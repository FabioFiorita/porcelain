import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  platform: text('platform').notNull(),
  secretHash: text('secret_hash').notNull(),
  createdAt: text('created_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  lastSeenAddress: text('last_seen_address'),
  revokedAt: text('revoked_at'),
});
