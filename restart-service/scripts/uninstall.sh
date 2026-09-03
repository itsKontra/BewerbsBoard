#!/usr/bin/env bash
set -e

# ==============================================================================
# Ubuntu Host Restart & Shutdown Web Service - Uninstaller
# ==============================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${RED}======================================================${NC}"
echo -e "${RED}  Uninstalling Host Restart & Shutdown Web Service   ${NC}"
echo -e "${RED}======================================================${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root.${NC}"
  echo "Please run: sudo bash $0"
  exit 1
fi

INSTALL_DIR="/opt/restart-service"
CONFIG_DIR="/etc/restart-service"
SYSTEMD_FILE="/etc/systemd/system/restart-service.service"

echo "Stopping and disabling systemd service..."
systemctl stop restart-service.service 2>/dev/null || true
systemctl disable restart-service.service 2>/dev/null || true

if [ -f "${SYSTEMD_FILE}" ]; then
  echo "Removing systemd service file..."
  rm -f "${SYSTEMD_FILE}"
  systemctl daemon-reload
  systemctl reset-failed 2>/dev/null || true
fi

if [ -d "${INSTALL_DIR}" ]; then
  echo "Removing application directory ${INSTALL_DIR}..."
  rm -rf "${INSTALL_DIR}"
fi

read -p "Do you also want to remove configuration at ${CONFIG_DIR}? (y/N): " -r CONFIRM
if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Removing ${CONFIG_DIR}..."
  rm -rf "${CONFIG_DIR}"
else
  echo "Preserving configuration files in ${CONFIG_DIR}."
fi

echo -e "\n${GREEN}Uninstallation complete!${NC}"
echo -e "${RED}======================================================${NC}"
