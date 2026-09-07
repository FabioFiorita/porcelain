CREATE TABLE IF NOT EXISTS `environment` (
	`singleton` integer PRIMARY KEY,
	`id` text NOT NULL,
	CONSTRAINT "environment_singleton" CHECK("singleton" = 1)
);
--> statement-breakpoint
CREATE TABLE `inventory_projects` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`common_directory` text NOT NULL,
	`repository_identity` text NOT NULL UNIQUE,
	`available` integer NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT "project_id_present" CHECK("id" IS NOT NULL),
	CONSTRAINT "project_available" CHECK("available" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `worktrees` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`metadata_identity` text NOT NULL,
	`main` integer NOT NULL,
	`branch` text,
	`available` integer NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `fk_worktrees_project_id_inventory_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON DELETE CASCADE,
	CONSTRAINT "worktree_id_present" CHECK("id" IS NOT NULL),
	CONSTRAINT "worktree_main" CHECK("main" IN (0, 1)),
	CONSTRAINT "worktree_available" CHECK("available" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `worktree_order` ON `worktrees` (`project_id`,`position`);
--> statement-breakpoint
-- Bridge the foundation's version-1 JSON inventory. Empty on a new database.
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, repository_identity TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
--> statement-breakpoint
INSERT INTO inventory_projects (id, name, common_directory, repository_identity, available, position)
SELECT id, json_extract(data, '$.name'), json_extract(data, '$.commonDirectory'),
       repository_identity, json_extract(data, '$.available'), rowid
FROM projects;
--> statement-breakpoint
INSERT INTO worktrees (id, project_id, path, metadata_identity, main, branch, available, position)
SELECT json_extract(w.value, '$.id'), p.id, json_extract(w.value, '$.path'),
       json_extract(w.value, '$.metadataIdentity'), json_extract(w.value, '$.main'),
       json_extract(w.value, '$.branch'), json_extract(w.value, '$.available'), CAST(w.key AS INTEGER)
FROM projects AS p, json_each(p.data, '$.worktrees') AS w;
--> statement-breakpoint
DROP TABLE projects;
--> statement-breakpoint
PRAGMA user_version = 2;
