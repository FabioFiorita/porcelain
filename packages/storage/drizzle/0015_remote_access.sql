CREATE TABLE `remote_access` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`lan` integer NOT NULL,
	`tailnet` integer NOT NULL,
	`cloudflare` integer NOT NULL,
	`cloudflare_hostname` text,
	CONSTRAINT "remote_access_singleton" CHECK("remote_access"."singleton" = 1),
	CONSTRAINT "remote_access_cloudflare_hostname" CHECK("remote_access"."cloudflare" = 0 OR "remote_access"."cloudflare_hostname" IS NOT NULL)
);
