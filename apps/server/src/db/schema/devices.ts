import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// A paired device. The credential is a bearer token whose digest is stored
// here; the plaintext exists only on the device. `last_seen_at` is written by a
// periodic flush rather than per request, so authentication adds no SQL.
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
