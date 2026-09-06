CREATE TABLE "action_comment_bans" (
	"action_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"banned_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_comment_bans_action_id_user_id_pk" PRIMARY KEY("action_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organization_comment_bans" (
	"organization_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"banned_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_comment_bans_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "action_comment_bans" ADD CONSTRAINT "action_comment_bans_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_comment_bans" ADD CONSTRAINT "action_comment_bans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_comment_bans" ADD CONSTRAINT "action_comment_bans_banned_by_user_id_user_id_fk" FOREIGN KEY ("banned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_comment_bans" ADD CONSTRAINT "organization_comment_bans_organization_id_orgs_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_comment_bans" ADD CONSTRAINT "organization_comment_bans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_comment_bans" ADD CONSTRAINT "organization_comment_bans_banned_by_user_id_user_id_fk" FOREIGN KEY ("banned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_comment_bans_user_idx" ON "action_comment_bans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_comment_bans_user_idx" ON "organization_comment_bans" USING btree ("user_id");