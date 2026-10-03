CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`platform` text NOT NULL,
	`secret_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`last_seen_address` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE TABLE `pairing_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`secret_hash` text NOT NULL,
	`addresses` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`redeemed_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE INDEX `pairing_grants_expires` ON `pairing_grants` (`expires_at`);
