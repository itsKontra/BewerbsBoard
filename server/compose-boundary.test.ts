import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('self-hosted Compose authentication boundary', () => {
  it('runs one hardened, loopback-only app with durable storage and operational limits', async () => {
    const [compose, dockerfile, healthcheck] = await Promise.all([
      readFile('compose.yaml', 'utf8'),
      readFile('Dockerfile', 'utf8'),
      readFile('server/healthcheck.mjs', 'utf8'),
    ])

    expect(compose).toContain('name: web-scoreboard-local')
    expect(compose).toContain('app:')
    expect(compose).toContain('${APP_BIND_ADDRESS:-127.0.0.1}:${APP_PORT:-3080}:8080')
    expect(compose).not.toContain('0.0.0.0:3080:8080')
    expect(compose).toContain('restart: unless-stopped')
    expect(compose).toContain('read_only: true')
    expect(compose).toContain('no-new-privileges:true')
    expect(compose).toContain('cap_drop:')
    expect(compose).toContain('- ALL')
    expect(compose).toContain('pids_limit: 256')
    expect(compose).toContain('cpus: 1')
    expect(compose).toContain('mem_limit: 768m')
    expect(compose).toContain('/app/data')
    expect(compose).toContain('type: volume')
    expect(compose).toContain('interval: 10s')
    expect(compose).toContain('timeout: 5s')
    expect(compose).toContain('retries: 3')
    expect(compose).toContain('start_period: 30s')
    expect(compose).toContain('driver: json-file')
    expect(compose).toContain('max-size: 10m')
    expect(compose).toContain('max-file: 3')
    expect(dockerfile).toContain('/app/server/healthcheck.mjs')
    expect(healthcheck).toContain('successes >= 3')
  })
})
