-- Consolidate every auto-imported action beneath one shared organization while
-- preserving the existing account owner and organization-level moderation bans.
DO $migration$
DECLARE
	target_organization_id bigint;
	supporter_owner_user_id text;
	manual_action_count integer;
	distinct_owner_count integer;
BEGIN
	LOCK TABLE "orgs" IN SHARE ROW EXCLUSIVE MODE;
	LOCK TABLE "actions" IN SHARE ROW EXCLUSIVE MODE;
	LOCK TABLE "organization_comment_bans" IN SHARE ROW EXCLUSIVE MODE;

	SELECT count(*)::integer
	INTO manual_action_count
	FROM "actions"
	JOIN "orgs" ON "orgs"."id" = "actions"."org_id"
	WHERE "orgs"."name" ~* '^Supporters of '
		AND "actions"."automatically_added" = false;

	IF manual_action_count > 0 THEN
		RAISE EXCEPTION 'Refusing to collapse supporter organizations with % manually submitted actions', manual_action_count;
	END IF;

	SELECT count(DISTINCT "owner_user_id")::integer
	INTO distinct_owner_count
	FROM "orgs"
	WHERE "name" ~* '^Supporters of '
		AND "owner_user_id" IS NOT NULL;

	IF distinct_owner_count > 1 THEN
		RAISE EXCEPTION 'Refusing to collapse supporter organizations owned by % different users', distinct_owner_count;
	END IF;

	SELECT "id"
	INTO target_organization_id
	FROM "orgs"
	WHERE "name" = 'Supporters of Force'
	ORDER BY "id"
	LIMIT 1;

	IF target_organization_id IS NULL THEN
		SELECT "id"
		INTO target_organization_id
		FROM "orgs"
		WHERE "name" ~* '^Supporters of '
		ORDER BY ("owner_user_id" IS NOT NULL) DESC, "created_at", "id"
		LIMIT 1;
	END IF;

	IF target_organization_id IS NULL THEN
		INSERT INTO "orgs" (
			"name",
			"slug",
			"website"
		)
		VALUES (
			'Supporters of Force',
			'supporters-of-force',
			'https://forceagainst.com/'
		)
		RETURNING "id" INTO target_organization_id;
	ELSE
		IF EXISTS (
			SELECT 1
			FROM "orgs"
			WHERE "slug" = 'supporters-of-force'
				AND "id" <> target_organization_id
		) THEN
			RAISE EXCEPTION 'Cannot assign the supporters-of-force slug because another organization already uses it';
		END IF;

		UPDATE "orgs"
		SET
			"name" = 'Supporters of Force',
			"slug" = 'supporters-of-force',
			"avatar" = NULL,
			"website" = 'https://forceagainst.com/',
			"open_graph" = NULL,
			"description" = '',
			"sidebar" = '',
			"updated_at" = now()
		WHERE "id" = target_organization_id;
	END IF;

	SELECT "owner_user_id"
	INTO supporter_owner_user_id
	FROM "orgs"
	WHERE "name" ~* '^Supporters of '
		AND "owner_user_id" IS NOT NULL
	ORDER BY ("id" = target_organization_id) DESC, "id"
	LIMIT 1;

	IF supporter_owner_user_id IS NOT NULL THEN
		UPDATE "orgs"
		SET "owner_user_id" = NULL
		WHERE "id" <> target_organization_id
			AND "owner_user_id" = supporter_owner_user_id;

		UPDATE "orgs"
		SET "owner_user_id" = COALESCE("owner_user_id", supporter_owner_user_id)
		WHERE "id" = target_organization_id;
	END IF;

	INSERT INTO "organization_comment_bans" (
		"organization_id",
		"user_id",
		"banned_by_user_id",
		"created_at"
	)
	SELECT
		target_organization_id,
		"user_id",
		"banned_by_user_id",
		"created_at"
	FROM "organization_comment_bans"
	WHERE "organization_id" IN (
		SELECT "id"
		FROM "orgs"
		WHERE "name" ~* '^Supporters of '
			AND "id" <> target_organization_id
	)
	ON CONFLICT ("organization_id", "user_id") DO UPDATE
	SET
		"banned_by_user_id" = COALESCE(
			"organization_comment_bans"."banned_by_user_id",
			excluded."banned_by_user_id"
		),
		"created_at" = LEAST(
			"organization_comment_bans"."created_at",
			excluded."created_at"
		);

	UPDATE "actions"
	SET "org_id" = target_organization_id
	WHERE "automatically_added" = true
		AND "org_id" <> target_organization_id;

	DELETE FROM "orgs"
	WHERE "name" ~* '^Supporters of '
		AND "id" <> target_organization_id;

	IF EXISTS (
		SELECT 1
		FROM "actions"
		WHERE "automatically_added" = true
			AND "org_id" <> target_organization_id
	) THEN
		RAISE EXCEPTION 'Some automatically imported actions were not consolidated';
	END IF;

	IF (
		SELECT count(*)
		FROM "orgs"
		WHERE "name" ~* '^Supporters of '
	) <> 1 THEN
		RAISE EXCEPTION 'Supporter organization consolidation did not leave exactly one row';
	END IF;
END
$migration$;
