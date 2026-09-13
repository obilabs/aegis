-- Migration 098: kb_article_feedback table.
--
-- Schema-drift fix. app/api/kb/public/article/[slug]/feedback/route.ts reads
-- and writes kb_article_feedback, but no migration or init.sql ever created
-- it, so "Was this helpful?" on a public KB article returned 500 on every
-- install. Columns match what the route inserts: article_id, session_id,
-- is_helpful, feedback_text, feedback_category, source, ip_address,
-- user_agent.
--
-- ip_address is varchar(45), not inet: the route stores 'unknown' when no
-- client IP header is present (same type as kb_article_acknowledgments).
--
-- Idempotent (IF NOT EXISTS), per the migration convention. Also folded into
-- init.sql so a fresh install gets it without the migration chain; applying
-- this to a fresh DB is a no-op.

BEGIN;

CREATE TABLE IF NOT EXISTS public.kb_article_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
    session_id character varying(64) NOT NULL,
    is_helpful boolean NOT NULL,
    feedback_text text,
    feedback_category character varying(50),
    source character varying(30) DEFAULT 'public_kb'::character varying NOT NULL,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- One vote per anonymous session per article (the route checks first; this
-- makes the rule hold under concurrent submissions too).
CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_article_feedback_article_session
    ON public.kb_article_feedback USING btree (article_id, session_id);

COMMIT;
