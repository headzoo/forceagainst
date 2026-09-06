CREATE TYPE "public"."comment_moderation_event_type" AS ENUM('comment_under_review', 'comment_removed', 'comment_restored', 'report_reviewing', 'report_resolved', 'report_dismissed', 'thread_locked', 'thread_unlocked', 'slow_mode_changed');--> statement-breakpoint
CREATE TYPE "public"."comment_report_status" AS ENUM('pending', 'reviewing', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."comment_visibility_status" AS ENUM('visible', 'under_review', 'removed');--> statement-breakpoint
CREATE TABLE "comment_moderation_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"action_id" bigint NOT NULL,
	"comment_id" bigint,
	"report_id" bigint,
	"target_user_id" text,
	"event" "comment_moderation_event_type" NOT NULL,
	"reason" text NOT NULL,
	"previous_state" text,
	"new_state" text,
	"performed_by_admin_id" text NOT NULL,
	"performed_by_admin_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_moderation_events_reason_length_check" CHECK (char_length("comment_moderation_events"."reason") between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "comment_reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"comment_id" bigint NOT NULL,
	"action_id" bigint NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "comment_report_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_admin_id" text,
	"reviewed_by_admin_name" text,
	"reviewed_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reports_reason_check" CHECK ("comment_reports"."reason" IN ('spam', 'harassment', 'hate', 'misinformation', 'other')),
	CONSTRAINT "comment_reports_details_length_check" CHECK ("comment_reports"."details" IS NULL OR char_length("comment_reports"."details") <= 1000),
	CONSTRAINT "comment_reports_resolution_length_check" CHECK ("comment_reports"."resolution_note" IS NULL OR char_length("comment_reports"."resolution_note") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "comment_user_blocks" (
	"blocker_user_id" text NOT NULL,
	"blocked_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_user_blocks_blocker_user_id_blocked_user_id_pk" PRIMARY KEY("blocker_user_id","blocked_user_id"),
	CONSTRAINT "comment_user_blocks_not_self_check" CHECK ("comment_user_blocks"."blocker_user_id" <> "comment_user_blocks"."blocked_user_id")
);
--> statement-breakpoint
ALTER TABLE "action_comments" ADD COLUMN "moderation_status" "comment_visibility_status" DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_comments" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "action_comments" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "action_comments" ADD COLUMN "moderated_by_admin_id" text;--> statement-breakpoint
ALTER TABLE "action_comments" ADD COLUMN "moderated_by_admin_name" text;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "comments_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "comment_slow_mode_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comment_moderation_events" ADD CONSTRAINT "comment_moderation_events_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_moderation_events" ADD CONSTRAINT "comment_moderation_events_comment_id_action_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."action_comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_moderation_events" ADD CONSTRAINT "comment_moderation_events_report_id_comment_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."comment_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_moderation_events" ADD CONSTRAINT "comment_moderation_events_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_comment_id_action_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."action_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_user_blocks" ADD CONSTRAINT "comment_user_blocks_blocker_user_id_user_id_fk" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_user_blocks" ADD CONSTRAINT "comment_user_blocks_blocked_user_id_user_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_moderation_events_action_created_idx" ON "comment_moderation_events" USING btree ("action_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_moderation_events_comment_created_idx" ON "comment_moderation_events" USING btree ("comment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_reports_comment_reporter_unique" ON "comment_reports" USING btree ("comment_id","reporter_user_id");--> statement-breakpoint
CREATE INDEX "comment_reports_status_created_idx" ON "comment_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "comment_reports_action_idx" ON "comment_reports" USING btree ("action_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_user_blocks_blocked_idx" ON "comment_user_blocks" USING btree ("blocked_user_id");--> statement-breakpoint
CREATE INDEX "action_comments_moderation_status_idx" ON "action_comments" USING btree ("moderation_status","created_at");--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_comment_slow_mode_check" CHECK ("actions"."comment_slow_mode_seconds" IN (0, 30, 60, 300, 900, 3600));--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."maintain_action_comment_count"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF NEW."deleted_at" IS NULL AND NEW."moderation_status" = 'visible' THEN
			UPDATE "public"."actions"
			SET "comment_count" = "comment_count" + 1
			WHERE "id" = NEW."action_id";
		END IF;
		RETURN NEW;
	END IF;

	IF TG_OP = 'DELETE' THEN
		IF OLD."deleted_at" IS NULL AND OLD."moderation_status" = 'visible' THEN
			UPDATE "public"."actions"
			SET "comment_count" = GREATEST("comment_count" - 1, 0)
			WHERE "id" = OLD."action_id";
		END IF;
		RETURN OLD;
	END IF;

	IF OLD."action_id" IS DISTINCT FROM NEW."action_id"
		OR (OLD."deleted_at" IS NULL AND OLD."moderation_status" = 'visible')
			IS DISTINCT FROM (NEW."deleted_at" IS NULL AND NEW."moderation_status" = 'visible') THEN
		IF OLD."deleted_at" IS NULL AND OLD."moderation_status" = 'visible' THEN
			UPDATE "public"."actions"
			SET "comment_count" = GREATEST("comment_count" - 1, 0)
			WHERE "id" = OLD."action_id";
		END IF;

		IF NEW."deleted_at" IS NULL AND NEW."moderation_status" = 'visible' THEN
			UPDATE "public"."actions"
			SET "comment_count" = "comment_count" + 1
			WHERE "id" = NEW."action_id";
		END IF;
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER "action_comments_maintain_count" ON "public"."action_comments";--> statement-breakpoint
CREATE TRIGGER "action_comments_maintain_count"
AFTER INSERT OR DELETE OR UPDATE OF "action_id", "deleted_at", "moderation_status" ON "public"."action_comments"
FOR EACH ROW
EXECUTE FUNCTION "public"."maintain_action_comment_count"();
