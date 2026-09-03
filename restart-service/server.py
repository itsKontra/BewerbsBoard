#!/usr/bin/env python3
"""
Restart & Shutdown Web Service for Ubuntu / Linux
Serves a responsive control panel on a configurable port with system metrics,
reboot/shutdown controls, cancellation support, and systemd integration.
"""

import argparse
import base64
import json
import logging
import mimetypes
import os
import platform
import secrets
import signal
import socket
import subprocess
import sys
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional

# Maximum permitted payload size for JSON requests (64 KB)
MAX_PAYLOAD_SIZE = 65536

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("restart-service")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

DEFAULT_CONFIG: Dict[str, Any] = {
    "host": "0.0.0.0",
    "port": 8080,
    "auth_enabled": False,
    "username": "admin",
    "password": "changeme",
    "default_delay_seconds": 0,
    "allow_cancel": True,
    "dry_run": False,
    "reboot_command": "systemctl reboot",
    "shutdown_command": "systemctl poweroff",
    "cancel_command": "shutdown -c",
}


def load_config(custom_path: Optional[str] = None) -> Dict[str, Any]:
    """Load configuration from file, environment, or defaults."""
    config = dict(DEFAULT_CONFIG)

    # Search candidates
    candidates = []
    if custom_path:
        candidates.append(custom_path)
    if os.environ.get("CONFIG_PATH"):
        candidates.append(os.environ["CONFIG_PATH"])
    candidates.extend([
        "/etc/restart-service/config.json",
        os.path.join(BASE_DIR, "config.json"),
    ])

    for path in candidates:
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    file_config = json.load(f)
                    config.update(file_config)
                    logger.info("Loaded configuration from: %s", path)
                    break
            except Exception as e:
                logger.warning("Could not read configuration from %s: %s", path, e)

    # Environment variable overrides
    if "HOST" in os.environ:
        config["host"] = os.environ["HOST"]
    if "PORT" in os.environ:
        try:
            config["port"] = int(os.environ["PORT"])
        except ValueError:
            logger.warning("Invalid PORT environment variable. Keeping: %s", config["port"])
    if "DRY_RUN" in os.environ:
        config["dry_run"] = os.environ["DRY_RUN"].lower() in ("1", "true", "yes")
    if "AUTH_ENABLED" in os.environ:
        config["auth_enabled"] = os.environ["AUTH_ENABLED"].lower() in ("1", "true", "yes")
    if "AUTH_USERNAME" in os.environ:
        config["username"] = os.environ["AUTH_USERNAME"]
    if "AUTH_PASSWORD" in os.environ:
        config["password"] = os.environ["AUTH_PASSWORD"]

    # Auto-enable dry-run if not running as root on Linux or on non-Linux
    is_linux = sys.platform.startswith("linux")
    is_root = (os.geteuid() == 0) if hasattr(os, "geteuid") else False
    if not config["dry_run"] and (not is_linux or not is_root):
        logger.info("Non-root or non-Linux environment detected. Dry-run mode enabled for safety.")
        config["dry_run"] = True

    return config


