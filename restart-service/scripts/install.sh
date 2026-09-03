#!/usr/bin/env bash
# ==============================================================================
# BewerbsBoard — Host Restart & Shutdown Web Service Installer
# ==============================================================================
# Installs the host power management daemon, generates configuration, registers
# the systemd service unit, and verifies daemon health.
# ==============================================================================

set -euo pipefail

# Terminal colors & styling with fallback
if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1); CYAN=$(tput setaf 6)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""; CYAN=""
fi

show_help() {
  cat << EOF
${BOLD}BewerbsBoard Host Restart & Shutdown Service — Installer${RESET}

${BOLD}USAGE:${RESET}
  sudo bash install.sh [PORT]
  sudo bash install.sh --port <PORT>

${BOLD}ARGUMENTS:${RESET}
  PORT                 TCP port to bind the service to (default: 8080)

${BOLD}OPTIONS:${RESET}
  -p, --port <PORT>    Specify the target HTTP port
  -h, --help           Show this help message and exit

${BOLD}ENVIRONMENT VARIABLES:${RESET}
  PORT                 Fallback port if not provided as argument

${BOLD}EXAMPLES:${RESET}
  sudo bash install.sh
  sudo bash install.sh 9000
  sudo bash install.sh --port 8088
EOF
}

# Target file paths
INSTALL_DIR="/opt/restart-service"
CONFIG_DIR="/etc/restart-service"
CONFIG_FILE="${CONFIG_DIR}/config.json"
SYSTEMD_FILE="/etc/systemd/system/restart-service.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Parse arguments
TARGET_PORT="${PORT:-8080}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    -p|--port)
      if [[ -z "${2:-}" ]]; then
        echo "${RED}Error: --port requires a numerical port argument.${RESET}" >&2
        exit 1
      fi
      TARGET_PORT="$2"
      shift 2
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        TARGET_PORT="$1"
        shift
      else
        echo "${RED}Error: Unknown argument '$1'. Run with --help for usage.${RESET}" >&2
        exit 1
      fi
      ;;
  esac
done

# Validate port number
if ! [[ "$TARGET_PORT" =~ ^[0-9]+$ ]] || [ "$TARGET_PORT" -lt 1 ] || [ "$TARGET_PORT" -gt 65535 ]; then
  echo "${RED}Error: Target port '$TARGET_PORT' is invalid. Must be between 1 and 65535.${RESET}" >&2
  exit 1
fi

echo ""
echo "${BOLD}${CYAN}──────────────────────────────────────────────────────────────────${RESET}"
echo "${BOLD}${CYAN}  🚒 BewerbsBoard — Host Power Management Service Installer       ${RESET}"
echo "${BOLD}${CYAN}──────────────────────────────────────────────────────────────────${RESET}"
echo ""

# Verify root privileges
if [ "$EUID" -ne 0 ]; then
  echo "${RED}${BOLD}Error: Root privileges required.${RESET}" >&2
  echo "This installer configures /opt, /etc, and systemd units."
  echo "Please re-run using: ${BOLD}sudo bash $0${RESET}"
  exit 1
fi

# Verify Python 3
if ! command -v python3 >/dev/null 2>&1; then
  echo "${YELLOW}Python 3 is not installed. Installing python3 via apt...${RESET}"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y python3
  else
    echo "${RED}Error: Could not install python3 automatically. Please install Python 3.8+ manually.${RESET}" >&2
    exit 1
  fi
fi

PYTHON_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "unknown")
echo "  • Detected Python version: ${BOLD}${PYTHON_VER}${RESET}"

# Verify systemctl
if ! command -v systemctl >/dev/null 2>&1; then
  echo "${YELLOW}Warning: 'systemctl' command not found. This host may not be using systemd (e.g. Docker container).${RESET}"
  echo "Application files will be installed, but service daemon cannot be registered."
  SKIP_SYSTEMD=true
else
  SKIP_SYSTEMD=false
fi

# Step 1: Install application files
echo "  • Installing application files to ${BOLD}${INSTALL_DIR}${RESET}..."
install -d -m 755 "${INSTALL_DIR}"
install -d -m 755 "${CONFIG_DIR}"

