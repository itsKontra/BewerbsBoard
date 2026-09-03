# ⚡ BewerbsBoard Host Restart & Shutdown Service

A lightweight, zero-dependency background daemon and web control panel designed for Linux / Ubuntu host machines. Provides safe, authenticated remote reboot, poweroff, cancellation, and live system telemetry over LAN.

> 📖 **Full Documentation**: For exhaustive architecture diagrams, REST API endpoints, security mechanisms, and configuration details, see **[docs/restart-service.md](../docs/restart-service.md)**.

---

## 🚀 Quick Start

### Automated Installation (Ubuntu / Debian / Raspberry Pi OS)

```bash
# Run the installer with optional port (defaults to 8080)
sudo bash scripts/install.sh 8080
```

Once started, access the web control panel at:
- **Local**: `http://localhost:8080`
- **Network**: `http://<SERVER_IP>:8080`

### Local Development / Dry-Run

You can run the service locally without installing system files or needing root:

```bash
python3 server.py --port 8080 --dry-run
```

### Running Tests

```bash
python3 -m unittest discover -s tests -p "test_*.py" -v
```

---

## 📁 Directory Overview

- [`server.py`](server.py): Zero-dependency Python 3 HTTP server (`ThreadingHTTPServer`) and system telemetry collector.
- [`static/`](static/): Beautiful single-page control interface (`index.html`, `style.css`, `app.js`, `favicon.svg`).
- [`scripts/install.sh`](scripts/install.sh): Interactive/unattended installer script for systemd.
- [`scripts/uninstall.sh`](scripts/uninstall.sh): Clean uninstaller script.
- [`systemd/restart-service.service`](systemd/restart-service.service): Production systemd unit file.
- [`tests/test_server.py`](tests/test_server.py): Comprehensive unit and integration test suite.
- [`config.json.example`](config.json.example): Configuration template.
