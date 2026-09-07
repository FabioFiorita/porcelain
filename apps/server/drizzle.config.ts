import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/inventory/inventory-schema.ts',
  out: './drizzle',
});
