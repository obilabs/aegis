-- Integration tests for kb-quiz Phase 1a SQL pieces.
--
-- Spec: openspec/changes/kb-quiz/proposal.md (D35, D38, D41)
-- Migration: 082_kb_quiz_editable_and_reports.sql
--
-- Run via: apps/aegis/scripts/test-db.sh kb-quiz
--
-- Tests:
--   T01: assessment_hash trigger fires on INSERT (assessment IS NULL → hash NULL)
--   T02: assessment_hash trigger fires on INSERT (assessment populated → hash populated)
--   T03: same assessment JSON → same hash (deterministic)
--   T04: changing assessment → hash changes
--   T05: editing prose only (content) does NOT change assessment_hash
--   T06: NULL'ing assessment clears assessment_hash
--   T07: article_type CHECK rejects bogus values
--   T08: v_training_best_attempt picks the highest score per (user, article)
--   T09: report query — "passed CURRENT version" excludes stale-version passes
--   T10: report query — "stale_pass_count" picks up users who passed only old version

\set ON_ERROR_STOP on
\set VERBOSITY terse

BEGIN;

DO $$
DECLARE
  v_org_id uuid;
  v_art_a uuid; v_art_b uuid; v_art_c uuid;
  v_hash_a text; v_hash_a2 text; v_hash_b text; v_content_hash text;
  v_emp_contact uuid; v_emp_user uuid;

  -- Two synthetic assessments. Same shape, different correct answer → different hash.
  v_assessment_x jsonb := '{"questions": [{"id": "q1", "type": "single", "prompt": "What is 2+2?", "options": [{"id":"a","label":"3"},{"id":"b","label":"4"}], "correct": "b"}], "passing_score": 80}'::jsonb;
  v_assessment_y jsonb := '{"questions": [{"id": "q1", "type": "single", "prompt": "What is 2+2?", "options": [{"id":"a","label":"3"},{"id":"b","label":"4"}], "correct": "a"}], "passing_score": 80}'::jsonb;
  v_invalid_type text;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  ASSERT v_org_id IS NOT NULL, 'Setup: no organization';

  -- T01: INSERT with assessment NULL → hash NULL
  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, article_type)
    VALUES (v_org_id, 'kbquiz-T01', 'kbquiz-t01', 'x', 'x', 'draft', 'standard')
    RETURNING id INTO v_art_a;
  SELECT assessment_hash INTO v_hash_a FROM kb_articles WHERE id = v_art_a;
  ASSERT v_hash_a IS NULL, format('T01: standard article assessment_hash should be NULL, got %s', v_hash_a);

  -- T02: INSERT with assessment populated → hash populated, 32-char md5
  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, article_type, assessment, passing_score)
    VALUES (v_org_id, 'kbquiz-T02', 'kbquiz-t02', 'x', 'x', 'draft', 'training', v_assessment_x, 80)
    RETURNING id INTO v_art_b;
  SELECT assessment_hash INTO v_hash_b FROM kb_articles WHERE id = v_art_b;
  ASSERT v_hash_b IS NOT NULL AND length(v_hash_b) = 32,
    format('T02: training article assessment_hash should be 32-char md5, got %s', v_hash_b);

  -- T03: same assessment JSON → same hash (deterministic, key-order independent)
  INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, article_type, assessment, passing_score)
    VALUES (v_org_id, 'kbquiz-T03', 'kbquiz-t03', 'x', 'x', 'draft', 'training', v_assessment_x, 80)
    RETURNING id INTO v_art_c;
  SELECT assessment_hash INTO v_hash_a2 FROM kb_articles WHERE id = v_art_c;
  ASSERT v_hash_a2 = v_hash_b,
    format('T03: same assessment JSON should produce same hash. Got %s vs %s', v_hash_a2, v_hash_b);

  -- T04: changing assessment → hash changes
  UPDATE kb_articles SET assessment = v_assessment_y WHERE id = v_art_b;
  SELECT assessment_hash INTO v_hash_a FROM kb_articles WHERE id = v_art_b;
  ASSERT v_hash_a <> v_hash_b,
    format('T04: changing assessment should change hash. Got %s, was %s', v_hash_a, v_hash_b);

  -- T05: editing prose only (content/title/etc.) does NOT recompute hash.
  -- This is the load-bearing claim of D38: trigger fires only on UPDATE OF assessment.
  v_content_hash := v_hash_a;
  UPDATE kb_articles SET content = 'completely different prose' WHERE id = v_art_b;
  SELECT assessment_hash INTO v_hash_a FROM kb_articles WHERE id = v_art_b;
  ASSERT v_hash_a = v_content_hash,
    format('T05: prose-only edit should NOT change assessment_hash. Got %s, was %s', v_hash_a, v_content_hash);

  -- T06: setting assessment to NULL clears the hash
  UPDATE kb_articles SET assessment = NULL WHERE id = v_art_b;
  SELECT assessment_hash INTO v_hash_a FROM kb_articles WHERE id = v_art_b;
  ASSERT v_hash_a IS NULL,
    format('T06: NULLing assessment should clear hash. Got %s', v_hash_a);

  -- T07: article_type CHECK rejects bogus values
  BEGIN
    INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, article_type)
      VALUES (v_org_id, 'kbquiz-T07-bad', 'kbquiz-t07-bad', 'x', 'x', 'pamphlet');
    v_invalid_type := 'pamphlet was accepted';
  EXCEPTION WHEN check_violation THEN
    v_invalid_type := 'rejected';
  END;
  ASSERT v_invalid_type = 'rejected', format('T07: article_type CHECK should reject pamphlet, but: %s', v_invalid_type);

  -- T08: v_training_best_attempt picks highest score per (user, article)
  --      Need a real user with a real contact since training_completions has FKs.
  INSERT INTO contacts (organization_id, contact_type, first_name, last_name, email, start_date)
    VALUES (v_org_id, 'employee', 'Quiz', 'Tester', 'kbquiz.tester@local', CURRENT_DATE)
    RETURNING id INTO v_emp_contact;
  INSERT INTO users (organization_id, email, first_name, last_name, contact_id)
    VALUES (v_org_id, 'kbquiz.tester@local', 'Quiz', 'Tester', v_emp_contact)
    RETURNING id INTO v_emp_user;

  -- Restore assessment so we have something to test against.
  UPDATE kb_articles SET assessment = v_assessment_x WHERE id = v_art_b;
  SELECT assessment_hash INTO v_hash_b FROM kb_articles WHERE id = v_art_b;

  INSERT INTO training_completions (organization_id, user_id, article_id, attempt_number, score, passed, assessment_hash)
    VALUES
      (v_org_id, v_emp_user, v_art_b, 1, 60, false, v_hash_b),
      (v_org_id, v_emp_user, v_art_b, 2, 90, true,  v_hash_b),
      (v_org_id, v_emp_user, v_art_b, 3, 75, false, v_hash_b);

  -- View should expose attempt_number=2 as the best (score 90, passed=true)
  ASSERT (SELECT score FROM v_training_best_attempt
            WHERE user_id = v_emp_user AND article_id = v_art_b) = 90,
    'T08a: v_training_best_attempt should return the highest score (90)';
  ASSERT (SELECT passed FROM v_training_best_attempt
            WHERE user_id = v_emp_user AND article_id = v_art_b) = true,
    'T08b: v_training_best_attempt should reflect the best attempt is passing';

  -- T09 + T10: report-style queries against v_training_best_attempt with hash filter.
  -- Setup: emp_user has an attempt at score=90 against the OLD hash (v_assessment_x's hash).
  -- Now change the article's assessment to v_assessment_y (new hash), then add another
  -- attempt at score=70 against the NEW hash.
  UPDATE kb_articles SET assessment = v_assessment_y WHERE id = v_art_b;
  SELECT assessment_hash INTO v_hash_a FROM kb_articles WHERE id = v_art_b;  -- now the new hash

  INSERT INTO training_completions (organization_id, user_id, article_id, attempt_number, score, passed, assessment_hash)
    VALUES (v_org_id, v_emp_user, v_art_b, 4, 70, false, v_hash_a);  -- new-version attempt, didn't pass

  -- T09: "currently passed" filter — passed against the CURRENT hash only.
  -- emp_user's only passing attempt was on the OLD hash → currently_passed = false.
  ASSERT (SELECT COUNT(DISTINCT v.user_id) FROM v_training_best_attempt v
            WHERE v.article_id = v_art_b
              AND v.passed = true
              AND v.assessment_hash = (SELECT assessment_hash FROM kb_articles WHERE id = v_art_b)) = 0,
    'T09: passed-against-current-hash should be 0 (only stale pass exists)';

  -- T10: stale_pass_count — passed an OLDER version, not the current one.
  -- Note: v_training_best_attempt picks the row with MAX score per (user, article).
  -- emp_user's attempts: 60 (old, fail), 90 (old, pass), 75 (old, fail), 70 (new, fail).
  -- Best is 90/old-hash/passed=true → counts as stale pass.
  ASSERT (SELECT COUNT(DISTINCT v.user_id) FROM v_training_best_attempt v
            WHERE v.article_id = v_art_b
              AND v.passed = true
              AND v.assessment_hash IS DISTINCT FROM (SELECT assessment_hash FROM kb_articles WHERE id = v_art_b)) = 1,
    'T10: stale_pass_count should be 1 (passed old version, not current)';

  RAISE NOTICE '✓ All kb-quiz integration tests passed (T01-T10)';
END $$;

ROLLBACK;
