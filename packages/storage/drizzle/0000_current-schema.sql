CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`worktree_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `artifacts_worktree` ON `artifacts` (`worktree_id`);--> statement-breakpoint
CREATE TABLE `comment_threads` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`worktree_id` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_threads_id_unique` ON `comment_threads` (`id`);--> statement-breakpoint
CREATE TABLE `commit_review_layer_sets` (
	`project_id` text NOT NULL,
	`commit_oid` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`project_id`, `commit_oid`),
	FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `environment` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	CONSTRAINT "environment_singleton" CHECK("environment"."singleton" = 1)
);
--> statement-breakpoint
CREATE TABLE `project_file_preferences` (
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`pinned` integer NOT NULL,
	`hidden` integer NOT NULL,
	PRIMARY KEY(`project_id`, `path`),
	CONSTRAINT "project_preference_pinned" CHECK("project_file_preferences"."pinned" IN (0, 1)),
	CONSTRAINT "project_preference_hidden" CHECK("project_file_preferences"."hidden" IN (0, 1))
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `project_worktrees` (
	`worktree_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_worktrees_project` ON `project_worktrees` (`project_id`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `inventory_projects_repository_identity_unique` ON `inventory_projects` (`repository_identity`);--> statement-breakpoint
CREATE TABLE `review_layer_sets` (
	`worktree_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`layers` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `worktrees` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`metadata_identity` text,
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
CREATE UNIQUE INDEX `worktree_order` ON `worktrees` (`project_id`,`position`);