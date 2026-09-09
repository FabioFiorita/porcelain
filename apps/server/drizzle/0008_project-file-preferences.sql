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
INSERT INTO project_file_preferences (project_id, path, pinned, hidden)
SELECT ownership.project_id, preference.path, MAX(preference.pinned), MAX(preference.hidden)
FROM file_preferences AS preference
JOIN project_worktrees AS ownership ON ownership.worktree_id = preference.worktree_id
GROUP BY ownership.project_id, preference.path;
--> statement-breakpoint
DELETE FROM file_preferences
WHERE worktree_id IN (SELECT worktree_id FROM project_worktrees);
