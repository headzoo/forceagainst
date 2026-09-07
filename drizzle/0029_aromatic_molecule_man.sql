CREATE TYPE "public"."legislative_lifecycle_stage" AS ENUM('introduced', 'committee', 'floor', 'cross_chamber', 'enrolled', 'executive', 'law', 'vetoed', 'failed', 'other');--> statement-breakpoint
CREATE TYPE "public"."legislative_source" AS ENUM('legiscan', 'congress');--> statement-breakpoint
CREATE TABLE "legislative_bill_actions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bill_id" bigint NOT NULL,
	"provider_action_key" text NOT NULL,
	"action_date" timestamp with time zone,
	"body" text,
	"description" text NOT NULL,
	"provider_action_code" text,
	"stage" "legislative_lifecycle_stage",
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legislative_bills" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" "legislative_source" NOT NULL,
	"provider_bill_id" text NOT NULL,
	"session_id" bigint NOT NULL,
	"jurisdiction" text NOT NULL,
	"bill_number" text NOT NULL,
	"bill_type" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"origin_chamber" text,
	"latest_action_body" text,
	"latest_action_text" text,
	"latest_action_date" timestamp with time zone,
	"stage" "legislative_lifecycle_stage" DEFAULT 'other' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"provider_status" text,
	"provider_status_code" text,
	"public_source_url" text,
	"master_change_hash" text,
	"detail_change_hash" text,
	"provider_updated_at" timestamp with time zone,
	"details_pending" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legislative_sessions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" "legislative_source" NOT NULL,
	"provider_session_id" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"display_name" text NOT NULL,
	"year_start" integer,
	"year_end" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_current" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legislative_sync_checkpoints" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" "legislative_source" NOT NULL,
	"scope" text NOT NULL,
	"watermark" text,
	"last_success_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legislative_bill_actions" ADD CONSTRAINT "legislative_bill_actions_bill_id_legislative_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."legislative_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislative_bills" ADD CONSTRAINT "legislative_bills_session_id_legislative_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."legislative_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legislative_bill_actions_bill_provider_key_unique" ON "legislative_bill_actions" USING btree ("bill_id","provider_action_key");--> statement-breakpoint
CREATE INDEX "legislative_bill_actions_bill_order_idx" ON "legislative_bill_actions" USING btree ("bill_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "legislative_bills_source_provider_unique" ON "legislative_bills" USING btree ("source","provider_bill_id");--> statement-breakpoint
CREATE INDEX "legislative_bills_state_active_list_idx" ON "legislative_bills" USING btree ("source","jurisdiction","is_active","session_id");--> statement-breakpoint
CREATE INDEX "legislative_bills_federal_origin_active_idx" ON "legislative_bills" USING btree ("source","session_id","origin_chamber","is_active");--> statement-breakpoint
CREATE INDEX "legislative_bills_session_idx" ON "legislative_bills" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legislative_sessions_source_provider_unique" ON "legislative_sessions" USING btree ("source","provider_session_id");--> statement-breakpoint
CREATE INDEX "legislative_sessions_current_jurisdiction_idx" ON "legislative_sessions" USING btree ("jurisdiction","is_current");--> statement-breakpoint
CREATE UNIQUE INDEX "legislative_sync_checkpoints_source_scope_unique" ON "legislative_sync_checkpoints" USING btree ("source","scope");