CREATE TABLE `members` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`code` text PRIMARY KEY NOT NULL,
	`plu` text NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`mode` text DEFAULT 'weight' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`created` text NOT NULL,
	`cashier` text NOT NULL,
	`total` integer NOT NULL,
	`cash` integer NOT NULL,
	`qr` integer NOT NULL,
	`items` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`void_reason` text,
	`qr_recipient` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
