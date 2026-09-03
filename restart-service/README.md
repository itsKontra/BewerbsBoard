# Ubuntu Host Restart & Shutdown Web Service

A lightweight, zero-dependency web service designed for Ubuntu / Linux systems that serves a modern web interface on a configurable port to safely restart or shut down the host machine.

---

## Features

- **Reboot & Shutdown Controls**: Trigger instant or delayed host restarts and shutdowns via dedicated actions.
- **Safety First**: Native `<dialog>` confirmation modals prevent accidental clicks. Includes an active countdown overlay with a **Cancel** button during delay periods.
- **Live System Telemetry**: Displays live CPU load averages, memory utilization, hostname, kernel version, and system uptime.
- **Auto Reconnect Detection**: Pings the host during reboots and automatically reloads when the service returns online.
- **Zero External Dependencies**: Built with Python 3's standard library (`http.server.ThreadingHTTPServer`). Runs on Ubuntu 20.04, 22.04, and 24.04 out-of-the-box without `pip install` or package conflicts.
- **Configurable Port & Host**: Configure via configuration file (`/etc/restart-service/config.json`), CLI arguments (`--port`, `--host`), or environment variables (`PORT`, `HOST`).
- **Optional Authentication**: Supports HTTP Basic Authentication for protected access.
- **Systemd Integration**: Includes systemd unit file and automated installer/uninstaller scripts.
- **Safe Dry-Run Mode**: Automatically simulates actions when running on non-Linux platforms or without root privileges.

---

## Quick Start (Automated Ubuntu Installation)

Clone or copy the repository onto your Ubuntu server and run the installer:

```bash
# Clone or navigate to the directory
cd restart-service

# Run the installer (specify port as argument, defaults to 8080)
sudo bash scripts/install.sh 8080
```

The script performs the following:
1. Copies application files to `/opt/restart-service/`.
2. Generates configuration at `/etc/restart-service/config.json`.
3. Installs and registers the systemd unit `/etc/systemd/system/restart-service.service`.
4. Enables and starts the service automatically.
5. Prints the accessible web address (e.g. `http://<SERVER_IP>:8080`).

---

## Manual Installation on Ubuntu

### 1. Copy Files
```bash
sudo mkdir -p /opt/restart-service /etc/restart-service
sudo cp server.py /opt/restart-service/
sudo cp -r static /opt/restart-service/
sudo cp config.json.example /etc/restart-service/config.json
sudo chmod +x /opt/restart-service/server.py
```

### 2. Configure Port & Settings
Edit `/etc/restart-service/config.json`:
```json
{
  "host": "0.0.0.0",
  "port": 8080,
  "auth_enabled": false,
  "username": "admin",
  "password": "changeme",
  "default_delay_seconds": 5,
  "allow_cancel": true,
  "dry_run": false
}
```

### 3. Install and Start Systemd Unit
```bash
sudo cp systemd/restart-service.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now restart-service.service
```

### 4. Check Status
```bash
sudo systemctl status restart-service.service
```

---

## Configuration Reference

Configuration is resolved with the following priority:
1. **CLI Flags**: `--port 9000`, `--host 0.0.0.0`, `--dry-run`, `--auth`, `--delay 10`, `--config /path/to/config.json`
2. **Environment Variables**: `PORT`, `HOST`, `DRY_RUN`, `AUTH_ENABLED`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `CONFIG_PATH`
3. **Configuration File**: `/etc/restart-service/config.json` or `./config.json`
4. **Defaults**: Port `8080`, Host `0.0.0.0`, Delay `5s`, Auth disabled

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `host` | String | `"0.0.0.0"` | Network interface to bind (`0.0.0.0` for all interfaces) |
| `port` | Number | `8080` | Port to serve the web interface on |
| `auth_enabled` | Boolean | `false` | Enable HTTP Basic Authentication |
| `username` | String | `"admin"` | Username when authentication is enabled |
| `password` | String | `"changeme"` | Password when authentication is enabled |
| `default_delay_seconds` | Number | `5` | Default delay in seconds before executing restart/shutdown |
| `allow_cancel` | Boolean | `true` | Allow cancelling actions during the grace period |
| `dry_run` | Boolean | `false` | Simulate commands without executing system reboot/shutdown |
| `reboot_command` | String | `"systemctl reboot"` | Command executed to reboot the system |
| `shutdown_command` | String | `"systemctl poweroff"` | Command executed to power off the system |
| `cancel_command` | String | `"shutdown -c"` | Command executed to cancel scheduled system shutdown |

---

## Running Locally / Development Mode

You can run the server directly without installing to `/opt`:

```bash
# Run with custom port and simulated execution
python3 server.py --port 8080 --dry-run
```

Open `http://localhost:8080` in your web browser.

---

## API Reference

All API actions accept and return `application/json`.

### `GET /api/status`
Returns host telemetry, hardware utilization, and current scheduled action state.
```json
{
  "status": "online",
  "host": {
    "hostname": "ubuntu-server",
    "os_name": "Ubuntu 24.04 LTS",
    "kernel": "6.8.0-31-generic",
    "architecture": "x86_64",
    "python_version": "3.12.3"
  },
  "uptime_seconds": 184520.4,
  "service_uptime_seconds": 3600.2,
  "cpu": {
    "cores": 4,
    "load_1m": 0.12,
    "load_5m": 0.08,
    "load_15m": 0.05
  },
  "memory": {
    "total_bytes": 16777216000,
    "available_bytes": 12582912000,
    "used_bytes": 4194304000,
    "used_percent": 25.0
  },
  "scheduled_action": null,
  "dry_run": false,
  "allow_cancel": true,
  "server_time": 1787850240.0
}
```

### `POST /api/restart`
Initiates a host restart.
```bash
curl -X POST http://localhost:8080/api/restart \
  -H "Content-Type: application/json" \
  -d '{"delay": 10}'
```

### `POST /api/shutdown`
Initiates a host shutdown.
```bash
curl -X POST http://localhost:8080/api/shutdown \
  -H "Content-Type: application/json" \
  -d '{"delay": 10}'
```

### `POST /api/cancel`
Cancels an ongoing countdown for a scheduled restart or shutdown.
```bash
curl -X POST http://localhost:8080/api/cancel \
  -H "Content-Type: application/json"
```

### `GET /api/ping`
Lightweight heartbeat endpoint for uptime checks.
```bash
curl http://localhost:8080/api/ping
# {"status": "ok", "timestamp": 1787850240.0}
```

---

## Service Management Commands

```bash
# View live logs
sudo journalctl -u restart-service -f

# Restart the service daemon
sudo systemctl restart restart-service

# Stop the service daemon
sudo systemctl stop restart-service

# Check service status
sudo systemctl status restart-service
```

---

## Firewall Setup (Optional)

If `ufw` is active on your Ubuntu host, allow traffic on your configured port:

```bash
sudo ufw allow 8080/tcp
```

---

## Uninstallation

To remove the service and all installed files:

```bash
sudo bash scripts/uninstall.sh
```

---

## Running the Automated Test Suite

```bash
python3 -m unittest discover -s tests -p "test_*.py" -v
```
