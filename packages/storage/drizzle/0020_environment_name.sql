CREATE TABLE `environment_name` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	CONSTRAINT "environment_name_singleton" CHECK("environment_name"."singleton" = 1)
);
