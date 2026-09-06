CREATE TYPE "public"."comment_access_status" AS ENUM('active', 'muted', 'banned');--> statement-breakpoint
CREATE TYPE "public"."comment_moderation_action_type" AS ENUM('warning', 'mute', 'ban', 'restore', 'comment_removed');--> statement-breakpoint
CREATE TABLE "comment_moderation_actions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" "comment_moderation_action_type" NOT NULL,
	"reason" text NOT NULL,
	"restriction_expires_at" timestamp with time zone,
	"performed_by_admin_id" text NOT NULL,
	"performed_by_admin_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_moderation_actions_reason_length_check" CHECK (char_length("comment_moderation_actions"."reason") between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "comment_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "comment_rate_limits_request_count_check" CHECK ("comment_rate_limits"."request_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_comment_moderation" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" "comment_access_status" DEFAULT 'active' NOT NULL,
	"restriction_expires_at" timestamp with time zone,
	"reason" text,
	"updated_by_admin_id" text,
	"updated_by_admin_name" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_comment_moderation_expiry_check" CHECK (
    ("user_comment_moderation"."status" = 'muted' AND "user_comment_moderation"."restriction_expires_at" IS NOT NULL)
    OR ("user_comment_moderation"."status" IN ('active', 'banned') AND "user_comment_moderation"."restriction_expires_at" IS NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "action_comments" ADD COLUMN "normalized_body_hash" text;--> statement-breakpoint
ALTER TABLE "comment_moderation_actions" ADD CONSTRAINT "comment_moderation_actions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_comment_moderation" ADD CONSTRAINT "user_comment_moderation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_moderation_actions_user_created_idx" ON "comment_moderation_actions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_rate_limits_expires_idx" ON "comment_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_comment_moderation_status_idx" ON "user_comment_moderation" USING btree ("status","restriction_expires_at");--> statement-breakpoint
CREATE INDEX "action_comments_user_body_hash_created_idx" ON "action_comments" USING btree ("user_id","normalized_body_hash","created_at");
