ALTER TABLE `devices` ADD `route` text DEFAULT 'loopback' NOT NULL;--> statement-breakpoint
ALTER TABLE `devices` ADD `route_inferred` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- A device paired before credentials were bound to a route keeps working over
-- the route its last seen address came through: the loopback listener, the
-- tailnet (100.64.0.0/10, fd7a:115c:a1e0::/48), a private or link-local local
-- network address, or else a Cloudflare tunnel visitor. A device never seen
-- since pairing is bound to the loopback listener. route_inferred tells the
-- owner that the binding was inferred, so they can pair it again elsewhere.
UPDATE `devices`
SET `route_inferred` = 1,
  `route` = lower(
    CASE
      WHEN `last_seen_address` GLOB '::ffff:*' THEN substr(`last_seen_address`, 8)
      ELSE coalesce(`last_seen_address`, '')
    END
  );--> statement-breakpoint
UPDATE `devices`
SET `route` = CASE
  WHEN `route` = '' OR `route` GLOB '127.*' OR `route` = '::1' THEN 'loopback'
  WHEN `route` GLOB '100.6[4-9].*'
    OR `route` GLOB '100.[7-9][0-9].*'
    OR `route` GLOB '100.1[01][0-9].*'
    OR `route` GLOB '100.12[0-7].*'
    OR `route` GLOB 'fd7a:115c:a1e0:*' THEN 'tailnet'
  WHEN `route` GLOB '10.*'
    OR `route` GLOB '192.168.*'
    OR `route` GLOB '172.1[6-9].*'
    OR `route` GLOB '172.2[0-9].*'
    OR `route` GLOB '172.3[01].*'
    OR `route` GLOB '169.254.*'
    OR `route` GLOB 'fe[89ab]?:*'
    OR `route` GLOB 'f[cd]??:*' THEN 'lan'
  ELSE 'tunnel'
END
WHERE `route_inferred` = 1;