install -m 755 "${SCRIPT_DIR}/server.py" "${INSTALL_DIR}/server.py"
rm -rf "${INSTALL_DIR}/static"
cp -r "${SCRIPT_DIR}/static" "${INSTALL_DIR}/static"

# Step 2: Provision Configuration
if [ ! -f "${CONFIG_FILE}" ]; then
  echo "  • Generating default configuration at ${BOLD}${CONFIG_FILE}${RESET} (Port: ${GREEN}${TARGET_PORT}${RESET})..."
  if [ -f "${SCRIPT_DIR}/config.json.example" ]; then
    # Clone template and update port
    sed "s/\"port\": [0-9]*/\"port\": ${TARGET_PORT}/" "${SCRIPT_DIR}/config.json.example" > "${CONFIG_FILE}"
  else
    cat > "${CONFIG_FILE}" << EOF
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
  fi
  chmod 600 "${CONFIG_FILE}"
else
  echo "  • ${YELLOW}Existing configuration found at ${CONFIG_FILE}.${RESET} Preserving current settings."
fi

# Step 3: Register and start systemd service
if [ "$SKIP_SYSTEMD" = false ]; then
  echo "  • Registering systemd service unit ${BOLD}${SYSTEMD_FILE}${RESET}..."
  install -m 644 "${SCRIPT_DIR}/systemd/restart-service.service" "${SYSTEMD_FILE}"

  echo "  • Reloading systemd manager and starting service..."
  systemctl daemon-reload
  systemctl enable restart-service.service
  systemctl restart restart-service.service

  # Step 4: Health check
  echo "  • Verifying daemon activity..."
  sleep 1
  if systemctl is-active --quiet restart-service.service; then
    echo "  • ${GREEN}${BOLD}✓ Service is active and running!${RESET}"
  else
    echo "  • ${RED}${BOLD}✗ Service failed to activate. Inspecting journal logs:${RESET}"
    systemctl status restart-service.service --no-pager || true
    exit 1
  fi
fi

# Detect network IP address
PRIMARY_IP=$(hostname -I 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i !~ /^127\./ && $i !~ /^172\.(1[6-9]|2[0-9]|3[0-1])\./ && $i !~ /^10\.89\./) {print $i; exit}}' || echo "")
if [ -z "$PRIMARY_IP" ]; then
  PRIMARY_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")
fi

ACTIVE_PORT=$(grep '"port"' "${CONFIG_FILE}" 2>/dev/null | grep -o '[0-9]\+' || echo "${TARGET_PORT}")

echo ""
echo "${BOLD}${GREEN}==================================================================${RESET}"
echo "${BOLD}${GREEN}  ✓ Installation Completed Successfully!                         ${RESET}"
echo "${BOLD}${GREEN}==================================================================${RESET}"
echo ""
echo "  ${BOLD}Web Control Panel:${RESET}"
echo "    Local:   ${CYAN}http://localhost:${ACTIVE_PORT}${RESET}"
echo "    Network: ${CYAN}http://${PRIMARY_IP}:${ACTIVE_PORT}${RESET}"
echo ""
echo "  ${BOLD}Configuration & Files:${RESET}"
echo "    Config:  ${CONFIG_FILE}"
echo "    Files:   ${INSTALL_DIR}/"
echo ""
echo "  ${BOLD}Service Management Commands:${RESET}"
echo "    Live logs:       ${BOLD}sudo journalctl -u restart-service -f${RESET}"
echo "    Service status:  ${BOLD}sudo systemctl status restart-service${RESET}"
echo "    Restart daemon:  ${BOLD}sudo systemctl restart restart-service${RESET}"
echo "    Stop daemon:     ${BOLD}sudo systemctl stop restart-service${RESET}"
echo "    Uninstall:       ${BOLD}sudo bash ${SCRIPT_DIR}/scripts/uninstall.sh${RESET}"
echo ""
echo "${DIM}Documentation: docs/restart-service.md${RESET}"
echo ""
