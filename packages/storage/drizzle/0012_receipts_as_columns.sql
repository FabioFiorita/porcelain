-- A Git action receipt is stored in columns, like every other table: the
-- fields the store filters and orders by (state, finished_at, dismissed_at)
-- are queried directly instead of through json_extract, and project_id and
-- worktree_id are no longer stored twice. Only the nested values stay JSON:
-- the intent, the expectation, the result and the progress lines.
--
-- Every receipt is copied from its stored value. A receipt written before a
-- field existed takes the value the current code would have read: an action
-- from its intent, an empty expectation, no progress, and a refresh required,
-- which is the cautious answer when the outcome is unknown. A value without a
-- state, an intent or an acceptance time is no receipt at all and is dropped.
-- SQLite cannot change a column list in place, so the table is rebuilt, with
-- foreign key enforcement off and a foreign_key_check before commit as for
-- every migration.
CREATE TABLE `__new_git_action_receipts` (
	`request_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`worktree_id` text NOT NULL,
	`action` text NOT NULL,
	`state` text NOT NULL,
	`reason` text,
	`message` text,
	`refresh_required` integer NOT NULL,
	`accepted_at` text NOT NULL,
	`finished_at` text,
	`dismissed_at` text,
	`intent` text NOT NULL,
	`expected` text NOT NULL,
	`result` text,
	`progress` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktree_presence`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_git_action_receipts` (
	"request_id", "project_id", "worktree_id", "action", "state", "reason",
	"message", "refresh_required", "accepted_at", "finished_at", "dismissed_at",
	"intent", "expected", "result", "progress"
)
SELECT
	"request_id",
	"project_id",
	"worktree_id",
	COALESCE(json_extract("value", '$.action'), json_extract("value", '$.intent.action')),
	json_extract("value", '$.state'),
	json_extract("value", '$.reason'),
	json_extract("value", '$.message'),
	COALESCE(json_extract("value", '$.refreshRequired'), 1),
	json_extract("value", '$.acceptedAt'),
	json_extract("value", '$.finishedAt'),
	json_extract("value", '$.dismissedAt'),
	json_extract("value", '$.intent'),
	COALESCE(json_extract("value", '$.expected'), '{}'),
	json_extract("value", '$.result'),
	COALESCE(json_extract("value", '$.progress'), '[]')
FROM `git_action_receipts`
WHERE json_type("value", '$.state') = 'text'
	AND json_type("value", '$.intent') = 'object'
	AND json_type("value", '$.intent.action') = 'text'
	AND json_type("value", '$.acceptedAt') = 'text';
--> statement-breakpoint
DROP TABLE `git_action_receipts`;
--> statement-breakpoint
ALTER TABLE `__new_git_action_receipts` RENAME TO `git_action_receipts`;
--> statement-breakpoint
CREATE INDEX `git_action_receipts_project` ON `git_action_receipts` (`project_id`);
--> statement-breakpoint
CREATE INDEX `git_action_receipts_worktree` ON `git_action_receipts` (`worktree_id`);
