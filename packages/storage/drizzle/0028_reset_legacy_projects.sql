-- Reset registrations made with dev:ino:birthtimeNs so they can be added again.
-- Foreign keys are disabled during upgrades, so remove their children explicitly.
CREATE TEMP TABLE reset_projects AS
SELECT id FROM inventory_projects
WHERE length(repository_identity) - length(replace(repository_identity, ':', '')) = 2;
--> statement-breakpoint
CREATE TEMP TABLE reset_worktrees AS
SELECT worktree_id FROM worktree_presence WHERE project_id IN (SELECT id FROM reset_projects);
--> statement-breakpoint
DELETE FROM comment_messages WHERE worktree_id IN (SELECT worktree_id FROM reset_worktrees)
OR thread_id IN (SELECT id FROM comment_threads WHERE worktree_id IN (SELECT worktree_id FROM reset_worktrees));
--> statement-breakpoint
DELETE FROM comment_threads WHERE worktree_id IN (SELECT worktree_id FROM reset_worktrees);
--> statement-breakpoint
DELETE FROM comment_reads WHERE worktree_id IN (SELECT worktree_id FROM reset_worktrees);
--> statement-breakpoint
DELETE FROM review_proof_files WHERE worktree_id IN (SELECT worktree_id FROM reset_worktrees);
--> statement-breakpoint
DELETE FROM reviews WHERE worktree_id IN (SELECT worktree_id FROM reset_worktrees);
--> statement-breakpoint
DELETE FROM reviewed_files WHERE worktree_id IN (SELECT worktree_id FROM reset_worktrees);
--> statement-breakpoint
DELETE FROM reviewed_layers WHERE worktree_id IN (SELECT worktree_id FROM reset_worktrees);
--> statement-breakpoint
DELETE FROM git_action_receipts WHERE worktree_id IN (SELECT worktree_id FROM reset_worktrees)
OR project_id IN (SELECT id FROM reset_projects);
--> statement-breakpoint
DELETE FROM worktree_presence WHERE worktree_id IN (SELECT worktree_id FROM reset_worktrees);
--> statement-breakpoint
DELETE FROM project_file_preferences WHERE project_id IN (SELECT id FROM reset_projects);
--> statement-breakpoint
DELETE FROM inventory_projects WHERE id IN (SELECT id FROM reset_projects);
--> statement-breakpoint
DROP TABLE reset_worktrees;
--> statement-breakpoint
DROP TABLE reset_projects;
