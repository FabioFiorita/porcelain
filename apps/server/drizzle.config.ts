import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: '../../packages/storage/src/db/schema/*.ts',
  out: '../../packages/storage/drizzle',
});
