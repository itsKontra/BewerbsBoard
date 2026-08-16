CREATE TABLE `app_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`user` text NOT NULL,
	`action` text NOT NULL,
	`details` text
);
--> statement-breakpoint
CREATE TABLE `category_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`category_type_id` text NOT NULL,
	`run_status` text DEFAULT 'OPEN' NOT NULL,
	`start_order_position` integer,
	`attack_time_hundredths` integer,
	`attack_time_errors` integer,
	`relay_race_hundredths` integer,
	`relay_race_errors` integer,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_type_id`) REFERENCES `category_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_entries_group_id_category_type_id_unique` ON `category_entries` (`group_id`,`category_type_id`);--> statement-breakpoint
CREATE TABLE `category_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`competition_class_id` text NOT NULL,
	`has_relay_race` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`competition_class_id`) REFERENCES `competition_classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_types_name_unique` ON `category_types` (`name`);--> statement-breakpoint
CREATE TABLE `competition_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_classes_name_unique` ON `competition_classes` (`name`);--> statement-breakpoint
CREATE TABLE `evaluation_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category_type_id_1` text NOT NULL,
	`category_type_id_2` text,
	`exclude_relay_race` integer NOT NULL,
	`is_brigade_pairing` integer DEFAULT false NOT NULL,
	`public` integer DEFAULT true NOT NULL,
	`public_tv` integer DEFAULT true NOT NULL,
	`display_duration_seconds` integer DEFAULT 10 NOT NULL,
	`order` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`category_type_id_1`) REFERENCES `category_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_type_id_2`) REFERENCES `category_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_types_name_unique` ON `evaluation_types` (`name`);--> statement-breakpoint
CREATE TABLE `fire_brigades` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fire_brigades_name_unique` ON `fire_brigades` (`name`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`fire_brigade_id` text NOT NULL,
	`competition_class_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`fire_brigade_id`) REFERENCES `fire_brigades`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`competition_class_id`) REFERENCES `competition_classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_fire_brigade_id_name_competition_class_unique` ON `groups` (`fire_brigade_id`,`name`,`competition_class_id`);--> statement-breakpoint
CREATE TABLE `tv_runtime_state` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'ROTATION' NOT NULL,
	`selected_category_id` text,
	`updated_at` integer
);
--> statement-breakpoint
-- seed-data:start
INSERT INTO `tv_runtime_state` (`id`, `mode`) VALUES
  ('default', 'ROTATION');
--> statement-breakpoint
INSERT INTO `competition_classes` (`id`, `name`) VALUES
  ('cc-aktiv', 'AKTIV'),
  ('cc-jugend', 'JUGEND'),
  ('cc-gast', 'GAST');
--> statement-breakpoint
INSERT INTO `category_types` (`id`, `name`, `competition_class_id`, `has_relay_race`) VALUES
  ('bronze-aktiv', 'Bronze Aktiv', 'cc-aktiv', 1),
  ('silber-aktiv', 'Silber Aktiv', 'cc-aktiv', 1),
  ('bronze-jugend', 'Bronze Jugend', 'cc-jugend', 0),
  ('bronze-gaeste', 'Bronze Gäste', 'cc-gast', 1),
  ('silber-gaeste', 'Silber Gäste', 'cc-gast', 1);
--> statement-breakpoint
INSERT INTO `evaluation_types` (`id`, `name`, `category_type_id_1`, `category_type_id_2`, `exclude_relay_race`, `is_brigade_pairing`, `public`, `public_tv`, `display_duration_seconds`, `order`) VALUES
  ('bronze-aktiv', 'Bronze Aktiv', 'bronze-aktiv', NULL, 0, 0, 1, 1, 12, 1),
  ('silber-aktiv', 'Silber Aktiv', 'silber-aktiv', NULL, 0, 0, 1, 1, 12, 2),
  ('bronze-jugend', 'Bronze Jugend', 'bronze-jugend', NULL, 0, 0, 1, 1, 10, 3),
  ('bronze-gaeste', 'Bronze Gäste', 'bronze-gaeste', NULL, 0, 0, 1, 1, 10, 5),
  ('silber-gaeste', 'Silber Gäste', 'silber-gaeste', NULL, 0, 0, 1, 1, 10, 6),
  ('gesamt-aktiv', 'Gesamtwertung Aktiv', 'bronze-aktiv', 'silber-aktiv', 0, 0, 1, 1, 10, 7),
  ('gesamt-feuerwehr', 'Gesamtwertung Feuerwehr', 'bronze-aktiv', 'bronze-jugend', 1, 1, 1, 1, 10, 8);
-- seed-data:end
