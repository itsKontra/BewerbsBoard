# BewerbsBoard

BewerbsBoard is a self-hosted digital scoreboard designed for fire brigade competitions. 

It replaces traditional paper or simple spreadsheet scoreboards with a modern, connected system. You can run it on your own hardware locally, or host it in the cloud.

## Table of contents

- [Features](#features)
- [Quick Start (The Easy Way)](#quick-start-the-easy-way)
- [For Developers and Advanced Users](#for-developers-and-advanced-users)
  - [Manual Deployment](#manual-deployment)
  - [Configuration](#configuration)
  - [Development Guide](#development-guide)
  - [TV Display Set-Top Box Setup](#tv-display-set-top-box-setup)
- [License](#license)

## Features

The application provides three separate views, each designed for a specific purpose:

1. **Public View (`/`)**: A mobile-friendly live scoreboard. Spectators can use their phones to see current rankings and upcoming starts in real time.
2. **TV Display (`/tv`)**: A full-screen presentation mode designed for large monitors or TVs. It automatically rotates through rankings, shows announcements, displays QR codes, and includes three visual themes (Broadcast, Ceremony, and Outdoor).
3. **Administration (`/admin`)**: A secure control panel for event organizers. Use this to manage participants, enter scores, control what shows on the TV displays, and configure the event.

### Software preview

<p align="center">
  <img src="docs/images/bewerbsboard-overview.png" alt="BewerbsBoard preview showing the public, administration, and TV interfaces" width="800">
</p>

## Quick Start (The Easy Way)

The simplest way to explore or install BewerbsBoard is by using our interactive deployment wizard. It will guide you step-by-step through setting up a local demo or a full installation.

To run the wizard, open your terminal (Command Prompt, PowerShell, or bash) and run the following commands:

```sh
git clone https://github.com/itsKontra/BewerbsBoard.git
cd BewerbsBoard
./scripts/deploy-wizard.sh
```

Follow the on-screen prompts. You can choose to run a quick local demo to test it out, or set up a permanent installation using Docker or Cloudflare.

---

## For Developers and Advanced Users

If you prefer to configure everything manually or want to contribute to the project, you will find detailed technical instructions in this section.

### Manual Deployment

#### Docker Compose (Local/Self-Hosted)
Use this option to inspect and control every step yourself. For self-hosting, ensure Git, Bash, Docker Engine, and Docker Compose v2 are installed.

```sh
git clone https://github.com/itsKontra/BewerbsBoard.git
cd BewerbsBoard
cp example.env .env
```

Edit `.env` to set your administrator credentials. Then start the application:

```sh
./app.sh start
curl --fail http://127.0.0.1:3080/healthz
```

The default endpoints are:
- Public scoreboard: `http://127.0.0.1:3080/`
- Administration: `http://127.0.0.1:3080/admin`
- TV display: `http://127.0.0.1:3080/tv`

#### Cloudflare Pages (Serverless)
This deployment uses Cloudflare Pages Functions, D1 for relational data, and Workers KV for configuration. It requires Node.js 20+, npm, and a Cloudflare account.

1. Install dependencies and authenticate Wrangler:
   ```sh
   npm ci
   npx wrangler login
   ```
2. Create backing services:
   ```sh
   npx wrangler d1 create bewerbsboard
   npx wrangler kv namespace create KV
   ```
3. Copy the returned `database_id` and KV `id` into `wrangler.toml`.
4. Deploy the project:
   ```sh
   npx wrangler pages project create bewerbsboard --production-branch main
   npm run db:migrate:remote
   npm run build
   npx wrangler pages deploy dist --project-name bewerbsboard
   ```

*Note: Cloudflare deployments do not include the built-in login screen. You must protect `/admin` and `/api/admin/*` with a trusted authorization layer before using it publicly.*

### Configuration

#### Environment Variables
Copy `example.env` to `.env`. Docker Compose loads this file automatically.

| Variable | Description |
| --- | --- |
| `APP_BIND_ADDRESS` | Host address to bind to (default: `127.0.0.1`). |
| `APP_PORT` | Port exposed on the host (default: `3080`). |
| `LOCAL_AUTH_USER` | Administrator username for the built-in login. |
| `LOCAL_AUTH_PASSWORD` | Administrator password. |
| `LOCAL_AUTH_SECRET` | Secret used to sign session cookies. |

*Additional variables for Keycloak/OIDC proxies are documented in `example.env`.*

#### Application Control Script
The `app.sh` script manages your Docker installation. 
```sh
./app.sh start         # Start the containers
./app.sh stop          # Stop containers (preserves data)
./app.sh delete        # Remove containers and ALL data
```

### Development Guide

Install Node.js 20+ and run `npm ci` to get started.

#### Project Structure
- `src/`: React user interface.
- `server/`: Self-hosted Hono server and SQLite persistence.
- `functions/`: Cloudflare Pages Functions.
- `shared/`: Shared domain logic, types, and schema.

#### Common Commands
```sh
npm run dev              # Start Vite development server
npm run build            # Build the browser bundle and server
npm run db:seed:generate # Regenerate seed data from JSON
npm test                 # Run tests
npx playwright test      # Run browser tests
```

#### Demo Mode
You can view the UI with deterministic demo data by appending `?demo=true` to the URL (e.g., `http://localhost:5173/?demo=true`).

### TV Display Set-Top Box Setup

An Odroid, Raspberry Pi, or similar Debian device can run Firefox in kiosk mode to automatically open the TV view on boot.

1. Review and adjust `scripts/setup-debian-device.sh` to match your TV URL.
2. Run the script on your dedicated device:
   ```sh
   chmod +x scripts/setup-debian-device.sh
   ./scripts/setup-debian-device.sh
   sudo reboot
   ```

3. Confirm that the installed Docker setup provides the Compose v2 command (`docker compose version`) before deploying the scoreboard with `./app.sh start`.
4. For a device that creates its own offline Wi-Fi network, follow [`scripts/setup-debian-hotspot.md`](scripts/setup-debian-hotspot.md). Replace the example SSID and password before enabling the hotspot.
5. To connect the headless device to an existing wireless network instead, follow [`scripts/setup-debian-wifi.md`](scripts/setup-debian-wifi.md).

The device setup script changes display-manager settings, configures automatic login, replaces Firefox policy/profile data, and installs system packages. Use it only on a dedicated kiosk device after reviewing it.

### Host network addresses in the TV display (Optional)

This feature is designed for standalone setups (such as a Raspberry Pi or set-top box running both Docker and the TV browser in kiosk mode). It displays the host's actual network IP addresses directly on the TV display, allowing administrators to discover and access the admin interface when connecting the device to an unfamiliar or DHCP-managed network.

Docker cannot inspect the host's network interfaces. The collector is optional; without it, the application starts normally and reports only addresses visible inside its container. To display host interface names and addresses in the TV admin splash, install the collector on the Linux Docker host:
```sh
sudo install -Dm755 deploy/network-info-writer.sh /usr/local/lib/bewerbsboard/network-info-writer.sh
sudo install -Dm644 deploy/bewerbsboard-network-info.service /etc/systemd/system/bewerbsboard-network-info.service
sudo systemctl enable --now bewerbsboard-network-info.service
```
Then start Docker with: `docker compose -f compose.yaml -f compose.network-info.yaml up -d`

## License

This project is available under the [MIT License](LICENSE).
