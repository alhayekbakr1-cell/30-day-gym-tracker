CREATE TABLE `gym_challenge_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`state_json` text NOT NULL,
	`archived_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `gym_challenge_history_user_archived_idx` ON `gym_challenge_history` (`user_email`,`archived_at`);--> statement-breakpoint
CREATE TABLE `gym_coach_snapshot` (
	`user_email` text PRIMARY KEY NOT NULL,
	`completed_sessions` integer DEFAULT 0 NOT NULL,
	`sessions_due` integer DEFAULT 0 NOT NULL,
	`consistency_pct` integer DEFAULT 0 NOT NULL,
	`total_volume` integer DEFAULT 0 NOT NULL,
	`weight_unit` text DEFAULT 'lb' NOT NULL,
	`load_unit` text DEFAULT 'lb' NOT NULL,
	`progress_version` integer DEFAULT 0 NOT NULL,
	`latest_weight` text,
	`weight_change` text,
	`average_sleep` text,
	`average_rir` text,
	`rir_coverage_pct` integer DEFAULT 0 NOT NULL,
	`next_workout` text,
	`next_workout_date` text,
	`recommendation` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
