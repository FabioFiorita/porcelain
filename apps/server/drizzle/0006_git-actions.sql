CREATE TABLE `git_action_blocks` (
	`project_id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `git_action_preparations` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`consumed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `git_action_receipts` (
	`request_id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
