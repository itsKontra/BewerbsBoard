#!/usr/bin/env bash
# ==============================================================================
# BewerbsBoard — Host Restart & Shutdown Web Service Uninstaller
# ==============================================================================
# Safely stops the daemon, disables and removes the systemd unit, and cleans up
# application files and optional configuration.
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
${BOLD}BewerbsBoard Host Restart & Shutdown Service — Uninstaller${RESET}

${BOLD}USAGE:${RESET}
  sudo bash uninstall.sh [OPTIONS]

${BOLD}OPTIONS:${RESET}
  -f, --force          Non-interactive mode (preserves configuration files)
  -p, --purge          Non-interactive mode and purges configuration (/etc/restart-service)
  -h, --help           Show this help message and exit

${BOLD}EXAMPLES:${RESET}
  sudo bash uninstall.sh
  sudo bash uninstall.sh --purge
EOF
}

FORCE=false
PURGE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    -f|--force)
      FORCE=true
      shift
      ;;
    -p|--purge)
      FORCE=true
      PURGE=true
      shift
      ;;
    *)
      echo "${RED}Error: Unknown argument '$1'. Run with --help for usage.${RESET}" >&2
      exit 1
      ;;
  esac
done

INSTALL_DIR="/opt/restart-service"
CONFIG_DIR="/etc/restart-service"
SYSTEMD_FILE="/etc/systemd/system/restart-service.service"

echo ""
echo "${BOLD}${RED}──────────────────────────────────────────────────────────────────${RESET}"
echo "${BOLD}${RED}  🗑️  BewerbsBoard — Host Power Service Uninstaller              ${RESET}"
echo "${BOLD}${RED}──────────────────────────────────────────────────────────────────${RESET}"
echo ""

# Verify root privileges
if [ "$EUID" -ne 0 ]; then
  echo "${RED}${BOLD}Error: Root privileges required.${RESET}" >&2
  echo "Please re-run using: ${BOLD}sudo bash $0${RESET}"
  exit 1
fi

# Step 1: Stop and disable systemd service
if command -v systemctl >/dev/null 2>&1; then
  echo "  • Stopping and disabling systemd service..."
  systemctl stop restart-service.service 2>/dev/null || true
  systemctl disable restart-service.service 2>/dev/null || true

  if [ -f "${SYSTEMD_FILE}" ]; then
    echo "  • Removing systemd service unit ${BOLD}${SYSTEMD_FILE}${RESET}..."
    rm -f "${SYSTEMD_FILE}"
    systemctl daemon-reload
    systemctl reset-failed 2>/dev/null || true
  fi
fi

# Step 2: Remove application binaries and static files
if [ -d "${INSTALL_DIR}" ]; then
  echo "  • Removing application directory ${BOLD}${INSTALL_DIR}${RESET}..."
  rm -rf "${INSTALL_DIR}"
fi

# Step 3: Handle configuration files
if [ -d "${CONFIG_DIR}" ]; then
  REMOVE_CONFIG=false

  if [ "$PURGE" = true ]; then
    REMOVE_CONFIG=true
  elif [ "$FORCE" = true ]; then
    REMOVE_CONFIG=false
  else
    echo ""
    read -r -p "  Do you also want to delete the configuration files at ${CONFIG_DIR}? [y/N]: " CONFIRM_INPUT
    if [[ "$CONFIRM_INPUT" =~ ^[Yy]$ ]]; then
      REMOVE_CONFIG=true
    fi
  fi

  if [ "$REMOVE_CONFIG" = true ]; then
    echo "  • Purging configuration directory ${BOLD}${CONFIG_DIR}${RESET}..."
    rm -rf "${CONFIG_DIR}"
  else
    echo "  • Preserving configuration directory ${BOLD}${CONFIG_DIR}${RESET}."
  fi
fi

echo ""
echo "${BOLD}${GREEN}==================================================================${RESET}"
echo "${BOLD}${GREEN}  ✓ Uninstallation Complete                                      ${RESET}"
echo "${BOLD}${GREEN}==================================================================${RESET}"
echo ""
echo "  The host power management service has been stopped and removed."
echo ""
