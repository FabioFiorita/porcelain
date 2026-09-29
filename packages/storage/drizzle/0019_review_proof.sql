CREATE TABLE `review_proof_files` (
	`worktree_id` text NOT NULL,
	`id` text NOT NULL,
	`media_type` text NOT NULL,
	`bytes` blob NOT NULL,
	PRIMARY KEY(`worktree_id`, `id`),
	FOREIGN KEY (`worktree_id`) REFERENCES `reviews`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `reviews` ADD `proof` text;