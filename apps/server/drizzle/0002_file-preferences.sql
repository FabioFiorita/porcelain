CREATE TABLE `file_preferences` (
	`worktree_id` text NOT NULL,
	`path` text NOT NULL,
	`pinned` integer NOT NULL,
	`hidden` integer NOT NULL,
	PRIMARY KEY(`worktree_id`, `path`),
	CONSTRAINT "preference_pinned" CHECK("file_preferences"."pinned" IN (0, 1)),
	CONSTRAINT "preference_hidden" CHECK("file_preferences"."hidden" IN (0, 1))
);
