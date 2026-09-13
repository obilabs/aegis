-- Integration tests for kb_article_feedback (migration 098).
--
-- Route: app/api/kb/public/article/[slug]/feedback/route.ts
--
-- Run via: scripts/test-db.sh kb-feedback
--
-- Tests:
--   T01: the route's INSERT succeeds with the columns it sends (incl. ip 'unknown')
--   T02: the route's duplicate check finds the row by (article_id, session_id)
--   T03: a second vote from the same session on the same article is rejected
--   T04: the same session can vote on a different article
--   T05: deleting an article removes its feedback (ON DELETE CASCADE)

\set ON_ERROR_STOP on
\set VERBOSITY terse

BEGIN;

DO $$
DECLARE
  v_org_id uuid;
  v_art_a uuid;
  v_art_b uuid;
  v_count int;
  v_dup_rejected boolean := false;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name) VALUES ('KB Feedback Test Org')
      RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO kb_articles (organization_id, title, slug, content, status, visibility)
    VALUES (v_org_id, 'Feedback A', 'kb-feedback-test-a', 'body', 'published', 'public')
    RETURNING id INTO v_art_a;
  INSERT INTO kb_articles (organization_id, title, slug, content, status, visibility)
    VALUES (v_org_id, 'Feedback B', 'kb-feedback-test-b', 'body', 'published', 'public')
    RETURNING id INTO v_art_b;

  -- T01
  INSERT INTO kb_article_feedback (
    article_id, session_id, is_helpful, feedback_text, feedback_category,
    source, ip_address, user_agent
  ) VALUES (v_art_a, 'c2Vzc2lvbi0x', true, NULL, NULL, 'public_kb', 'unknown', 'ua');

  -- T02
  SELECT count(*) INTO v_count FROM kb_article_feedback
   WHERE article_id = v_art_a AND session_id = 'c2Vzc2lvbi0x';
  ASSERT v_count = 1, 'T02: expected 1 feedback row, got ' || v_count;

  -- T03
  BEGIN
    INSERT INTO kb_article_feedback (article_id, session_id, is_helpful, source)
      VALUES (v_art_a, 'c2Vzc2lvbi0x', false, 'public_kb');
  EXCEPTION WHEN unique_violation THEN
    v_dup_rejected := true;
  END;
  ASSERT v_dup_rejected, 'T03: duplicate (article, session) vote was accepted';

  -- T04
  INSERT INTO kb_article_feedback (article_id, session_id, is_helpful, feedback_text, feedback_category, source, ip_address, user_agent)
    VALUES (v_art_b, 'c2Vzc2lvbi0x', false, 'Out of date', 'outdated', 'public_kb', '2001:db8::1', 'ua');

  -- T05
  DELETE FROM kb_articles WHERE id = v_art_b;
  SELECT count(*) INTO v_count FROM kb_article_feedback WHERE article_id = v_art_b;
  ASSERT v_count = 0, 'T05: feedback survived article delete, got ' || v_count;

  RAISE NOTICE 'kb-feedback integration tests passed (T01-T05)';
END $$;

ROLLBACK;
