CREATE TABLE `reviews` (
	`worktree_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`published_at` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`summary_html` text NOT NULL,
	`summary_token` text NOT NULL,
	`summary_secret` text NOT NULL,
	`diagram` text,
	`layers` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_summary_token_unique` ON `reviews` (`summary_token`);
--> statement-breakpoint
CREATE TABLE `reviewed_layers` (
	`worktree_id` text NOT NULL,
	`layer_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`reviewed_at` text NOT NULL,
	`stale` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`worktree_id`, `layer_id`)
);
--> statement-breakpoint
CREATE INDEX `reviewed_layers_worktree` ON `reviewed_layers` (`worktree_id`);
--> statement-breakpoint
DROP TABLE `artifacts`;
--> statement-breakpoint
DROP TABLE `review_layer_sets`;
--> statement-breakpoint
DROP TABLE `commit_review_layer_sets`;
