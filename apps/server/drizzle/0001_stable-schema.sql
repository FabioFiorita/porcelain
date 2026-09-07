-- Align RC table definitions with the stable Drizzle snapshot without losing rows.
CREATE TABLE `__stable_environment` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	CONSTRAINT "environment_singleton" CHECK("__stable_environment"."singleton" = 1)
);
--> statement-breakpoint
CREATE TABLE `__stable_inventory_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`common_directory` text NOT NULL,
	`repository_identity` text NOT NULL,
	`available` integer NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT "project_id_present" CHECK("__stable_inventory_projects"."id" IS NOT NULL),
	CONSTRAINT "project_available" CHECK("__stable_inventory_projects"."available" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `__stable_worktrees` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`metadata_identity` text NOT NULL,
	`main` integer NOT NULL,
	`branch` text,
	`available` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `__stable_inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "worktree_id_present" CHECK("__stable_worktrees"."id" IS NOT NULL),
	CONSTRAINT "worktree_main" CHECK("__stable_worktrees"."main" IN (0, 1)),
	CONSTRAINT "worktree_available" CHECK("__stable_worktrees"."available" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__stable_environment` SELECT * FROM `environment`;
--> statement-breakpoint
INSERT INTO `__stable_inventory_projects` SELECT * FROM `inventory_projects`;
--> statement-breakpoint
INSERT INTO `__stable_worktrees` SELECT * FROM `worktrees`;
--> statement-breakpoint
DROP TABLE `worktrees`;
--> statement-breakpoint
DROP TABLE `inventory_projects`;
--> statement-breakpoint
DROP TABLE `environment`;
--> statement-breakpoint
ALTER TABLE `__stable_environment` RENAME TO `environment`;
--> statement-breakpoint
ALTER TABLE `__stable_inventory_projects` RENAME TO `inventory_projects`;
--> statement-breakpoint
ALTER TABLE `__stable_worktrees` RENAME TO `worktrees`;
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_projects_repository_identity_unique` ON `inventory_projects` (`repository_identity`);
--> statement-breakpoint
CREATE UNIQUE INDEX `worktree_order` ON `worktrees` (`project_id`,`position`);
