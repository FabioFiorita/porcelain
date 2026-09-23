ALTER TABLE `comment_threads` RENAME TO `comment_threads_legacy`;
--> statement-breakpoint
CREATE TABLE `comment_threads` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`worktree_id` text NOT NULL,
	`anchor` text NOT NULL,
	`resolved` integer NOT NULL,
	`revision` integer NOT NULL,
	`last_agent_revision` integer,
	`size_bytes` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_threads_normalized_id_unique` ON `comment_threads` (`id`);
--> statement-breakpoint
CREATE INDEX `comment_threads_worktree` ON `comment_threads` (`worktree_id`);
--> statement-breakpoint
CREATE TABLE `comment_messages` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`thread_id` text NOT NULL,
	`worktree_id` text NOT NULL,
	`body` text NOT NULL,
	`author` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`thread_id`) REFERENCES `comment_threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `comment_threads` (
	`sequence`, `id`, `worktree_id`, `anchor`, `resolved`, `revision`,
	`last_agent_revision`, `size_bytes`
)
SELECT
	`sequence`,
	`id`,
	`worktree_id`,
	json_extract(`data`, '$.anchor'),
	CASE json_extract(`data`, '$.resolved') WHEN 1 THEN 1 ELSE 0 END,
	`revision`,
	`last_agent_revision`,
	length(cast(`data` AS blob)) +
		CASE json_extract(`data`, '$.resolved') WHEN 1 THEN 1 ELSE 0 END
FROM `comment_threads_legacy`
ORDER BY `sequence`;
--> statement-breakpoint
INSERT INTO `comment_messages` (
	`id`, `thread_id`, `worktree_id`, `body`, `author`, `created_at`
)
SELECT
	json_extract(message.value, '$.id'),
	thread.`id`,
	thread.`worktree_id`,
	json_extract(message.value, '$.body'),
	coalesce(json_extract(message.value, '$.author'), 'reviewer'),
	json_extract(message.value, '$.createdAt')
FROM `comment_threads_legacy` AS thread,
	json_each(thread.`data`, '$.messages') AS message
ORDER BY thread.`sequence`, cast(message.key AS integer);
--> statement-breakpoint
DROP TABLE `comment_threads_legacy`;
--> statement-breakpoint
CREATE INDEX `comment_messages_id` ON `comment_messages` (`id`);
--> statement-breakpoint
CREATE INDEX `comment_messages_thread` ON `comment_messages` (`thread_id`,`sequence`);
--> statement-breakpoint
CREATE INDEX `comment_messages_worktree` ON `comment_messages` (`worktree_id`);
