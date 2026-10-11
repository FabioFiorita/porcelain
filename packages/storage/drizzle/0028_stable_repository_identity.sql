-- Main ids heal from stored identity even when the repository is unreachable.
-- Linked rows need reachable metadata at upgrade time; every filesystem error skips
-- that worktree, so an unreachable linked worktree cannot be carried over.
-- Normalize each registration first so the survivor wins every conflicting row.
-- Foreign keys are disabled by the legacy upgrade; delete cascade leftovers explicitly.
CREATE TEMPORARY TABLE stable_projects AS
SELECT id AS project_id,
       CASE WHEN length(repository_identity) - length(replace(repository_identity, ':', '')) = 2
            THEN substr(repository_identity, instr(repository_identity, ':') + 1)
            ELSE repository_identity END AS identity,
       rowid AS registration
FROM inventory_projects;
--> statement-breakpoint
CREATE TEMPORARY TABLE stable_project_survivors AS
SELECT project_id,
       (SELECT newest.project_id FROM stable_projects AS newest
        WHERE newest.identity = original.identity ORDER BY registration DESC LIMIT 1) AS survivor_id
FROM stable_projects AS original;
--> statement-breakpoint
CREATE TEMPORARY TABLE stable_worktree_ids AS
SELECT project_id, survivor_id,
       json_extract(mapping.value, '$.old_id') AS old_id,
       json_extract(mapping.value, '$.stable_id') AS stable_id,
       json_extract(mapping.value, '$.new_id') AS new_id
FROM inventory_projects
JOIN stable_project_survivors ON project_id = inventory_projects.id,
     json_each(porcelain_stable_worktree_ids(project_id, survivor_id, common_directory, repository_identity)) AS mapping;
--> statement-breakpoint
CREATE TEMPORARY TABLE stable_duplicate_receipts AS
SELECT request_id FROM git_action_receipts
WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id);
--> statement-breakpoint
UPDATE reviews
SET worktree_id = (SELECT stable_id FROM stable_worktree_ids WHERE old_id = reviews.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids WHERE old_id <> stable_id);
--> statement-breakpoint
UPDATE reviewed_files
SET worktree_id = (SELECT stable_id FROM stable_worktree_ids WHERE old_id = reviewed_files.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids WHERE old_id <> stable_id);
--> statement-breakpoint
UPDATE reviewed_layers
SET worktree_id = (SELECT stable_id FROM stable_worktree_ids WHERE old_id = reviewed_layers.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids WHERE old_id <> stable_id);
--> statement-breakpoint
UPDATE comment_threads
SET worktree_id = (SELECT stable_id FROM stable_worktree_ids WHERE old_id = comment_threads.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids WHERE old_id <> stable_id);
--> statement-breakpoint
UPDATE comment_messages
SET worktree_id = (SELECT stable_id FROM stable_worktree_ids WHERE old_id = comment_messages.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids WHERE old_id <> stable_id);
--> statement-breakpoint
UPDATE comment_reads
SET worktree_id = (SELECT stable_id FROM stable_worktree_ids WHERE old_id = comment_reads.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids WHERE old_id <> stable_id);
--> statement-breakpoint
UPDATE git_action_receipts
SET worktree_id = (SELECT stable_id FROM stable_worktree_ids WHERE old_id = git_action_receipts.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids WHERE old_id <> stable_id);
--> statement-breakpoint
UPDATE review_proof_files
SET worktree_id = (SELECT stable_id FROM stable_worktree_ids WHERE old_id = review_proof_files.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids WHERE old_id <> stable_id);
--> statement-breakpoint
UPDATE worktree_presence
SET worktree_id = (SELECT stable_id FROM stable_worktree_ids WHERE old_id = worktree_presence.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids WHERE old_id <> stable_id);
--> statement-breakpoint
UPDATE OR IGNORE reviews
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE stable_id = reviews.worktree_id)
WHERE worktree_id IN (SELECT stable_id FROM stable_worktree_ids WHERE project_id <> survivor_id);
--> statement-breakpoint
UPDATE OR IGNORE reviewed_files
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE stable_id = reviewed_files.worktree_id)
WHERE worktree_id IN (SELECT stable_id FROM stable_worktree_ids WHERE project_id <> survivor_id);
--> statement-breakpoint
UPDATE OR IGNORE reviewed_layers
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE stable_id = reviewed_layers.worktree_id)
WHERE worktree_id IN (SELECT stable_id FROM stable_worktree_ids WHERE project_id <> survivor_id);
--> statement-breakpoint
UPDATE OR IGNORE comment_threads
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE stable_id = comment_threads.worktree_id)
WHERE worktree_id IN (SELECT stable_id FROM stable_worktree_ids WHERE project_id <> survivor_id);
--> statement-breakpoint
UPDATE OR IGNORE comment_messages
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE stable_id = comment_messages.worktree_id)
WHERE worktree_id IN (SELECT stable_id FROM stable_worktree_ids WHERE project_id <> survivor_id);
--> statement-breakpoint
UPDATE OR IGNORE comment_reads
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE stable_id = comment_reads.worktree_id)
WHERE worktree_id IN (SELECT stable_id FROM stable_worktree_ids WHERE project_id <> survivor_id);
--> statement-breakpoint
UPDATE OR IGNORE git_action_receipts
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE stable_id = git_action_receipts.worktree_id)
WHERE worktree_id IN (SELECT stable_id FROM stable_worktree_ids WHERE project_id <> survivor_id);
--> statement-breakpoint
UPDATE OR IGNORE review_proof_files
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE stable_id = review_proof_files.worktree_id)
WHERE worktree_id IN (SELECT stable_id FROM stable_worktree_ids WHERE project_id <> survivor_id)
AND NOT EXISTS (SELECT 1 FROM reviews WHERE reviews.worktree_id = review_proof_files.worktree_id);
--> statement-breakpoint
UPDATE OR IGNORE worktree_presence
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE stable_id = worktree_presence.worktree_id)
WHERE worktree_id IN (SELECT stable_id FROM stable_worktree_ids WHERE project_id <> survivor_id);
--> statement-breakpoint
UPDATE worktree_presence
SET project_id = (SELECT survivor_id FROM stable_project_survivors WHERE project_id = worktree_presence.project_id)
WHERE worktree_id IN (SELECT new_id FROM stable_worktree_ids);
--> statement-breakpoint
UPDATE git_action_receipts
SET project_id = (SELECT survivor_id FROM stable_project_survivors WHERE project_id = git_action_receipts.project_id)
WHERE worktree_id IN (SELECT new_id FROM stable_worktree_ids);
--> statement-breakpoint
DELETE FROM review_proof_files
WHERE worktree_id IN (SELECT worktree_id FROM worktree_presence
                     WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id));
