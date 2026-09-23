import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const pairingGrants = sqliteTable(
  'pairing_grants',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull(),
    secretHash: text('secret_hash').notNull(),
    addresses: text('addresses', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    redeemedAt: text('redeemed_at'),
    revokedAt: text('revoked_at'),
  },
  (table) => [index('pairing_grants_expires').on(table.expiresAt)],
);
