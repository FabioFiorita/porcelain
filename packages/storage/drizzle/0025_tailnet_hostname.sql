PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_remote_access` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`lan` integer NOT NULL,
	`lan_interface` text,
	`lan_subnet` text,
	`lan_gateway` text,
	`lan_gateway_hardware` text,
	`tailnet` integer NOT NULL,
	`tailnet_hostname` text,
	`tailnet_port` integer,
	`cloudflare` integer NOT NULL,
	`cloudflare_hostname` text,
	CONSTRAINT "remote_access_singleton" CHECK("__new_remote_access"."singleton" = 1),
	CONSTRAINT "remote_access_lan_network" CHECK(("__new_remote_access"."lan_interface" IS NULL) = ("__new_remote_access"."lan_subnet" IS NULL)),
	CONSTRAINT "remote_access_tailnet_hostname" CHECK("__new_remote_access"."tailnet" = 0 OR "__new_remote_access"."tailnet_hostname" IS NOT NULL),
	CONSTRAINT "remote_access_cloudflare_hostname" CHECK("__new_remote_access"."cloudflare" = 0 OR "__new_remote_access"."cloudflare_hostname" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `__new_remote_access`("singleton", "lan", "lan_interface", "lan_subnet", "lan_gateway", "lan_gateway_hardware", "tailnet", "tailnet_hostname", "tailnet_port", "cloudflare", "cloudflare_hostname") SELECT "singleton", "lan", "lan_interface", "lan_subnet", "lan_gateway", "lan_gateway_hardware", 0, NULL, NULL, "cloudflare", "cloudflare_hostname" FROM `remote_access`;--> statement-breakpoint
DROP TABLE `remote_access`;--> statement-breakpoint
ALTER TABLE `__new_remote_access` RENAME TO `remote_access`;--> statement-breakpoint
PRAGMA foreign_keys=ON;