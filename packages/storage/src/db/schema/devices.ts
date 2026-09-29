import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  platform: text('platform').notNull(),
  secretHash: text('secret_hash').notNull(),
  createdAt: text('created_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  lastSeenAddress: text('last_seen_address'),
  route: text('route', { enum: ['loopback', 'lan', 'tailnet', 'tunnel'] })
    .notNull()
    .default('loopback'),
  routeInferred: integer('route_inferred', { mode: 'boolean' })
    .notNull()
    .default(false),
  revokedAt: text('revoked_at'),
});
