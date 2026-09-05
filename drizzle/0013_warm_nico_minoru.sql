CREATE TYPE "public"."congress_chamber" AS ENUM('house', 'senate');--> statement-breakpoint
CREATE TABLE "congress_members" (
	"bioguide_id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"suffix" text,
	"nickname" text,
	"official_full_name" text NOT NULL,
	"party" text NOT NULL,
	"chamber" "congress_chamber" NOT NULL,
	"state" text NOT NULL,
	"district" integer,
	"senate_class" integer,
	"senate_rank" integer,
	"display_title" text NOT NULL,
	"official_website" text,
	"contact_form_url" text,
	"capitol_phone" text,
	"capitol_office" text,
	"mailing_address" text,
	"congress_gov_profile_url" text,
	"official_image_url" text,
	"official_image_attribution" text,
	"official_social_handles" jsonb,
	"district_offices" jsonb,
	"is_current" boolean DEFAULT true NOT NULL,
	"provider_updated_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "congress_members_current_chamber_state_district_idx" ON "congress_members" USING btree ("is_current","chamber","state","district");--> statement-breakpoint
CREATE INDEX "congress_members_current_state_idx" ON "congress_members" USING btree ("is_current","state");--> statement-breakpoint
CREATE INDEX "congress_members_current_roster_sort_idx" ON "congress_members" USING btree ("is_current","chamber","state","district","senate_class","last_name","first_name");