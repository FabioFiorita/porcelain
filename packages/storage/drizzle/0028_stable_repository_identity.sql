-- Mount device numbers are not durable identities. Compute both ids once from
-- surviving Git administrative directories; missing directories keep their rows.
-- The upgrade connection supplies the filesystem function and owns the transaction.
CREATE TEMPORARY TABLE stable_worktree_ids AS
SELECT json_extract(mapping.value, '$.old_id') AS old_id,
       json_extract(mapping.value, '$.new_id') AS new_id
FROM inventory_projects,
     json_each(porcelain_stable_worktree_ids(inventory_projects.id, common_directory)) AS mapping
WHERE length(repository_identity) - length(replace(repository_identity, ':', '')) = 2;
--> statement-breakpoint
UPDATE reviews
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE old_id = reviews.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids);
--> statement-breakpoint
UPDATE reviewed_files
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE old_id = reviewed_files.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids);
--> statement-breakpoint
UPDATE reviewed_layers
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE old_id = reviewed_layers.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids);
--> statement-breakpoint
UPDATE comment_threads
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE old_id = comment_threads.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids);
--> statement-breakpoint
UPDATE comment_messages
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE old_id = comment_messages.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids);
--> statement-breakpoint
UPDATE comment_reads
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE old_id = comment_reads.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids);
--> statement-breakpoint
UPDATE git_action_receipts
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE old_id = git_action_receipts.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids);
--> statement-breakpoint
UPDATE review_proof_files
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE old_id = review_proof_files.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids);
--> statement-breakpoint
UPDATE worktree_presence
SET worktree_id = (SELECT new_id FROM stable_worktree_ids WHERE old_id = worktree_presence.worktree_id)
WHERE worktree_id IN (SELECT old_id FROM stable_worktree_ids);
--> statement-breakpoint
-- Re-registration after a device change may have created two project ids for
-- this repository. Keep both and their data; registration reuses a matching
-- identity under the inventory write lane, so it creates no further duplicates.
DROP INDEX inventory_projects_repository_identity_unique;
--> statement-breakpoint
UPDATE inventory_projects
SET repository_identity = substr(repository_identity, instr(repository_identity, ':') + 1)
WHERE length(repository_identity) - length(replace(repository_identity, ':', '')) = 2;
--> statement-breakpoint
DROP TABLE stable_worktree_ids;
