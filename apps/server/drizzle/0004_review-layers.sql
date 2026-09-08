CREATE TABLE `review_layer_sets` (
	`worktree_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`layers` text NOT NULL
);
