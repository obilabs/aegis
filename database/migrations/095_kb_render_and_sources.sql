-- 095_kb_render_and_sources.sql
--
-- KB attestations, Phase 1 (render pipeline). Prerequisite hardening only — no
-- signing feature yet. See openspec/changes/kb-attestations/{design.md §10, tasks.md §2}.
--
-- 1. kb_articles.content_format — lets a route know whether to run the markdown
--    renderer before sanitizing. Docling imports write markdown into `content`
--    and currently render as literal source; this is the fix (set on import in a
--    later task). Existing articles are HTML, so DEFAULT 'html' is correct.
-- 2. kb_article_sources — stores the ORIGINAL uploaded file that Docling
--    extracted an article from (today it is discarded outright). The original is
--    the authority; the article is the extraction. NOT document_attachments —
--    that is FK'd to `documents`, a different entity (design §10.2).
-- 3. audit_log (entity_type, entity_id) index — the one folded-in fix (NOTES §4):
--    the attestation-history UI queries exactly this pattern; adding it later
--    would mean a second migration for one line.
--
-- Idempotent (guarded ADD COLUMN / CREATE TABLE / CREATE INDEX IF NOT EXISTS and
-- a pg_constraint guard for the named CHECK) so re-application is a no-op.
--
-- NOTE (addition beyond design §10.2's column list): kb_article_sources carries
-- organization_id NOT NULL. Root CLAUDE.md security rule #1 — every query filters
-- by organization_id — needs it as a first-class column, not only reachable via a
-- join to kb_articles.

BEGIN;

-- 1. content_format ---------------------------------------------------------
ALTER TABLE public.kb_articles
  ADD COLUMN IF NOT EXISTS content_format character varying(20) NOT NULL DEFAULT 'html';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kb_articles_content_format_chk'
  ) THEN
    ALTER TABLE public.kb_articles
      ADD CONSTRAINT kb_articles_content_format_chk
      CHECK (content_format IN ('html', 'markdown'));
  END IF;
END $$;

-- 2. kb_article_sources -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kb_article_sources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  article_id        uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  storage_key       text NOT NULL,
  original_filename character varying(255),
  mime_type         character varying(100),
  byte_size         bigint,
  sha256            character(64),
  extracted_by      uuid,   -- importing user; bare uuid, matching kb_articles.author_id convention
  created_at        timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kb_article_sources_article ON public.kb_article_sources(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_article_sources_org ON public.kb_article_sources(organization_id);

-- 3. audit_log (entity_type, entity_id) index -------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

COMMIT;
