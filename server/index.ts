import { serve } from '@hono/node-server'
import { resolve } from 'node:path'

import { createSelfHostedApp } from './app.js'
import { createDatabase } from './database.js'
import { readLocalAuthConfig } from './local-auth.js'

const port = parsePort(process.env.PORT)
const publicDirectory = resolve(process.env.PUBLIC_DIRECTORY ?? 'dist')
const database = createDatabase('/app/data/scoreboard.sqlite')
const localAuth = readLocalAuthConfig(process.env)
const app = createSelfHostedApp({ publicDirectory, database, localAuth: localAuth ?? undefined })

serve({ fetch: app.fetch, port }, (info) => {
  console.log(JSON.stringify({ event: 'server_started', port: info.port, database: database.getConnectionSettings().journalMode }))
})

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 8080
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535; received ${value}`)
  }

  return port
}