--> statement-breakpoint
DELETE FROM comment_messages
WHERE worktree_id IN (SELECT worktree_id FROM worktree_presence
                     WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id));
--> statement-breakpoint
DELETE FROM comment_threads
WHERE worktree_id IN (SELECT worktree_id FROM worktree_presence
                     WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id));
--> statement-breakpoint
DELETE FROM reviews
WHERE worktree_id IN (SELECT worktree_id FROM worktree_presence
                     WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id));
--> statement-breakpoint
DELETE FROM reviewed_files
WHERE worktree_id IN (SELECT worktree_id FROM worktree_presence
                     WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id));
--> statement-breakpoint
DELETE FROM reviewed_layers
WHERE worktree_id IN (SELECT worktree_id FROM worktree_presence
                     WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id));
--> statement-breakpoint
DELETE FROM comment_reads
WHERE worktree_id IN (SELECT worktree_id FROM worktree_presence
                     WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id));
--> statement-breakpoint
DELETE FROM git_action_receipts
WHERE worktree_id IN (SELECT worktree_id FROM worktree_presence
                     WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id));
--> statement-breakpoint
DELETE FROM worktree_presence
WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id);
--> statement-breakpoint
DELETE FROM project_file_preferences
WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id);
--> statement-breakpoint
DELETE FROM git_action_receipts
WHERE project_id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id);
--> statement-breakpoint
DELETE FROM inventory_projects
WHERE id IN (SELECT project_id FROM stable_project_survivors WHERE project_id <> survivor_id);
--> statement-breakpoint
UPDATE inventory_projects
SET repository_identity = (SELECT identity FROM stable_projects WHERE project_id = inventory_projects.id);
--> statement-breakpoint
DROP TABLE stable_worktree_ids;
--> statement-breakpoint
DROP TABLE stable_project_survivors;
--> statement-breakpoint
DROP TABLE stable_projects;
