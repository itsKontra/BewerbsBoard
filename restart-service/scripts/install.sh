#!/usr/bin/env bash
set -e

# ==============================================================================
# Ubuntu Host Restart & Shutdown Web Service - Installer
# ==============================================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}  Installing Host Restart & Shutdown Web Service     ${NC}"
echo -e "${GREEN}======================================================${NC}"

# Check for root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root.${NC}"
  echo "Please run: sudo bash $0"
  exit 1
fi

# Check for Python 3
if ! command -v python3 &> /dev/null; then
  echo -e "${YELLOW}Python 3 not found. Installing python3 via apt...${NC}"
  apt-get update && apt-get install -y python3
fi

INSTALL_DIR="/opt/restart-service"
CONFIG_DIR="/etc/restart-service"
SYSTEMD_FILE="/etc/systemd/system/restart-service.service"

# Determine script source directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Desired port from argument or environment variable, defaulting to 8080
TARGET_PORT="${1:-${PORT:-8080}}"

# Validate port number
if ! [[ "$TARGET_PORT" =~ ^[0-9]+$ ]] || [ "$TARGET_PORT" -lt 1 ] || [ "$TARGET_PORT" -gt 65535 ]; then
  echo -e "${RED}Error: Port '$TARGET_PORT' must be a valid integer between 1 and 65535.${NC}"
  exit 1
fi

echo -e "Target Port: ${GREEN}${TARGET_PORT}${NC}"
echo -e "Installing application files to ${INSTALL_DIR}..."

mkdir -p "${INSTALL_DIR}"
mkdir -p "${CONFIG_DIR}"

# Copy server and static files
cp -r "${SCRIPT_DIR}/server.py" "${INSTALL_DIR}/"
cp -r "${SCRIPT_DIR}/static" "${INSTALL_DIR}/"
chmod +x "${INSTALL_DIR}/server.py"

# Configure configuration file
if [ ! -f "${CONFIG_DIR}/config.json" ]; then
  echo "Creating default configuration at ${CONFIG_DIR}/config.json..."
  cat > "${CONFIG_DIR}/config.json" << EOF
{
  "host": "0.0.0.0",
  "port": ${TARGET_PORT},
  "auth_enabled": false,
  "username": "admin",
  "password": "changeme_to_secure_password",
  "default_delay_seconds": 5,
  "allow_cancel": true,
  "dry_run": false,
  "reboot_command": "systemctl reboot",
  "shutdown_command": "systemctl poweroff",
  "cancel_command": "shutdown -c"
}
EOF
  chmod 600 "${CONFIG_DIR}/config.json"
else
  echo -e "${YELLOW}Existing config found at ${CONFIG_DIR}/config.json. Keeping it intact.${NC}"
fi

# Install systemd service unit
echo "Installing systemd unit..."
cp "${SCRIPT_DIR}/systemd/restart-service.service" "${SYSTEMD_FILE}"

# Reload systemd and start service
echo "Configuring and starting systemd service..."
systemctl daemon-reload
systemctl enable restart-service.service
systemctl restart restart-service.service

# Check status
if systemctl is-active --quiet restart-service.service; then
  echo -e "\n${GREEN}Service successfully installed and started!${NC}"
else
  echo -e "\n${RED}Warning: Service is not active. Checking status:${NC}"
  systemctl status restart-service.service --no-pager
  exit 1
fi

# Detect IP address
PRIMARY_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")
PORT_USED=$(grep '"port"' "${CONFIG_DIR}/config.json" | grep -o '[0-9]\+' || echo "${TARGET_PORT}")

echo -e "\n${GREEN}Access the web interface at:${NC}"
echo -e "  Local:   http://localhost:${PORT_USED}"
echo -e "  Network: http://${PRIMARY_IP}:${PORT_USED}"
echo -e "\nConfiguration file: ${CONFIG_DIR}/config.json"
echo -e "Service logs:       journalctl -u restart-service -f"
echo -e "Manage service:     systemctl [start|stop|restart|status] restart-service"
echo -e "${GREEN}======================================================${NC}"
