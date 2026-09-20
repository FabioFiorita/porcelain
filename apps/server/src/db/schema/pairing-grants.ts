import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// A pairing grant is a single-use invitation. Only the digest of its secret is
// stored, so a copy of this table cannot be redeemed. `redeemed_at` and
// `revoked_at` are both terminal: redemption tests them in the same conditional
// update that sets `redeemed_at`, which is what makes a second attempt fail.
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
