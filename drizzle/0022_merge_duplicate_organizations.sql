-- Merge ownerless organizations that the seed importer recreated without the
-- required "Supporters of " prefix. Member-owned organizations and records
-- containing manually submitted actions are deliberately excluded.
WITH duplicate_pairs AS (
	SELECT "raw"."id" AS "raw_id", "supporters"."id" AS "supporters_id"
	FROM "orgs" AS "raw"
	JOIN "orgs" AS "supporters"
		ON "supporters"."name" = 'Supporters of ' || "raw"."name"
	WHERE "raw"."owner_user_id" IS NULL
		AND "supporters"."owner_user_id" IS NULL
		AND "raw"."created_at" >= "supporters"."created_at"
		AND NOT EXISTS (
			SELECT 1
			FROM "actions"
			WHERE "actions"."org_id" = "raw"."id"
				AND "actions"."automatically_added" = false
		)
)
UPDATE "orgs" AS "supporters"
SET
	"website" = COALESCE("supporters"."website", "raw"."website"),
	"open_graph" = COALESCE("supporters"."open_graph", "raw"."open_graph"),
	"description" = CASE
		WHEN "supporters"."description" = '' THEN "raw"."description"
		ELSE "supporters"."description"
	END,
	"sidebar" = CASE
		WHEN "supporters"."sidebar" = '' THEN "raw"."sidebar"
		ELSE "supporters"."sidebar"
	END,
	"updated_at" = GREATEST("supporters"."updated_at", "raw"."updated_at")
FROM duplicate_pairs
JOIN "orgs" AS "raw" ON "raw"."id" = duplicate_pairs."raw_id"
WHERE "supporters"."id" = duplicate_pairs."supporters_id";--> statement-breakpoint

WITH duplicate_pairs AS (
	SELECT "raw"."id" AS "raw_id", "supporters"."id" AS "supporters_id"
	FROM "orgs" AS "raw"
	JOIN "orgs" AS "supporters"
		ON "supporters"."name" = 'Supporters of ' || "raw"."name"
	WHERE "raw"."owner_user_id" IS NULL
		AND "supporters"."owner_user_id" IS NULL
		AND "raw"."created_at" >= "supporters"."created_at"
		AND NOT EXISTS (
			SELECT 1
			FROM "actions"
			WHERE "actions"."org_id" = "raw"."id"
				AND "actions"."automatically_added" = false
		)
)
UPDATE "actions"
SET "org_id" = duplicate_pairs."supporters_id"
FROM duplicate_pairs
WHERE "actions"."org_id" = duplicate_pairs."raw_id";--> statement-breakpoint

DELETE FROM "orgs" AS "raw"
USING "orgs" AS "supporters"
WHERE "supporters"."name" = 'Supporters of ' || "raw"."name"
	AND "raw"."owner_user_id" IS NULL
	AND "supporters"."owner_user_id" IS NULL
	AND "raw"."created_at" >= "supporters"."created_at"
	AND NOT EXISTS (
		SELECT 1
		FROM "actions"
		WHERE "actions"."org_id" = "raw"."id"
	);
