# Debian Wi-Fi Hotspot Setup Guide

This guide provides step-by-step instructions to configure a headless Debian system (such as an Odroid) as a Wi-Fi hotspot using `hostapd` and `dnsmasq`.

## Prerequisites

*   A Debian-based system.
*   A USB Wi-Fi adapter that supports AP (Access Point) mode.
*   Root or `sudo` privileges.

**Specific Configuration Used in this Guide:**
*   **Interface:** `wlan0`
*   **Network Name (SSID):** `SC-WIFI`
*   **Password:** `test1234` (Must be at least 8 characters)
*   **Router IP:** `192.168.4.1`

---

## Step 0: Disable Wi-Fi

Bring down the network interface to stop the DHCP client and disconnect from your router.

```bash
sudo ifdown wlan0
```

Flush the Interface

```bash
sudo ip addr flush dev wlan0
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

## Step 1: Verify AP Mode Support

Before starting, ensure your Wi-Fi adapter supports creating a hotspot.

```bash
sudo apt update && sudo apt install iw
iw list
```

Scroll through the output to the **Supported interface modes** section. You must see `AP` listed.

## Step 2: Install Required Packages

Install the access point daemon (`hostapd`) and the DHCP/DNS server (`dnsmasq`).

```bash
sudo apt update
sudo apt install hostapd dnsmasq ifupdown
```

## Step 3: Set a Static IP for the Wi-Fi Interface

Your device needs a fixed IP address to act as a router for connected clients.

1. Open the network interfaces file:
   ```bash
   sudo nano /etc/network/interfaces
   ```
2. Add the following lines to the bottom of the file:
   ```text
   allow-hotplug wlan0
   iface wlan0 inet static
       address 192.168.4.1
       netmask 255.255.255.0
   ```
3. Save and apply the IP address:
   ```bash
   sudo ifdown wlan0
   sudo ifup wlan0
   ```

## Step 4: Configure the DHCP Server (dnsmasq)

Configure `dnsmasq` to assign IP addresses to devices that connect to the Wi-Fi network.

1. Back up the default configuration file and create a new one:
   ```bash
   sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.orig
   sudo nano /etc/dnsmasq.conf
   ```
2. Paste the following configuration:
   ```text
   interface=wlan0
   bind-interfaces
   dhcp-range=192.168.4.10,192.168.4.50,255.255.255.0,24h
   ```
   *Note: The `bind-interfaces` directive is required. It prevents `dnsmasq` from attempting to listen on all interfaces, which otherwise causes a port 53 collision with systemd-resolved.*

## Step 5: Configure the Access Point (hostapd)

Configure the broadcast settings for your network.

1. Create the `hostapd` configuration file:
   ```bash
   sudo nano /etc/hostapd/hostapd.conf
   ```
2. Paste the following configuration:
   ```text
   interface=wlan0
   driver=nl80211
   ssid=SC-WIFI
   hw_mode=g
   channel=6
   wpa=2
   wpa_passphrase=test1234
   wpa_key_mgmt=WPA-PSK
   rsn_pairwise=CCMP
   ```
3. Tell the system where to find this configuration file:
   ```bash
   sudo nano /etc/default/hostapd
   ```
4. Find the `#DAEMON_CONF=""` line and update it to:
   ```text
   DAEMON_CONF="/etc/hostapd/hostapd.conf"
   ```

## Step 6: Enable and Start Services

Debian masks `hostapd` by default, so it must be unmasked before starting.

```bash
sudo systemctl unmask hostapd
sudo systemctl enable hostapd dnsmasq
sudo systemctl restart hostapd dnsmasq
```

## Step 7: Verification

Check the status of both services to ensure they are running without errors:

```bash
sudo systemctl status dnsmasq
sudo systemctl status hostapd
```

If both show as `active (running)`, your hotspot is broadcasting and ready for devices to connect!
