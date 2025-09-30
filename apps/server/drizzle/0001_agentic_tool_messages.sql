ALTER TABLE `messages` ADD COLUMN `tool_name` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `tool_call_id` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `arguments` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `result` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `metadata` text;
