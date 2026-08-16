#!/bin/bash
# ODROID-C2 Armbian Kiosk & Docker Setup Script
# Installs a minimal X11 environment, Openbox, native Firefox, and Docker.

echo "Starting Kiosk & Docker Setup..."

# ---------------------------------------------------------
# 1. System Updates & Core Dependencies
# ---------------------------------------------------------
echo "Updating system and installing foundational tools..."
sudo apt update && sudo apt upgrade -y

# Install display server (X11), window manager (Openbox), and display manager (LightDM)
# x11-xserver-utils provides 'xset' for screen blanking control
# unclutter hides the mouse cursor
sudo apt install -y xserver-xorg x11-xserver-utils openbox lightdm unclutter 

# Install required graphical foundations (D-Bus) and system fonts for the browser
sudo apt install -y dbus-x11 fonts-liberation fonts-noto-color-emoji

# Install utilities for adding third-party repositories
sudo apt install -y ca-certificates curl gpg

# ---------------------------------------------------------
# 2. Add Official Mozilla APT Repository
# ---------------------------------------------------------
echo "Configuring official Mozilla repository for native Firefox..."

# Import the Mozilla signing key
curl -fsSL https://packages.mozilla.org/apt/repo-signing-key.gpg | sudo gpg --dearmor --yes -o /usr/share/keyrings/packages.mozilla.org.gpg

# Add the repository, strictly verifying ARM64 architecture support
(
  arch=$(dpkg --print-architecture);
  case "$arch" in
    amd64|arm64) ;;
    *)
      printf 'Mozilla stable Firefox DEB packages are not published for %s.\n' "$arch";
      printf 'Use firefox-esr or Mozilla tarball instructions instead.\n';
      exit 1;
      ;;
  esac;
  
  printf '%s\n' \
    'Types: deb' \
    'URIs: https://packages.mozilla.org/apt' \
    'Suites: mozilla' \
    'Components: main' \
    "Architectures: $arch" \
    'Signed-By: /usr/share/keyrings/packages.mozilla.org.gpg' | sudo tee /etc/apt/sources.list.d/mozilla.sources > /dev/null;
)

# Pin the Mozilla repository to the highest priority so Debian doesn't overwrite it
printf '%s\n' \
  'Package: firefox*' \
  'Pin: origin packages.mozilla.org' \
  'Pin-Priority: 1000' | sudo tee /etc/apt/preferences.d/mozilla > /dev/null

# ---------------------------------------------------------
# 3. Install Firefox
# ---------------------------------------------------------
echo "Installing Firefox..."
sudo apt update
sudo apt install -y firefox

# ---------------------------------------------------------
# 4. Configure LightDM Auto-Login
# ---------------------------------------------------------
echo "Configuring LightDM to auto-login user 'app' into Openbox..."
sudo mkdir -p /etc/lightdm/lightdm.conf.d

sudo tee /etc/lightdm/lightdm.conf.d/50-kiosk.conf > /dev/null << 'EOF'
[Seat:*]
autologin-user=app
autologin-user-timeout=0
user-session=openbox
autologin-session=openbox
EOF

# ---------------------------------------------------------
# 5. Configure Openbox Autostart Script
# ---------------------------------------------------------
echo "Creating Openbox autostart sequence..."
sudo mkdir -p /home/app/.config/openbox

sudo tee /home/app/.config/openbox/autostart > /dev/null << 'EOF'
# Redirect standard output and errors to a log file for debugging
exec > /home/app/kiosk.log 2>&1

# Disable DPMS (Energy Star) features and screen blanking
xset -dpms
xset s off
xset s noblank

# Hide the mouse cursor after 0.5 seconds of inactivity
unclutter -idle 0.5 -root &

# Start Firefox with kiosk flags, pointing directly to the dashboard
firefox --kiosk "https://bewerb.example.dev/tv" &
EOF

# Ensure the 'app' user owns its configuration files
sudo chown -R app:app /home/app

# ---------------------------------------------------------
# 6. Apply Firefox Enterprise Lockdown Policies
# ---------------------------------------------------------
echo "Applying Firefox kiosk policies..."
sudo mkdir -p /usr/lib/firefox/distribution/
sudo mkdir -p /etc/firefox/policies/

# Write the policy file to disable all pop-ups, updates, and onboarding screens
sudo tee /usr/lib/firefox/distribution/policies.json > /dev/null << 'EOF'
{
  "policies": {
    "DisableTelemetry": true,
    "DisableFirefoxStudies": true,
    "DisablePocket": true,
    "DisableProfileImport": true,
    "NoDefaultBookmarks": true,
    "OverrideFirstRunPage": "",
    "OverridePostUpdatePage": "",
    "DisableAppUpdate": true,
    "DisableDefaultBrowserAgent": true,
    "DontCheckDefaultBrowser": true,
    "UserMessaging": {
      "SkipOnboarding": true,
      "ExtensionRecommendations": false,
      "FeatureRecommendations": false,
      "MoreFromMozilla": false
    }
  }
}
EOF

# Create a symlink to guarantee Firefox finds the policy
sudo ln -sf /usr/lib/firefox/distribution/policies.json /etc/firefox/policies/policies.json

# Wipe any existing profile data to force Firefox to read the new policies on next boot
sudo rm -rf /home/app/.mozilla

# ---------------------------------------------------------
# 7. Install and Configure Docker
# ---------------------------------------------------------
echo "Installing Docker and Docker Compose..."
# Install Docker and standard Compose from Debian repositories
sudo apt install -y docker.io docker-compose

# Ensure the Docker daemon starts automatically on boot
sudo systemctl enable docker
sudo systemctl start docker

# Add the 'app' user to the docker group so containers can be managed without sudo
sudo usermod -aG docker app

# Create a directory for your Node.js Docker projects
sudo mkdir -p /home/app/server
sudo chown -R app:app /home/app/server

# ---------------------------------------------------------
# Done
# ---------------------------------------------------------
echo "========================================================"
echo "Setup complete!"
echo "Docker is installed and the 'app' user has permissions."
echo "Drop your docker-compose.yml in /home/app/server/"
echo "Please reboot the device to apply all settings."
echo "========================================================"