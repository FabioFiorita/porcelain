CREATE TABLE `environment` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	CONSTRAINT "environment_singleton" CHECK("environment"."singleton" = 1)
);
--> statement-breakpoint
CREATE TABLE `inventory_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`common_directory` text NOT NULL,
	`repository_identity` text NOT NULL,
	`available` integer NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT "project_id_present" CHECK("inventory_projects"."id" IS NOT NULL),
	CONSTRAINT "project_available" CHECK("inventory_projects"."available" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `worktrees` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`metadata_identity` text NOT NULL,
	`main` integer NOT NULL,
	`branch` text,
	`available` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "worktree_id_present" CHECK("worktrees"."id" IS NOT NULL),
	CONSTRAINT "worktree_main" CHECK("worktrees"."main" IN (0, 1)),
	CONSTRAINT "worktree_available" CHECK("worktrees"."available" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_projects_repository_identity_unique` ON `inventory_projects` (`repository_identity`);
--> statement-breakpoint
CREATE UNIQUE INDEX `worktree_order` ON `worktrees` (`project_id`,`position`);
