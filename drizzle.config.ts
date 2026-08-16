import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './shared/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
});
