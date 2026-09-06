ALTER TABLE "actions" ADD COLUMN "comment_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_comment_count_nonnegative_check" CHECK ("actions"."comment_count" >= 0);--> statement-breakpoint
CREATE FUNCTION "public"."maintain_action_comment_count"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF NEW."deleted_at" IS NULL THEN
			UPDATE "public"."actions"
			SET "comment_count" = "comment_count" + 1
			WHERE "id" = NEW."action_id";
		END IF;
		RETURN NEW;
	END IF;

	IF TG_OP = 'DELETE' THEN
		IF OLD."deleted_at" IS NULL THEN
			UPDATE "public"."actions"
			SET "comment_count" = GREATEST("comment_count" - 1, 0)
			WHERE "id" = OLD."action_id";
		END IF;
		RETURN OLD;
	END IF;

	IF OLD."action_id" IS DISTINCT FROM NEW."action_id"
		OR (OLD."deleted_at" IS NULL) <> (NEW."deleted_at" IS NULL) THEN
		IF OLD."deleted_at" IS NULL THEN
			UPDATE "public"."actions"
			SET "comment_count" = GREATEST("comment_count" - 1, 0)
			WHERE "id" = OLD."action_id";
		END IF;

		IF NEW."deleted_at" IS NULL THEN
			UPDATE "public"."actions"
			SET "comment_count" = "comment_count" + 1
			WHERE "id" = NEW."action_id";
		END IF;
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "action_comments_maintain_count"
AFTER INSERT OR DELETE OR UPDATE OF "action_id", "deleted_at" ON "public"."action_comments"
FOR EACH ROW
EXECUTE FUNCTION "public"."maintain_action_comment_count"();--> statement-breakpoint
UPDATE "public"."actions"
SET "comment_count" = (
	SELECT count(*)::integer
	FROM "public"."action_comments"
	WHERE "action_comments"."action_id" = "actions"."id"
		AND "action_comments"."deleted_at" IS NULL
);
