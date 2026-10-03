ALTER TABLE `devices` ADD `trusted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pairing_grants` ADD `trusted` integer DEFAULT false NOT NULL;