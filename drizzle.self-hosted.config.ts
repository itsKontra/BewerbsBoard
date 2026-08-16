import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './shared/db/schema.ts',
  out: './server/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './server/migrations/verification.sqlite',
  },
})
