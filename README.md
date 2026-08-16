# BewerbsBoard

A self-hosted scoreboard for fire brigade competitions. It provides a mobile spectator view, a full-screen TV presentation, and an administration interface for entrants, scoring, display control, and event configuration.

## Table of contents

- [Functionality](#functionality)
- [Deployment](#deployment)
  - [Option 1: Interactive deployment wizard](#option-1-interactive-deployment-wizard)
  - [Option 2: Docker Compose](#option-2-docker-compose)
  - [Option 3: Cloudflare Pages with Wrangler](#option-3-cloudflare-pages-with-wrangler)
- [Configuration](#configuration)
  - [Environment variables](#environment-variables)
  - [Application control script](#application-control-script)
- [Development](#development)
  - [Project structure](#project-structure)
  - [Build](#build)
  - [Seed data](#seed-data)
  - [Testing and demo mode](#testing-and-demo-mode)
- [Set up a small set-top box](#set-up-a-small-set-top-box)
- [License](#license)

## Functionality

The application exposes three views:

- `/` is the public, mobile-friendly scoreboard with live rankings and upcoming starts.
- `/admin` manages participants, start order, results, TV output, event setup, settings, and audit logs.
- `/tv` is the full-screen display. It supports automatic rotation, a fixed ranking, announcements, winner presentations, QR codes, and three visual themes.

### Software preview

<p align="center">
  <img src="docs/images/bewerbsboard-overview.png" alt="BewerbsBoard preview showing the public, administration, and TV interfaces" width="800">
</p>

## Deployment

For self-hosting, install Git, Bash, Docker Engine, and Docker Compose v2. The application stores its SQLite database in the `scoreboard-data` Docker volume.

### Option 1: Interactive deployment wizard

The wizard is the easiest way to explore or deploy the project. It can start the local demo, configure a Docker deployment, provision Cloudflare resources, or guide an OAuth2/Keycloak proxy setup.

```sh
git clone https://github.com/itsKontra/BewerbsBoard.git
cd BewerbsBoard
chmod +x scripts/deploy-wizard.sh
./scripts/deploy-wizard.sh
```

The wizard writes configuration to `.env`. For a local Docker deployment it also creates the unified `app.sh` management script described under [Application control script](#application-control-script).

### Option 2: Docker Compose

Use this path when you want to inspect and control every step yourself.

```sh
git clone https://github.com/itsKontra/BewerbsBoard.git
cd BewerbsBoard
cp example.env .env
```

Edit `.env`, especially the administrator credentials. Then start and verify the application:

```sh
chmod +x app.sh
./app.sh start
docker compose --project-name app_scoreboard ps
curl --fail http://127.0.0.1:3080/healthz
```

The default endpoints are:

- Public scoreboard: `http://127.0.0.1:3080/`
- Administration: `http://127.0.0.1:3080/admin`
- TV display: `http://127.0.0.1:3080/tv`

Without `.env`, the Compose default accepts connections only from the Docker host. The supplied `example.env` uses `0.0.0.0` for LAN access; prefer a specific LAN address when possible, and expose every interface only when the host firewall or a trusted network provides the required protection.

For an authenticated reverse proxy, use [`deploy/nginx-scoreboard.conf.example`](deploy/nginx-scoreboard.conf.example) as the route and trusted-header contract. TLS, DNS, the identity provider, and proxy configuration remain operator responsibilities.

### Option 3: Cloudflare Pages with Wrangler

This deployment uses Cloudflare Pages Functions, D1 for relational data, and Workers KV for application/display configuration. It requires Node.js 20 or newer, npm, and a Cloudflare account.

Install dependencies and authenticate Wrangler:

```sh
npm ci
npx wrangler --version
npx wrangler login
npx wrangler whoami
```

Create the backing services:

```sh
npx wrangler d1 create bewerbsboard
npx wrangler kv namespace create KV
```

Copy the returned D1 `database_id` and KV namespace `id` into [`wrangler.toml`](wrangler.toml), replacing both `your-...-id` placeholders. Keep the binding names as `DB` and `KV`; the Pages Functions use those exact names.

Create the Pages project, apply the D1 migrations, build, and deploy:

```sh
npx wrangler pages project create bewerbsboard --production-branch main
npm run db:migrate:remote
npm run build
npx wrangler pages deploy dist --project-name bewerbsboard
```

Later deployments only need the migration, build, and deploy commands. Run `npx wrangler pages deployment list --project-name bewerbsboard` to inspect deployments.

Cloudflare Direct Upload through Wrangler is required because this repository contains a `functions/` directory; dashboard drag-and-drop does not compile Pages Functions. The Cloudflare deployment does not provide the Docker deployment's built-in login screen. Protect `/admin` and `/api/admin/*` with a trusted authorization layer before using it publicly.

For more detail, see Cloudflare's documentation for [Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/), and [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/).

## Configuration

### Environment variables

Copy [`example.env`](example.env) to `.env`. Docker Compose loads the file automatically. Never commit `.env` or real credentials.

| Variable | Required | Compose default | Description |
| --- | --- | --- | --- |
| `APP_BIND_ADDRESS` | No | `127.0.0.1` | Address on the Docker host to which the container port is published. `example.env` sets `0.0.0.0` for LAN access; use a specific LAN address when possible because `0.0.0.0` exposes every interface. |
| `APP_PORT` | No | `3080` | Port exposed on the Docker host. The container itself listens on port `8080`. |
| `LOCAL_AUTH_USER` | For built-in login | — | Administrator username. Local authentication is enabled only when both this and `LOCAL_AUTH_PASSWORD` are present. |
| `LOCAL_AUTH_PASSWORD` | For built-in login | — | Administrator password. Use a strong, unique value. |
| `LOCAL_AUTH_SECRET` | Recommended with built-in login | Random per restart | Secret used to sign the eight-hour session cookie. Set a stable random value so restarts do not invalidate every session. Generate one with `openssl rand -hex 32`. |
| `OAUTH2_PROXY_OIDC_ISSUER_URL` | Proxy setups only | — | OIDC issuer URL used by an optional oauth2-proxy/Keycloak deployment. The Node application does not consume it directly. |
| `OAUTH2_PROXY_CLIENT_ID` | Proxy setups only | — | OIDC client ID for oauth2-proxy. |
| `OAUTH2_PROXY_CLIENT_SECRET` | Proxy setups only | — | OIDC client secret for oauth2-proxy. |
| `OAUTH2_PROXY_COOKIE_SECRET` | Proxy setups only | — | Secret used by oauth2-proxy to protect its session cookie. |

If `LOCAL_AUTH_USER` or `LOCAL_AUTH_PASSWORD` is missing, the self-hosted application expects a trusted reverse proxy to authenticate administrators and replace client-supplied `X-Auth-Request-*` headers.

### Application control script

[`app.sh`](app.sh) replaces the former `app-start.sh`, `app-stop.sh`, and `app-delete.sh` scripts. It resolves paths relative to the repository, uses the fixed Compose project name `app_scoreboard`, and selects `compose.keycloak.yaml` when that optional wizard-generated file exists; otherwise it uses `compose.yaml`.

Ensure it is executable after copying it to a Linux host:

```sh
chmod +x app.sh
```

Use one of these subcommands:

```sh
./app.sh start         # build and start in the background, then wait for health
./app.sh stop          # stop containers while preserving data
./app.sh delete        # confirm, then remove containers, networks, and data
./app.sh delete --yes  # perform the destructive delete without prompting
```

`delete` removes the `scoreboard-data` volume and all competition data. It cannot be undone unless you have an external backup.

## Development

Install Node.js 20 or newer and npm, then install the locked dependencies:

```sh
npm ci
```

### Project structure

```text
.
├── src/                 React user interface and Vite demo data adapters
│   └── features/        Public, TV, and administration feature modules
├── server/              Self-hosted Hono server and SQLite persistence
├── functions/           Cloudflare Pages Functions
├── shared/              Domain logic, API mappers, schema, and seed source
├── migrations/          Cloudflare D1 migrations
├── server/migrations/   Self-hosted SQLite migrations
├── tests/               Playwright end-to-end tests
├── scripts/             Deployment, seed generation, and Debian setup tools
├── deploy/              Reverse-proxy example configuration
├── public/              Static application assets
├── compose.yaml         Self-hosted Docker stack
├── Dockerfile           Multi-stage production image
└── wrangler.toml        Cloudflare Pages, D1, and KV bindings
```

The UI and both backends share the types and business rules in `shared/`, while `server/` and `functions/` adapt them to SQLite and Cloudflare respectively.

### Build

```sh
npm run build
```

The build performs TypeScript project checks, creates the browser bundle in `dist/`, and compiles the self-hosted server into `dist-server/`.

To run that production build outside Docker, provide a writable `/app/data` path expected by the server and then run `npm start`. Docker Compose is the supported self-hosted production path.

### Seed data

Seed data is for development and demonstration only. The single source of truth is [`shared/seed/seed-data.json`](shared/seed/seed-data.json). It supplies the Vite demo, fresh self-hosted databases, and fresh D1 databases.

After changing the catalog or demo data, regenerate the seed blocks in both initial migrations:

```sh
npm run db:seed:generate
```

Verify and review the generated changes before committing them. Initial migration changes affect only new databases. For an existing installation, create a forward migration or deliberately replace/reset the database; do not expect the seed generator to update persisted competition data.

For local D1 development, apply the migration with:

```sh
npm run db:migrate:local
```

For Cloudflare D1, use `npm run db:migrate:remote`.

### Testing and demo mode

Start Vite's development server:

```sh
npm run dev
```

Open these URLs for deterministic demo data:

- Public: `http://localhost:5173/?demo=true`
- Admin: `http://localhost:5173/admin?demo=true`
- TV: `http://localhost:5173/tv?demo=true`

The query parameter is `demo=true`; the UI stores its result internally in a variable named `isDemoMode`. The TV demo also accepts a `theme` parameter:

| Value | Theme |
| --- | --- |
| `theme=1` or `theme=broadcast` | Broadcast |
| `theme=2` or `theme=ceremony` | Ceremony |
| `theme=3` or `theme=outdoor` | Outdoor |

For example: `http://localhost:5173/tv?demo=true&theme=ceremony`.

Run the automated checks with:

```sh
npm test -- --run       # Vitest unit and integration tests once
npm test                # Vitest in watch mode
npm run lint            # oxlint
npx playwright test     # browser tests; starts Vite automatically
```

If Chromium is not installed for Playwright yet, run `npx playwright install chromium` once. The browser tests use the repository-required viewports: 360×740 for the public view and 1920×1080 for `/admin` and `/tv`.

## Set up a small set-top box

An Odroid, Raspberry Pi, or similar Debian device can run Firefox in kiosk mode and open the TV view on boot. The supplied example targets an ODROID-C2 running Armbian/Debian with a dedicated user named `app`.

1. Review [`scripts/setup-debian-device.sh`](scripts/setup-debian-device.sh) before running it. Change the hard-coded kiosk URL (`https://bewerb.example.dev/tv`) to your scoreboard's `/tv` URL and adjust the `app` username if necessary.
2. Copy the repository or script to the device, make it executable, and run it from a local terminal:

   ```sh
   chmod +x scripts/setup-debian-device.sh
   ./scripts/setup-debian-device.sh
   sudo reboot
   ```

3. Confirm that the installed Docker setup provides the Compose v2 command (`docker compose version`) before deploying the scoreboard with `./app.sh start`.
4. For a device that creates its own offline Wi-Fi network, follow [`scripts/setup-debian-hotspot.md`](scripts/setup-debian-hotspot.md). Replace the example SSID and password before enabling the hotspot.
5. To connect the headless device to an existing wireless network instead, follow [`scripts/setup-debian-wifi.md`](scripts/setup-debian-wifi.md).

The device setup script changes display-manager settings, configures automatic login, replaces Firefox policy/profile data, and installs system packages. Use it only on a dedicated kiosk device after reviewing it.

## License

This project is available under the [MIT License](LICENSE).
