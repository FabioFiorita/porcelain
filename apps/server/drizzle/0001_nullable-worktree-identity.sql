PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_worktrees` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`metadata_identity` text,
	`main` integer NOT NULL,
	`branch` text,
	`available` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "worktree_id_present" CHECK("__new_worktrees"."id" IS NOT NULL),
	CONSTRAINT "worktree_main" CHECK("__new_worktrees"."main" IN (0, 1)),
	CONSTRAINT "worktree_available" CHECK("__new_worktrees"."available" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_worktrees`("id", "project_id", "path", "metadata_identity", "main", "branch", "available", "position") SELECT "id", "project_id", "path", NULLIF("metadata_identity", ''), "main", "branch", "available", "position" FROM `worktrees`;--> statement-breakpoint
DROP TABLE `worktrees`;--> statement-breakpoint
ALTER TABLE `__new_worktrees` RENAME TO `worktrees`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `worktree_order` ON `worktrees` (`project_id`,`position`);