class SystemState:
    """Manages scheduled system tasks and retrieves host telemetry."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.start_time = time.time()
        self.lock = threading.Lock()
        self.scheduled_action: Optional[Dict[str, Any]] = None
        self._timer: Optional[threading.Timer] = None

    def get_os_info(self) -> Dict[str, str]:
        """Get descriptive OS information."""
        pretty_name = f"{platform.system()} {platform.release()}"
        if sys.platform.startswith("linux") and os.path.exists("/etc/os-release"):
            try:
                with open("/etc/os-release", "r", encoding="utf-8") as f:
                    for line in f:
                        if line.startswith("PRETTY_NAME="):
                            pretty_name = line.strip().split("=", 1)[1].strip('"\']')
                            break
            except Exception:
                pass

        return {
            "hostname": socket.gethostname(),
            "os_name": pretty_name,
            "kernel": platform.release(),
            "architecture": platform.machine(),
            "python_version": platform.python_version(),
        }

    def get_uptime_seconds(self) -> float:
        """Get system uptime in seconds."""
        if sys.platform.startswith("linux") and os.path.exists("/proc/uptime"):
            try:
                with open("/proc/uptime", "r", encoding="utf-8") as f:
                    return float(f.readline().split()[0])
            except Exception:
                pass
        return time.time() - self.start_time

    def get_memory_info(self) -> Dict[str, Any]:
        """Get system memory statistics."""
        if sys.platform.startswith("linux") and os.path.exists("/proc/meminfo"):
            try:
                mem_total = 0
                mem_avail = 0
                with open("/proc/meminfo", "r", encoding="utf-8") as f:
                    for line in f:
                        parts = line.split(":")
                        if parts[0] == "MemTotal":
                            mem_total = int(parts[1].strip().split()[0]) * 1024
                        elif parts[0] == "MemAvailable":
                            mem_avail = int(parts[1].strip().split()[0]) * 1024
                if mem_total > 0:
                    used = mem_total - mem_avail
                    percent = round((used / mem_total) * 100, 1)
                    return {
                        "total_bytes": mem_total,
                        "available_bytes": mem_avail,
                        "used_bytes": used,
                        "used_percent": percent,
                    }
            except Exception:
                pass

        # Fallback values
        return {
            "total_bytes": 0,
            "available_bytes": 0,
            "used_bytes": 0,
            "used_percent": 0.0,
        }

    def get_cpu_info(self) -> Dict[str, Any]:
        """Get CPU load statistics."""
        load_avg = [0.0, 0.0, 0.0]
        if hasattr(os, "getloadavg"):
            try:
                load_avg = [round(x, 2) for x in os.getloadavg()]
            except Exception:
                pass
        return {
            "cores": os.cpu_count() or 1,
            "load_1m": load_avg[0],
            "load_5m": load_avg[1],
            "load_15m": load_avg[2],
        }

    def get_status(self) -> Dict[str, Any]:
        """Assemble complete system telemetry."""
        with self.lock:
            scheduled_info = None
            if self.scheduled_action:
                remaining = max(0.0, round(self.scheduled_action["execute_at"] - time.time(), 1))
                scheduled_info = {
                    "action": self.scheduled_action["action"],
                    "scheduled_at": self.scheduled_action["scheduled_at"],
                    "execute_at": self.scheduled_action["execute_at"],
                    "delay_seconds": self.scheduled_action["delay_seconds"],
                    "remaining_seconds": remaining,
                }

        return {
            "status": "online",
            "host": self.get_os_info(),
            "uptime_seconds": round(self.get_uptime_seconds(), 1),
            "service_uptime_seconds": round(time.time() - self.start_time, 1),
            "cpu": self.get_cpu_info(),
            "memory": self.get_memory_info(),
            "scheduled_action": scheduled_info,
            "dry_run": self.config["dry_run"],
            "allow_cancel": self.config["allow_cancel"],
            "server_time": time.time(),
        }

    def schedule_action(self, action: str, delay_seconds: int) -> Dict[str, Any]:
        """Schedule or immediately execute a reboot or shutdown."""
        if action not in ("restart", "shutdown"):
            raise ValueError(f"Invalid action: {action}")

        # Clamp delay to a reasonable range (0 to 24 hours)
        try:
            delay_seconds = max(0, min(86400, int(delay_seconds)))
        except (ValueError, TypeError):
            delay_seconds = self.config.get("default_delay_seconds", 0)

        with self.lock:
            # Cancel any existing scheduled action
            if self._timer and self._timer.is_alive():
                self._timer.cancel()
                self._timer = None

            execute_at = time.time() + delay_seconds
            self.scheduled_action = {
                "action": action,
                "scheduled_at": time.time(),
                "execute_at": execute_at,
                "delay_seconds": delay_seconds,
            }

            if delay_seconds == 0:
                # Immediate execution in background thread after sending response
                threading.Thread(target=self._execute_action_worker, args=(action, execute_at), daemon=True).start()
            else:
                self._timer = threading.Timer(delay_seconds, self._execute_action_worker, args=(action, execute_at))
                self._timer.daemon = True
                self._timer.start()

        logger.info("Scheduled action '%s' with delay of %s seconds.", action, delay_seconds)
        return {
            "success": True,
            "action": action,
            "delay_seconds": delay_seconds,
            "message": f"Action '{action}' scheduled in {delay_seconds} seconds.",
        }

    def cancel_action(self) -> Dict[str, Any]:
        """Cancel any currently pending action."""
        with self.lock:
            if not self.scheduled_action:
                return {"success": False, "message": "No action is currently scheduled."}

            cancelled_action = self.scheduled_action["action"]
            if self._timer and self._timer.is_alive():
                self._timer.cancel()
                self._timer = None

            self.scheduled_action = None

            # Also execute system cancel command if configured
            if not self.config["dry_run"]:
                cancel_cmd = self.config.get("cancel_command", "shutdown -c")
                try:
                    subprocess.run(cancel_cmd, shell=True, check=False)
                except Exception as e:
                    logger.warning("Cancel command failed: %s", e)

        logger.info("Cancelled scheduled action '%s'.", cancelled_action)
        return {
            "success": True,
            "cancelled_action": cancelled_action,
            "message": f"Action '{cancelled_action}' was successfully cancelled.",
        }

    def _execute_action_worker(self, action: str, scheduled_execute_at: float):
        """Worker that invokes system commands."""
        # Short pause to ensure response packet was flushed to the client
        time.sleep(0.5)

        with self.lock:
            # If the action was cancelled or replaced during the pause, abort
            if not self.scheduled_action or self.scheduled_action.get("execute_at") != scheduled_execute_at:
                logger.info("Action '%s' was cancelled prior to execution. Aborting worker.", action)
                return

        cmd = self.config["reboot_command"] if action == "restart" else self.config["shutdown_command"]
        dry_run = self.config["dry_run"]

        logger.warning(
            "EXECUTING HOST %s: command='%s' (dry_run=%s)",
            action.upper(),
            cmd,
            dry_run,
        )

        try:
            if dry_run:
                logger.info("[DRY RUN] Simulation complete. Host will NOT restart/shutdown.")
                return

            res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
            if res.returncode != 0:
                logger.error("Command failed with code %d: %s", res.returncode, res.stderr)
            else:
                logger.info("Command executed successfully: %s", res.stdout)
        except Exception as e:
            logger.error("Failed to execute command '%s': %s", cmd, e)
        finally:
            with self.lock:
                # Clear scheduled action if it matches the current action
                if self.scheduled_action and self.scheduled_action.get("execute_at") == scheduled_execute_at:
                    self.scheduled_action = None


class RequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for web interface and REST API."""

    system_state: SystemState
    config: Dict[str, Any]

    def log_message(self, format_str: str, *args: Any):
        """Custom logger to integrate with Python logging module."""
        logger.info("%s - %s", self.address_string(), format_str % args)

    def check_auth(self) -> bool:
        """Verify HTTP Basic Authentication if enabled."""
        if not self.config.get("auth_enabled", False):
            return True

        auth_header = self.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Basic "):
            self.send_response(HTTPStatus.UNAUTHORIZED)
            self.send_header("WWW-Authenticate", 'Basic realm="Restart Service"')
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Unauthorized"}).encode("utf-8"))
            return False

        try:
            encoded_cred = auth_header.split(" ", 1)[1].strip()
            decoded = base64.b64decode(encoded_cred).decode("utf-8")
            username, password = decoded.split(":", 1)
            expected_username = str(self.config.get("username", ""))
            expected_password = str(self.config.get("password", ""))

            # Constant-time comparison to prevent timing attacks
            valid_user = secrets.compare_digest(username, expected_username)
            valid_pass = secrets.compare_digest(password, expected_password)
            if valid_user and valid_pass:
                return True
        except Exception:
            pass

        self.send_response(HTTPStatus.UNAUTHORIZED)
        self.send_header("WWW-Authenticate", 'Basic realm="Restart Service"')
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": "Invalid credentials"}).encode("utf-8"))
        return False

    def send_json(self, data: Any, status: HTTPStatus = HTTPStatus.OK):
        """Send JSON response."""
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.end_headers()
        self.wfile.write(body)

    def parse_json_body(self) -> Dict[str, Any]:
        """Read and parse incoming JSON payload with size limits."""
        try:
            content_len = int(self.headers.get("Content-Length", 0))
        except (ValueError, TypeError):
            content_len = 0

        if content_len <= 0:
            return {}

        if content_len > MAX_PAYLOAD_SIZE:
            raise ValueError(f"Payload size exceeds maximum allowed ({MAX_PAYLOAD_SIZE} bytes)")

        raw = self.rfile.read(content_len).decode("utf-8")
        if not raw.strip():
            return {}
        return json.loads(raw)

    def do_GET(self):
        """Handle GET requests for static assets and API endpoints."""
        if not self.check_auth():
            return

        path = self.path.split("?", 1)[0]

        if path == "/api/status":
            self.send_json(self.system_state.get_status())
            return

        if path == "/api/ping":
            self.send_json({"status": "ok", "timestamp": time.time()})
            return

        # Serve static assets
        if path == "/" or path == "/index.html":
            file_path = os.path.join(STATIC_DIR, "index.html")
        elif path == "/favicon.ico":
            file_path = os.path.join(STATIC_DIR, "favicon.svg")
        else:
            rel_path = path.lstrip("/")
            file_path = os.path.join(STATIC_DIR, rel_path)

        # Path traversal protection
        try:
            file_path = os.path.abspath(file_path)
            if not os.path.commonpath([STATIC_DIR, file_path]) == STATIC_DIR:
                self.send_error(HTTPStatus.FORBIDDEN, "Access denied")
                return
        except Exception:
            self.send_error(HTTPStatus.FORBIDDEN, "Invalid path")
            return

        if os.path.isfile(file_path):
            content_type, _ = mimetypes.guess_type(file_path)
            if content_type is None:
                content_type = "application/octet-stream"

            try:
                with open(file_path, "rb") as f:
                    content = f.read()

                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", f"{content_type}; charset=utf-8" if "text" in content_type or "javascript" in content_type else content_type)
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                logger.error("Error reading file %s: %s", file_path, e)
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "File read error")
        else:
            self.send_error(HTTPStatus.NOT_FOUND, "Resource not found")

    def do_POST(self):
        """Handle POST actions for restart, shutdown, and cancel."""
        if not self.check_auth():
            return

        path = self.path.split("?", 1)[0]

        try:
            payload = self.parse_json_body()
        except Exception as e:
            self.send_json({"error": f"Malformed JSON: {e}"}, status=HTTPStatus.BAD_REQUEST)
            return

        delay = payload.get("delay", self.config.get("default_delay_seconds", 0))

        if path == "/api/restart":
            try:
                res = self.system_state.schedule_action("restart", delay)
                self.send_json(res)
            except Exception as e:
                self.send_json({"error": str(e)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        if path == "/api/shutdown":
            try:
                res = self.system_state.schedule_action("shutdown", delay)
                self.send_json(res)
            except Exception as e:
                self.send_json({"error": str(e)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        if path == "/api/cancel":
            res = self.system_state.cancel_action()
            self.send_json(res)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")


def create_server(host: str, port: int, cfg: Dict[str, Any]) -> ThreadingHTTPServer:
    """Factory to instantiate the HTTP server."""
    state = SystemState(cfg)

    class CustomHandler(RequestHandler):
        pass

    CustomHandler.system_state = state
    CustomHandler.config = cfg

    server = ThreadingHTTPServer((host, port), CustomHandler)
    return server


def main():
    """Command line entrypoint."""
    parser = argparse.ArgumentParser(description="Ubuntu Host Restart & Shutdown Web Service")
    parser.add_argument("-p", "--port", type=int, help="Port to bind (default: 8080 or config)")
    parser.add_argument("-H", "--host", type=str, help="Host address to bind (default: 0.0.0.0 or config)")
    parser.add_argument("-c", "--config", type=str, help="Path to config.json file")
    parser.add_argument("--dry-run", action="store_true", help="Simulate reboot/shutdown commands without executing them")
    parser.add_argument("--auth", action="store_true", help="Enforce Basic Authentication")
    parser.add_argument("--delay", type=int, help="Default countdown delay in seconds")

    args = parser.parse_args()

    # Load configuration
    config = load_config(args.config)

    if args.port:
        config["port"] = args.port
    if args.host:
        config["host"] = args.host
    if args.dry_run:
        config["dry_run"] = True
    if args.auth:
        config["auth_enabled"] = True
    if args.delay is not None:
        config["default_delay_seconds"] = args.delay

    host = config["host"]
    port = config["port"]

    try:
        server = create_server(host, port, config)
    except OSError as e:
        logger.critical("Could not bind to %s:%s: %s", host, port, e)
        sys.exit(1)

    logger.info("==================================================")
    logger.info(" Restart & Shutdown Web Service")
    logger.info(" Listening on: http://%s:%s", "localhost" if host == "0.0.0.0" else host, port)
    logger.info(" Dry-run mode: %s", config["dry_run"])
    logger.info(" Auth enabled: %s", config["auth_enabled"])
    logger.info(" Default delay: %s seconds", config["default_delay_seconds"])
    logger.info("==================================================")

    def handle_signal(sig, frame):
        logger.info("Shutdown signal received. Stopping server...")
        threading.Thread(target=server.shutdown).start()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        logger.info("Server terminated cleanly.")


if __name__ == "__main__":
    main()
