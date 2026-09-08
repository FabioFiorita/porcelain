CREATE TABLE `project_worktrees` (
	`worktree_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_worktrees_project` ON `project_worktrees` (`project_id`);
--> statement-breakpoint
INSERT INTO `project_worktrees` (`worktree_id`, `project_id`)
SELECT `id`, `project_id` FROM `worktrees`;
