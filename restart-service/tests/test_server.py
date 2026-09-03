#!/usr/bin/env python3
"""
Automated Test Suite for Host Restart & Shutdown Web Service
Tests configuration parsing, telemetry aggregation, action scheduling/cancellation,
HTTP endpoints, path traversal security, and authentication.
"""

import base64
import json
import os
import socket
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request

# Ensure workspace root is in python path
WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, WORKSPACE_DIR)

import server


def find_free_port() -> int:
    """Find an available ephemeral port for testing."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class TestConfigAndState(unittest.TestCase):
    """Test configuration loading and system state logic."""

    def test_default_config(self):
        config = server.load_config()
        self.assertIn("port", config)
        self.assertIn("host", config)
        self.assertIn("dry_run", config)
        self.assertIn("reboot_command", config)
        self.assertIn("shutdown_command", config)

    def test_env_var_override(self):
        os.environ["PORT"] = "9999"
        os.environ["HOST"] = "127.0.0.1"
        try:
            config = server.load_config()
            self.assertEqual(config["port"], 9999)
            self.assertEqual(config["host"], "127.0.0.1")
        finally:
            del os.environ["PORT"]
            del os.environ["HOST"]

    def test_system_state_telemetry(self):
        config = server.DEFAULT_CONFIG.copy()
        config["dry_run"] = True
        state = server.SystemState(config)

        status = state.get_status()
        self.assertEqual(status["status"], "online")
        self.assertIn("host", status)
        self.assertIn("hostname", status["host"])
        self.assertIn("uptime_seconds", status)
        self.assertIn("cpu", status)
        self.assertIn("memory", status)
        self.assertIsNone(status["scheduled_action"])

    def test_scheduling_and_cancellation(self):
        config = server.DEFAULT_CONFIG.copy()
        config["dry_run"] = True
        state = server.SystemState(config)

        # Schedule action with 10s delay
        res = state.schedule_action("restart", delay_seconds=10)
        self.assertTrue(res["success"])
        self.assertEqual(res["action"], "restart")

        # Verify state is updated
        status = state.get_status()
        self.assertIsNotNone(status["scheduled_action"])
        self.assertEqual(status["scheduled_action"]["action"], "restart")
        self.assertGreater(status["scheduled_action"]["remaining_seconds"], 0)

        # Cancel action
        cancel_res = state.cancel_action()
        self.assertTrue(cancel_res["success"])

        # Verify state is cleared
        status_after = state.get_status()
        self.assertIsNone(status_after["scheduled_action"])


class TestHttpServer(unittest.TestCase):
    """Integration tests running against active HTTP server instance."""

    @classmethod
    def setUpClass(cls):
        cls.port = find_free_port()
        cls.config = server.DEFAULT_CONFIG.copy()
        cls.config["port"] = cls.port
        cls.config["host"] = "127.0.0.1"
        cls.config["dry_run"] = True
        cls.config["auth_enabled"] = False

        cls.httpd = server.create_server("127.0.0.1", cls.port, cls.config)
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.3)  # Allow server to bind

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def get_url(self, path: str) -> str:
        return f"http://127.0.0.1:{self.port}{path}"

    def test_get_index_html(self):
        req = urllib.request.Request(self.get_url("/"))
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn("text/html", resp.headers.get("Content-Type", ""))
            content = resp.read().decode("utf-8")
            self.assertIn("Host Power Control", content)
            self.assertIn("btn-restart", content)
            self.assertIn("btn-shutdown", content)

    def test_get_static_assets(self):
        for path, expected_type in [("/style.css", "text/css"), ("/app.js", "javascript"), ("/favicon.ico", "svg")]:
            req = urllib.request.Request(self.get_url(path))
            with urllib.request.urlopen(req) as resp:
                self.assertEqual(resp.status, 200)
                self.assertIn(expected_type, resp.headers.get("Content-Type", ""))

    def test_api_ping(self):
        req = urllib.request.Request(self.get_url("/api/ping"))
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data.get("status"), "ok")

    def test_api_status(self):
        req = urllib.request.Request(self.get_url("/api/status"))
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "online")
            self.assertTrue(data["dry_run"])
            self.assertIn("hostname", data["host"])

    def test_api_restart_and_cancel_lifecycle(self):
        # Trigger restart with 20s delay
        data = json.dumps({"delay": 20}).encode("utf-8")
        req = urllib.request.Request(
            self.get_url("/api/restart"),
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            res = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(res["success"])
            self.assertEqual(res["action"], "restart")

        # Verify status endpoint reflects scheduled action
        req_status = urllib.request.Request(self.get_url("/api/status"))
        with urllib.request.urlopen(req_status) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIsNotNone(data["scheduled_action"])
            self.assertEqual(data["scheduled_action"]["action"], "restart")

        # Cancel action
        cancel_req = urllib.request.Request(
            self.get_url("/api/cancel"),
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(cancel_req) as resp:
            self.assertEqual(resp.status, 200)
            res = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(res["success"])

        # Verify cleared
        with urllib.request.urlopen(req_status) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIsNone(data["scheduled_action"])

    def test_api_shutdown_immediate(self):
        data = json.dumps({"delay": 0}).encode("utf-8")
        req = urllib.request.Request(
            self.get_url("/api/shutdown"),
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            res = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(res["success"])
            self.assertEqual(res["action"], "shutdown")

    def test_malformed_json_payload(self):
        req = urllib.request.Request(
            self.get_url("/api/restart"),
            data=b"invalid json {{{",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                self.assertEqual(resp.status, 400)
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 400)

    def test_large_payload_rejected(self):
        huge_data = json.dumps({"delay": 5, "padding": "x" * 70000}).encode("utf-8")
        req = urllib.request.Request(
            self.get_url("/api/restart"),
            data=huge_data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                self.assertEqual(resp.status, 400)
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 400)

    def test_unknown_post_endpoint(self):
        req = urllib.request.Request(
            self.get_url("/api/unknown_endpoint"),
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                self.fail("Expected 404")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 404)

    def test_path_traversal_protection(self):
        # Attempt to access file outside static directory
        try:
            req = urllib.request.Request(self.get_url("/../server.py"))
            with urllib.request.urlopen(req) as resp:
                # Should not return 200 OK
                self.assertNotEqual(resp.status, 200)
        except urllib.error.HTTPError as e:
            self.assertIn(e.code, [403, 404])


class TestHttpServerWithAuth(unittest.TestCase):
    """Test Basic Authentication enforcement."""

    @classmethod
    def setUpClass(cls):
        cls.port = find_free_port()
        cls.config = server.DEFAULT_CONFIG.copy()
        cls.config["port"] = cls.port
        cls.config["host"] = "127.0.0.1"
        cls.config["dry_run"] = True
        cls.config["auth_enabled"] = True
        cls.config["username"] = "admin"
        cls.config["password"] = "secret123"

        cls.httpd = server.create_server("127.0.0.1", cls.port, cls.config)
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def get_url(self, path: str) -> str:
        return f"http://127.0.0.1:{self.port}{path}"

    def test_unauthorized_request_rejected(self):
        req = urllib.request.Request(self.get_url("/api/status"))
        try:
            with urllib.request.urlopen(req) as resp:
                self.fail("Expected HTTPError 401, but succeeded")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 401)
            self.assertIn("Basic", e.headers.get("WWW-Authenticate", ""))

    def test_authorized_request_accepted(self):
        auth_val = base64.b64encode(b"admin:secret123").decode("utf-8")
        req = urllib.request.Request(
            self.get_url("/api/status"),
            headers={"Authorization": f"Basic {auth_val}"}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "online")


if __name__ == "__main__":
    unittest.main()
