import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const remoteAccess = sqliteTable(
  'remote_access',
  {
    singleton: integer('singleton').primaryKey(),
    lan: integer('lan', { mode: 'boolean' }).notNull(),
    lanInterface: text('lan_interface'),
    lanSubnet: text('lan_subnet'),
    lanGateway: text('lan_gateway'),
    lanGatewayHardware: text('lan_gateway_hardware'),
    tailnet: integer('tailnet', { mode: 'boolean' }).notNull(),
    tailnetServeTarget: text('tailnet_serve_target'),
    cloudflare: integer('cloudflare', { mode: 'boolean' }).notNull(),
    cloudflareHostname: text('cloudflare_hostname'),
  },
  (table) => [
    check('remote_access_singleton', sql`${table.singleton} = 1`),
    check(
      'remote_access_lan_network',
      sql`(${table.lanInterface} IS NULL) = (${table.lanSubnet} IS NULL)`,
    ),
    check(
      'remote_access_cloudflare_hostname',
      sql`${table.cloudflare} = 0 OR ${table.cloudflareHostname} IS NOT NULL`,
    ),
  ],
);
