# Connecting to Wi-Fi on Headless Debian

This guide explains how to connect your headless Debian device (like an Odroid or Raspberry Pi without NetworkManager) to an existing Wi-Fi network using `wpa_supplicant`.

## Prerequisites

*   Your Wi-Fi network name (SSID)
*   Your Wi-Fi password
*   Your Wi-Fi interface name (e.g., `wlx7cdd90ad6a47` or `wlan0`)

---

## Step 0: Disable Hotspot

Stop and disable the services:

```bash
sudo systemctl stop hostapd dnsmasq
sudo systemctl disable hostapd dnsmasq
```

Open the file:

```bash
sudo nano /etc/network/interfaces
```

Find and delete or comment out (by adding a # at the beginning of each line) this specific block:

```text
# allow-hotplug wlan0
# iface wlan0 inet static
#     address 192.168.4.1
#     netmask 255.255.255.0
```

Remove the static IP assignment

```bash
sudo ip addr flush dev wlan0
```

## Step 1: Identify Your Interface

If you don't already know your Wi-Fi interface name, list all network devices:

```bash
ip link
```
Look for a name starting with `wl` or `wlan` (e.g., `wlx7cdd90ad6a47`).

## Step 2: Install wpasupplicant

Ensure the required tool is installed (it usually is by default):

```bash
sudo apt update
sudo apt install wpasupplicant ifupdown isc-dhcp-client 
```

## Step 3: Generate the Network Configuration

Use `wpa_passphrase` to securely generate the configuration file for your network. Replace `YOUR_SSID` and `YOUR_PASSWORD` with your actual Wi-Fi details.

```bash
wpa_passphrase "YOUR_SSID" "YOUR_PASSWORD" | sudo tee /etc/wpa_supplicant/wpa_supplicant.conf
```

*(Optional)* For added security, you can edit `/etc/wpa_supplicant/wpa_supplicant.conf` and delete the commented-out line containing your plaintext password.

## Step 4: Configure Network Interfaces

Now, tell the system to use this configuration file when starting the Wi-Fi interface.

1. Open your interfaces file:
   ```bash
   sudo nano /etc/network/interfaces
   ```
2. Add the following lines to the bottom of the file (replace `wlan0` with your actual interface name):
   ```text
   allow-hotplug wlan0
   iface wlan0 inet dhcp
       wpa-conf /etc/wpa_supplicant/wpa_supplicant.conf
   ```
   *Note: Using `inet dhcp` tells your device to request an IP address from the Wi-Fi router.*
3. Save and exit (Ctrl+O, Enter, Ctrl+X).

## Step 5: Connect to the Network

To apply the changes and connect to the network immediately, bring the interface down and back up (replace `wlan0` with your interface name):

```bash
sudo ifdown wlan0
sudo ifup wlan0
```

## Step 6: Verify the Connection

Check if your interface successfully received an IP address from the router:

```bash
ip a show wlan0
```

Look for the `inet` line (e.g., `inet 192.168.1.15/24`). If you see an IP address, you are connected!

You can also test internet connectivity by pinging an external server:
```bash
ping -c 4 8.8.8.8
```
