-- Worktrees stop being stored: Git lists them and their ids are derived from
-- the project and the filesystem identity of the administrative Git directory.
--
-- Everything here runs in the one transaction Drizzle wraps this file in, so a
-- crash leaves the old ids intact rather than a half-rewritten database. The
-- derivation is registered on the connection as `porcelain_worktree_id` before
-- migrations run; it is the same function the server uses at runtime.
--
-- Rows whose old id cannot be mapped keep it. That happens when the worktree
-- had no recorded identity (it was unavailable at the last refresh) or had
-- already left the active table, and there is nothing to derive from. They are
-- not matched by path: a worktree deleted and recreated at the same path is a
-- different worktree, which is the whole reason ids are derived. They keep
-- their data. Where the project they belonged to can still be determined they
-- are seeded into worktree_presence and follow the same observed-absence rule
-- as everything else; where it cannot, they have no presence row, so nothing
-- collects them and nothing deletes them with a project. In practice
-- project_worktrees held a row for every worktree ever listed, so that set
-- should be empty.
CREATE TABLE `worktree_presence` (
  `worktree_id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `missing_since` text,
  FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `worktree_presence_project` ON `worktree_presence` (`project_id`);
--> statement-breakpoint
-- The mapping, computed once from data already stored. No filesystem access.
CREATE TEMPORARY TABLE `worktree_id_migration` AS
SELECT
  `id` AS `old_id`,
  `project_id`,
  porcelain_worktree_id(`project_id`, `metadata_identity`) AS `new_id`
FROM `worktrees`
WHERE `metadata_identity` IS NOT NULL;
--> statement-breakpoint
UPDATE `reviewed_files`
SET `worktree_id` = (
  SELECT `new_id` FROM `worktree_id_migration` WHERE `old_id` = `reviewed_files`.`worktree_id`
)
WHERE `worktree_id` IN (SELECT `old_id` FROM `worktree_id_migration`);
--> statement-breakpoint
UPDATE `artifacts`
SET `worktree_id` = (
  SELECT `new_id` FROM `worktree_id_migration` WHERE `old_id` = `artifacts`.`worktree_id`
)
WHERE `worktree_id` IN (SELECT `old_id` FROM `worktree_id_migration`);
--> statement-breakpoint
UPDATE `review_layer_sets`
SET `worktree_id` = (
  SELECT `new_id` FROM `worktree_id_migration` WHERE `old_id` = `review_layer_sets`.`worktree_id`
)
WHERE `worktree_id` IN (SELECT `old_id` FROM `worktree_id_migration`);
--> statement-breakpoint
-- A comment thread carries its worktree twice: the column it is looked up by
-- and the id inside the stored thread that is returned to the client.
UPDATE `comment_threads`
SET
  `worktree_id` = (
    SELECT `new_id` FROM `worktree_id_migration` WHERE `old_id` = `comment_threads`.`worktree_id`
  ),
  `data` = json_set(
    `data`,
    '$.worktreeId',
    (SELECT `new_id` FROM `worktree_id_migration` WHERE `old_id` = `comment_threads`.`worktree_id`)
  )
WHERE `worktree_id` IN (SELECT `old_id` FROM `worktree_id_migration`);
--> statement-breakpoint
-- Archived layers have no worktree column at all: the source worktree is only
-- inside the payload, so leaving it would return an id nothing resolves.
UPDATE `commit_review_layer_sets`
SET `data` = json_set(
  `data`,
  '$.sourceWorktreeId',
  (
    SELECT `new_id` FROM `worktree_id_migration`
    WHERE `old_id` = json_extract(`commit_review_layer_sets`.`data`, '$.sourceWorktreeId')
  )
)
WHERE json_extract(`data`, '$.sourceWorktreeId') IN (SELECT `old_id` FROM `worktree_id_migration`);
--> statement-breakpoint
-- An unexpired preparation and a recovered receipt both name their worktree in
-- a durable value; an upgrade must not strand a Git action in flight.
UPDATE `git_action_preparations`
SET `value` = json_set(
  `value`,
  '$.worktreeId',
  (
    SELECT `new_id` FROM `worktree_id_migration`
    WHERE `old_id` = json_extract(`git_action_preparations`.`value`, '$.worktreeId')
  )
)
WHERE json_extract(`value`, '$.worktreeId') IN (SELECT `old_id` FROM `worktree_id_migration`);
--> statement-breakpoint
UPDATE `git_action_receipts`
SET `value` = json_set(
  `value`,
  '$.worktreeId',
  (
    SELECT `new_id` FROM `worktree_id_migration`
    WHERE `old_id` = json_extract(`git_action_receipts`.`value`, '$.worktreeId')
  )
)
WHERE json_extract(`value`, '$.worktreeId') IN (SELECT `old_id` FROM `worktree_id_migration`);
--> statement-breakpoint
-- Presence rows for everything that now has review data, mapped or not. A
-- worktree present in Git clears `missing_since` on the first listing; one
-- that is gone has it set by the first listing that succeeds without it.
INSERT OR IGNORE INTO `worktree_presence` (`worktree_id`, `project_id`, `missing_since`)
SELECT `worktree_id`, `project_id`, NULL FROM (
  SELECT `worktree_id`, (
    SELECT `project_id` FROM `worktree_id_migration` WHERE `new_id` = `reviewed_files`.`worktree_id`
    UNION ALL
    SELECT `project_id` FROM `project_worktrees` WHERE `worktree_id` = `reviewed_files`.`worktree_id`
    LIMIT 1
  ) AS `project_id` FROM `reviewed_files`
  UNION
  SELECT `worktree_id`, (
    SELECT `project_id` FROM `worktree_id_migration` WHERE `new_id` = `artifacts`.`worktree_id`
    UNION ALL
    SELECT `project_id` FROM `project_worktrees` WHERE `worktree_id` = `artifacts`.`worktree_id`
    LIMIT 1
  ) AS `project_id` FROM `artifacts`
  UNION
  SELECT `worktree_id`, (
    SELECT `project_id` FROM `worktree_id_migration` WHERE `new_id` = `review_layer_sets`.`worktree_id`
    UNION ALL
    SELECT `project_id` FROM `project_worktrees` WHERE `worktree_id` = `review_layer_sets`.`worktree_id`
    LIMIT 1
  ) AS `project_id` FROM `review_layer_sets`
  UNION
  SELECT `worktree_id`, (
    SELECT `project_id` FROM `worktree_id_migration` WHERE `new_id` = `comment_threads`.`worktree_id`
    UNION ALL
    SELECT `project_id` FROM `project_worktrees` WHERE `worktree_id` = `comment_threads`.`worktree_id`
    LIMIT 1
  ) AS `project_id` FROM `comment_threads`
)
WHERE `project_id` IS NOT NULL;
--> statement-breakpoint
DROP TABLE `worktree_id_migration`;
--> statement-breakpoint
DROP TABLE `project_worktrees`;
--> statement-breakpoint
DROP TABLE `worktrees`;
