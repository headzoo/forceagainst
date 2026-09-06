CREATE TABLE "action_comments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"action_id" bigint NOT NULL,
	"user_id" text,
	"parent_id" bigint,
	"depth" integer DEFAULT 0 NOT NULL,
	"body" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_comments_depth_check" CHECK ("action_comments"."depth" between 0 and 3),
	CONSTRAINT "action_comments_body_length_check" CHECK (char_length("action_comments"."body") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
DO $$
DECLARE
	member record;
	base_username text;
	candidate text;
	suffix integer;
BEGIN
	FOR member IN SELECT "id", "email" FROM "user" ORDER BY "created_at", "id" LOOP
		base_username := trim(both '_' from regexp_replace(lower(split_part(member."email", '@', 1)), '[^a-z0-9_]+', '_', 'g'));
		IF char_length(base_username) < 3 THEN
			base_username := 'member';
		END IF;
		candidate := left(base_username, 24);
		suffix := 2;
		WHILE EXISTS (SELECT 1 FROM "user" WHERE "username" = candidate) LOOP
			candidate := left(base_username, 24 - char_length(suffix::text) - 1) || '_' || suffix::text;
			suffix := suffix + 1;
		END LOOP;
		UPDATE "user" SET "username" = candidate WHERE "id" = member."id";
	END LOOP;
END
$$;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "action_comments" ADD CONSTRAINT "action_comments_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_comments" ADD CONSTRAINT "action_comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_comments" ADD CONSTRAINT "action_comments_parent_id_action_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."action_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_comments_action_created_idx" ON "action_comments" USING btree ("action_id","created_at");--> statement-breakpoint
CREATE INDEX "action_comments_parent_idx" ON "action_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "action_comments_user_idx" ON "action_comments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_unique" ON "user" USING btree ("username");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_format" CHECK ("user"."username" ~ '^[a-z0-9_]{3,24}$');--> statement-breakpoint
CREATE FUNCTION prevent_user_username_change() RETURNS trigger AS $$
BEGIN
	IF NEW."username" IS DISTINCT FROM OLD."username" THEN
		RAISE EXCEPTION 'Usernames cannot be changed after registration.';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER user_username_immutable
BEFORE UPDATE OF "username" ON "user"
FOR EACH ROW EXECUTE FUNCTION prevent_user_username_change();--> statement-breakpoint
CREATE FUNCTION validate_action_comment_thread() RETURNS trigger AS $$
DECLARE
	parent_action_id bigint;
	parent_depth integer;
BEGIN
	IF NEW."parent_id" IS NULL THEN
		IF NEW."depth" <> 0 THEN
			RAISE EXCEPTION 'Top-level comments must have depth 0.';
		END IF;
		RETURN NEW;
	END IF;

	SELECT "action_id", "depth" INTO parent_action_id, parent_depth
	FROM "action_comments"
	WHERE "id" = NEW."parent_id";

	IF parent_action_id IS NULL OR parent_action_id <> NEW."action_id" THEN
		RAISE EXCEPTION 'Comment parents must belong to the same action.';
	END IF;
	IF NEW."depth" <> parent_depth + 1 OR NEW."depth" > 3 THEN
		RAISE EXCEPTION 'Comments can only be nested four levels deep.';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER action_comments_validate_thread
BEFORE INSERT OR UPDATE OF "action_id", "parent_id", "depth" ON "action_comments"
FOR EACH ROW EXECUTE FUNCTION validate_action_comment_thread();
