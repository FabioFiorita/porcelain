CREATE TABLE `commit_review_layer_sets` (
	`project_id` text NOT NULL,
	`commit_oid` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`project_id`, `commit_oid`),
	FOREIGN KEY (`project_id`) REFERENCES `inventory_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
