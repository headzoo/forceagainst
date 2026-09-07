CREATE TABLE "organization_members" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"invited_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_orgs_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_organization_user_unique" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_members_organization_tier_idx" ON "organization_members" USING btree ("organization_id","id");--> statement-breakpoint
INSERT INTO "organization_members" (
	"organization_id",
	"user_id",
	"invited_by_user_id",
	"created_at"
)
SELECT
	"id",
	"owner_user_id",
	NULL,
	"created_at"
FROM "orgs"
WHERE "owner_user_id" IS NOT NULL
ORDER BY "created_at", "id"
ON CONFLICT ("organization_id", "user_id") DO NOTHING;--> statement-breakpoint
CREATE FUNCTION "ensure_organization_owner_membership"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
	IF NEW."owner_user_id" IS NOT NULL THEN
		INSERT INTO "organization_members" (
			"organization_id",
			"user_id",
			"invited_by_user_id",
			"created_at"
		)
		VALUES (
			NEW."id",
			NEW."owner_user_id",
			NULL,
			NEW."created_at"
		)
		ON CONFLICT ("organization_id", "user_id") DO NOTHING;
	END IF;

	RETURN NEW;
END
$function$;--> statement-breakpoint
CREATE TRIGGER "orgs_ensure_owner_membership"
AFTER INSERT OR UPDATE OF "owner_user_id" ON "orgs"
FOR EACH ROW
EXECUTE FUNCTION "ensure_organization_owner_membership"();
