--
-- Aegis ITSM — consolidated fresh-install schema
--
-- REGENERATED 2026-08-17 from a database built by the PREVIOUS init.sql plus
-- every migration 088-097, then dumped schema-only. It is now COMPLETE on its
-- own: `psql -f database/init.sql` produces the same schema the container boot
-- produces, with no migration chain required.
--
-- Why this was needed: the old init.sql was a PRE-092 SNAPSHOT. Everything in
-- migrations 090 (email_attempts), 092 (MTP pairing moved onto api_keys) and
-- 093 (the entire cascade-revocation schema) was absent, and it still shipped
-- the `mtp_pairings` table that 092 DROPS. Containers were fine because the
-- entrypoint applies migrations; anyone following the documented
-- `psql -f init.sql` instruction got a database where MTP pairing and cascade
-- revocation both broke at runtime — and, trusting "complete schema", would
-- have debugged the code instead of the schema.
--
-- TWO THINGS THIS FILE DELIBERATELY DOES:
--
-- 1. It EXCLUDES the `pgboss` schema. pg-boss creates its own schema at
--    runtime; baking it in caused the drift fixed in 376907d. A naive pg_dump
--    re-introduces it — regenerate with `--exclude-schema=pgboss` or that bug
--    comes straight back.
--
-- 2. It PRE-POPULATES `schema_migrations` with 088-097 at the end. The
--    entrypoint runs init.sql and THEN the migration loop; without this the
--    loop would re-apply ten migrations against a schema that already has
--    everything. Marking them applied is what makes "fresh install = one flat
--    schema, no migration chain" true rather than aspirational.
--
-- The migrations directory is RETAINED: it is the upgrade path for databases
-- created before this consolidation. Do not delete it.
--
-- TO REGENERATE (after adding a migration):
--   docker exec aegis-db pg_dump -U aegis -d aegis --schema-only \n--     --no-owner --no-privileges --exclude-schema=pgboss > init.sql
--   then re-append the seed INSERTs and the schema_migrations block at the end.
--

--
-- PostgreSQL database dump
--

\restrict QH3wgHWHMd4LAj5VShf9Kvt3NkqEDbYYIhRBhBCiIMvtrAqtICsFTF0Lleq86eI

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg12+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: action_date_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.action_date_type AS ENUM (
    'complete_by',
    'scheduled_for'
);


--
-- Name: api_key_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.api_key_type AS ENUM (
    'provider',
    'integration',
    'personal',
    'service'
);


--
-- Name: chat_context_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chat_context_level AS ENUM (
    'end_user',
    'technician',
    'admin',
    'provider'
);


--
-- Name: credential_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.credential_request_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired',
    'revoked'
);


--
-- Name: credential_share_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.credential_share_mode AS ENUM (
    'never',
    'on_demand',
    'time_boxed',
    'break_glass'
);


--
-- Name: dashboard_view_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dashboard_view_type AS ENUM (
    'end_user',
    'manager',
    'hr',
    'executive',
    'it_admin',
    'provider',
    'custom'
);


--
-- Name: policy_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.policy_type AS ENUM (
    'company_policy',
    'it_security_policy',
    'compliance_policy',
    'procedure'
);


--
-- Name: request_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.request_category AS ENUM (
    'incident',
    'service_request',
    'hardware_request',
    'change_request',
    'onboarding',
    'offboarding',
    'problem'
);


--
-- Name: ticket_base_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_base_status AS ENUM (
    'open',
    'pending',
    'closed'
);


--
-- Name: _ensure_api_key_usage_partition(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._ensure_api_key_usage_partition(month_start date) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  partition_name text := 'api_key_usage_logs_' || to_char(month_start, 'YYYY_MM');
  range_end date := (month_start + interval '1 month')::date;
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.api_key_usage_logs FOR VALUES FROM (%L) TO (%L)',
    partition_name, month_start, range_end
  );
END;
$$;


--
-- Name: acknowledge_dns_alert(uuid, uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acknowledge_dns_alert(p_alert_id uuid, p_user_id uuid, p_is_expected boolean DEFAULT false, p_notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE dns_change_alerts
    SET
        status = 'acknowledged',
        acknowledged_by = p_user_id,
        acknowledged_at = NOW(),
        is_expected = COALESCE(p_is_expected, is_expected),
        resolution_notes = COALESCE(p_notes, resolution_notes),
        updated_at = NOW()
    WHERE id = p_alert_id;

    RETURN FOUND;
END;
$$;


--
-- Name: acknowledge_kb_article(uuid, uuid, uuid, character varying, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acknowledge_kb_article(p_article_id uuid, p_user_id uuid DEFAULT NULL::uuid, p_contact_id uuid DEFAULT NULL::uuid, p_ip_address character varying DEFAULT NULL::character varying, p_user_agent text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_article_version INT;
BEGIN
    -- Get current article version
    SELECT COALESCE(
        (SELECT MAX(version_number) FROM kb_article_versions WHERE article_id = p_article_id),
        1
    ) INTO v_article_version;
    
    -- Insert acknowledgment
    INSERT INTO kb_article_acknowledgments (
        article_id, user_id, contact_id, ip_address, user_agent, article_version
    ) VALUES (
        p_article_id, p_user_id, p_contact_id, p_ip_address, p_user_agent, v_article_version
    )
    ON CONFLICT DO NOTHING;
    
    RETURN FOUND;
END;
$$;


--
-- Name: add_contribution_columns(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_contribution_columns(p_table_name text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Soft delete columns
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false', p_table_name);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE', p_table_name);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES users(id)', p_table_name);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by_provider_id UUID REFERENCES provider_api_keys(id)', p_table_name);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by_name VARCHAR(200)', p_table_name);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS delete_reason TEXT', p_table_name);
    
    -- Contribution tracking
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by_provider_id UUID REFERENCES provider_api_keys(id)', p_table_name);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by_provider_name VARCHAR(200)', p_table_name);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS last_modified_by_provider_id UUID REFERENCES provider_api_keys(id)', p_table_name);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS last_modified_by_provider_name VARCHAR(200)', p_table_name);
    
    -- Restoration tracking
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS restored_at TIMESTAMP WITH TIME ZONE', p_table_name);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS restored_by_user_id UUID REFERENCES users(id)', p_table_name);
    
    -- Create index for soft delete queries
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_deleted ON %I(is_deleted) WHERE is_deleted = true', p_table_name, p_table_name);
END;
$$;


--
-- Name: ai_get_ticket(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_get_ticket(p_session_id uuid, p_ticket_id uuid) RETURNS TABLE(id uuid, ticket_number text, subject character varying, description text, status_name character varying, priority character varying, category_name character varying, created_at timestamp with time zone, updated_at timestamp with time zone, can_view_details boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_session RECORD;
    v_policy RECORD;
    v_can_access BOOLEAN;
    v_redacted_fields TEXT[];
BEGIN
    -- Get session and policy
    SELECT * INTO v_session FROM ai_chat_sessions WHERE id = p_session_id;
    SELECT * INTO v_policy 
    FROM ai_data_access_policies 
    WHERE organization_id = v_session.organization_id 
      AND context_level = v_session.context_level
      AND resource_type = 'tickets';
    
    -- Check access
    v_can_access := can_ai_access_resource(p_session_id, 'tickets', p_ticket_id);
    v_redacted_fields := get_ai_redacted_fields(p_session_id, 'tickets');
    
    IF NOT v_can_access THEN
        RETURN; -- Return empty result
    END IF;
    
    RETURN QUERY
    SELECT 
        t.id,
        t.prefix || '-' || t.number::TEXT as ticket_number,
        t.subject,
        CASE 
            WHEN 'description' = ANY(v_redacted_fields) THEN '[Content hidden]'::TEXT
            ELSE t.description
        END as description,
        ts.name as status_name,
        t.priority,
        tc.name as category_name,
        t.created_at,
        t.updated_at,
        NOT ('internal_notes' = ANY(v_redacted_fields)) as can_view_details
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
    LEFT JOIN ticket_categories tc ON t.category_id = tc.id
    WHERE t.id = p_ticket_id
      AND t.organization_id = v_session.organization_id;
END;
$$;


--
-- Name: ai_search_kb(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_search_kb(p_session_id uuid, p_query text, p_limit integer DEFAULT 5) RETURNS TABLE(id uuid, title character varying, excerpt text, category_name character varying, relevance_score double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_session RECORD;
    v_policy RECORD;
    v_allowed_visibility TEXT[];
BEGIN
    -- Get session and policy
    SELECT * INTO v_session FROM ai_chat_sessions WHERE ai_chat_sessions.id = p_session_id;
    SELECT * INTO v_policy
    FROM ai_data_access_policies
    WHERE ai_data_access_policies.organization_id = v_session.organization_id
      AND ai_data_access_policies.context_level = v_session.context_level
      AND ai_data_access_policies.resource_type = 'kb_articles';

    -- Determine allowed visibility levels
    IF v_policy.scope_restrictions ? 'visibility' THEN
        SELECT array_agg(value::TEXT) INTO v_allowed_visibility
        FROM jsonb_array_elements_text(v_policy.scope_restrictions->'visibility');
    ELSE
        v_allowed_visibility := ARRAY['public', 'internal', 'private'];
    END IF;

    -- Search with visibility filter (FIXED: was 'knowledge_base_articles', now 'kb_articles')
    RETURN QUERY
    SELECT
        kb.id,
        kb.title,
        LEFT(kb.content_plain, 300) as excerpt,
        cat.name as category_name,
        ts_rank(
            to_tsvector('english', COALESCE(kb.title::text, '') || ' ' || COALESCE(kb.content_plain, '')),
            plainto_tsquery('english', p_query)
        )::double precision as relevance_score
    FROM kb_articles kb
    LEFT JOIN kb_categories cat ON kb.category_id = cat.id
    WHERE kb.organization_id = v_session.organization_id
      AND kb.status = 'published'
      AND kb.visibility = ANY(v_allowed_visibility)
      AND kb.is_deleted = false
      AND (kb.expires_at IS NULL OR kb.expires_at > NOW())
      AND (
          to_tsvector('english', COALESCE(kb.title::text, '') || ' ' || COALESCE(kb.content_plain, ''))
          @@ plainto_tsquery('english', p_query)
          OR kb.title ILIKE '%' || p_query || '%'
      )
    ORDER BY relevance_score DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: ai_search_my_tickets(uuid, text, character varying, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_search_my_tickets(p_session_id uuid, p_query text DEFAULT NULL::text, p_status character varying DEFAULT NULL::character varying, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, ticket_number text, subject character varying, status_name character varying, priority character varying, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_session RECORD;
BEGIN
    SELECT * INTO v_session FROM ai_chat_sessions WHERE id = p_session_id;
    
    RETURN QUERY
    SELECT 
        t.id,
        t.prefix || '-' || t.number::TEXT as ticket_number,
        t.subject,
        ts.name as status_name,
        t.priority,
        t.created_at
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
    WHERE t.organization_id = v_session.organization_id
      AND (t.created_by = v_session.user_id OR t.contact_id = v_session.contact_id)
      AND (p_status IS NULL OR ts.base_status = p_status::ticket_base_status)
      AND (p_query IS NULL OR t.subject ILIKE '%' || p_query || '%')
    ORDER BY t.created_at DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: approve_category_request(uuid, uuid, character varying, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_category_request(p_request_id uuid, p_reviewed_by uuid, p_final_name character varying DEFAULT NULL::character varying, p_notes text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$ -- Returns created category ID
DECLARE
    v_request RECORD;
    v_category_id UUID;
BEGIN
    SELECT * INTO v_request FROM category_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Category request not found';
    END IF;
    
    -- Create the category
    INSERT INTO ticket_categories (
        workspace_id,
        organization_id,
        name,
        parent_id,
        base_type,
        created_by
    ) VALUES (
        v_request.workspace_id,
        v_request.organization_id,
        COALESCE(p_final_name, v_request.suggested_name),
        v_request.suggested_parent_id,
        COALESCE(v_request.suggested_base_type, 'service_request'),
        p_reviewed_by
    )
    RETURNING id INTO v_category_id;
    
    -- Update request
    UPDATE category_requests
    SET status = 'approved',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        review_notes = p_notes,
        created_category_id = v_category_id
    WHERE id = p_request_id;
    
    -- Update sample tickets to use new category
    UPDATE tickets
    SET category_id = v_category_id
    WHERE id = ANY(v_request.sample_ticket_ids);
    
    RETURN v_category_id;
END;
$$;


--
-- Name: assign_onboarding_policies(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_onboarding_policies(p_contact_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_contact RECORD;
    v_policy RECORD;
    v_count INT := 0;
BEGIN
    -- Get contact details
    SELECT * INTO v_contact FROM contacts WHERE id = p_contact_id;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Find applicable policies
    FOR v_policy IN 
        SELECT * FROM policies 
        WHERE organization_id = v_contact.organization_id
          AND status = 'published'
          AND requires_acknowledgment = true
          AND (
              required_for_all = true
              OR v_contact.contact_type = ANY(required_contact_types)
              -- Add more conditions for roles, departments, job titles
          )
    LOOP
        -- Check if already assigned
        IF NOT EXISTS (
            SELECT 1 FROM policy_assignments 
            WHERE policy_id = v_policy.id AND contact_id = p_contact_id
        ) THEN
            INSERT INTO policy_assignments (
                policy_id, contact_id, due_date
            ) VALUES (
                v_policy.id, 
                p_contact_id, 
                CURRENT_DATE + v_policy.acknowledgment_deadline_days
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_count;
END;
$$;


--
-- Name: auto_assign_ticket(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_assign_ticket(p_ticket_id uuid, p_team_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$ -- Returns assigned user_id
DECLARE
    v_team RECORD;
    v_agent RECORD;
    v_last_assigned UUID;
BEGIN
    -- Get team settings
    SELECT * INTO v_team FROM teams WHERE id = p_team_id;
    IF NOT FOUND OR NOT v_team.auto_assign_enabled THEN
        RETURN NULL;
    END IF;
    
    IF v_team.auto_assign_method = 'round_robin' THEN
        -- Get last assigned agent for this team
        SELECT assigned_to INTO v_last_assigned
        FROM tickets
        WHERE team_id = p_team_id AND assigned_to IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1;
        
        -- Get next available agent after the last assigned
        SELECT tm.user_id INTO v_agent
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = p_team_id
          AND tm.is_available = true
          AND (tm.out_of_office_until IS NULL OR tm.out_of_office_until < CURRENT_DATE)
          AND tm.current_ticket_count < tm.max_open_tickets
          AND (v_last_assigned IS NULL OR tm.user_id > v_last_assigned)
        ORDER BY tm.user_id
        LIMIT 1;
        
        -- If no agent found after last, wrap around
        IF v_agent IS NULL THEN
            SELECT tm.user_id INTO v_agent
            FROM team_members tm
            WHERE tm.team_id = p_team_id
              AND tm.is_available = true
              AND (tm.out_of_office_until IS NULL OR tm.out_of_office_until < CURRENT_DATE)
              AND tm.current_ticket_count < tm.max_open_tickets
            ORDER BY tm.user_id
            LIMIT 1;
        END IF;
        
    ELSIF v_team.auto_assign_method = 'least_busy' THEN
        -- Get agent with lowest ticket count
        SELECT user_id INTO v_agent
        FROM get_available_agents(p_team_id)
        LIMIT 1;
    END IF;
    
    -- Assign ticket
    IF v_agent IS NOT NULL THEN
        UPDATE tickets SET assigned_to = v_agent.user_id WHERE id = p_ticket_id;
        
        -- Update agent's ticket count
        UPDATE team_members 
        SET current_ticket_count = current_ticket_count + 1
        WHERE team_id = p_team_id AND user_id = v_agent.user_id;
        
        RETURN v_agent.user_id;
    END IF;
    
    RETURN NULL;
END;
$$;


--
-- Name: calculate_next_occurrence(character varying, jsonb, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_next_occurrence(p_schedule_type character varying, p_schedule_config jsonb, p_from_date timestamp with time zone DEFAULT now()) RETURNS timestamp with time zone
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_next TIMESTAMP WITH TIME ZONE;
    v_time TIME;
    v_day_of_week INT;
    v_day_of_month INT;
    v_month INT;
BEGIN
    v_time := COALESCE((p_schedule_config->>'time')::TIME, '09:00'::TIME);

    CASE p_schedule_type
        WHEN 'daily' THEN
            v_next := DATE_TRUNC('day', p_from_date) + INTERVAL '1 day' + v_time;

        WHEN 'weekly' THEN
            v_day_of_week := COALESCE((p_schedule_config->>'dayOfWeek')::INT, 1); -- Monday default
            v_next := DATE_TRUNC('week', p_from_date) + ((v_day_of_week - 1) || ' days')::INTERVAL + v_time;
            IF v_next <= p_from_date THEN
                v_next := v_next + INTERVAL '1 week';
            END IF;

        WHEN 'monthly' THEN
            v_day_of_month := COALESCE((p_schedule_config->>'dayOfMonth')::INT, 1);
            v_next := DATE_TRUNC('month', p_from_date) + ((v_day_of_month - 1) || ' days')::INTERVAL + v_time;
            IF v_next <= p_from_date THEN
                v_next := v_next + INTERVAL '1 month';
            END IF;

        WHEN 'yearly' THEN
            v_month := COALESCE((p_schedule_config->>'month')::INT, 1);
            v_day_of_month := COALESCE((p_schedule_config->>'dayOfMonth')::INT, 1);
            v_next := DATE_TRUNC('year', p_from_date) +
                     ((v_month - 1) || ' months')::INTERVAL +
                     ((v_day_of_month - 1) || ' days')::INTERVAL +
                     v_time;
            IF v_next <= p_from_date THEN
                v_next := v_next + INTERVAL '1 year';
            END IF;

        ELSE
            -- Default to tomorrow
            v_next := DATE_TRUNC('day', p_from_date) + INTERVAL '1 day' + v_time;
    END CASE;

    RETURN v_next;
END;
$$;


--
-- Name: can_ai_access_resource(uuid, character varying, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_ai_access_resource(p_session_id uuid, p_resource_type character varying, p_resource_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_session RECORD;
    v_policy RECORD;
    v_can_access BOOLEAN := false;
BEGIN
    -- Get session info
    SELECT * INTO v_session FROM ai_chat_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Get policy for this context level and resource type
    SELECT * INTO v_policy 
    FROM ai_data_access_policies 
    WHERE organization_id = v_session.organization_id 
      AND context_level = v_session.context_level
      AND resource_type = p_resource_type;
    
    IF NOT FOUND OR NOT v_policy.can_read THEN
        RETURN false;
    END IF;
    
    -- Check scope restrictions
    IF v_policy.scope_restrictions ? 'own_only' AND (v_policy.scope_restrictions->>'own_only')::boolean THEN
        -- For "own_only", check if the resource belongs to the user
        CASE p_resource_type
            WHEN 'tickets' THEN
                SELECT EXISTS(
                    SELECT 1 FROM tickets 
                    WHERE id = p_resource_id 
                    AND (created_by = v_session.user_id OR contact_id = v_session.contact_id)
                ) INTO v_can_access;
            ELSE
                v_can_access := false;
        END CASE;
    ELSE
        v_can_access := true;
    END IF;
    
    RETURN v_can_access;
END;
$$;


--
-- Name: can_delegate_action(uuid, uuid, character varying, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_delegate_action(actor_uuid uuid, target_uuid uuid, action_name character varying, org_uuid uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    can_perform BOOLEAN := false;
    rule RECORD;
BEGIN
    -- Check each delegation rule
    FOR rule IN
        SELECT dr.*
        FROM delegation_rules dr
        WHERE dr.organization_id = org_uuid
        AND dr.action = action_name
        AND dr.is_active = true
        AND (dr.starts_at IS NULL OR dr.starts_at <= NOW())
        AND (dr.ends_at IS NULL OR dr.ends_at > NOW())
    LOOP
        -- Check if actor matches delegator criteria
        IF rule.delegator_type = 'manager' THEN
            -- Check if actor is manager of target
            IF rule.target_scope = 'direct_reports' THEN
                SELECT EXISTS(
                    SELECT 1 FROM manager_relationships mr
                    WHERE mr.manager_id = actor_uuid
                    AND mr.user_id = target_uuid
                    AND mr.is_active = true
                    AND mr.relationship_type = 'direct'
                ) INTO can_perform;
            ELSIF rule.target_scope = 'all' THEN
                SELECT EXISTS(
                    SELECT 1 FROM get_subordinates(actor_uuid) gs
                    WHERE gs.user_id = target_uuid
                ) INTO can_perform;
            END IF;
        ELSIF rule.delegator_type = 'group_owner' THEN
            -- Check if actor is owner of a group containing target
            SELECT EXISTS(
                SELECT 1 FROM user_groups ug
                INNER JOIN user_group_memberships ugm ON ug.id = ugm.group_id
                WHERE ug.owner_id = actor_uuid
                AND ugm.user_id = target_uuid
            ) INTO can_perform;
        ELSIF rule.delegator_type = 'user' AND rule.delegator_id = actor_uuid THEN
            can_perform := true;
        ELSIF rule.delegator_type = 'role' THEN
            -- Check if actor has the specified role
            SELECT EXISTS(
                SELECT 1 FROM users u
                WHERE u.id = actor_uuid
                AND u.role_id = rule.delegator_id
            ) INTO can_perform;
        END IF;

        IF can_perform THEN
            RETURN true;
        END IF;
    END LOOP;

    RETURN false;
END;
$$;


--
-- Name: can_request_tier(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_request_tier(p_contact_id uuid, p_tier_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_contact RECORD;
    v_tier RECORD;
    v_rules JSONB;
BEGIN
    -- Get contact info
    SELECT * INTO v_contact FROM contacts WHERE id = p_contact_id;
    IF NOT FOUND THEN RETURN false; END IF;
    
    -- Get tier and eligibility rules
    SELECT * INTO v_tier FROM asset_request_tiers WHERE id = p_tier_id AND is_active = true;
    IF NOT FOUND THEN RETURN false; END IF;
    
    v_rules := v_tier.eligibility_rules;
    
    -- Check contact type
    IF v_rules ? 'contact_types' AND jsonb_array_length(v_rules->'contact_types') > 0 THEN
        IF NOT (v_rules->'contact_types' ? v_contact.contact_type) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- Check department (if not "*" for all)
    IF v_rules ? 'departments' AND NOT (v_rules->'departments' ? '*') THEN
        IF NOT (v_rules->'departments' ? v_contact.department) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- Check job title (if specified)
    IF v_rules ? 'job_titles' AND jsonb_array_length(v_rules->'job_titles') > 0 THEN
        IF NOT (v_rules->'job_titles' ? v_contact.job_title) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- Check tenure (if specified)
    IF v_rules ? 'min_tenure_days' AND (v_rules->>'min_tenure_days')::INT > 0 THEN
        IF v_contact.start_date IS NULL OR 
           (CURRENT_DATE - v_contact.start_date) < (v_rules->>'min_tenure_days')::INT THEN
            RETURN false;
        END IF;
    END IF;
    
    RETURN true;
END;
$$;


--
-- Name: can_user_perform_kb_action(uuid, character varying, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_user_perform_kb_action(p_user_id uuid, p_action character varying, p_article_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_user_role VARCHAR(50);
    v_is_author BOOLEAN := false;
    v_has_permission BOOLEAN := false;
BEGIN
    -- Get user role
    SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
    
    -- Admins can do everything
    IF v_user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Check if user is the article author
    IF p_article_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM kb_articles a
            JOIN kb_contributors c ON a.author_id = c.id
            WHERE a.id = p_article_id AND c.user_id = p_user_id
        ) INTO v_is_author;
    END IF;
    
    -- Check explicit permissions
    SELECT EXISTS (
        SELECT 1 FROM kb_permissions p
        WHERE p.user_id = p_user_id
          AND p.permission = p_action
          AND (p.expires_at IS NULL OR p.expires_at > NOW())
          AND (p.category_ids IS NULL OR p_category_id = ANY(p.category_ids))
    ) INTO v_has_permission;
    
    -- Handle specific actions
    CASE p_action
        WHEN 'kb.view.public' THEN RETURN true; -- Everyone can view public
        WHEN 'kb.view.internal' THEN RETURN v_user_role IN ('admin', 'manager', 'technician') OR v_has_permission;
        WHEN 'kb.create.draft' THEN RETURN v_has_permission OR EXISTS (SELECT 1 FROM kb_contributors WHERE user_id = p_user_id AND is_active);
        WHEN 'kb.edit.own' THEN RETURN v_is_author OR v_has_permission;
        WHEN 'kb.edit.all' THEN RETURN v_user_role IN ('admin', 'manager') OR v_has_permission;
        WHEN 'kb.publish' THEN RETURN v_user_role IN ('admin', 'manager') OR v_has_permission;
        WHEN 'kb.delete' THEN RETURN v_user_role = 'admin' OR v_has_permission;
        ELSE RETURN v_has_permission;
    END CASE;
END;
$$;


--
-- Name: check_certificate_expiry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_certificate_expiry() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_cert RECORD;
    v_days INT;
    v_alerts_created INT := 0;
BEGIN
    -- Find certificates that need alerts
    FOR v_cert IN
        SELECT c.*, c.expires_at - CURRENT_DATE as days_remaining
        FROM certificates c
        WHERE c.archived_at IS NULL
        AND c.status = 'active'
        AND c.expires_at <= CURRENT_DATE + 90
    LOOP
        v_days := v_cert.days_remaining;

        -- Check if we should send alert for this threshold
        IF v_days = ANY(v_cert.alert_days_before) THEN
            -- Check if we already sent this alert
            IF NOT EXISTS (
                SELECT 1 FROM certificate_alerts
                WHERE certificate_id = v_cert.id
                AND days_until_expiry = v_days
                AND created_at > CURRENT_DATE - 1
            ) THEN
                INSERT INTO certificate_alerts (
                    organization_id, certificate_id, days_until_expiry,
                    alert_type
                ) VALUES (
                    v_cert.organization_id, v_cert.id, v_days,
                    CASE
                        WHEN v_days <= 0 THEN 'expired'
                        WHEN v_days <= 7 THEN 'expiry_warning'
                        ELSE 'expiry_warning'
                    END
                );

                UPDATE certificates
                SET last_alert_sent_at = NOW()
                WHERE id = v_cert.id;

                v_alerts_created := v_alerts_created + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN v_alerts_created;
END;
$$;


--
-- Name: check_provider_permission(uuid, character varying, character varying, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_provider_permission(p_provider_id uuid, p_permission character varying, p_entity_type character varying DEFAULT NULL::character varying, p_entity_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_has_permission BOOLEAN := false;
    v_grant RECORD;
BEGIN
    -- Check all active grants for this provider
    FOR v_grant IN 
        SELECT permissions, scope_config, valid_from, valid_until
        FROM provider_access_grants
        WHERE provider_id = p_provider_id
          AND is_active = true
          AND (valid_from IS NULL OR valid_from <= NOW())
          AND (valid_until IS NULL OR valid_until > NOW())
    LOOP
        -- Check if permission is in the grant
        IF p_permission = ANY(v_grant.permissions) OR '*' = ANY(v_grant.permissions) THEN
            -- TODO: Check scope restrictions if entity provided
            v_has_permission := true;
            EXIT;
        END IF;
        
        -- Check wildcard permissions (e.g., 'tickets:*' matches 'tickets:read')
        IF EXISTS (
            SELECT 1 FROM unnest(v_grant.permissions) perm
            WHERE perm LIKE split_part(p_permission, ':', 1) || ':*'
        ) THEN
            v_has_permission := true;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN v_has_permission;
END;
$$;


--
-- Name: clone_job_title(uuid, character varying, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clone_job_title(p_source_id uuid, p_new_name character varying, p_new_department_id uuid DEFAULT NULL::uuid, p_created_by uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_source RECORD;
    v_new_id UUID;
    v_new_profile_id UUID;
BEGIN
    -- Get source job title
    SELECT * INTO v_source FROM job_titles WHERE id = p_source_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source job title not found';
    END IF;
    
    -- Create new job title
    INSERT INTO job_titles (
        organization_id, name, description, department_id, level, 
        cloned_from_id, clone_notes
    ) VALUES (
        v_source.organization_id,
        p_new_name,
        v_source.description || ' (Cloned from ' || v_source.name || ')',
        COALESCE(p_new_department_id, v_source.department_id),
        v_source.level,
        p_source_id,
        'Cloned from: ' || v_source.name || ' on ' || NOW()::DATE
    )
    RETURNING id INTO v_new_id;
    
    -- Clone access profile if exists
    IF v_source.default_access_profile_id IS NOT NULL THEN
        INSERT INTO access_profiles (
            organization_id, name, description, is_default
        )
        SELECT 
            organization_id,
            p_new_name || ' Profile',
            'Access profile for ' || p_new_name || ' (cloned from ' || v_source.name || ')',
            false
        FROM access_profiles WHERE id = v_source.default_access_profile_id
        RETURNING id INTO v_new_profile_id;
        
        -- Clone profile items
        INSERT INTO access_profile_items (
            profile_id, item_type, service_id, asset_tier_id, 
            item_name, item_description, is_required, is_optional, 
            quantity, provisioning_notes
        )
        SELECT 
            v_new_profile_id, item_type, service_id, asset_tier_id,
            item_name, item_description, is_required, is_optional,
            quantity, provisioning_notes
        FROM access_profile_items WHERE profile_id = v_source.default_access_profile_id;
        
        -- Link new profile to new job title
        UPDATE job_titles SET default_access_profile_id = v_new_profile_id WHERE id = v_new_id;
    END IF;
    
    RETURN v_new_id;
END;
$$;


--
-- Name: complete_maintenance(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_maintenance(p_schedule_id uuid, p_performed_by uuid, p_work_performed text DEFAULT NULL::text, p_ticket_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_schedule RECORD;
    v_next_date DATE;
BEGIN
    SELECT * INTO v_schedule FROM maintenance_schedules WHERE id = p_schedule_id;
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Calculate next maintenance date
    v_next_date := CASE v_schedule.frequency_type
        WHEN 'days' THEN CURRENT_DATE + (v_schedule.frequency_value || ' days')::INTERVAL
        WHEN 'weeks' THEN CURRENT_DATE + (v_schedule.frequency_value || ' weeks')::INTERVAL
        WHEN 'months' THEN CURRENT_DATE + (v_schedule.frequency_value || ' months')::INTERVAL
        WHEN 'years' THEN CURRENT_DATE + (v_schedule.frequency_value || ' years')::INTERVAL
        ELSE CURRENT_DATE + INTERVAL '30 days'
    END;

    -- Record history
    INSERT INTO maintenance_history (
        schedule_id, performed_at, scheduled_for,
        performed_by, work_performed, ticket_id,
        result, next_maintenance_at
    ) VALUES (
        p_schedule_id, NOW(), v_schedule.next_maintenance_at,
        p_performed_by, p_work_performed, p_ticket_id,
        'completed', v_next_date
    );

    -- Update schedule
    UPDATE maintenance_schedules SET
        last_maintenance_at = CURRENT_DATE,
        next_maintenance_at = v_next_date,
        updated_at = NOW()
    WHERE id = p_schedule_id;

    RETURN true;
END;
$$;


--
-- Name: compute_scheduling_active_from(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_scheduling_active_from() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.action_date_type = 'scheduled_for' AND NEW.scheduled_for IS NOT NULL THEN
    NEW.is_scheduled := true;
    NEW.scheduling_active_from := NEW.scheduled_for - (COALESCE(NEW.lead_time_days, 3) || ' days')::INTERVAL;
  ELSIF NEW.action_date_type = 'complete_by' THEN
    -- complete_by mode: clear scheduling fields (unless manually set)
    IF NEW.scheduled_for IS NULL THEN
      NEW.is_scheduled := false;
      NEW.scheduling_active_from := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: contact_deletion_impact(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.contact_deletion_impact(p_contact_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'open_tickets', (SELECT COUNT(*) FROM tickets t LEFT JOIN ticket_statuses ts ON t.status_id = ts.id WHERE t.contact_id = p_contact_id AND (ts.name IS NULL OR ts.name NOT IN ('Closed', 'Resolved'))),
    'closed_tickets', (SELECT COUNT(*) FROM tickets t JOIN ticket_statuses ts ON t.status_id = ts.id WHERE t.contact_id = p_contact_id AND ts.name IN ('Closed', 'Resolved')),
    'credentials', (SELECT COUNT(*) FROM contact_credentials WHERE contact_id = p_contact_id),
    'kb_articles', (SELECT COUNT(*) FROM kb_contributors WHERE contact_id = p_contact_id),
    'documents', (SELECT COUNT(*) FROM documents WHERE created_by = (SELECT u.id FROM users u WHERE u.contact_id = p_contact_id LIMIT 1)),
    'access_requests', (SELECT COUNT(*) FROM access_requests WHERE for_contact_id = p_contact_id OR requester_id = p_contact_id),
    'group_memberships', (SELECT COUNT(*) FROM contact_group_members WHERE contact_id = p_contact_id),
    'asset_assignments', (SELECT COUNT(*) FROM asset_contacts WHERE contact_id = p_contact_id),
    'onboarding_requests', (SELECT COUNT(*) FROM onboarding_requests WHERE contact_id = p_contact_id),
    'offboarding_requests', (SELECT COUNT(*) FROM offboarding_requests WHERE contact_id = p_contact_id),
    'projects', (SELECT COUNT(*) FROM projects WHERE contact_id = p_contact_id),
    'team_memberships', (SELECT COUNT(*) FROM team_members WHERE contact_id = p_contact_id),
    'service_ownerships', (SELECT COUNT(*) FROM service_owners WHERE contact_id = p_contact_id)
  ) INTO result;

  RETURN result;
END;
$$;


--
-- Name: create_project_from_template(uuid, character varying, uuid, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_project_from_template(p_template_id uuid, p_name character varying, p_contact_id uuid DEFAULT NULL::uuid, p_manager_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT CURRENT_DATE) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_template RECORD;
    v_project_id UUID;
    v_task JSONB;
BEGIN
    SELECT * INTO v_template FROM project_templates WHERE id = p_template_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found';
    END IF;

    -- Create project
    INSERT INTO projects (
        organization_id, name, description, category,
        status, contact_id, manager_id, start_date,
        budget_hours, template_id
    ) VALUES (
        v_template.organization_id, p_name, v_template.description, v_template.category,
        v_template.default_status, p_contact_id, p_manager_id, p_start_date,
        v_template.estimated_hours, p_template_id
    )
    RETURNING id INTO v_project_id;

    -- Create tasks from template
    FOR v_task IN SELECT * FROM jsonb_array_elements(v_template.task_templates)
    LOOP
        INSERT INTO project_tasks (
            project_id, title, description,
            estimated_hours, sort_order, template_task_id
        ) VALUES (
            v_project_id,
            v_task->>'title',
            v_task->>'description',
            (v_task->>'estimated_hours')::DECIMAL,
            (v_task->>'sort_order')::INT,
            v_task->>'id'
        );
    END LOOP;

    RETURN v_project_id;
END;
$$;


--
-- Name: create_ticket_from_chat(uuid, character varying, text, uuid, character varying, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_ticket_from_chat(p_session_id uuid, p_subject character varying, p_description text, p_category_id uuid DEFAULT NULL::uuid, p_priority character varying DEFAULT 'medium'::character varying, p_ai_suggested boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_session RECORD;
    v_ticket_id UUID;
BEGIN
    -- Get session info
    SELECT * INTO v_session FROM ai_chat_sessions WHERE id = p_session_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chat session not found';
    END IF;

    -- Create ticket
    INSERT INTO tickets (
        organization_id,
        subject,
        description,
        source,
        priority,
        category_id,
        created_by,
        custom_fields
    ) VALUES (
        v_session.organization_id,
        p_subject,
        p_description,
        'chat',
        p_priority,
        p_category_id,
        v_session.user_id,
        jsonb_build_object('chat_session_id', p_session_id)
    )
    RETURNING id INTO v_ticket_id;

    -- Update session
    UPDATE ai_chat_sessions
    SET
        resolution_status = 'ticket_created',
        created_ticket_id = v_ticket_id,
        updated_at = NOW()
    WHERE id = p_session_id;

    -- Record conversion
    INSERT INTO chat_ticket_conversions (session_id, ticket_id, created_by)
    VALUES (p_session_id, v_ticket_id, CASE WHEN p_ai_suggested THEN 'ai_suggested' ELSE 'user_requested' END);

    RETURN v_ticket_id;
END;
$$;


--
-- Name: detect_dns_changes(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_dns_changes(p_domain_id uuid, p_new_snapshot_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_domain RECORD;
    v_old_snapshot RECORD;
    v_new_snapshot RECORD;
    v_schedule RECORD;
    v_alerts_created INT := 0;
    v_severity VARCHAR(20);
    v_is_expected BOOLEAN;
    v_change_window RECORD;
BEGIN
    -- Get domain info
    SELECT * INTO v_domain FROM domains WHERE id = p_domain_id;

    -- Get monitoring schedule
    SELECT * INTO v_schedule FROM dns_monitoring_schedules
    WHERE domain_id = p_domain_id AND is_active = true;

    -- Get previous snapshot
    SELECT * INTO v_old_snapshot FROM dns_monitoring_snapshots
    WHERE domain_id = p_domain_id AND id != p_new_snapshot_id
    ORDER BY checked_at DESC LIMIT 1;

    -- Get new snapshot
    SELECT * INTO v_new_snapshot FROM dns_monitoring_snapshots
    WHERE id = p_new_snapshot_id;

    -- If no old snapshot, this is first check
    IF v_old_snapshot.id IS NULL THEN
        RETURN 0;
    END IF;

    -- Check for active change window
    SELECT * INTO v_change_window FROM dns_change_windows
    WHERE (domain_id = p_domain_id OR domain_id IS NULL)
    AND organization_id = v_domain.organization_id
    AND is_active = true
    AND NOW() BETWEEN starts_at AND ends_at
    LIMIT 1;

    v_is_expected := (v_change_window.id IS NOT NULL);

    -- Compare A records
    IF v_old_snapshot.a_records::text != v_new_snapshot.a_records::text THEN
        v_severity := CASE
            WHEN v_schedule.critical_records::text LIKE '%"A:%' THEN 'critical'
            ELSE COALESCE(v_schedule.alert_severity_default, 'warning')
        END;

        INSERT INTO dns_change_alerts (
            organization_id, domain_id, record_type, record_name,
            old_value, new_value, severity, title, is_expected, status
        ) VALUES (
            v_domain.organization_id, p_domain_id, 'A', '@',
            v_old_snapshot.a_records::text, v_new_snapshot.a_records::text,
            v_severity,
            'A record changed for ' || v_domain.name,
            v_is_expected,
            CASE WHEN v_is_expected THEN 'acknowledged' ELSE 'open' END
        );
        v_alerts_created := v_alerts_created + 1;
    END IF;

    -- Compare MX records
    IF v_old_snapshot.mx_records::text != v_new_snapshot.mx_records::text THEN
        v_severity := 'critical'; -- MX changes are always critical

        INSERT INTO dns_change_alerts (
            organization_id, domain_id, record_type, record_name,
            old_value, new_value, severity, title, is_expected, status
        ) VALUES (
            v_domain.organization_id, p_domain_id, 'MX', '@',
            v_old_snapshot.mx_records::text, v_new_snapshot.mx_records::text,
            v_severity,
            'MX record changed for ' || v_domain.name || ' - Email routing affected',
            v_is_expected,
            CASE WHEN v_is_expected THEN 'acknowledged' ELSE 'open' END
        );
        v_alerts_created := v_alerts_created + 1;
    END IF;

    -- Compare NS records
    IF v_old_snapshot.ns_records::text != v_new_snapshot.ns_records::text THEN
        v_severity := 'critical'; -- NS changes are always critical

        INSERT INTO dns_change_alerts (
            organization_id, domain_id, record_type, record_name,
            old_value, new_value, severity, title, is_expected, status
        ) VALUES (
            v_domain.organization_id, p_domain_id, 'NS', '@',
            v_old_snapshot.ns_records::text, v_new_snapshot.ns_records::text,
            v_severity,
            'Nameserver changed for ' || v_domain.name || ' - Potential security issue',
            v_is_expected,
            CASE WHEN v_is_expected THEN 'acknowledged' ELSE 'open' END
        );
        v_alerts_created := v_alerts_created + 1;
    END IF;

    -- Compare TXT records
    IF v_old_snapshot.txt_records::text != v_new_snapshot.txt_records::text THEN
        v_severity := COALESCE(v_schedule.alert_severity_default, 'warning');

        INSERT INTO dns_change_alerts (
            organization_id, domain_id, record_type, record_name,
            old_value, new_value, severity, title, is_expected, status
        ) VALUES (
            v_domain.organization_id, p_domain_id, 'TXT', '@',
            v_old_snapshot.txt_records::text, v_new_snapshot.txt_records::text,
            v_severity,
            'TXT record changed for ' || v_domain.name,
            v_is_expected,
            CASE WHEN v_is_expected THEN 'acknowledged' ELSE 'open' END
        );
        v_alerts_created := v_alerts_created + 1;
    END IF;

    -- Compare SSL expiry
    IF v_old_snapshot.ssl_expires_at != v_new_snapshot.ssl_expires_at THEN
        v_severity := 'info';

        INSERT INTO dns_change_alerts (
            organization_id, domain_id, record_type, record_name,
            old_value, new_value, severity, title, is_expected, status
        ) VALUES (
            v_domain.organization_id, p_domain_id, 'SSL', 'expiry',
            v_old_snapshot.ssl_expires_at::text, v_new_snapshot.ssl_expires_at::text,
            v_severity,
            'SSL certificate renewed for ' || v_domain.name,
            v_is_expected,
            CASE WHEN v_is_expected THEN 'acknowledged' ELSE 'open' END
        );
        v_alerts_created := v_alerts_created + 1;
    END IF;

    RETURN v_alerts_created;
END;
$$;


--
-- Name: disable_feature(uuid, character varying, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.disable_feature(p_organization_id uuid, p_feature_key character varying, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_feature RECORD;
BEGIN
    -- Get feature info
    SELECT * INTO v_feature
    FROM feature_registry
    WHERE feature_key = p_feature_key;
    
    -- Feature doesn't exist
    IF v_feature IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Feature not found');
    END IF;
    
    -- Can't disable core features
    IF NOT v_feature.can_disable THEN
        RETURN jsonb_build_object('success', false, 'error', 'This feature cannot be disabled');
    END IF;
    
    -- Disable the feature
    INSERT INTO organization_feature_flags (
        organization_id, feature_key, enabled, enabled_at, enabled_by
    ) VALUES (
        p_organization_id, p_feature_key, false, NOW(), p_user_id
    )
    ON CONFLICT (organization_id, feature_key) DO UPDATE SET
        enabled = false,
        updated_at = NOW();
    
    -- Log the action
    INSERT INTO feature_usage_log (organization_id, feature_key, user_id, action)
    VALUES (p_organization_id, p_feature_key, p_user_id, 'disabled');
    
    RETURN jsonb_build_object('success', true, 'feature', p_feature_key, 'message', 'Feature disabled');
END;
$$;


--
-- Name: enable_feature(uuid, character varying, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enable_feature(p_organization_id uuid, p_feature_key character varying, p_user_id uuid, p_acknowledge_beta boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_feature RECORD;
    v_result JSONB;
BEGIN
    -- Get feature info
    SELECT * INTO v_feature
    FROM feature_registry
    WHERE feature_key = p_feature_key;
    
    -- Feature doesn't exist
    IF v_feature IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Feature not found');
    END IF;
    
    -- Can't enable coming soon features
    IF v_feature.status = 'coming_soon' THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'This feature is coming soon and cannot be enabled yet',
            'stable_version', v_feature.stable_version
        );
    END IF;
    
    -- Can't enable deprecated features
    IF v_feature.status = 'deprecated' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This feature has been deprecated');
    END IF;
    
    -- Beta/Alpha features require acknowledgment
    IF v_feature.status IN ('beta', 'alpha') AND NOT p_acknowledge_beta THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Beta acknowledgment required',
            'requires_acknowledgment', true,
            'status', v_feature.status,
            'stable_version', v_feature.stable_version,
            'message', format(
                'This feature is in %s. It may have bugs or change significantly. ' ||
                'It will become stable in version %s. Do you want to enable it anyway?',
                upper(v_feature.status),
                COALESCE(v_feature.stable_version, 'a future release')
            )
        );
    END IF;
    
    -- Enable the feature
    INSERT INTO organization_feature_flags (
        organization_id, feature_key, enabled, enabled_at, enabled_by,
        beta_acknowledged, beta_acknowledged_at, beta_acknowledged_by
    ) VALUES (
        p_organization_id, p_feature_key, true, NOW(), p_user_id,
        v_feature.status IN ('beta', 'alpha'), 
        CASE WHEN v_feature.status IN ('beta', 'alpha') THEN NOW() END,
        CASE WHEN v_feature.status IN ('beta', 'alpha') THEN p_user_id END
    )
    ON CONFLICT (organization_id, feature_key) DO UPDATE SET
        enabled = true,
        enabled_at = NOW(),
        enabled_by = p_user_id,
        beta_acknowledged = COALESCE(organization_feature_flags.beta_acknowledged, v_feature.status IN ('beta', 'alpha')),
        beta_acknowledged_at = COALESCE(organization_feature_flags.beta_acknowledged_at, 
            CASE WHEN v_feature.status IN ('beta', 'alpha') THEN NOW() END),
        beta_acknowledged_by = COALESCE(organization_feature_flags.beta_acknowledged_by,
            CASE WHEN v_feature.status IN ('beta', 'alpha') THEN p_user_id END),
        updated_at = NOW();
    
    -- Log the action
    INSERT INTO feature_usage_log (organization_id, feature_key, user_id, action, context)
    VALUES (p_organization_id, p_feature_key, p_user_id, 'enabled', 
        jsonb_build_object('status', v_feature.status, 'beta_ack', p_acknowledge_beta));
    
    RETURN jsonb_build_object(
        'success', true,
        'feature', p_feature_key,
        'status', v_feature.status,
        'message', CASE 
            WHEN v_feature.status = 'beta' THEN 'Feature enabled (Beta)'
            WHEN v_feature.status = 'alpha' THEN 'Feature enabled (Alpha - use with caution)'
            ELSE 'Feature enabled'
        END
    );
END;
$$;


--
-- Name: enforce_flat_cascade(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_flat_cascade() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.parent_key_id IS NOT NULL THEN
    PERFORM 1 FROM public.api_keys
      WHERE id = NEW.parent_key_id
        AND parent_key_id IS NOT NULL;
    IF FOUND THEN
      RAISE EXCEPTION
        'api_keys: cascade depth cap (1); parent % already has a parent_key_id',
        NEW.parent_key_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: evaluate_dynamic_group(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evaluate_dynamic_group(p_group_id uuid) RETURNS TABLE(added integer, removed integer, unchanged integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_group RECORD;
    v_rule RECORD;
    v_matching_ids UUID[];
    v_rule_matches UUID[];
    v_current_dynamic UUID[];
    v_to_add UUID[];
    v_to_remove UUID[];
    v_added INT := 0;
    v_removed INT := 0;
    v_unchanged INT := 0;
    v_first_rule BOOLEAN := true;
    v_sql TEXT;
BEGIN
    SELECT * INTO v_group FROM dynamic_groups WHERE id = p_group_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Group not found';
    END IF;

    -- Build matching set from rules
    FOR v_rule IN
        SELECT * FROM dynamic_group_rules WHERE group_id = p_group_id ORDER BY sort_order
    LOOP
        -- Build dynamic SQL based on group_type and field_name
        IF v_group.group_type = 'user' THEN
            v_sql := 'SELECT id FROM contacts WHERE organization_id = ' ||
                     quote_literal(v_group.organization_id) ||
                     ' AND archived_at IS NULL AND is_active = true';
        ELSIF v_group.group_type = 'asset' THEN
            v_sql := 'SELECT id FROM assets WHERE organization_id = ' ||
                     quote_literal(v_group.organization_id);
        ELSE
            v_sql := 'SELECT id FROM contacts WHERE organization_id = ' ||
                     quote_literal(v_group.organization_id) ||
                     ' AND archived_at IS NULL';
        END IF;

        -- Add field condition
        CASE v_rule.operator
            WHEN 'equals' THEN
                v_sql := v_sql || ' AND ' || quote_ident(v_rule.field_name) || '::text = ' || quote_literal(v_rule.value);
            WHEN 'not_equals' THEN
                v_sql := v_sql || ' AND ' || quote_ident(v_rule.field_name) || '::text != ' || quote_literal(v_rule.value);
            WHEN 'contains' THEN
                v_sql := v_sql || ' AND ' || quote_ident(v_rule.field_name) || '::text ILIKE ' || quote_literal('%' || v_rule.value || '%');
            WHEN 'starts_with' THEN
                v_sql := v_sql || ' AND ' || quote_ident(v_rule.field_name) || '::text ILIKE ' || quote_literal(v_rule.value || '%');
            WHEN 'in_list' THEN
                v_sql := v_sql || ' AND ' || quote_ident(v_rule.field_name) || '::text = ANY(ARRAY(SELECT jsonb_array_elements_text(' || quote_literal(v_rule.value) || '::jsonb)))';
            WHEN 'is_empty' THEN
                v_sql := v_sql || ' AND (' || quote_ident(v_rule.field_name) || ' IS NULL OR ' || quote_ident(v_rule.field_name) || '::text = '''')';
            WHEN 'is_not_empty' THEN
                v_sql := v_sql || ' AND ' || quote_ident(v_rule.field_name) || ' IS NOT NULL AND ' || quote_ident(v_rule.field_name) || '::text != ''''';
            WHEN 'is_under' THEN
                -- Hierarchical match: use recursive CTE for departments/locations
                IF v_rule.field_name = 'department_id' OR v_rule.field_name = 'department_id' THEN
                    v_sql := v_sql || ' AND ' || quote_ident(v_rule.field_name) || ' IN (
                        WITH RECURSIVE dept_tree AS (
                            SELECT id FROM departments WHERE id = ' || quote_literal(v_rule.value) || '::uuid
                            UNION ALL
                            SELECT d.id FROM departments d JOIN dept_tree dt ON d.parent_id = dt.id
                        ) SELECT id FROM dept_tree
                    )';
                ELSIF v_rule.field_name = 'location_id' THEN
                    v_sql := v_sql || ' AND ' || quote_ident(v_rule.field_name) || ' IN (
                        WITH RECURSIVE loc_tree AS (
                            SELECT id FROM office_locations WHERE id = ' || quote_literal(v_rule.value) || '::uuid
                            UNION ALL
                            SELECT l.id FROM office_locations l JOIN loc_tree lt ON l.parent_id = lt.id
                        ) SELECT id FROM loc_tree
                    )';
                END IF;
            ELSE
                -- Unsupported operator, skip
                CONTINUE;
        END CASE;

        EXECUTE 'SELECT ARRAY(' || v_sql || ')' INTO v_rule_matches;

        IF v_first_rule THEN
            v_matching_ids := v_rule_matches;
            v_first_rule := false;
        ELSE
            IF v_group.rule_logic = 'AND' THEN
                -- Intersection
                SELECT ARRAY(SELECT unnest(v_matching_ids) INTERSECT SELECT unnest(v_rule_matches)) INTO v_matching_ids;
            ELSE
                -- Union
                SELECT ARRAY(SELECT DISTINCT unnest(v_matching_ids) UNION SELECT unnest(v_rule_matches)) INTO v_matching_ids;
            END IF;
        END IF;
    END LOOP;

    -- Handle case with no rules
    IF v_matching_ids IS NULL THEN
        v_matching_ids := ARRAY[]::UUID[];
    END IF;

    -- Get current dynamic members
    IF v_group.group_type = 'user' THEN
        SELECT ARRAY(
            SELECT contact_id FROM dynamic_group_members
            WHERE group_id = p_group_id AND membership_source = 'dynamic' AND is_active = true
        ) INTO v_current_dynamic;
    ELSIF v_group.group_type = 'asset' THEN
        SELECT ARRAY(
            SELECT asset_id FROM dynamic_group_members
            WHERE group_id = p_group_id AND membership_source = 'dynamic' AND is_active = true
        ) INTO v_current_dynamic;
    END IF;

    IF v_current_dynamic IS NULL THEN
        v_current_dynamic := ARRAY[]::UUID[];
    END IF;

    -- Calculate diff
    SELECT ARRAY(SELECT unnest(v_matching_ids) EXCEPT SELECT unnest(v_current_dynamic)) INTO v_to_add;
    SELECT ARRAY(SELECT unnest(v_current_dynamic) EXCEPT SELECT unnest(v_matching_ids)) INTO v_to_remove;

    -- Add new members
    IF v_group.group_type = 'user' OR v_group.group_type = 'contact' THEN
        INSERT INTO dynamic_group_members (group_id, contact_id, membership_source, rule_matched_at)
        SELECT p_group_id, unnest(v_to_add), 'dynamic', NOW()
        ON CONFLICT (group_id, contact_id) DO UPDATE SET is_active = true, rule_matched_at = NOW(), removed_at = NULL;
    ELSIF v_group.group_type = 'asset' THEN
        INSERT INTO dynamic_group_members (group_id, asset_id, membership_source, rule_matched_at)
        SELECT p_group_id, unnest(v_to_add), 'dynamic', NOW()
        ON CONFLICT (group_id, asset_id) DO UPDATE SET is_active = true, rule_matched_at = NOW(), removed_at = NULL;
    END IF;
    v_added := COALESCE(array_length(v_to_add, 1), 0);

    -- Soft-remove members who no longer match
    UPDATE dynamic_group_members
    SET is_active = false, removed_at = NOW()
    WHERE group_id = p_group_id
      AND membership_source = 'dynamic'
      AND is_active = true
      AND (
          (v_group.group_type IN ('user', 'contact') AND contact_id = ANY(v_to_remove)) OR
          (v_group.group_type = 'asset' AND asset_id = ANY(v_to_remove))
      );
    v_removed := COALESCE(array_length(v_to_remove, 1), 0);

    v_unchanged := COALESCE(array_length(v_matching_ids, 1), 0) - v_added;

    -- Update group stats
    UPDATE dynamic_groups
    SET last_evaluated_at = NOW(),
        member_count = (SELECT COUNT(*) FROM dynamic_group_members WHERE group_id = p_group_id AND is_active = true),
        updated_at = NOW()
    WHERE id = p_group_id;

    RETURN QUERY SELECT v_added, v_removed, v_unchanged;
END;
$$;


--
-- Name: evaluate_routing_rules(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evaluate_routing_rules(p_ticket_id uuid, p_workspace_id uuid) RETURNS TABLE(rule_id uuid, rule_name character varying, team_id uuid, user_id uuid, priority character varying, tags text[])
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_ticket RECORD;
    v_rule RECORD;
    v_match BOOLEAN;
    v_condition JSONB;
BEGIN
    -- Get ticket details
    SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id;
    
    -- Evaluate each rule in priority order
    FOR v_rule IN 
        SELECT * FROM routing_rules 
        WHERE workspace_id = p_workspace_id AND is_active = true
        ORDER BY priority ASC
    LOOP
        v_match := true;
        
        -- Check each condition
        FOR v_condition IN SELECT * FROM jsonb_array_elements(v_rule.conditions)
        LOOP
            -- Simplified condition evaluation (expand as needed)
            CASE v_condition->>'field'
                WHEN 'category' THEN
                    IF v_condition->>'operator' = 'equals' THEN
                        v_match := v_match AND (v_ticket.request_category::TEXT = v_condition->>'value');
                    END IF;
                WHEN 'priority' THEN
                    IF v_condition->>'operator' = 'equals' THEN
                        v_match := v_match AND (v_ticket.priority = v_condition->>'value');
                    ELSIF v_condition->>'operator' = 'in' THEN
                        v_match := v_match AND (v_ticket.priority = ANY(ARRAY(SELECT jsonb_array_elements_text(v_condition->'value'))));
                    END IF;
                WHEN 'subject' THEN
                    IF v_condition->>'operator' = 'contains' THEN
                        v_match := v_match AND (v_ticket.subject ILIKE '%' || (v_condition->>'value') || '%');
                    END IF;
                ELSE
                    -- Unknown field, skip
                    NULL;
            END CASE;
            
            -- Early exit if no match
            IF NOT v_match THEN
                EXIT;
            END IF;
        END LOOP;
        
        -- If all conditions matched, return this rule
        IF v_match THEN
            -- Update stats
            UPDATE routing_rules 
            SET times_matched = times_matched + 1, last_matched_at = NOW()
            WHERE id = v_rule.id;
            
            RETURN QUERY SELECT 
                v_rule.id,
                v_rule.name,
                v_rule.assign_to_team_id,
                v_rule.assign_to_user_id,
                v_rule.set_priority,
                v_rule.add_tags;
            RETURN;
        END IF;
    END LOOP;
    
    -- No rule matched
    RETURN;
END;
$$;


--
-- Name: expire_stale_credential_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_stale_credential_access() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_expired_count INT;
BEGIN
    -- Expire requests past their access window
    UPDATE credential_access_requests
    SET status = 'expired'
    WHERE status = 'approved'
      AND access_expires_at < NOW();
    
    GET DIAGNOSTICS v_expired_count = ROW_COUNT;
    
    -- Revoke access for missed check-ins
    UPDATE credential_access_requests car
    SET status = 'revoked'
    FROM credential_sharing_policies csp
    WHERE car.policy_id = csp.id
      AND car.status = 'approved'
      AND csp.check_in_required = true
      AND car.last_check_in_at + (csp.check_in_interval_hours || ' hours')::INTERVAL < NOW();
    
    RETURN v_expired_count;
END;
$$;


--
-- Name: find_category_matches(uuid, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_category_matches(p_workspace_id uuid, p_subject text, p_description text, p_limit integer DEFAULT 5) RETURNS TABLE(category_id uuid, category_name character varying, category_path text, base_type public.request_category, keyword_score integer, total_score numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.id,
        tc.name,
        tc.path,
        tc.base_type,
        -- Count keyword matches
        (
            SELECT COUNT(*)::INT 
            FROM unnest(tc.keywords) k 
            WHERE LOWER(p_subject || ' ' || COALESCE(p_description, '')) LIKE '%' || LOWER(k) || '%'
        ) as keyword_score,
        -- Total score (can be enhanced with ML)
        (
            SELECT COUNT(*)::DECIMAL 
            FROM unnest(tc.keywords) k 
            WHERE LOWER(p_subject || ' ' || COALESCE(p_description, '')) LIKE '%' || LOWER(k) || '%'
        ) as total_score
    FROM ticket_categories tc
    WHERE tc.workspace_id = p_workspace_id
      AND tc.is_active = true
      AND tc.depth > 0 -- Only return subcategories
    ORDER BY total_score DESC, tc.total_tickets DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: generate_asset_name(uuid, uuid, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_asset_name(p_organization_id uuid, p_asset_type_id uuid, p_location character varying DEFAULT NULL::character varying, p_department character varying DEFAULT NULL::character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_template RECORD;
    v_name VARCHAR(100);
    v_seq_str VARCHAR(20);
BEGIN
    -- Get the naming template
    SELECT * INTO v_template 
    FROM asset_naming_templates 
    WHERE organization_id = p_organization_id 
      AND (asset_type_id = p_asset_type_id OR asset_type_id IS NULL)
      AND is_active = true
    ORDER BY asset_type_id NULLS LAST
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- Default pattern if no template
        RETURN 'ASSET-' || LPAD((SELECT COUNT(*) + 1 FROM assets WHERE organization_id = p_organization_id)::TEXT, 6, '0');
    END IF;
    
    -- Increment sequence
    UPDATE asset_naming_templates 
    SET sequence_current = sequence_current + 1, updated_at = NOW()
    WHERE id = v_template.id
    RETURNING sequence_current INTO v_template.sequence_current;
    
    -- Format sequence with padding
    v_seq_str := LPAD(v_template.sequence_current::TEXT, v_template.sequence_padding, '0');
    
    -- Build name from pattern
    v_name := v_template.pattern;
    v_name := REPLACE(v_name, '{PREFIX}', v_template.prefix);
    v_name := REPLACE(v_name, '{SEQ}', v_seq_str);
    v_name := REPLACE(v_name, '{LOCATION}', COALESCE(UPPER(LEFT(p_location, 3)), 'XXX'));
    v_name := REPLACE(v_name, '{DEPT}', COALESCE(UPPER(LEFT(p_department, 3)), 'XXX'));
    v_name := REPLACE(v_name, '{YEAR}', TO_CHAR(NOW(), 'YY'));
    v_name := REPLACE(v_name, '{MONTH}', TO_CHAR(NOW(), 'MM'));
    
    RETURN v_name;
END;
$$;


--
-- Name: generate_due_recurring_tickets(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_due_recurring_tickets() RETURNS TABLE(recurring_ticket_id uuid, ticket_id uuid, scheduled_for date)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_rt RECORD;
    v_ticket_id UUID;
BEGIN
    FOR v_rt IN
        SELECT * FROM recurring_tickets
        WHERE is_active = true
        AND next_generation_at <= NOW()
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        ORDER BY next_generation_at ASC
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Create the ticket
        INSERT INTO tickets (
            organization_id,
            subject,
            description,
            type_id,
            category_id,
            priority,
            assigned_to,
            contact_id,
            source,
            custom_fields
        ) VALUES (
            v_rt.organization_id,
            v_rt.ticket_subject,
            v_rt.ticket_description,
            v_rt.ticket_type_id,
            v_rt.ticket_category_id,
            v_rt.ticket_priority,
            v_rt.assign_to_user_id,
            v_rt.contact_id,
            'recurring',
            v_rt.custom_fields
        )
        RETURNING id INTO v_ticket_id;

        -- Link assets to ticket
        INSERT INTO ticket_assets (ticket_id, asset_id)
        SELECT v_ticket_id, asset_id
        FROM recurring_ticket_assets
        WHERE recurring_ticket_id = v_rt.id;

        -- Record instance
        INSERT INTO recurring_ticket_instances (
            recurring_ticket_id, ticket_id, scheduled_for, was_on_time
        ) VALUES (
            v_rt.id, v_ticket_id, v_rt.next_generation_at::DATE, true
        );

        -- Update next generation time
        UPDATE recurring_tickets
        SET
            last_generated_at = NOW(),
            next_generation_at = calculate_next_occurrence(
                v_rt.schedule_type,
                v_rt.schedule_config,
                NOW()
            ),
            updated_at = NOW()
        WHERE id = v_rt.id;

        -- Return result
        recurring_ticket_id := v_rt.id;
        ticket_id := v_ticket_id;
        scheduled_for := v_rt.next_generation_at::DATE;
        RETURN NEXT;
    END LOOP;
END;
$$;


--
-- Name: generate_offboarding_tasks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_offboarding_tasks(p_request_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_request RECORD;
    v_contact RECORD;
    v_access RECORD;
    v_asset RECORD;
    v_task_count INT := 0;
BEGIN
    -- Get the offboarding request
    SELECT * INTO v_request FROM offboarding_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Offboarding request not found';
    END IF;
    
    -- Get the contact
    SELECT * INTO v_contact FROM contacts WHERE id = v_request.contact_id;
    
    -- Create tasks for each service access
    FOR v_access IN 
        SELECT usa.*, s.name as service_name
        FROM user_service_access usa
        JOIN services s ON usa.service_id = s.id
        WHERE usa.contact_id = v_request.contact_id
        AND usa.revoked_at IS NULL
    LOOP
        INSERT INTO offboarding_tasks (
            offboarding_request_id, task_type, task_name, service_id,
            assigned_team, priority, is_security_critical
        ) VALUES (
            p_request_id, 'revoke_access', 
            'Revoke access: ' || v_access.service_name,
            v_access.service_id, 'IT', 
            CASE WHEN v_request.is_security_concern THEN 100 ELSE 70 END,
            true
        );
        v_task_count := v_task_count + 1;
    END LOOP;
    
    -- Create tasks for each assigned asset
    FOR v_asset IN 
        SELECT a.* 
        FROM assets a
        JOIN asset_contacts ac ON a.id = ac.asset_id
        WHERE ac.contact_id = v_request.contact_id
    LOOP
        INSERT INTO offboarding_tasks (
            offboarding_request_id, task_type, task_name, asset_id,
            assigned_team, priority
        ) VALUES (
            p_request_id, 'collect_asset',
            'Collect: ' || v_asset.name,
            v_asset.id, 'IT', 60
        );
        
        -- Also create retrieval assignment
        INSERT INTO asset_retrieval_assignments (
            offboarding_request_id, asset_id, assigned_to, status
        ) VALUES (
            p_request_id, v_asset.id, 
            (SELECT id FROM users WHERE organization_id = v_request.organization_id LIMIT 1),
            'pending'
        );
        
        v_task_count := v_task_count + 1;
    END LOOP;
    
    -- Add standard tasks
    INSERT INTO offboarding_tasks (offboarding_request_id, task_type, task_name, assigned_team, priority, is_security_critical)
    VALUES 
        (p_request_id, 'disable_account', 'Disable user account', 'IT', 100, true),
        (p_request_id, 'disable_email', 'Disable email / set forwarding', 'IT', 95, true),
        (p_request_id, 'collect_badge', 'Collect access badge', 'Security', 90, true),
        (p_request_id, 'transfer_data', 'Transfer/archive user data', 'IT', 50, false),
        (p_request_id, 'exit_interview', 'Conduct exit interview', 'HR', 40, false);
    
    v_task_count := v_task_count + 5;
    
    RETURN v_task_count;
END;
$$;


--
-- Name: generate_offboarding_tasks_v2(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_offboarding_tasks_v2(p_request_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_request RECORD;
    v_contact RECORD;
    v_access RECORD;
    v_asset RECORD;
    v_owner RECORD;
    v_service RECORD;
    v_task_count INT := 0;
BEGIN
    -- Get the offboarding request
    SELECT * INTO v_request FROM offboarding_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Offboarding request not found';
    END IF;
    
    -- Get the contact
    SELECT * INTO v_contact FROM contacts WHERE id = v_request.contact_id;
    
    -- Create tasks for each service access
    FOR v_access IN 
        SELECT usa.*, s.name as service_name, s.id as sid, s.offboarding_doc_id
        FROM user_service_access usa
        JOIN services s ON usa.service_id = s.id
        WHERE usa.contact_id = v_request.contact_id
        AND usa.revoked_at IS NULL
    LOOP
        -- Find service owner who can deprovision
        SELECT * INTO v_owner 
        FROM service_owners 
        WHERE service_id = v_access.sid 
          AND can_deprovision = true 
          AND is_available = true
        ORDER BY is_primary DESC, role_type ASC
        LIMIT 1;
        
        INSERT INTO offboarding_tasks (
            offboarding_request_id, task_type, task_name, service_id,
            assigned_to, assigned_team, 
            service_owner_id,
            kb_article_id,
            priority, is_security_critical
        ) VALUES (
            p_request_id, 'revoke_access', 
            'Revoke access: ' || v_access.service_name,
            v_access.sid, 
            v_owner.user_id, -- Assign to service owner
            'IT', 
            v_owner.id,
            v_access.offboarding_doc_id, -- Link to offboarding documentation
            CASE WHEN v_request.is_security_concern THEN 100 ELSE 70 END,
            true
        );
        v_task_count := v_task_count + 1;
    END LOOP;
    
    -- Create tasks for each assigned asset
    FOR v_asset IN 
        SELECT a.* 
        FROM assets a
        JOIN asset_contacts ac ON a.id = ac.asset_id
        WHERE ac.contact_id = v_request.contact_id
    LOOP
        INSERT INTO offboarding_tasks (
            offboarding_request_id, task_type, task_name, asset_id,
            assigned_team, priority
        ) VALUES (
            p_request_id, 'collect_asset',
            'Collect: ' || v_asset.name,
            v_asset.id, 'IT', 60
        );
        
        -- Also create retrieval assignment
        INSERT INTO asset_retrieval_assignments (
            offboarding_request_id, asset_id, assigned_to, status
        ) VALUES (
            p_request_id, v_asset.id, 
            (SELECT id FROM users WHERE organization_id = v_request.organization_id LIMIT 1),
            'pending'
        );
        
        v_task_count := v_task_count + 1;
    END LOOP;
    
    -- Add standard tasks
    INSERT INTO offboarding_tasks (offboarding_request_id, task_type, task_name, assigned_team, priority, is_security_critical)
    VALUES 
        (p_request_id, 'disable_account', 'Disable user account', 'IT', 100, true),
        (p_request_id, 'disable_email', 'Disable email / set forwarding', 'IT', 95, true),
        (p_request_id, 'collect_badge', 'Collect access badge', 'Security', 90, true),
        (p_request_id, 'transfer_data', 'Transfer/archive user data', 'IT', 50, false),
        (p_request_id, 'exit_interview', 'Conduct exit interview', 'HR', 40, false);
    
    v_task_count := v_task_count + 5;
    
    RETURN v_task_count;
END;
$$;


--
-- Name: generate_onboarding_tasks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_onboarding_tasks(p_request_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_request RECORD;
    v_profile RECORD;
    v_item RECORD;
    v_task_count INT := 0;
BEGIN
    -- Get the onboarding request
    SELECT * INTO v_request FROM onboarding_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Onboarding request not found';
    END IF;
    
    -- Get the access profile
    SELECT * INTO v_profile FROM access_profiles WHERE id = v_request.access_profile_id;
    
    -- Create tasks for each profile item
    FOR v_item IN 
        SELECT * FROM access_profile_items WHERE profile_id = v_profile.id
    LOOP
        INSERT INTO onboarding_tasks (
            onboarding_request_id, task_type, task_name, description,
            service_id, assigned_team, priority
        ) VALUES (
            p_request_id,
            CASE v_item.item_type
                WHEN 'service' THEN 'provision_service'
                WHEN 'asset_tier' THEN 'assign_asset'
                ELSE 'other'
            END,
            'Provision: ' || COALESCE(
                (SELECT name FROM services WHERE id = v_item.service_id),
                (SELECT name FROM asset_request_tiers WHERE id = v_item.asset_tier_id),
                v_item.item_name
            ),
            v_item.provisioning_notes,
            v_item.service_id,
            CASE v_item.item_type
                WHEN 'service' THEN 'IT'
                WHEN 'asset_tier' THEN 'IT'
                WHEN 'access_card' THEN 'Security'
                ELSE 'IT'
            END,
            CASE WHEN v_item.is_required THEN 70 ELSE 30 END
        );
        v_task_count := v_task_count + 1;
    END LOOP;
    
    -- Add standard tasks
    INSERT INTO onboarding_tasks (onboarding_request_id, task_type, task_name, assigned_team, priority)
    VALUES 
        (p_request_id, 'create_account', 'Create user account', 'IT', 100),
        (p_request_id, 'create_email', 'Create email account', 'IT', 90),
        (p_request_id, 'create_badge', 'Create access badge', 'Security', 80),
        (p_request_id, 'setup_workstation', 'Setup workstation', 'IT', 60),
        (p_request_id, 'orientation', 'Schedule orientation', 'HR', 50);
    
    v_task_count := v_task_count + 5;
    
    RETURN v_task_count;
END;
$$;


--
-- Name: generate_onboarding_tasks_v2(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_onboarding_tasks_v2(p_request_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_request RECORD;
    v_profile RECORD;
    v_item RECORD;
    v_service RECORD;
    v_owner RECORD;
    v_task_count INT := 0;
BEGIN
    -- Get the onboarding request
    SELECT * INTO v_request FROM onboarding_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Onboarding request not found';
    END IF;
    
    -- Get the access profile
    SELECT * INTO v_profile FROM access_profiles WHERE id = v_request.access_profile_id;
    
    -- Create tasks for each profile item
    FOR v_item IN 
        SELECT * FROM access_profile_items WHERE profile_id = v_profile.id
    LOOP
        -- Get service details and documentation
        IF v_item.service_id IS NOT NULL THEN
            SELECT * INTO v_service FROM services WHERE id = v_item.service_id;
            
            -- Find primary service owner/admin
            SELECT * INTO v_owner 
            FROM service_owners 
            WHERE service_id = v_item.service_id 
              AND can_provision = true 
              AND is_available = true
            ORDER BY is_primary DESC, role_type ASC
            LIMIT 1;
        END IF;
        
        INSERT INTO onboarding_tasks (
            onboarding_request_id, task_type, task_name, description,
            service_id, 
            assigned_to, assigned_team,
            service_owner_id,
            kb_article_id,
            priority
        ) VALUES (
            p_request_id,
            CASE v_item.item_type
                WHEN 'service' THEN 'provision_service'
                WHEN 'asset_tier' THEN 'assign_asset'
                ELSE 'other'
            END,
            'Provision: ' || COALESCE(
                v_service.name,
                (SELECT name FROM asset_request_tiers WHERE id = v_item.asset_tier_id),
                v_item.item_name
            ),
            COALESCE(v_item.provisioning_notes, v_service.description),
            v_item.service_id,
            v_owner.user_id, -- Assign to service owner
            CASE v_item.item_type
                WHEN 'service' THEN 'IT'
                WHEN 'asset_tier' THEN 'IT'
                WHEN 'access_card' THEN 'Security'
                ELSE 'IT'
            END,
            v_owner.id,
            v_service.onboarding_doc_id, -- Link to onboarding documentation
            CASE WHEN v_item.is_required THEN 70 ELSE 30 END
        );
        v_task_count := v_task_count + 1;
    END LOOP;
    
    -- Add standard tasks
    INSERT INTO onboarding_tasks (onboarding_request_id, task_type, task_name, assigned_team, priority)
    VALUES 
        (p_request_id, 'create_account', 'Create user account', 'IT', 100),
        (p_request_id, 'create_email', 'Create email account', 'IT', 90),
        (p_request_id, 'create_badge', 'Create access badge', 'Security', 80),
        (p_request_id, 'setup_workstation', 'Setup workstation', 'IT', 60),
        (p_request_id, 'orientation', 'Schedule orientation', 'HR', 50);
    
    v_task_count := v_task_count + 5;
    
    RETURN v_task_count;
END;
$$;


--
-- Name: generate_project_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_project_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.project_number IS NULL THEN
        NEW.project_number := 'PRJ-' || LPAD(nextval('project_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_task_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_task_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.task_number IS NULL THEN
        NEW.task_number := 'TSK-' || LPAD(nextval('task_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: get_ai_redacted_fields(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_ai_redacted_fields(p_session_id uuid, p_resource_type character varying) RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_session RECORD;
    v_policy RECORD;
BEGIN
    SELECT * INTO v_session FROM ai_chat_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RETURN ARRAY[]::TEXT[];
    END IF;
    
    SELECT redacted_fields INTO v_policy 
    FROM ai_data_access_policies 
    WHERE organization_id = v_session.organization_id 
      AND context_level = v_session.context_level
      AND resource_type = p_resource_type;
    
    RETURN COALESCE(v_policy.redacted_fields, ARRAY[]::TEXT[]);
END;
$$;


--
-- Name: get_all_reports(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_reports(manager_id uuid) RETURNS TABLE(contact_id uuid, depth integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE reports AS (
        SELECT id, 1 as depth
        FROM contacts
        WHERE reports_to_id = manager_id AND archived_at IS NULL
        
        UNION ALL
        
        SELECT c.id, r.depth + 1
        FROM contacts c
        INNER JOIN reports r ON c.reports_to_id = r.id
        WHERE c.archived_at IS NULL
    )
    SELECT id, depth FROM reports;
END;
$$;


--
-- Name: get_available_agents(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_available_agents(p_team_id uuid, p_workspace_id uuid DEFAULT NULL::uuid) RETURNS TABLE(user_id uuid, name text, current_tickets integer, max_tickets integer, availability_score numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tm.user_id,
        u.first_name || ' ' || u.last_name as name,
        tm.current_ticket_count as current_tickets,
        tm.max_open_tickets as max_tickets,
        -- Score: lower is better (more available)
        CASE 
            WHEN tm.max_open_tickets = 0 THEN 999
            ELSE (tm.current_ticket_count::DECIMAL / tm.max_open_tickets)
        END as availability_score
    FROM team_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = p_team_id
      AND tm.is_available = true
      AND (tm.out_of_office_until IS NULL OR tm.out_of_office_until < CURRENT_DATE)
      AND tm.current_ticket_count < tm.max_open_tickets
    ORDER BY availability_score ASC, tm.current_ticket_count ASC;
END;
$$;


--
-- Name: get_available_tiers_for_contact(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_available_tiers_for_contact(p_contact_id uuid) RETURNS TABLE(tier_id uuid, tier_name character varying, category character varying, description text, requires_approval boolean, available_count bigint, show_count boolean)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_contact RECORD;
BEGIN
    SELECT * INTO v_contact FROM contacts WHERE id = p_contact_id;
    
    RETURN QUERY
    SELECT 
        t.id as tier_id,
        t.name as tier_name,
        t.category,
        t.description,
        t.requires_approval,
        COALESCE(inv.available_count, 0) as available_count,
        t.show_count_to_users as show_count
    FROM asset_request_tiers t
    LEFT JOIN asset_tier_inventory inv ON t.id = inv.tier_id
    WHERE t.organization_id = v_contact.organization_id
      AND t.is_active = true
      AND can_request_tier(p_contact_id, t.id)
    ORDER BY t.category, t.sort_order;
END;
$$;


--
-- Name: get_contextual_help(character varying, character varying, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_contextual_help(p_feature_key character varying, p_context character varying, p_user_id uuid) RETURNS TABLE(id uuid, title character varying, content text, learn_more_url character varying, video_url character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_ui_mode VARCHAR(20);
    v_user_role VARCHAR(50);
BEGIN
    -- Get user's UI mode and role
    SELECT get_user_ui_mode(p_user_id), role
    INTO v_ui_mode, v_user_role
    FROM users WHERE id = p_user_id;
    
    RETURN QUERY
    SELECT h.id, h.title, h.content, h.learn_more_url, h.video_url
    FROM contextual_help h
    LEFT JOIN user_help_dismissals d ON h.id = d.help_id AND d.user_id = p_user_id
    WHERE h.feature_key = p_feature_key
      AND h.context = p_context
      AND (h.ui_mode IS NULL OR v_ui_mode = ANY(h.ui_mode))
      AND (h.user_roles IS NULL OR v_user_role = ANY(h.user_roles))
      AND (NOT h.show_once OR d.id IS NULL)
    ORDER BY h.display_order
    LIMIT 1;
END;
$$;


--
-- Name: get_department_tree(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_department_tree(p_organization_id uuid) RETURNS TABLE(id uuid, name character varying, code character varying, path text, depth integer, parent_id uuid, head_name text, employee_count bigint, children_count bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.name,
        d.code,
        d.path,
        d.depth,
        d.parent_id,
        COALESCE(c.first_name || ' ' || c.last_name, '') as head_name,
        (SELECT COUNT(*) FROM contacts ct WHERE ct.department_id = d.id AND ct.archived_at IS NULL) as employee_count,
        (SELECT COUNT(*) FROM departments cd WHERE cd.parent_id = d.id AND cd.is_active = true) as children_count
    FROM departments d
    LEFT JOIN contacts c ON d.head_contact_id = c.id
    WHERE d.organization_id = p_organization_id AND d.is_active = true
    ORDER BY d.path;
END;
$$;


--
-- Name: get_direct_reports_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_direct_reports_count(manager_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM contacts WHERE reports_to_id = manager_id AND archived_at IS NULL);
END;
$$;


--
-- Name: get_location_map_data(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_location_map_data(p_organization_id uuid) RETURNS TABLE(id uuid, name character varying, location_level character varying, latitude numeric, longitude numeric, employee_count bigint, asset_count bigint, address text, is_remote boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.name,
        l.location_level,
        l.latitude,
        l.longitude,
        (SELECT COUNT(*) FROM contacts c WHERE c.location_id = l.id AND c.archived_at IS NULL) as employee_count,
        (SELECT COUNT(*) FROM assets a WHERE a.location_id = l.id AND a.archived_at IS NULL) as asset_count,
        CONCAT_WS(', ', 
            NULLIF(l.address_line1, ''),
            NULLIF(l.city, ''),
            NULLIF(l.state, ''),
            NULLIF(l.country, '')
        ) as address,
        l.is_remote
    FROM office_locations l
    WHERE l.organization_id = p_organization_id
      AND l.is_active = true
      AND l.latitude IS NOT NULL 
      AND l.longitude IS NOT NULL
    ORDER BY l.employee_count DESC;
END;
$$;


--
-- Name: get_location_tree(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_location_tree(p_organization_id uuid, p_parent_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, name character varying, code character varying, location_level character varying, path text, depth integer, parent_id uuid, employee_count integer, asset_count integer, latitude numeric, longitude numeric, children_count bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE location_tree AS (
        -- Base case: root locations or children of specified parent
        SELECT 
            l.id, l.name, l.code, l.location_level, l.path, l.depth, l.parent_id,
            l.employee_count, l.asset_count, l.latitude, l.longitude
        FROM office_locations l
        WHERE l.organization_id = p_organization_id
          AND (
              (p_parent_id IS NULL AND l.parent_id IS NULL) OR
              (l.parent_id = p_parent_id)
          )
          AND l.is_active = true
        
        UNION ALL
        
        -- Recursive case: get children
        SELECT 
            l.id, l.name, l.code, l.location_level, l.path, l.depth, l.parent_id,
            l.employee_count, l.asset_count, l.latitude, l.longitude
        FROM office_locations l
        INNER JOIN location_tree lt ON l.parent_id = lt.id
        WHERE l.is_active = true
    )
    SELECT 
        lt.*,
        (SELECT COUNT(*) FROM office_locations c WHERE c.parent_id = lt.id AND c.is_active = true) as children_count
    FROM location_tree lt
    ORDER BY lt.path;
END;
$$;


--
-- Name: get_org_chart(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_chart(p_organization_id uuid, p_root_contact_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, name text, job_title text, department text, location text, email character varying, avatar_url character varying, reports_to_id uuid, direct_reports_count bigint, depth integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE org_tree AS (
        -- Base case: root(s)
        SELECT 
            c.id,
            c.first_name || ' ' || c.last_name as name,
            jt.name as job_title,
            d.name as department,
            l.name as location,
            c.email,
            c.avatar_url,
            c.reports_to_id,
            0 as depth
        FROM contacts c
        LEFT JOIN job_titles jt ON c.job_title_id = jt.id
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN office_locations l ON c.location_id = l.id
        WHERE c.organization_id = p_organization_id
          AND c.archived_at IS NULL
          AND c.contact_type = 'employee'
          AND (
              (p_root_contact_id IS NULL AND c.reports_to_id IS NULL) OR
              (c.id = p_root_contact_id)
          )
        
        UNION ALL
        
        -- Recursive case: get reports
        SELECT 
            c.id,
            c.first_name || ' ' || c.last_name,
            jt.name,
            d.name,
            l.name,
            c.email,
            c.avatar_url,
            c.reports_to_id,
            ot.depth + 1
        FROM contacts c
        INNER JOIN org_tree ot ON c.reports_to_id = ot.id
        LEFT JOIN job_titles jt ON c.job_title_id = jt.id
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN office_locations l ON c.location_id = l.id
        WHERE c.archived_at IS NULL
          AND c.contact_type = 'employee'
    )
    SELECT 
        ot.id,
        ot.name,
        ot.job_title,
        ot.department,
        ot.location,
        ot.email,
        ot.avatar_url,
        ot.reports_to_id,
        (SELECT COUNT(*) FROM contacts r WHERE r.reports_to_id = ot.id AND r.archived_at IS NULL) as direct_reports_count,
        ot.depth
    FROM org_tree ot
    ORDER BY ot.depth, ot.name;
END;
$$;


--
-- Name: get_organization_features(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_organization_features(p_organization_id uuid) RETURNS TABLE(feature_key character varying, feature_name character varying, description text, category character varying, status character varying, icon character varying, badge_text character varying, badge_color character varying, is_enabled boolean, can_enable boolean, can_disable boolean, requires_beta_ack boolean, beta_acknowledged boolean, stable_version character varying, docs_url character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.feature_key,
        r.feature_name,
        r.description,
        r.category,
        r.status,
        r.icon,
        r.badge_text,
        r.badge_color,
        COALESCE(f.enabled, r.default_enabled) as is_enabled,
        r.status NOT IN ('coming_soon', 'deprecated') as can_enable,
        r.can_disable,
        r.status IN ('beta', 'alpha') as requires_beta_ack,
        COALESCE(f.beta_acknowledged, false) as beta_acknowledged,
        r.stable_version,
        r.docs_url
    FROM feature_registry r
    LEFT JOIN organization_feature_flags f 
        ON r.feature_key = f.feature_key 
        AND f.organization_id = p_organization_id
    ORDER BY 
        CASE r.category
            WHEN 'core' THEN 1
            WHEN 'standard' THEN 2
            WHEN 'advanced' THEN 3
            WHEN 'enterprise' THEN 4
            WHEN 'experimental' THEN 5
        END,
        r.feature_name;
END;
$$;


--
-- Name: get_pending_acknowledgments(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pending_acknowledgments(p_user_id uuid DEFAULT NULL::uuid, p_contact_id uuid DEFAULT NULL::uuid) RETURNS TABLE(article_id uuid, title character varying, category_name character varying, acknowledgment_required_by date, days_overdue integer)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_contact_id uuid;
  v_resolved_user_id uuid;
BEGIN
  -- Resolve contact_id from user_id if not provided
  v_contact_id := p_contact_id;
  v_resolved_user_id := p_user_id;
  IF v_contact_id IS NULL AND p_user_id IS NOT NULL THEN
    SELECT u.contact_id INTO v_contact_id FROM users u WHERE u.id = p_user_id;
  END IF;
  -- And the inverse — for the kb_article_owes call
  IF v_resolved_user_id IS NULL AND p_contact_id IS NOT NULL THEN
    SELECT u.id INTO v_resolved_user_id FROM users u WHERE u.contact_id = p_contact_id LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.title,
    c.name AS category_name,
    -- Effective deadline: LEAST of fixed date and relative date (preserves existing semantics)
    CASE
      WHEN a.acknowledgment_required_by IS NOT NULL AND a.acknowledgment_days IS NOT NULL AND v_contact_id IS NOT NULL THEN
        LEAST(
          a.acknowledgment_required_by,
          (SELECT (COALESCE(ct.start_date, ct.created_at::date) + a.acknowledgment_days)
             FROM contacts ct WHERE ct.id = v_contact_id)
        )
      WHEN a.acknowledgment_days IS NOT NULL AND v_contact_id IS NOT NULL THEN
        (SELECT (COALESCE(ct.start_date, ct.created_at::date) + a.acknowledgment_days)
           FROM contacts ct WHERE ct.id = v_contact_id)
      ELSE
        a.acknowledgment_required_by
    END AS acknowledgment_required_by,
    -- Days overdue based on the effective deadline
    CASE
      WHEN a.acknowledgment_required_by IS NOT NULL AND a.acknowledgment_days IS NOT NULL AND v_contact_id IS NOT NULL THEN
        GREATEST(0, (CURRENT_DATE - LEAST(
          a.acknowledgment_required_by,
          (SELECT (COALESCE(ct.start_date, ct.created_at::date) + a.acknowledgment_days)
             FROM contacts ct WHERE ct.id = v_contact_id)
        ))::integer)
      WHEN a.acknowledgment_days IS NOT NULL AND v_contact_id IS NOT NULL THEN
        GREATEST(0, (CURRENT_DATE - (
          SELECT (COALESCE(ct.start_date, ct.created_at::date) + a.acknowledgment_days)
            FROM contacts ct WHERE ct.id = v_contact_id
        ))::integer)
      WHEN a.acknowledgment_required_by IS NOT NULL THEN
        GREATEST(0, (CURRENT_DATE - a.acknowledgment_required_by)::integer)
      ELSE 0
    END AS days_overdue
  FROM kb_articles a
  LEFT JOIN kb_categories c ON a.category_id = c.id
  WHERE a.requires_acknowledgment = true
    AND a.status = 'published'
    AND a.is_deleted = false
    -- The audience check — single source of truth via kb_article_owes
    AND v_resolved_user_id IS NOT NULL
    AND public.kb_article_owes(a.id, v_resolved_user_id) = true
    AND NOT EXISTS (
      SELECT 1 FROM kb_article_acknowledgments ack
      WHERE ack.article_id = a.id
        AND (
          (p_user_id IS NOT NULL AND ack.user_id = p_user_id)
          OR (p_contact_id IS NOT NULL AND ack.contact_id = p_contact_id)
        )
    )
  ORDER BY acknowledgment_required_by ASC NULLS LAST, a.title;
END;
$$;


--
-- Name: get_pending_emails(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pending_emails(p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, to_email character varying, to_name character varying, subject character varying, body_text text, body_html text, attachments jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    UPDATE email_queue eq
    SET status = 'sending', updated_at = NOW()
    WHERE eq.id IN (
        SELECT e.id FROM email_queue e
        WHERE e.status = 'pending'
        AND e.scheduled_at <= NOW()
        ORDER BY e.priority DESC, e.scheduled_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING eq.id, eq.to_email, eq.to_name, eq.subject, eq.body_text, eq.body_html, eq.attachments;
END;
$$;


--
-- Name: get_pending_policies(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pending_policies(p_user_id uuid DEFAULT NULL::uuid, p_contact_id uuid DEFAULT NULL::uuid) RETURNS TABLE(policy_id uuid, policy_name character varying, policy_type public.policy_type, version character varying, due_date date, days_until_due integer, is_overdue boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.policy_type,
        p.version,
        pa.due_date,
        (pa.due_date - CURRENT_DATE)::INT as days_until_due,
        pa.due_date < CURRENT_DATE as is_overdue
    FROM policy_assignments pa
    JOIN policies p ON pa.policy_id = p.id
    WHERE pa.status = 'pending'
      AND (
          (p_user_id IS NOT NULL AND pa.user_id = p_user_id) OR
          (p_contact_id IS NOT NULL AND pa.contact_id = p_contact_id)
      )
    ORDER BY pa.due_date ASC;
END;
$$;


--
-- Name: get_suggested_articles_for_ticket(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_suggested_articles_for_ticket(p_ticket_id uuid, p_limit integer DEFAULT 5) RETURNS TABLE(article_id uuid, title character varying, slug character varying, relevance_source character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH ticket_info AS (
        SELECT
            t.organization_id,
            t.subject,
            t.description,
            t.type,
            t.category_id
        FROM tickets t
        WHERE t.id = p_ticket_id
    )
    SELECT DISTINCT ON (a.id)
        a.id as article_id,
        a.title,
        a.slug,
        CASE
            WHEN a.related_ticket_types @> ARRAY[(SELECT type FROM ticket_info)] THEN 'ticket_type_match'
            ELSE 'text_search'
        END as relevance_source
    FROM kb_articles a, ticket_info ti
    WHERE a.organization_id = ti.organization_id
      AND a.status = 'published'
      AND a.visibility IN ('public', 'authenticated', 'internal')
      AND (
          -- Match by ticket type
          a.related_ticket_types @> ARRAY[ti.type]
          -- Or by text search
          OR to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.content_plain, ''))
             @@ plainto_tsquery('english', coalesce(ti.subject, '') || ' ' || coalesce(LEFT(ti.description, 500), ''))
      )
    ORDER BY a.id,
             CASE WHEN a.related_ticket_types @> ARRAY[ti.type] THEN 0 ELSE 1 END,
             a.helpful_count DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: get_user_ui_mode(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_ui_mode(p_user_id uuid) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_user_mode VARCHAR(20);
    v_org_mode VARCHAR(20);
BEGIN
    SELECT u.ui_mode, o.ui_mode
    INTO v_user_mode, v_org_mode
    FROM users u
    JOIN organizations o ON u.organization_id = o.id
    WHERE u.id = p_user_id;
    
    RETURN COALESCE(v_user_mode, v_org_mode, 'standard');
END;
$$;


--
-- Name: handle_ticket_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_ticket_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_status_record RECORD;
    new_status_record RECORD;
    pause_duration INTEGER;
    -- Sentinel surrogates so subsequent IF/ELSIF branches that compare
    -- old_status_record.* keep working when there's no prior status.
    has_old BOOLEAN := false;
BEGIN
    -- Get old and new status details
    IF OLD.status_id IS NOT NULL THEN
        SELECT * INTO old_status_record FROM ticket_statuses WHERE id = OLD.status_id;
        has_old := FOUND;
    END IF;

    SELECT * INTO new_status_record FROM ticket_statuses WHERE id = NEW.status_id;

    -- Handle SLA pause/resume — only when we have an old status to compare against.
    IF has_old THEN
        IF old_status_record.sla_paused = true AND new_status_record.sla_paused = false THEN
            -- Resuming from paused state - calculate pause duration
            IF OLD.sla_paused_at IS NOT NULL THEN
                pause_duration := EXTRACT(EPOCH FROM (NOW() - OLD.sla_paused_at))::INTEGER;
                NEW.sla_total_paused_seconds := COALESCE(OLD.sla_total_paused_seconds, 0) + pause_duration;
                NEW.sla_paused_at := NULL;

                -- Adjust due dates by pause duration
                IF NEW.sla_due_at IS NOT NULL THEN
                    NEW.sla_due_at := NEW.sla_due_at + (pause_duration || ' seconds')::INTERVAL;
                END IF;
                IF NEW.sla_resolution_due_at IS NOT NULL THEN
                    NEW.sla_resolution_due_at := NEW.sla_resolution_due_at + (pause_duration || ' seconds')::INTERVAL;
                END IF;
            END IF;
        ELSIF old_status_record.sla_paused = false AND new_status_record.sla_paused = true THEN
            -- Entering paused state
            NEW.sla_paused_at := NOW();
        END IF;
    ELSE
        -- No prior status. If the new status itself is paused, mark the start.
        IF new_status_record.sla_paused = true THEN
            NEW.sla_paused_at := NOW();
        END IF;
    END IF;

    -- Handle closed status — same guard.
    IF has_old THEN
        IF new_status_record.base_status = 'closed' AND old_status_record.base_status != 'closed' THEN
            NEW.sla_resolved_at := NOW();
            NEW.closed_at := NOW();
        ELSIF new_status_record.base_status != 'closed' AND old_status_record.base_status = 'closed' THEN
            -- Reopening ticket
            NEW.sla_resolved_at := NULL;
            NEW.closed_at := NULL;
        END IF;
    ELSE
        -- No prior. If transitioning straight into closed, set the timestamps.
        IF new_status_record.base_status = 'closed' THEN
            NEW.sla_resolved_at := COALESCE(NEW.sla_resolved_at, NOW());
            NEW.closed_at := COALESCE(NEW.closed_at, NOW());
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: has_acknowledged_required_policies(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_acknowledged_required_policies(p_user_id uuid DEFAULT NULL::uuid, p_contact_id uuid DEFAULT NULL::uuid, p_for_onboarding boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_pending_count INT;
BEGIN
    SELECT COUNT(*) INTO v_pending_count
    FROM policy_assignments pa
    JOIN policies p ON pa.policy_id = p.id
    WHERE pa.status = 'pending'
      AND (
          (p_user_id IS NOT NULL AND pa.user_id = p_user_id) OR
          (p_contact_id IS NOT NULL AND pa.contact_id = p_contact_id)
      )
      AND (
          NOT p_for_onboarding OR p.required_for_onboarding = true
      )
      AND p.blocks_access_until_acknowledged = true;
    
    RETURN v_pending_count = 0;
END;
$$;


--
-- Name: initialize_ticket_statuses(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_ticket_statuses(org_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO ticket_statuses (
        organization_id, name, color, icon, description, 
        base_status, sla_paused, is_default, is_system, sort_order
    )
    SELECT 
        org_id, name, color, icon, description,
        base_status, sla_paused, is_default, is_system, sort_order
    FROM ticket_status_templates
    ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;


--
-- Name: is_feature_enabled(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_feature_enabled(p_organization_id uuid, p_feature character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
DECLARE
    v_enabled BOOLEAN;
BEGIN
    EXECUTE format('SELECT %I FROM organization_features WHERE organization_id = $1', p_feature)
    INTO v_enabled
    USING p_organization_id;
    
    RETURN COALESCE(v_enabled, false);
END;
$_$;


--
-- Name: is_feature_enabled_v2(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_feature_enabled_v2(p_organization_id uuid, p_feature_key character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_registry_status VARCHAR(20);
    v_default_enabled BOOLEAN;
    v_override_enabled BOOLEAN;
BEGIN
    -- Get feature from registry
    SELECT status, default_enabled
    INTO v_registry_status, v_default_enabled
    FROM feature_registry
    WHERE feature_key = p_feature_key;
    
    -- Feature doesn't exist
    IF v_registry_status IS NULL THEN
        RETURN false;
    END IF;
    
    -- Coming soon features are never enabled
    IF v_registry_status = 'coming_soon' THEN
        RETURN false;
    END IF;
    
    -- Deprecated features are disabled
    IF v_registry_status = 'deprecated' THEN
        RETURN false;
    END IF;
    
    -- Check for organization override
    SELECT enabled
    INTO v_override_enabled
    FROM organization_feature_flags
    WHERE organization_id = p_organization_id
      AND feature_key = p_feature_key;
    
    -- Return override if exists, otherwise default
    RETURN COALESCE(v_override_enabled, v_default_enabled);
END;
$$;


--
-- Name: kb_article_audience_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kb_article_audience_count(p_article_id uuid) RETURNS integer
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM users u
  WHERE kb_article_owes(p_article_id, u.id) = true;
  RETURN v_count;
END;
$$;


--
-- Name: kb_article_owes(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kb_article_owes(p_article_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  a kb_articles%ROWTYPE;
  v_contact_type varchar(20);
  v_user_role uuid;
  v_user_department uuid;
  v_user_job_title uuid;
  v_user_employment_type uuid;
  v_user_company uuid;
  v_user_location uuid;
  v_user_contact_groups uuid[];
BEGIN
  SELECT * INTO a FROM kb_articles WHERE id = p_article_id;
  IF NOT FOUND OR a.is_deleted = true THEN
    RETURN false;
  END IF;
  IF a.required_for_audience_kind = 'none' THEN
    RETURN false;
  END IF;

  -- Resolve user attributes in a single query.
  SELECT c.contact_type,
         u.role_id,
         c.department_id,
         c.job_title_id,
         c.employment_type_id,
         c.company_id,
         c.location_id,
         COALESCE(
           (SELECT array_agg(group_id) FROM contact_group_members WHERE contact_id = c.id),
           '{}'::uuid[]
         )
    INTO v_contact_type, v_user_role, v_user_department, v_user_job_title,
         v_user_employment_type, v_user_company, v_user_location, v_user_contact_groups
    FROM users u
    LEFT JOIN contacts c ON c.id = u.contact_id
    WHERE u.id = p_user_id;

  IF a.required_for_audience_kind = 'internal' THEN
    -- All employees owe; external contact types (customer/vendor/partner) do not.
    -- COALESCE handles users with no contact link (admin, system users) — they
    -- have NULL contact_type which would otherwise return NULL instead of false.
    RETURN COALESCE(v_contact_type = 'employee', false);
  END IF;

  -- 'targeted' — match any required_for_* axis (OR semantics)
  RETURN
    (a.required_for_roles <> '{}' AND v_user_role IS NOT NULL AND v_user_role = ANY(a.required_for_roles))
    OR (a.required_for_departments <> '{}' AND v_user_department IS NOT NULL AND v_user_department = ANY(a.required_for_departments))
    OR (a.required_for_job_titles <> '{}' AND v_user_job_title IS NOT NULL AND v_user_job_title = ANY(a.required_for_job_titles))
    OR (a.required_for_employment_types <> '{}' AND v_user_employment_type IS NOT NULL AND v_user_employment_type = ANY(a.required_for_employment_types))
    OR (a.required_for_companies <> '{}' AND v_user_company IS NOT NULL AND v_user_company = ANY(a.required_for_companies))
    OR (a.required_for_locations <> '{}' AND v_user_location IS NOT NULL AND v_user_location = ANY(a.required_for_locations))
    OR (a.required_for_contact_groups <> '{}' AND a.required_for_contact_groups && v_user_contact_groups);
END;
$$;


--
-- Name: kb_articles_compute_assessment_hash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kb_articles_compute_assessment_hash() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.assessment IS NULL THEN
    NEW.assessment_hash = NULL;
  ELSE
    -- jsonb_strip_nulls + cast → md5. Deterministic and key-order independent
    -- because jsonb stores objects in canonical key order.
    NEW.assessment_hash = md5(jsonb_strip_nulls(NEW.assessment)::text);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: log_ai_data_access(uuid, character varying, uuid, character varying, text, integer, boolean, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_ai_data_access(p_session_id uuid, p_resource_type character varying, p_resource_id uuid, p_action character varying, p_query_text text, p_results_count integer, p_access_granted boolean, p_denial_reason text DEFAULT NULL::text, p_redacted_fields text[] DEFAULT NULL::text[]) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO ai_chat_data_access_log (
        session_id, resource_type, resource_id, action, 
        query_text, results_count, access_granted, denial_reason, redacted_fields
    ) VALUES (
        p_session_id, p_resource_type, p_resource_id, p_action,
        p_query_text, p_results_count, p_access_granted, p_denial_reason, p_redacted_fields
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;


--
-- Name: log_audit_event(uuid, character varying, uuid, uuid, uuid, character varying, character varying, uuid, jsonb, jsonb, character varying, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event(p_organization_id uuid, p_actor_type character varying, p_user_id uuid, p_provider_user_id uuid, p_provider_id uuid, p_action character varying, p_entity_type character varying, p_entity_id uuid, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_actor_ip character varying DEFAULT NULL::character varying, p_success boolean DEFAULT true, p_error_message text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_audit_id UUID;
    v_actor_email VARCHAR(255);
    v_actor_name VARCHAR(255);
    v_entity_name VARCHAR(255);
    v_changed_fields TEXT[];
BEGIN
    -- Get actor details
    IF p_user_id IS NOT NULL THEN
        SELECT email, CONCAT(first_name, ' ', last_name) INTO v_actor_email, v_actor_name
        FROM users WHERE id = p_user_id;
    ELSIF p_provider_user_id IS NOT NULL THEN
        SELECT email, name INTO v_actor_email, v_actor_name
        FROM provider_users WHERE id = p_provider_user_id;
    END IF;
    
    -- Calculate changed fields
    IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
        SELECT array_agg(key) INTO v_changed_fields
        FROM (
            SELECT key FROM jsonb_each(p_new_values)
            EXCEPT
            SELECT key FROM jsonb_each(p_old_values) WHERE p_old_values->key = p_new_values->key
        ) changed;
    END IF;
    
    -- Insert audit record
    INSERT INTO audit_log (
        organization_id, actor_type, user_id, provider_user_id, provider_id,
        actor_email, actor_name, actor_ip,
        action, entity_type, entity_id, entity_name,
        old_values, new_values, changed_fields,
        success, error_message
    ) VALUES (
        p_organization_id, p_actor_type, p_user_id, p_provider_user_id, p_provider_id,
        v_actor_email, v_actor_name, p_actor_ip,
        p_action, p_entity_type, p_entity_id, v_entity_name,
        p_old_values, p_new_values, v_changed_fields,
        p_success, p_error_message
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$;


--
-- Name: mark_notifications_read(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_notifications_read(p_user_id uuid, p_notification_ids uuid[] DEFAULT NULL::uuid[]) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_count INT;
BEGIN
    IF p_notification_ids IS NULL THEN
        -- Mark all as read
        UPDATE notifications
        SET is_read = true, read_at = NOW()
        WHERE user_id = p_user_id AND is_read = false;
    ELSE
        -- Mark specific ones
        UPDATE notifications
        SET is_read = true, read_at = NOW()
        WHERE user_id = p_user_id
        AND id = ANY(p_notification_ids)
        AND is_read = false;
    END IF;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


--
-- Name: renew_certificate(uuid, date, character varying, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.renew_certificate(p_certificate_id uuid, p_new_expires_at date, p_new_serial_number character varying DEFAULT NULL::character varying, p_new_public_key text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_cert RECORD;
BEGIN
    SELECT * INTO v_cert FROM certificates WHERE id = p_certificate_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Record renewal in history
    INSERT INTO certificate_history (
        certificate_id, event_type,
        old_expires_at, new_expires_at,
        old_serial_number, new_serial_number,
        performed_by
    ) VALUES (
        p_certificate_id, 'renewed',
        v_cert.expires_at, p_new_expires_at,
        v_cert.serial_number, p_new_serial_number,
        p_user_id
    );

    -- Update certificate
    UPDATE certificates SET
        expires_at = p_new_expires_at,
        serial_number = COALESCE(p_new_serial_number, serial_number),
        public_key = COALESCE(p_new_public_key, public_key),
        issued_at = CURRENT_DATE,
        status = 'active',
        updated_at = NOW()
    WHERE id = p_certificate_id;

    -- Resolve any open alerts
    UPDATE certificate_alerts
    SET status = 'resolved', resolved_at = NOW()
    WHERE certificate_id = p_certificate_id AND status != 'resolved';

    RETURN true;
END;
$$;


--
-- Name: request_chat_handoff(uuid, character varying, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_chat_handoff(p_session_id uuid, p_reason character varying, p_reason_details text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_handoff_id UUID;
BEGIN
    INSERT INTO chat_handoffs (session_id, reason, reason_details)
    VALUES (p_session_id, p_reason, p_reason_details)
    RETURNING id INTO v_handoff_id;

    UPDATE ai_chat_sessions
    SET resolution_status = 'escalated', updated_at = NOW()
    WHERE id = p_session_id;

    RETURN v_handoff_id;
END;
$$;


--
-- Name: request_new_category(uuid, character varying, uuid, character varying, uuid, uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_new_category(p_workspace_id uuid, p_suggested_name character varying, p_suggested_parent_id uuid, p_requested_by_type character varying, p_requested_by_user_id uuid DEFAULT NULL::uuid, p_sample_ticket_id uuid DEFAULT NULL::uuid, p_ai_confidence numeric DEFAULT NULL::numeric, p_ai_reasoning text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_request_id UUID;
    v_existing RECORD;
    v_ticket RECORD;
BEGIN
    -- Check if similar request already exists
    SELECT * INTO v_existing
    FROM category_requests
    WHERE workspace_id = p_workspace_id
      AND LOWER(suggested_name) = LOWER(p_suggested_name)
      AND status = 'pending';
    
    IF FOUND THEN
        -- Update existing request with new evidence
        UPDATE category_requests
        SET occurrence_count = occurrence_count + 1,
            sample_ticket_ids = CASE 
                WHEN p_sample_ticket_id IS NOT NULL 
                THEN array_append(sample_ticket_ids, p_sample_ticket_id)
                ELSE sample_ticket_ids
            END,
            updated_at = NOW()
        WHERE id = v_existing.id;
        
        RETURN v_existing.id;
    END IF;
    
    -- Get ticket subject if provided
    IF p_sample_ticket_id IS NOT NULL THEN
        SELECT subject INTO v_ticket FROM tickets WHERE id = p_sample_ticket_id;
    END IF;
    
    -- Create new request
    INSERT INTO category_requests (
        workspace_id,
        organization_id,
        suggested_name,
        suggested_parent_id,
        requested_by_type,
        requested_by_user_id,
        ai_confidence,
        ai_reasoning,
        sample_ticket_ids,
        sample_ticket_subjects
    )
    SELECT 
        p_workspace_id,
        w.organization_id,
        p_suggested_name,
        p_suggested_parent_id,
        p_requested_by_type,
        p_requested_by_user_id,
        p_ai_confidence,
        p_ai_reasoning,
        CASE WHEN p_sample_ticket_id IS NOT NULL THEN ARRAY[p_sample_ticket_id] ELSE ARRAY[]::UUID[] END,
        CASE WHEN v_ticket.subject IS NOT NULL THEN ARRAY[v_ticket.subject] ELSE ARRAY[]::TEXT[] END
    FROM workspaces w
    WHERE w.id = p_workspace_id
    RETURNING id INTO v_request_id;
    
    RETURN v_request_id;
END;
$$;


--
-- Name: resolve_dns_alert(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_dns_alert(p_alert_id uuid, p_ticket_id uuid, p_user_id uuid, p_resolution_notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ticket is REQUIRED to resolve
    IF p_ticket_id IS NULL THEN
        RAISE EXCEPTION 'Ticket ID is required to resolve DNS change alerts';
    END IF;

    -- Verify ticket exists
    IF NOT EXISTS (SELECT 1 FROM tickets WHERE id = p_ticket_id) THEN
        RAISE EXCEPTION 'Ticket not found';
    END IF;

    UPDATE dns_change_alerts
    SET
        status = 'resolved',
        ticket_id = p_ticket_id,
        resolved_by = p_user_id,
        resolved_at = NOW(),
        resolution_notes = p_resolution_notes,
        updated_at = NOW()
    WHERE id = p_alert_id;

    RETURN FOUND;
END;
$$;


--
-- Name: restore_deleted_item(character varying, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_deleted_item(p_entity_type character varying, p_entity_id uuid, p_restored_by_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_entity_name VARCHAR(500);
    v_org_id UUID;
BEGIN
    CASE p_entity_type
        WHEN 'ticket' THEN
            UPDATE tickets 
            SET is_deleted = false,
                deleted_at = NULL,
                deleted_by_user_id = NULL,
                deleted_by_provider_id = NULL,
                deleted_by_name = NULL,
                delete_reason = NULL,
                restored_at = NOW(),
                restored_by_user_id = p_restored_by_user_id
            WHERE id = p_entity_id AND is_deleted = true
            RETURNING subject INTO v_entity_name;
            
        WHEN 'asset' THEN
            UPDATE assets 
            SET is_deleted = false,
                deleted_at = NULL,
                deleted_by_user_id = NULL,
                deleted_by_provider_id = NULL,
                deleted_by_name = NULL,
                delete_reason = NULL,
                restored_at = NOW(),
                restored_by_user_id = p_restored_by_user_id
            WHERE id = p_entity_id AND is_deleted = true
            RETURNING name INTO v_entity_name;
            
        WHEN 'contact' THEN
            UPDATE contacts 
            SET is_deleted = false,
                deleted_at = NULL,
                deleted_by_user_id = NULL,
                deleted_by_provider_id = NULL,
                deleted_by_name = NULL,
                delete_reason = NULL,
                restored_at = NOW(),
                restored_by_user_id = p_restored_by_user_id
            WHERE id = p_entity_id AND is_deleted = true
            RETURNING COALESCE(first_name || ' ' || last_name, email) INTO v_entity_name;
            
        WHEN 'credential' THEN
            UPDATE credentials 
            SET is_deleted = false,
                deleted_at = NULL,
                deleted_by_user_id = NULL,
                deleted_by_provider_id = NULL,
                deleted_by_name = NULL,
                delete_reason = NULL,
                restored_at = NOW(),
                restored_by_user_id = p_restored_by_user_id
            WHERE id = p_entity_id AND is_deleted = true
            RETURNING name INTO v_entity_name;
            
        WHEN 'kb_article' THEN
            UPDATE kb_articles 
            SET is_deleted = false,
                deleted_at = NULL,
                deleted_by_user_id = NULL,
                deleted_by_provider_id = NULL,
                deleted_by_name = NULL,
                delete_reason = NULL,
                restored_at = NOW(),
                restored_by_user_id = p_restored_by_user_id
            WHERE id = p_entity_id AND is_deleted = true
            RETURNING title INTO v_entity_name;
            
        ELSE
            RAISE EXCEPTION 'Unknown entity type: %', p_entity_type;
    END CASE;
    
    RETURN v_entity_name IS NOT NULL;
END;
$$;


--
-- Name: revoke_api_key(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_api_key(p_api_key_id uuid, p_revoked_by uuid, p_reason text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Revoke the key
    UPDATE provider_api_keys
    SET is_active = false,
        is_revoked = true,
        revoked_at = NOW(),
        revoked_by = p_revoked_by,
        revoked_reason = p_reason
    WHERE id = p_api_key_id;
    
    -- End all active sessions
    UPDATE provider_sessions
    SET is_active = false,
        ended_at = NOW(),
        end_reason = 'revoked'
    WHERE api_key_id = p_api_key_id AND is_active = true;
    
    RETURN true;
END;
$$;


--
-- Name: search_documents(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_documents(p_organization_id uuid, p_query text, p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, title character varying, description text, folder_id uuid, company_id uuid, rank real)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.title,
        d.description,
        d.folder_id,
        d.company_id,
        ts_rank(
            to_tsvector('english', coalesce(d.title, '') || ' ' || coalesce(d.content_raw, '')),
            plainto_tsquery('english', p_query)
        ) as rank
    FROM documents d
    WHERE d.organization_id = p_organization_id
      AND to_tsvector('english', coalesce(d.title, '') || ' ' || coalesce(d.content_raw, ''))
          @@ plainto_tsquery('english', p_query)
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: search_kb_articles(uuid, text, character varying, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_kb_articles(p_organization_id uuid, p_query text, p_visibility character varying DEFAULT 'public'::character varying, p_category_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, title character varying, summary text, slug character varying, category_id uuid, category_name character varying, relevance_score real, view_count integer, helpful_ratio numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.title,
        a.summary,
        a.slug,
        a.category_id,
        c.name as category_name,
        ts_rank(
            to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.content_plain, '')),
            plainto_tsquery('english', p_query)
        ) as relevance_score,
        a.view_count,
        CASE
            WHEN (a.helpful_count + a.not_helpful_count) > 0
            THEN ROUND(a.helpful_count::DECIMAL * 100 / (a.helpful_count + a.not_helpful_count), 1)
            ELSE NULL
        END as helpful_ratio
    FROM kb_articles a
    LEFT JOIN kb_categories c ON a.category_id = c.id
    WHERE a.organization_id = p_organization_id
      AND a.status = 'published'
      AND (a.expires_at IS NULL OR a.expires_at > NOW())
      AND (
          p_visibility = 'all'
          OR a.visibility = p_visibility
          OR (p_visibility = 'authenticated' AND a.visibility IN ('public', 'authenticated'))
      )
      AND (p_category_id IS NULL OR a.category_id = p_category_id)
      AND to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.content_plain, ''))
          @@ plainto_tsquery('english', p_query)
    ORDER BY relevance_score DESC, a.view_count DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: search_kb_articles_for_user(uuid, text, uuid, uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_kb_articles_for_user(p_organization_id uuid, p_query text, p_user_id uuid DEFAULT NULL::uuid, p_contact_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, title character varying, summary text, slug character varying, category_id uuid, category_name character varying, category_slug character varying, visibility character varying, relevance_score real, view_count integer, helpful_ratio numeric, requires_acknowledgment boolean, is_acknowledged boolean, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_user_role VARCHAR(50);
    v_user_role_id UUID;
    v_contact_company_id UUID;
    v_contact_location_id UUID;
    v_contact_department_id UUID;
    v_contact_job_title_id UUID;
    v_contact_employment_type_id UUID;
BEGIN
    -- Get user attributes for filtering (join user_roles to get role name)
    IF p_user_id IS NOT NULL THEN
        SELECT ur.name, u.role_id
        INTO v_user_role, v_user_role_id
        FROM users u
        LEFT JOIN user_roles ur ON ur.id = u.role_id
        WHERE u.id = p_user_id;
    END IF;

    -- Get contact attributes using structured FK fields
    IF p_contact_id IS NOT NULL THEN
        SELECT
            c.company_id,
            c.location_id,
            c.department_id,
            c.job_title_id,
            c.employment_type_id
        INTO
            v_contact_company_id,
            v_contact_location_id,
            v_contact_department_id,
            v_contact_job_title_id,
            v_contact_employment_type_id
        FROM contacts c
        WHERE c.id = p_contact_id;
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.title,
        a.summary,
        a.slug,
        a.category_id,
        c.name as category_name,
        c.slug as category_slug,
        a.visibility,
        ts_rank(
            to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.content_plain, '')),
            plainto_tsquery('english', p_query)
        ) as relevance_score,
        a.view_count,
        CASE
            WHEN (a.helpful_count + a.not_helpful_count) > 0
            THEN ROUND(a.helpful_count::DECIMAL * 100 / (a.helpful_count + a.not_helpful_count), 1)
            ELSE NULL
        END as helpful_ratio,
        a.requires_acknowledgment,
        CASE
            WHEN a.requires_acknowledgment THEN
                EXISTS (
                    SELECT 1 FROM kb_article_acknowledgments ack
                    WHERE ack.article_id = a.id
                    AND (ack.user_id = p_user_id OR ack.contact_id = p_contact_id)
                )
            ELSE NULL
        END as is_acknowledged,
        a.updated_at
    FROM kb_articles a
    LEFT JOIN kb_categories c ON a.category_id = c.id
    WHERE a.organization_id = p_organization_id
      AND a.status = 'published'
      AND a.is_deleted = false
      AND (a.expires_at IS NULL OR a.expires_at > NOW())
      AND (p_category_id IS NULL OR a.category_id = p_category_id)
      AND (
          p_query IS NULL
          OR p_query = ''
          OR to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.content_plain, ''))
             @@ plainto_tsquery('english', p_query)
      )
      AND (
          a.visibility = 'public'
          OR (a.visibility = 'authenticated' AND (p_user_id IS NOT NULL OR p_contact_id IS NOT NULL))
          OR (a.visibility = 'internal' AND p_user_id IS NOT NULL AND v_user_role IN ('System Admin', 'Helpdesk Admin', 'Technician', 'Manager', 'admin', 'technician', 'manager'))
          OR (
              a.visibility = 'private'
              AND (
                  (v_user_role_id IS NOT NULL AND v_user_role_id = ANY(a.visible_to_roles))
                  OR (v_contact_company_id IS NOT NULL AND v_contact_company_id = ANY(a.visible_to_companies))
                  OR (v_contact_location_id IS NOT NULL AND v_contact_location_id = ANY(a.visible_to_locations))
                  OR (v_contact_department_id IS NOT NULL AND v_contact_department_id = ANY(a.visible_to_departments))
                  OR (v_contact_job_title_id IS NOT NULL AND v_contact_job_title_id = ANY(a.visible_to_job_titles))
                  OR (v_contact_employment_type_id IS NOT NULL AND v_contact_employment_type_id = ANY(a.visible_to_employment_types))
                  OR (p_contact_id IS NOT NULL
                      AND array_length(a.visible_to_contact_groups, 1) IS NOT NULL
                      AND EXISTS (
                          SELECT 1 FROM contact_group_members cgm
                          WHERE cgm.contact_id = p_contact_id
                          AND cgm.group_id = ANY(a.visible_to_contact_groups)
                      ))
              )
          )
      )
    ORDER BY relevance_score DESC, a.view_count DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: seed_asset_master_data(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_asset_master_data(p_organization_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_type_id UUID;
    v_os_id UUID;
BEGIN
    -- Asset Types (if they don't already exist for this org)

    -- Computer
    INSERT INTO asset_types (organization_id, name, description, icon, color)
    VALUES (p_organization_id, 'Computer', 'Desktops, laptops, workstations', 'computer-desktop', 'blue')
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_type_id;
    IF v_type_id IS NOT NULL THEN
        INSERT INTO asset_subtypes (organization_id, asset_type_id, name, slug, sort_order) VALUES
            (p_organization_id, v_type_id, 'Desktop', 'desktop', 1),
            (p_organization_id, v_type_id, 'Laptop', 'laptop', 2),
            (p_organization_id, v_type_id, 'Workstation', 'workstation', 3),
            (p_organization_id, v_type_id, 'Mini PC', 'mini-pc', 4),
            (p_organization_id, v_type_id, 'All-in-One', 'all-in-one', 5)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Mobile Device
    INSERT INTO asset_types (organization_id, name, description, icon, color)
    VALUES (p_organization_id, 'Mobile Device', 'Phones and tablets', 'device-phone-mobile', 'green')
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_type_id;
    IF v_type_id IS NOT NULL THEN
        INSERT INTO asset_subtypes (organization_id, asset_type_id, name, slug, sort_order) VALUES
            (p_organization_id, v_type_id, 'Phone', 'phone', 1),
            (p_organization_id, v_type_id, 'Tablet', 'tablet', 2)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Network Equipment
    INSERT INTO asset_types (organization_id, name, description, icon, color)
    VALUES (p_organization_id, 'Network Equipment', 'Routers, switches, firewalls, APs', 'signal', 'amber')
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_type_id;
    IF v_type_id IS NOT NULL THEN
        INSERT INTO asset_subtypes (organization_id, asset_type_id, name, slug, sort_order) VALUES
            (p_organization_id, v_type_id, 'Router', 'router', 1),
            (p_organization_id, v_type_id, 'Switch', 'switch', 2),
            (p_organization_id, v_type_id, 'Firewall', 'firewall', 3),
            (p_organization_id, v_type_id, 'Access Point', 'access-point', 4),
            (p_organization_id, v_type_id, 'Load Balancer', 'load-balancer', 5),
            (p_organization_id, v_type_id, 'Modem', 'modem', 6)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Server
    INSERT INTO asset_types (organization_id, name, description, icon, color)
    VALUES (p_organization_id, 'Server', 'Physical and virtual servers', 'server-stack', 'purple')
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_type_id;
    IF v_type_id IS NOT NULL THEN
        INSERT INTO asset_subtypes (organization_id, asset_type_id, name, slug, sort_order) VALUES
            (p_organization_id, v_type_id, 'Rack Server', 'rack-server', 1),
            (p_organization_id, v_type_id, 'Tower Server', 'tower-server', 2),
            (p_organization_id, v_type_id, 'Virtual Machine', 'virtual-machine', 3),
            (p_organization_id, v_type_id, 'Cloud Instance', 'cloud-instance', 4)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Peripheral
    INSERT INTO asset_types (organization_id, name, description, icon, color)
    VALUES (p_organization_id, 'Peripheral', 'Monitors, printers, docking stations, etc.', 'printer', 'slate')
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_type_id;
    IF v_type_id IS NOT NULL THEN
        INSERT INTO asset_subtypes (organization_id, asset_type_id, name, slug, sort_order) VALUES
            (p_organization_id, v_type_id, 'Monitor', 'monitor', 1),
            (p_organization_id, v_type_id, 'Printer', 'printer', 2),
            (p_organization_id, v_type_id, 'Scanner', 'scanner', 3),
            (p_organization_id, v_type_id, 'Docking Station', 'docking-station', 4),
            (p_organization_id, v_type_id, 'Webcam', 'webcam', 5),
            (p_organization_id, v_type_id, 'Headset', 'headset', 6),
            (p_organization_id, v_type_id, 'Keyboard', 'keyboard', 7),
            (p_organization_id, v_type_id, 'Mouse', 'mouse', 8),
            (p_organization_id, v_type_id, 'Speaker', 'speaker', 9),
            (p_organization_id, v_type_id, 'KVM Switch', 'kvm-switch', 10)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Storage
    INSERT INTO asset_types (organization_id, name, description, icon, color)
    VALUES (p_organization_id, 'Storage', 'NAS, SAN, external drives', 'circle-stack', 'cyan')
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_type_id;
    IF v_type_id IS NOT NULL THEN
        INSERT INTO asset_subtypes (organization_id, asset_type_id, name, slug, sort_order) VALUES
            (p_organization_id, v_type_id, 'NAS', 'nas', 1),
            (p_organization_id, v_type_id, 'SAN', 'san', 2),
            (p_organization_id, v_type_id, 'External Drive', 'external-drive', 3),
            (p_organization_id, v_type_id, 'USB Drive', 'usb-drive', 4),
            (p_organization_id, v_type_id, 'Tape Library', 'tape-library', 5)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Software License
    INSERT INTO asset_types (organization_id, name, description, icon, color)
    VALUES (p_organization_id, 'Software License', 'Desktop, server, and SaaS licenses', 'key', 'emerald')
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_type_id;
    IF v_type_id IS NOT NULL THEN
        INSERT INTO asset_subtypes (organization_id, asset_type_id, name, slug, sort_order) VALUES
            (p_organization_id, v_type_id, 'Desktop License', 'desktop-license', 1),
            (p_organization_id, v_type_id, 'Server License', 'server-license', 2),
            (p_organization_id, v_type_id, 'SaaS Subscription', 'saas-subscription', 3),
            (p_organization_id, v_type_id, 'Volume License', 'volume-license', 4),
            (p_organization_id, v_type_id, 'OEM License', 'oem-license', 5)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Power / UPS
    INSERT INTO asset_types (organization_id, name, description, icon, color)
    VALUES (p_organization_id, 'Power', 'UPS, PDU, generators', 'bolt', 'yellow')
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_type_id;
    IF v_type_id IS NOT NULL THEN
        INSERT INTO asset_subtypes (organization_id, asset_type_id, name, slug, sort_order) VALUES
            (p_organization_id, v_type_id, 'UPS', 'ups', 1),
            (p_organization_id, v_type_id, 'PDU', 'pdu', 2),
            (p_organization_id, v_type_id, 'Surge Protector', 'surge-protector', 3)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Furniture
    INSERT INTO asset_types (organization_id, name, description, icon, color)
    VALUES (p_organization_id, 'Furniture', 'Desks, chairs, standing desks', 'home', 'stone')
    ON CONFLICT (organization_id, name) DO NOTHING
    RETURNING id INTO v_type_id;
    IF v_type_id IS NOT NULL THEN
        INSERT INTO asset_subtypes (organization_id, asset_type_id, name, slug, sort_order) VALUES
            (p_organization_id, v_type_id, 'Desk', 'desk', 1),
            (p_organization_id, v_type_id, 'Chair', 'chair', 2),
            (p_organization_id, v_type_id, 'Standing Desk', 'standing-desk', 3),
            (p_organization_id, v_type_id, 'Monitor Arm', 'monitor-arm', 4),
            (p_organization_id, v_type_id, 'Filing Cabinet', 'filing-cabinet', 5)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Seed common operating systems
    INSERT INTO operating_systems (organization_id, platform, name, version, sort_order) VALUES
        -- Windows
        (p_organization_id, 'windows', 'Windows 11 Pro', '24H2', 1),
        (p_organization_id, 'windows', 'Windows 11 Enterprise', '24H2', 2),
        (p_organization_id, 'windows', 'Windows 11 Home', '24H2', 3),
        (p_organization_id, 'windows', 'Windows 10 Pro', '22H2', 4),
        (p_organization_id, 'windows', 'Windows 10 Enterprise', '22H2', 5),
        (p_organization_id, 'windows', 'Windows Server 2022', 'Standard', 10),
        (p_organization_id, 'windows', 'Windows Server 2022', 'Datacenter', 11),
        (p_organization_id, 'windows', 'Windows Server 2019', 'Standard', 12),
        -- macOS
        (p_organization_id, 'macos', 'macOS Sequoia', '15', 20),
        (p_organization_id, 'macos', 'macOS Sonoma', '14', 21),
        (p_organization_id, 'macos', 'macOS Ventura', '13', 22),
        -- Linux
        (p_organization_id, 'linux', 'Ubuntu 24.04 LTS', '24.04', 30),
        (p_organization_id, 'linux', 'Ubuntu 22.04 LTS', '22.04', 31),
        (p_organization_id, 'linux', 'RHEL 9', '9', 32),
        (p_organization_id, 'linux', 'Debian 12', '12', 33),
        (p_organization_id, 'linux', 'Fedora 40', '40', 34),
        -- Mobile
        (p_organization_id, 'ios', 'iOS 18', '18', 40),
        (p_organization_id, 'ios', 'iOS 17', '17', 41),
        (p_organization_id, 'ios', 'iPadOS 18', '18', 42),
        (p_organization_id, 'android', 'Android 15', '15', 50),
        (p_organization_id, 'android', 'Android 14', '14', 51),
        -- ChromeOS
        (p_organization_id, 'chromeos', 'ChromeOS', NULL, 60)
    ON CONFLICT DO NOTHING;
END;
$$;


--
-- Name: seed_default_categories(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_default_categories(p_workspace_id uuid, p_workspace_type character varying DEFAULT 'it'::character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_org_id UUID;
    v_count INT := 0;
    v_incident_id UUID;
    v_service_id UUID;
    v_hardware_id UUID;
    v_change_id UUID;
BEGIN
    SELECT organization_id INTO v_org_id FROM workspaces WHERE id = p_workspace_id;
    
    IF p_workspace_type = 'it' THEN
        -- Create top-level categories
        INSERT INTO ticket_categories (workspace_id, organization_id, name, base_type, icon, color, keywords, ai_description)
        VALUES (p_workspace_id, v_org_id, 'Incident', 'incident', 'exclamation-triangle', '#ef4444', 
                ARRAY['broken', 'not working', 'error', 'crash', 'down', 'issue', 'problem', 'bug', 'fail'],
                'Something is broken or not working as expected')
        RETURNING id INTO v_incident_id;
        
        INSERT INTO ticket_categories (workspace_id, organization_id, name, base_type, icon, color, keywords, ai_description)
        VALUES (p_workspace_id, v_org_id, 'Service Request', 'service_request', 'clipboard-document-list', '#3b82f6',
                ARRAY['need', 'request', 'access', 'install', 'setup', 'help', 'how to', 'question'],
                'User needs something - access, software, information, or help')
        RETURNING id INTO v_service_id;
        
        INSERT INTO ticket_categories (workspace_id, organization_id, name, base_type, icon, color, keywords, ai_description)
        VALUES (p_workspace_id, v_org_id, 'Hardware Request', 'hardware_request', 'computer-desktop', '#8b5cf6',
                ARRAY['laptop', 'monitor', 'keyboard', 'mouse', 'phone', 'equipment', 'device', 'hardware'],
                'User needs physical equipment or hardware')
        RETURNING id INTO v_hardware_id;
        
        INSERT INTO ticket_categories (workspace_id, organization_id, name, base_type, icon, color, keywords, ai_description)
        VALUES (p_workspace_id, v_org_id, 'Change Request', 'change_request', 'arrow-path', '#f59e0b',
                ARRAY['change', 'modify', 'update', 'upgrade', 'migrate', 'move'],
                'Request to change or modify systems, configurations, or infrastructure')
        RETURNING id INTO v_change_id;
        
        v_count := 4;
        
        -- Incident subcategories
        INSERT INTO ticket_categories (workspace_id, organization_id, name, base_type, parent_id, keywords, ai_description, default_priority)
        VALUES 
            (p_workspace_id, v_org_id, 'Hardware Issue', 'incident', v_incident_id, 
             ARRAY['laptop', 'computer', 'monitor', 'keyboard', 'mouse', 'screen', 'battery', 'charger', 'power'],
             'Physical hardware is broken or malfunctioning', 'medium'),
            (p_workspace_id, v_org_id, 'Software Issue', 'incident', v_incident_id,
             ARRAY['application', 'app', 'software', 'program', 'crash', 'freeze', 'error message', 'not responding'],
             'Software application is crashing, freezing, or showing errors', 'medium'),
            (p_workspace_id, v_org_id, 'Network/Connectivity', 'incident', v_incident_id,
             ARRAY['network', 'internet', 'wifi', 'vpn', 'connection', 'slow', 'disconnect', 'cannot connect'],
             'Network connectivity issues - internet, VPN, WiFi', 'high'),
            (p_workspace_id, v_org_id, 'Login/Authentication', 'incident', v_incident_id,
             ARRAY['login', 'password', 'locked', 'cannot access', 'authentication', 'sign in', 'account', 'mfa', '2fa'],
             'Cannot log in or access account', 'high'),
            (p_workspace_id, v_org_id, 'Email Issue', 'incident', v_incident_id,
             ARRAY['email', 'outlook', 'gmail', 'calendar', 'meeting', 'invite', 'attachment'],
             'Email or calendar problems', 'medium'),
            (p_workspace_id, v_org_id, 'Printer Issue', 'incident', v_incident_id,
             ARRAY['printer', 'print', 'printing', 'scanner', 'scan', 'paper', 'jam', 'toner'],
             'Printer or scanner problems', 'low'),
            (p_workspace_id, v_org_id, 'Security Incident', 'incident', v_incident_id,
             ARRAY['security', 'virus', 'malware', 'phishing', 'suspicious', 'hacked', 'breach', 'compromised'],
             'Potential security issue or breach', 'critical');
        v_count := v_count + 7;
        
        -- Service Request subcategories
        INSERT INTO ticket_categories (workspace_id, organization_id, name, base_type, parent_id, keywords, ai_description, requires_approval)
        VALUES 
            (p_workspace_id, v_org_id, 'New Access', 'service_request', v_service_id,
             ARRAY['access', 'permission', 'grant', 'add me', 'need access'],
             'Request access to a system, application, or resource', true),
            (p_workspace_id, v_org_id, 'Software Installation', 'service_request', v_service_id,
             ARRAY['install', 'software', 'application', 'program', 'download'],
             'Request to install new software', true),
            (p_workspace_id, v_org_id, 'Password Reset', 'service_request', v_service_id,
             ARRAY['reset', 'password', 'forgot', 'expired', 'change password'],
             'Need to reset a password', false),
            (p_workspace_id, v_org_id, 'Account Setup', 'service_request', v_service_id,
             ARRAY['new account', 'create account', 'setup', 'new user'],
             'Set up a new account or user', false),
            (p_workspace_id, v_org_id, 'Information/How-To', 'service_request', v_service_id,
             ARRAY['how to', 'how do i', 'question', 'help', 'information', 'guide'],
             'Question or request for information', false);
        v_count := v_count + 5;
        
        -- Hardware Request subcategories
        INSERT INTO ticket_categories (workspace_id, organization_id, name, base_type, parent_id, keywords, ai_description, requires_approval)
        VALUES 
            (p_workspace_id, v_org_id, 'New Equipment', 'hardware_request', v_hardware_id,
             ARRAY['new laptop', 'new monitor', 'new equipment', 'need laptop', 'need monitor'],
             'Request for new hardware equipment', true),
            (p_workspace_id, v_org_id, 'Replacement', 'hardware_request', v_hardware_id,
             ARRAY['replace', 'replacement', 'broken', 'damaged', 'old'],
             'Replace broken or outdated equipment', true),
            (p_workspace_id, v_org_id, 'Upgrade', 'hardware_request', v_hardware_id,
             ARRAY['upgrade', 'more memory', 'more storage', 'faster', 'better'],
             'Upgrade existing equipment', true),
            (p_workspace_id, v_org_id, 'Return/Disposal', 'hardware_request', v_hardware_id,
             ARRAY['return', 'dispose', 'recycle', 'old equipment'],
             'Return or dispose of equipment', false);
        v_count := v_count + 4;
        
        -- Change Request subcategories
        INSERT INTO ticket_categories (workspace_id, organization_id, name, base_type, parent_id, keywords, ai_description, requires_approval, approval_type)
        VALUES 
            (p_workspace_id, v_org_id, 'Standard Change', 'change_request', v_change_id,
             ARRAY['routine', 'standard', 'regular'],
             'Pre-approved routine change', false, NULL),
            (p_workspace_id, v_org_id, 'Normal Change', 'change_request', v_change_id,
             ARRAY['change', 'modify', 'update'],
             'Change requiring approval', true, 'cab'),
            (p_workspace_id, v_org_id, 'Emergency Change', 'change_request', v_change_id,
             ARRAY['emergency', 'urgent', 'critical', 'immediate'],
             'Urgent change needed immediately', true, 'it_director');
        v_count := v_count + 3;
        
    ELSIF p_workspace_type = 'hr' THEN
        -- HR categories
        INSERT INTO ticket_categories (workspace_id, organization_id, name, base_type, icon, color, keywords, ai_description)
        VALUES 
            (p_workspace_id, v_org_id, 'Benefits', 'service_request', 'heart', '#ec4899',
             ARRAY['benefits', 'health', 'insurance', 'dental', 'vision', '401k', 'retirement'],
             'Questions about employee benefits'),
            (p_workspace_id, v_org_id, 'Time Off', 'service_request', 'calendar', '#8b5cf6',
             ARRAY['vacation', 'pto', 'sick', 'leave', 'time off', 'holiday'],
             'Time off requests and questions'),
            (p_workspace_id, v_org_id, 'Payroll', 'service_request', 'currency-dollar', '#10b981',
             ARRAY['payroll', 'paycheck', 'salary', 'pay', 'direct deposit', 'w2', 'tax'],
             'Payroll and compensation questions'),
            (p_workspace_id, v_org_id, 'Policy Question', 'service_request', 'document-text', '#3b82f6',
             ARRAY['policy', 'handbook', 'procedure', 'rule'],
             'Questions about company policies');
        v_count := 4;
    END IF;
    
    RETURN v_count;
END;
$$;


--
-- Name: send_notification(uuid, character varying, text, character varying, character varying, character varying, uuid, character varying, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_notification(p_user_id uuid, p_title character varying, p_body text, p_notification_type character varying DEFAULT 'info'::character varying, p_event_type character varying DEFAULT NULL::character varying, p_entity_type character varying DEFAULT NULL::character varying, p_entity_id uuid DEFAULT NULL::uuid, p_link character varying DEFAULT NULL::character varying, p_actions jsonb DEFAULT NULL::jsonb, p_send_email boolean DEFAULT true) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_notification_id UUID;
    v_user RECORD;
    v_prefs RECORD;
    v_template RECORD;
BEGIN
    -- Get user info
    SELECT * INTO v_user FROM users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Get user preferences for this event type
    SELECT * INTO v_prefs FROM notification_preferences
    WHERE user_id = p_user_id AND event_type = COALESCE(p_event_type, 'default');

    -- Create in-app notification if enabled (default: yes)
    IF v_prefs.in_app_enabled IS NULL OR v_prefs.in_app_enabled = true THEN
        INSERT INTO notifications (
            organization_id, user_id, title, body,
            notification_type, event_type,
            entity_type, entity_id, link, actions
        ) VALUES (
            v_user.organization_id, p_user_id, p_title, p_body,
            p_notification_type, p_event_type,
            p_entity_type, p_entity_id, p_link, p_actions
        )
        RETURNING id INTO v_notification_id;
    END IF;

    -- Queue email if enabled
    IF p_send_email AND (v_prefs.email_enabled IS NULL OR v_prefs.email_enabled = true) THEN
        INSERT INTO email_queue (
            organization_id, to_email, to_name,
            subject, body_text,
            related_type, related_id
        ) VALUES (
            v_user.organization_id, v_user.email, v_user.first_name || ' ' || v_user.last_name,
            p_title, p_body,
            p_entity_type, p_entity_id
        );
    END IF;

    RETURN v_notification_id;
END;
$$;


--
-- Name: set_domain_history_severity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_domain_history_severity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Set change_type based on column
    NEW.change_type := CASE
        WHEN NEW.field_name LIKE '%nameserver%' THEN 'nameserver'
        WHEN NEW.field_name LIKE '%ns%' THEN 'nameserver'
        WHEN NEW.field_name LIKE '%expir%' THEN 'expiry'
        WHEN NEW.field_name LIKE '%whois%' THEN 'whois'
        ELSE 'dns_record'
    END;

    -- Set severity based on field
    NEW.severity := CASE
        WHEN NEW.field_name LIKE '%nameserver%' THEN 'critical'
        WHEN NEW.field_name LIKE '%ns%' THEN 'critical'
        WHEN NEW.field_name LIKE '%mx%' THEN 'critical'
        WHEN NEW.field_name LIKE '%mail%' THEN 'critical'
        WHEN NEW.field_name LIKE '%expir%' THEN 'warning'
        ELSE 'info'
    END;

    RETURN NEW;
END;
$$;


--
-- Name: trigger_update_project_progress(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_update_project_progress() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM update_project_progress(COALESCE(NEW.project_id, OLD.project_id));
    RETURN NEW;
END;
$$;


--
-- Name: update_accessory_quantities(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_accessory_quantities() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Record quantity before
    NEW.quantity_before := (SELECT available_quantity FROM accessories WHERE id = NEW.accessory_id);

    -- Update accessory quantity
    UPDATE accessories
    SET
        available_quantity = available_quantity + NEW.quantity,
        total_quantity = CASE
            WHEN NEW.transaction_type IN ('received', 'adjusted') THEN total_quantity + GREATEST(NEW.quantity, 0)
            WHEN NEW.transaction_type = 'disposed' THEN total_quantity + NEW.quantity -- negative
            ELSE total_quantity
        END,
        updated_at = NOW()
    WHERE id = NEW.accessory_id;

    -- Record quantity after
    NEW.quantity_after := (SELECT available_quantity FROM accessories WHERE id = NEW.accessory_id);

    RETURN NEW;
END;
$$;


--
-- Name: update_category_path(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_category_path() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_parent_path TEXT;
    v_parent_depth INT;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path := NEW.name;
        NEW.depth := 0;
    ELSE
        SELECT path, depth INTO v_parent_path, v_parent_depth 
        FROM ticket_categories WHERE id = NEW.parent_id;
        
        NEW.path := v_parent_path || ' > ' || NEW.name;
        NEW.depth := v_parent_depth + 1;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: update_department_path(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_department_path() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_parent_path TEXT;
    v_parent_depth INT;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path := NEW.name;
        NEW.depth := 0;
    ELSE
        SELECT path, depth INTO v_parent_path, v_parent_depth 
        FROM departments WHERE id = NEW.parent_id;
        
        NEW.path := v_parent_path || '/' || NEW.name;
        NEW.depth := v_parent_depth + 1;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: update_group_path(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_group_path() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path := '/' || NEW.id::text;
        NEW.depth := 0;
    ELSE
        SELECT path || '/' || NEW.id::text, depth + 1
        INTO NEW.path, NEW.depth
        FROM user_groups
        WHERE id = NEW.parent_id;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: update_kb_category_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_kb_category_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE kb_categories SET article_count = (
            SELECT COUNT(*) FROM kb_articles
            WHERE category_id = NEW.category_id AND status = 'published'
        ) WHERE id = NEW.category_id;
    END IF;

    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        UPDATE kb_categories SET article_count = (
            SELECT COUNT(*) FROM kb_articles
            WHERE category_id = OLD.category_id AND status = 'published'
        ) WHERE id = OLD.category_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_location_path(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_location_path() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_parent_path TEXT;
    v_parent_depth INT;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path := NEW.name;
        NEW.depth := 0;
    ELSE
        SELECT path, depth INTO v_parent_path, v_parent_depth 
        FROM office_locations WHERE id = NEW.parent_id;
        
        NEW.path := v_parent_path || '/' || NEW.name;
        NEW.depth := v_parent_depth + 1;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: update_project_progress(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_project_progress(p_project_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total_tasks INT;
    v_completed_tasks INT;
    v_total_hours DECIMAL(10,2);
    v_percent INT;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'done'),
        COALESCE(SUM(actual_hours), 0)
    INTO v_total_tasks, v_completed_tasks, v_total_hours
    FROM project_tasks
    WHERE project_id = p_project_id;

    IF v_total_tasks > 0 THEN
        v_percent := ROUND((v_completed_tasks::DECIMAL / v_total_tasks) * 100);
    ELSE
        v_percent := 0;
    END IF;

    UPDATE projects SET
        percent_complete = v_percent,
        hours_logged = v_total_hours,
        updated_at = NOW()
    WHERE id = p_project_id;
END;
$$;


--
-- Name: validate_ticket_closure(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_ticket_closure(p_ticket_id uuid, p_user_id uuid) RETURNS TABLE(can_close boolean, errors text[])
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_ticket RECORD;
    v_type RECORD;
    v_errors TEXT[] := '{}';
    v_total_time INT;
BEGIN
    -- Get ticket and type
    SELECT t.*, tt.requires_time_entry as type_requires_time, tt.requires_resolution as type_requires_resolution,
           tt.minimum_time_minutes
    INTO v_ticket
    FROM tickets t
    LEFT JOIN ticket_types tt ON t.type_id = tt.id
    WHERE t.id = p_ticket_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, ARRAY['Ticket not found'];
        RETURN;
    END IF;

    -- Check time entry requirement
    IF v_ticket.type_requires_time THEN
        SELECT COALESCE(SUM(duration_minutes), 0) INTO v_total_time
        FROM ticket_time_entries
        WHERE ticket_id = p_ticket_id;

        IF v_total_time = 0 THEN
            v_errors := array_append(v_errors, 'Time entry required before closing');
        ELSIF v_ticket.minimum_time_minutes IS NOT NULL AND v_total_time < v_ticket.minimum_time_minutes THEN
            v_errors := array_append(v_errors, 'Minimum time of ' || v_ticket.minimum_time_minutes || ' minutes required');
        END IF;
    END IF;

    -- Check resolution notes requirement
    IF v_ticket.type_requires_resolution AND (v_ticket.resolution_notes IS NULL OR v_ticket.resolution_notes = '') THEN
        v_errors := array_append(v_errors, 'Resolution notes required before closing');
    END IF;

    -- Check approval requirement (for change requests)
    IF v_ticket.type_id IS NOT NULL THEN
        SELECT * INTO v_type FROM ticket_types WHERE id = v_ticket.type_id;
        IF v_type.requires_approval AND v_ticket.approved_at IS NULL THEN
            v_errors := array_append(v_errors, 'Ticket requires approval before closing');
        END IF;
    END IF;

    RETURN QUERY SELECT (array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0), v_errors;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_profile_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_profile_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    item_type character varying(50) NOT NULL,
    service_id uuid,
    asset_tier_id uuid,
    item_name character varying(255),
    item_description text,
    is_required boolean DEFAULT true,
    is_optional boolean DEFAULT false,
    quantity integer DEFAULT 1,
    provisioning_notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: access_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    for_job_titles uuid[],
    for_departments uuid[],
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: access_request_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_request_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    access_request_id uuid NOT NULL,
    user_id uuid,
    comment text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: access_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    request_number integer NOT NULL,
    requester_id uuid NOT NULL,
    for_contact_id uuid NOT NULL,
    requested_services jsonb NOT NULL,
    request_type character varying(50) DEFAULT 'new'::character varying,
    business_justification text,
    status character varying(50) DEFAULT 'pending'::character varying,
    approver_id uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    denial_reason text,
    requested_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: access_requests_request_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.access_requests_request_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: access_requests_request_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.access_requests_request_number_seq OWNED BY public.access_requests.request_number;


--
-- Name: accessories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    manufacturer character varying(255),
    model character varying(255),
    total_quantity integer DEFAULT 0,
    available_quantity integer DEFAULT 0,
    minimum_quantity integer DEFAULT 0,
    requires_return boolean DEFAULT true,
    is_consumable boolean DEFAULT false,
    unit_cost numeric(10,2),
    currency_code character varying(3) DEFAULT 'USD'::character varying,
    storage_location character varying(255),
    is_active boolean DEFAULT true,
    tags character varying(100)[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    model_id uuid
);


--
-- Name: accessory_disposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessory_disposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    accessory_id uuid NOT NULL,
    model_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    disposal_type character varying(50) NOT NULL,
    reason text,
    condition_notes text,
    assigned_to_user_id uuid,
    assignment_id uuid,
    reported_by uuid,
    reported_at timestamp with time zone DEFAULT now(),
    verified_by uuid,
    verified_at timestamp with time zone,
    replacement_cost numeric(10,2),
    was_replaced boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: accessory_inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessory_inventory_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    accessory_id uuid NOT NULL,
    transaction_type character varying(50) NOT NULL,
    quantity integer NOT NULL,
    quantity_before integer,
    quantity_after integer,
    purchase_order_id uuid,
    assignment_id uuid,
    disposal_id uuid,
    user_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: accessory_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessory_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    manufacturer character varying(255),
    model_number character varying(100),
    sku character varying(100),
    upc character varying(50),
    accessory_category character varying(100),
    specifications jsonb DEFAULT '{}'::jsonb,
    preferred_vendor_id uuid,
    unit_cost numeric(10,2),
    currency_code character varying(3) DEFAULT 'USD'::character varying,
    minimum_order_quantity integer DEFAULT 1,
    lead_time_days integer,
    product_url character varying(500),
    image_url character varying(500),
    avg_lifespan_months numeric(5,1),
    failure_rate numeric(5,2),
    return_rate numeric(5,2),
    is_active boolean DEFAULT true,
    is_preferred boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: accessory_purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessory_purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    accessory_id uuid,
    model_id uuid,
    item_name character varying(255),
    item_description text,
    quantity_ordered integer NOT NULL,
    quantity_received integer DEFAULT 0,
    unit_cost numeric(10,2),
    line_total numeric(10,2),
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: accessory_purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessory_purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    po_number character varying(100),
    vendor_id uuid,
    status character varying(20) DEFAULT 'draft'::character varying,
    order_date date,
    expected_delivery date,
    received_date date,
    subtotal numeric(10,2),
    tax numeric(10,2),
    shipping numeric(10,2),
    total numeric(10,2),
    currency_code character varying(3) DEFAULT 'USD'::character varying,
    tracking_number character varying(255),
    invoice_number character varying(100),
    notes text,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid NOT NULL,
    resource_name character varying(255),
    quantity integer DEFAULT 1,
    returned_quantity integer DEFAULT 0,
    serial_number character varying(255),
    asset_tag character varying(100),
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid,
    reason character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    expected_return_date date,
    returned_at timestamp with time zone,
    returned_to uuid,
    return_condition character varying(50),
    return_notes text,
    transferred_to_user uuid,
    transferred_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: accessory_model_performance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.accessory_model_performance AS
 SELECT am.organization_id,
    am.id AS model_id,
    am.name,
    am.manufacturer,
    am.model_number,
    am.unit_cost,
    COALESCE(sum(apoi.quantity_ordered), (0)::bigint) AS total_purchased,
    COALESCE(sum(apoi.line_total), (0)::numeric) AS total_spent,
    ( SELECT COALESCE(sum(ad.quantity), (0)::bigint) AS "coalesce"
           FROM (public.accessory_disposals ad
             JOIN public.accessories a ON ((ad.accessory_id = a.id)))
          WHERE ((a.model_id = am.id) AND ((ad.disposal_type)::text = ANY (ARRAY[('lost'::character varying)::text, ('stolen'::character varying)::text, ('not_returned'::character varying)::text])))) AS total_lost,
    ( SELECT COALESCE(sum(ad.quantity), (0)::bigint) AS "coalesce"
           FROM (public.accessory_disposals ad
             JOIN public.accessories a ON ((ad.accessory_id = a.id)))
          WHERE ((a.model_id = am.id) AND ((ad.disposal_type)::text = ANY (ARRAY[('damaged'::character varying)::text, ('broken'::character varying)::text])))) AS total_broken,
        CASE
            WHEN (( SELECT count(*) AS count
               FROM (public.user_assignments ua
                 JOIN public.accessories a ON (((ua.resource_id = a.id) AND ((ua.resource_type)::text = 'accessory'::text))))
              WHERE ((a.model_id = am.id) AND ((ua.status)::text <> 'active'::text))) > 0) THEN round(((( SELECT (count(*))::numeric AS count
               FROM (public.user_assignments ua
                 JOIN public.accessories a ON (((ua.resource_id = a.id) AND ((ua.resource_type)::text = 'accessory'::text))))
              WHERE ((a.model_id = am.id) AND ((ua.status)::text <> ALL (ARRAY[('active'::character varying)::text, ('returned'::character varying)::text])))) * 100.0) / (( SELECT count(*) AS count
               FROM (public.user_assignments ua
                 JOIN public.accessories a ON (((ua.resource_id = a.id) AND ((ua.resource_type)::text = 'accessory'::text))))
              WHERE ((a.model_id = am.id) AND ((ua.status)::text <> 'active'::text))))::numeric), 1)
            ELSE (0)::numeric
        END AS non_return_rate,
    am.avg_lifespan_months,
        CASE
            WHEN (am.avg_lifespan_months > (0)::numeric) THEN round((am.unit_cost / am.avg_lifespan_months), 2)
            ELSE NULL::numeric
        END AS cost_per_month
   FROM ((public.accessory_models am
     LEFT JOIN public.accessory_purchase_order_items apoi ON ((apoi.model_id = am.id)))
     LEFT JOIN public.accessory_purchase_orders apo ON (((apoi.purchase_order_id = apo.id) AND ((apo.status)::text = 'received'::text))))
  GROUP BY am.id, am.organization_id, am.name, am.manufacturer, am.model_number, am.unit_cost, am.avg_lifespan_months;


--
-- Name: accessory_spending_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.accessory_spending_analytics AS
 SELECT a.organization_id,
    am.id AS model_id,
    COALESCE(am.name, a.name) AS item_name,
    am.manufacturer,
    a.category,
    count(DISTINCT apo.id) AS order_count,
    sum(apoi.quantity_ordered) AS total_purchased,
    sum(apoi.line_total) AS total_spent,
    avg(apoi.unit_cost) AS avg_unit_cost,
    ( SELECT count(*) AS count
           FROM public.user_assignments ua
          WHERE (((ua.resource_type)::text = 'accessory'::text) AND (ua.resource_id = a.id))) AS times_assigned,
    ( SELECT count(*) AS count
           FROM public.user_assignments ua
          WHERE (((ua.resource_type)::text = 'accessory'::text) AND (ua.resource_id = a.id) AND ((ua.status)::text = 'returned'::text))) AS times_returned,
    ( SELECT COALESCE(sum(ad.quantity), (0)::bigint) AS "coalesce"
           FROM public.accessory_disposals ad
          WHERE ((ad.accessory_id = a.id) AND ((ad.disposal_type)::text = ANY (ARRAY[('lost'::character varying)::text, ('stolen'::character varying)::text, ('not_returned'::character varying)::text])))) AS total_lost,
    ( SELECT COALESCE(sum(ad.quantity), (0)::bigint) AS "coalesce"
           FROM public.accessory_disposals ad
          WHERE ((ad.accessory_id = a.id) AND ((ad.disposal_type)::text = ANY (ARRAY[('damaged'::character varying)::text, ('broken'::character varying)::text])))) AS total_damaged
   FROM (((public.accessories a
     LEFT JOIN public.accessory_models am ON ((a.model_id = am.id)))
     LEFT JOIN public.accessory_purchase_order_items apoi ON (((apoi.accessory_id = a.id) OR (apoi.model_id = am.id))))
     LEFT JOIN public.accessory_purchase_orders apo ON (((apoi.purchase_order_id = apo.id) AND ((apo.status)::text = 'received'::text))))
  GROUP BY a.organization_id, am.id, am.name, am.manufacturer, a.id, a.name, a.category;


--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp without time zone,
    "refreshTokenExpiresAt" timestamp without time zone,
    scope text,
    password text,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now()
);


--
-- Name: ai_action_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_action_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    message_id uuid,
    action_id uuid,
    action_name character varying(100),
    input_data jsonb,
    output_data jsonb,
    status character varying(20),
    error_message text,
    confirmed_by_user boolean,
    confirmed_at timestamp with time zone,
    executed_at timestamp with time zone,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(255),
    description text,
    action_type character varying(50),
    action_config jsonb,
    allowed_chat_types character varying(20)[],
    requires_confirmation boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_category_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_category_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    matched_at timestamp with time zone DEFAULT now(),
    matches jsonb DEFAULT '[]'::jsonb NOT NULL,
    best_match_id uuid,
    best_match_confidence numeric(3,2),
    had_good_match boolean,
    final_category_id uuid,
    was_ai_suggestion_used boolean,
    suggested_new_category boolean DEFAULT false,
    category_request_id uuid,
    agent_feedback character varying(20),
    feedback_notes text
);


--
-- Name: ai_chat_data_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_chat_data_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    action character varying(50) NOT NULL,
    query_text text,
    results_count integer,
    access_granted boolean NOT NULL,
    denial_reason text,
    redacted_fields text[],
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tokens_used integer,
    model_used character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    message_type character varying(50) DEFAULT 'text'::character varying,
    suggested_action jsonb,
    action_taken jsonb,
    kb_articles_referenced uuid[],
    was_helpful boolean,
    metadata jsonb DEFAULT '{}'::jsonb,
    kb_gap boolean DEFAULT false,
    kb_gap_processed boolean DEFAULT false
);


--
-- Name: ai_chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_chat_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    preset_id uuid,
    context_type character varying(50),
    context_id uuid,
    title character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    chat_type character varying(20) DEFAULT 'general'::character varying,
    channel character varying(20) DEFAULT 'web'::character varying,
    is_support_chat boolean DEFAULT false,
    resolution_status character varying(20),
    created_ticket_id uuid,
    escalated_to_user_id uuid,
    escalated_at timestamp with time zone,
    satisfaction_rating integer,
    satisfaction_feedback text,
    resolved_at timestamp with time zone,
    context_level public.chat_context_level DEFAULT 'end_user'::public.chat_context_level,
    contact_id uuid,
    provider_access_grant_id uuid,
    CONSTRAINT ai_chat_sessions_satisfaction_rating_check CHECK (((satisfaction_rating >= 1) AND (satisfaction_rating <= 5)))
);


--
-- Name: ai_data_access_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_data_access_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    context_level public.chat_context_level NOT NULL,
    resource_type character varying(50) NOT NULL,
    can_read boolean DEFAULT false,
    can_search boolean DEFAULT false,
    scope_restrictions jsonb DEFAULT '{}'::jsonb,
    redacted_fields text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    model_name character varying(100) NOT NULL,
    display_name character varying(100),
    use_case character varying(50) DEFAULT 'general'::character varying,
    system_prompt text,
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer DEFAULT 2000,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider_id uuid,
    name character varying(100) NOT NULL,
    description text,
    use_case character varying(50),
    model_name character varying(100),
    system_prompt text,
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer DEFAULT 2000,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    api_url character varying(500),
    api_key_encrypted text,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    provider_type character varying(50) DEFAULT 'ollama'::character varying,
    is_local boolean DEFAULT false,
    embedding_model character varying(100),
    embedding_dimension integer,
    embedding_api_url character varying(500),
    last_connection_status character varying(20) DEFAULT 'unknown'::character varying,
    last_connection_at timestamp with time zone,
    last_connection_error text
);


--
-- Name: ai_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    response_mode character varying(20) DEFAULT 'balanced'::character varying NOT NULL,
    auto_draft_threshold integer DEFAULT 3 NOT NULL,
    session_retention_days integer DEFAULT 90 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_settings_auto_draft_threshold_check CHECK (((auto_draft_threshold >= 0) AND (auto_draft_threshold <= 20))),
    CONSTRAINT ai_settings_response_mode_check CHECK (((response_mode)::text = ANY (ARRAY[('strict'::character varying)::text, ('balanced'::character varying)::text, ('open'::character varying)::text]))),
    CONSTRAINT ai_settings_session_retention_days_check CHECK (((session_retention_days >= 7) AND (session_retention_days <= 365)))
);


--
-- Name: ai_triage_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_triage_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    enabled boolean DEFAULT false,
    auto_categorize boolean DEFAULT true,
    categorize_confidence_threshold numeric(3,2) DEFAULT 0.80,
    auto_priority boolean DEFAULT true,
    priority_confidence_threshold numeric(3,2) DEFAULT 0.85,
    auto_route boolean DEFAULT true,
    route_confidence_threshold numeric(3,2) DEFAULT 0.85,
    auto_assign boolean DEFAULT false,
    assign_confidence_threshold numeric(3,2) DEFAULT 0.95,
    suggest_kb_articles boolean DEFAULT true,
    kb_suggestion_threshold numeric(3,2) DEFAULT 0.70,
    max_kb_suggestions integer DEFAULT 3,
    auto_respond boolean DEFAULT false,
    auto_respond_threshold numeric(3,2) DEFAULT 0.98,
    detect_similar_tickets boolean DEFAULT true,
    similar_ticket_threshold numeric(3,2) DEFAULT 0.85,
    fallback_team_id uuid,
    fallback_priority character varying(20) DEFAULT 'medium'::character varying,
    ai_provider_id uuid,
    ai_model_id uuid,
    categorization_prompt text,
    priority_prompt text,
    routing_prompt text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_triage_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_triage_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    triaged_at timestamp with time zone DEFAULT now(),
    ai_response jsonb,
    suggested_category character varying(50),
    suggested_subcategory_id uuid,
    category_confidence numeric(3,2),
    category_accepted boolean,
    suggested_priority character varying(20),
    priority_confidence numeric(3,2),
    priority_accepted boolean,
    suggested_team_id uuid,
    suggested_user_id uuid,
    routing_confidence numeric(3,2),
    routing_accepted boolean,
    suggested_kb_articles uuid[],
    kb_confidence numeric(3,2),
    kb_article_used uuid,
    similar_ticket_ids uuid[],
    similar_confidence numeric(3,2),
    was_auto_categorized boolean DEFAULT false,
    was_auto_prioritized boolean DEFAULT false,
    was_auto_routed boolean DEFAULT false,
    was_auto_assigned boolean DEFAULT false,
    agent_feedback character varying(20),
    feedback_notes text,
    feedback_at timestamp with time zone,
    feedback_by uuid
);


--
-- Name: ai_triage_performance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ai_triage_performance AS
 SELECT workspace_id,
    count(*) AS total_triaged,
    avg(category_confidence) AS avg_category_confidence,
    avg(priority_confidence) AS avg_priority_confidence,
    avg(routing_confidence) AS avg_routing_confidence,
    count(*) FILTER (WHERE (category_accepted = true)) AS category_accepted_count,
    count(*) FILTER (WHERE (priority_accepted = true)) AS priority_accepted_count,
    count(*) FILTER (WHERE (routing_accepted = true)) AS routing_accepted_count,
    round((((count(*) FILTER (WHERE (category_accepted = true)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 1) AS category_acceptance_rate,
    count(*) FILTER (WHERE ((agent_feedback)::text = 'correct'::text)) AS correct_count,
    count(*) FILTER (WHERE ((agent_feedback)::text = 'incorrect'::text)) AS incorrect_count
   FROM public.ai_triage_results
  WHERE (triaged_at > (now() - '30 days'::interval))
  GROUP BY workspace_id;


--
-- Name: alert_correlation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_correlation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    match_source character varying(100),
    match_alert_type character varying(100),
    match_severity character varying(20)[],
    match_tags character varying(100)[],
    correlation_type character varying(50) NOT NULL,
    correlation_window_minutes integer DEFAULT 15,
    correlation_key_template character varying(500),
    auto_create_incident boolean DEFAULT true,
    auto_create_ticket boolean DEFAULT false,
    incident_severity character varying(20),
    escalate_after_minutes integer,
    escalate_to_team uuid,
    priority integer DEFAULT 100,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: alert_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    source_type character varying(100) NOT NULL,
    webhook_token character varying(255),
    webhook_secret character varying(255),
    field_mapping jsonb,
    severity_mapping jsonb,
    auto_resolve boolean DEFAULT true,
    default_severity character varying(20) DEFAULT 'medium'::character varying,
    is_active boolean DEFAULT true,
    last_received_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: alert_notification_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_notification_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    match_severity character varying(20)[],
    match_source character varying(100),
    match_alert_type character varying(100),
    notify_channel character varying(50) NOT NULL,
    notify_config jsonb,
    delay_minutes integer DEFAULT 0,
    repeat_interval_minutes integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: alert_suppression_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_suppression_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    reason character varying(255),
    match_source character varying(100),
    match_alert_type character varying(100),
    match_asset_id uuid,
    match_hostname character varying(255),
    match_tags character varying(100)[],
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    created_by uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    source character varying(100) NOT NULL,
    source_alert_id character varying(255),
    source_url character varying(500),
    alert_type character varying(100) NOT NULL,
    title character varying(500) NOT NULL,
    message text,
    severity character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    asset_id uuid,
    hostname character varying(255),
    ip_address character varying(45),
    service_name character varying(100),
    correlation_key character varying(255),
    fingerprint character varying(255),
    metric_name character varying(100),
    metric_value double precision,
    threshold_value double precision,
    status character varying(20) DEFAULT 'firing'::character varying,
    incident_id uuid,
    fired_at timestamp with time zone NOT NULL,
    acknowledged_at timestamp with time zone,
    cleared_at timestamp with time zone,
    raw_payload jsonb,
    tags character varying(100)[],
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: api_key_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key_usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    method character varying(10) NOT NULL,
    path text NOT NULL,
    status_code integer,
    required_scope character varying(100),
    scope_granted boolean,
    duration_ms integer,
    request_ip character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acting_user_email character varying(320),
    action_ticket_ref character varying(60)
)
PARTITION BY RANGE (created_at);


--
-- Name: api_key_usage_logs_2026_03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key_usage_logs_2026_03 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    method character varying(10) NOT NULL,
    path text NOT NULL,
    status_code integer,
    required_scope character varying(100),
    scope_granted boolean,
    duration_ms integer,
    request_ip character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acting_user_email character varying(320),
    action_ticket_ref character varying(60)
);


--
-- Name: api_key_usage_logs_2026_04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key_usage_logs_2026_04 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    method character varying(10) NOT NULL,
    path text NOT NULL,
    status_code integer,
    required_scope character varying(100),
    scope_granted boolean,
    duration_ms integer,
    request_ip character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acting_user_email character varying(320),
    action_ticket_ref character varying(60)
);


--
-- Name: api_key_usage_logs_2026_05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key_usage_logs_2026_05 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    method character varying(10) NOT NULL,
    path text NOT NULL,
    status_code integer,
    required_scope character varying(100),
    scope_granted boolean,
    duration_ms integer,
    request_ip character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acting_user_email character varying(320),
    action_ticket_ref character varying(60)
);


--
-- Name: api_key_usage_logs_2026_06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key_usage_logs_2026_06 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    method character varying(10) NOT NULL,
    path text NOT NULL,
    status_code integer,
    required_scope character varying(100),
    scope_granted boolean,
    duration_ms integer,
    request_ip character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acting_user_email character varying(320),
    action_ticket_ref character varying(60)
);


--
-- Name: api_key_usage_logs_2026_07; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key_usage_logs_2026_07 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    method character varying(10) NOT NULL,
    path text NOT NULL,
    status_code integer,
    required_scope character varying(100),
    scope_granted boolean,
    duration_ms integer,
    request_ip character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acting_user_email character varying(320),
    action_ticket_ref character varying(60)
);


--
-- Name: api_key_usage_logs_2026_08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key_usage_logs_2026_08 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    method character varying(10) NOT NULL,
    path text NOT NULL,
    status_code integer,
    required_scope character varying(100),
    scope_granted boolean,
    duration_ms integer,
    request_ip character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acting_user_email character varying(320),
    action_ticket_ref character varying(60)
);


--
-- Name: api_key_usage_logs_2026_09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key_usage_logs_2026_09 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    method character varying(10) NOT NULL,
    path text NOT NULL,
    status_code integer,
    required_scope character varying(100),
    scope_granted boolean,
    duration_ms integer,
    request_ip character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acting_user_email character varying(320),
    action_ticket_ref character varying(60)
);


--
-- Name: api_key_usage_logs_2026_10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key_usage_logs_2026_10 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    method character varying(10) NOT NULL,
    path text NOT NULL,
    status_code integer,
    required_scope character varying(100),
    scope_granted boolean,
    duration_ms integer,
    request_ip character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acting_user_email character varying(320),
    action_ticket_ref character varying(60)
);


--
-- Name: api_key_usage_logs_2026_11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key_usage_logs_2026_11 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    method character varying(10) NOT NULL,
    path text NOT NULL,
    status_code integer,
    required_scope character varying(100),
    scope_granted boolean,
    duration_ms integer,
    request_ip character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acting_user_email character varying(320),
    action_ticket_ref character varying(60)
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    key_hash character varying(255) NOT NULL,
    key_prefix character varying(20),
    permissions jsonb DEFAULT '[]'::jsonb,
    rate_limit integer DEFAULT 1000,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    ai_context_level character varying(20) DEFAULT 'end_user'::character varying,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    key_type character varying(32) DEFAULT 'standard'::character varying NOT NULL,
    provider_name character varying(200),
    provider_contact_email character varying(255),
    provider_company character varying(200),
    allowed_ips text[],
    allowed_hours_start time without time zone,
    allowed_hours_end time without time zone,
    allowed_days integer[],
    rate_limit_per_minute integer,
    rate_limit_per_hour integer,
    rate_limit_per_day integer,
    requires_contract boolean DEFAULT false NOT NULL,
    required_contract_id uuid,
    contract_acknowledged boolean DEFAULT false NOT NULL,
    is_revoked boolean DEFAULT false NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoked_reason text,
    total_requests bigint DEFAULT 0 NOT NULL,
    last_used_ip character varying(45),
    key_owner_user_id uuid,
    migrated_at timestamp with time zone,
    pairing_window_expires_at timestamp with time zone,
    paired_at timestamp with time zone,
    paired_from_ip text,
    paired_user_agent text,
    parent_key_id uuid,
    CONSTRAINT api_keys_key_type_chk CHECK (((key_type)::text = ANY ((ARRAY['personal'::character varying, 'mtp-polling'::character varying, 'delegated-write'::character varying, 'standard'::character varying, 'aegis-mtp-pairing'::character varying])::text[])))
);


--
-- Name: api_keys_legacy_permissions_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys_legacy_permissions_backup (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    legacy_permissions jsonb NOT NULL,
    legacy_scopes text[] NOT NULL,
    backed_up_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: api_scopes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_scopes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    action character varying(20) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    risk_level character varying(20) DEFAULT 'low'::character varying,
    requires_contract boolean DEFAULT false,
    requires_mfa boolean DEFAULT false,
    display_order integer DEFAULT 0
);


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon_url text,
    owner_id uuid,
    access_levels jsonb DEFAULT '["Standard"]'::jsonb,
    requires_approval boolean DEFAULT true,
    approval_levels integer DEFAULT 1,
    provisioning_notes text,
    cost_per_license numeric(10,2),
    license_type character varying(50),
    vendor_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: approval_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    step_number integer NOT NULL,
    approver_type character varying(50) DEFAULT 'manager'::character varying NOT NULL,
    approver_id uuid,
    approver_role_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: approval_workflow_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_workflow_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    step_order integer NOT NULL,
    name character varying(255),
    approver_type character varying(50) NOT NULL,
    approver_id uuid,
    approval_mode character varying(20) DEFAULT 'any'::character varying,
    required_approvals integer DEFAULT 1,
    can_skip boolean DEFAULT false,
    skip_if_same_approver boolean DEFAULT true,
    timeout_hours integer DEFAULT 48,
    timeout_action character varying(20) DEFAULT 'escalate'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    workflow_type character varying(50) DEFAULT 'sequential'::character varying,
    auto_approve_conditions jsonb,
    escalation_enabled boolean DEFAULT false,
    escalation_after_hours integer DEFAULT 48,
    escalation_to uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    relationship_type character varying(50) DEFAULT 'user'::character varying,
    is_primary boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: asset_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    document_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    file_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_type character varying(100),
    file_size integer,
    file_path text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: asset_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    field_name character varying(100),
    old_value text,
    new_value text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_import_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_import_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_job_id uuid NOT NULL,
    row_number integer,
    raw_data jsonb NOT NULL,
    parsed_data jsonb,
    generated_name character varying(100),
    status character varying(50) DEFAULT 'pending'::character varying,
    validation_errors text[],
    created_asset_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_import_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255),
    source character varying(50) DEFAULT 'manual'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    total_items integer DEFAULT 0,
    processed_items integer DEFAULT 0,
    success_count integer DEFAULT 0,
    error_count integer DEFAULT 0,
    options jsonb DEFAULT '{}'::jsonb,
    errors jsonb DEFAULT '[]'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);


--
-- Name: asset_interfaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_interfaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(50),
    ip_address character varying(45),
    subnet_mask character varying(45),
    gateway character varying(45),
    mac_address character varying(17),
    dns_servers character varying(255)[],
    port_number character varying(20),
    speed character varying(20),
    is_primary boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    asset_subtype_id uuid NOT NULL,
    vendor_id uuid,
    name character varying(255) NOT NULL,
    model_number character varying(100),
    description text,
    end_of_life_date date,
    end_of_support_date date,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_naming_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_naming_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    asset_type_id uuid,
    asset_type_name character varying(100),
    prefix character varying(10) NOT NULL,
    pattern character varying(100) DEFAULT '{PREFIX}-{SEQ}'::character varying NOT NULL,
    sequence_start integer DEFAULT 1,
    sequence_current integer DEFAULT 0,
    sequence_padding integer DEFAULT 4,
    example_output character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_request_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_request_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    category character varying(100) NOT NULL,
    fulfillment_criteria jsonb DEFAULT '[]'::jsonb NOT NULL,
    eligibility_rules jsonb DEFAULT '{"departments": ["*"], "contact_types": ["employee"]}'::jsonb,
    requires_approval boolean DEFAULT false,
    approval_type character varying(50) DEFAULT 'manager'::character varying,
    approver_user_id uuid,
    approver_role_id uuid,
    approval_chain jsonb DEFAULT '[]'::jsonb,
    show_specs_to_users boolean DEFAULT false,
    show_count_to_users boolean DEFAULT true,
    show_brands_to_users boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    request_number integer NOT NULL,
    requester_id uuid NOT NULL,
    for_contact_id uuid NOT NULL,
    tier_id uuid NOT NULL,
    quantity integer DEFAULT 1,
    justification text,
    preferred_specs jsonb,
    status character varying(50) DEFAULT 'pending'::character varying,
    current_approval_level integer DEFAULT 1,
    approval_history jsonb DEFAULT '[]'::jsonb,
    decided_by uuid,
    decided_at timestamp with time zone,
    denial_reason text,
    fulfilled_by uuid,
    fulfilled_at timestamp with time zone,
    assigned_asset_id uuid,
    requested_at timestamp with time zone DEFAULT now(),
    needed_by date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_requests_request_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_requests_request_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asset_requests_request_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asset_requests_request_number_seq OWNED BY public.asset_requests.request_number;


--
-- Name: asset_retrieval_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_retrieval_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offboarding_request_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    assigned_to uuid NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    scheduled_date date,
    scheduled_time time without time zone,
    pickup_location character varying(255),
    collected_at timestamp with time zone,
    collected_by uuid,
    verified_at timestamp with time zone,
    verified_by uuid,
    condition_on_return character varying(50),
    condition_notes text,
    photos jsonb DEFAULT '[]'::jsonb,
    returned_to_stock_at timestamp with time zone,
    returned_to_stock_by uuid,
    new_asset_status character varying(50),
    departing_employee_acknowledged boolean DEFAULT false,
    departing_employee_acknowledged_at timestamp with time zone,
    collector_acknowledged boolean DEFAULT false,
    collector_acknowledged_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_software; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_software (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    software_id uuid NOT NULL,
    version character varying(100),
    install_date date,
    license_key character varying(500),
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_status_requestability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_status_requestability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    status_name character varying(100) NOT NULL,
    is_requestable boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_subtypes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_subtypes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    asset_type_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_tags (
    asset_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: asset_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    relationship_type character varying(50) DEFAULT 'related'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    asset_tag character varying(100),
    type_id uuid,
    make character varying(100),
    model character varying(100),
    serial_number character varying(100),
    os character varying(100),
    os_version character varying(100),
    purchase_date date,
    purchase_cost numeric(10,2),
    vendor_id uuid,
    warranty_expire date,
    warranty_notes text,
    company_id uuid,
    contact_id uuid,
    location_id uuid,
    physical_location character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    install_date date,
    retire_date date,
    primary_ip character varying(45),
    primary_mac character varying(17),
    hostname character varying(255),
    domain character varying(255),
    uri character varying(500),
    notes text,
    is_important boolean DEFAULT false,
    is_managed boolean DEFAULT true,
    tags character varying(100)[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_requestable boolean DEFAULT false,
    request_tier_id uuid,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid,
    deleted_by_provider_id uuid,
    deleted_by_name character varying(200),
    delete_reason text,
    created_by_provider_id uuid,
    created_by_provider_name character varying(200),
    last_modified_by_provider_id uuid,
    last_modified_by_provider_name character varying(200),
    restored_at timestamp with time zone,
    restored_by_user_id uuid,
    subtype_id uuid,
    model_id uuid,
    external_source character varying(50),
    external_id character varying(255),
    external_data jsonb DEFAULT '{}'::jsonb,
    last_synced_at timestamp with time zone,
    os_id uuid,
    legal_hold boolean DEFAULT false
);


--
-- Name: asset_tier_inventory; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.asset_tier_inventory AS
 SELECT t.id AS tier_id,
    t.organization_id,
    t.name AS tier_name,
    t.category,
    count(a.id) AS total_assets,
    count(a.id) FILTER (WHERE ((a.status)::text = ANY (ARRAY[('In Stock'::character varying)::text, ('Available'::character varying)::text, ('Ready for Deployment'::character varying)::text]))) AS available_count,
    count(a.id) FILTER (WHERE ((a.status)::text = 'In Use'::text)) AS in_use_count,
    jsonb_agg(DISTINCT jsonb_build_object('brand', a.make, 'model', a.model, 'count', 1)) FILTER (WHERE ((a.status)::text = ANY (ARRAY[('In Stock'::character varying)::text, ('Available'::character varying)::text, ('Ready for Deployment'::character varying)::text]))) AS available_breakdown
   FROM (public.asset_request_tiers t
     LEFT JOIN public.assets a ON (((a.request_tier_id = t.id) AND (a.organization_id = t.organization_id))))
  WHERE (t.is_active = true)
  GROUP BY t.id, t.organization_id, t.name, t.category;


--
-- Name: asset_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    color character varying(20),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    actor_type character varying(20) NOT NULL,
    user_id uuid,
    provider_user_id uuid,
    provider_id uuid,
    actor_email character varying(255),
    actor_name character varying(255),
    actor_ip character varying(45),
    action character varying(100) NOT NULL,
    action_category character varying(20),
    entity_type character varying(50),
    entity_id uuid,
    entity_name character varying(255),
    old_values jsonb,
    new_values jsonb,
    changed_fields text[],
    success boolean DEFAULT true,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    revoked_by_cascade_id uuid
);


--
-- Name: backlog_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backlog_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backlog_item_id uuid NOT NULL,
    user_id uuid,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: badge_retrieval_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badge_retrieval_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offboarding_request_id uuid NOT NULL,
    badge_number character varying(50),
    badge_type character varying(50),
    assigned_to uuid NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    collected_at timestamp with time zone,
    collected_by uuid,
    deactivated_at timestamp with time zone,
    deactivated_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: break_glass_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.break_glass_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    credential_name character varying(200),
    provider_api_key_id uuid,
    provider_name character varying(200),
    accessor_name character varying(200) NOT NULL,
    accessor_email character varying(255) NOT NULL,
    justification text NOT NULL,
    ticket_reference character varying(100),
    status character varying(20) DEFAULT 'open'::character varying,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    alerts_sent_to text[],
    alerts_sent_at timestamp with time zone,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bulk_access_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_access_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    operation_type character varying(50) NOT NULL,
    target_service_id uuid,
    target_contact_id uuid,
    items jsonb NOT NULL,
    access_level character varying(50) DEFAULT 'user'::character varying,
    expires_at timestamp with time zone,
    status character varying(50) DEFAULT 'pending'::character varying,
    processed_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    error_details jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: cascade_revocation_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cascade_revocation_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pairing_key_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    reason text NOT NULL,
    state character varying(16) DEFAULT 'queued'::character varying NOT NULL,
    queued_at timestamp with time zone DEFAULT now() NOT NULL,
    commit_after timestamp with time zone DEFAULT (now() + '00:01:00'::interval) NOT NULL,
    committed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    failure_reason text,
    cascade_audit_id uuid,
    CONSTRAINT cascade_revocation_queue_state_check CHECK (((state)::text = ANY ((ARRAY['queued'::character varying, 'cancelled'::character varying, 'committed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: catalog_bundles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bundle_item_id uuid NOT NULL,
    included_item_id uuid NOT NULL,
    quantity integer DEFAULT 1,
    is_optional boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalog_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    color character varying(20),
    parent_id uuid,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalog_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    short_description character varying(500),
    description text,
    category_id uuid,
    item_type character varying(50) NOT NULL,
    resource_type character varying(50),
    resource_id uuid,
    resource_config jsonb DEFAULT '{}'::jsonb,
    icon character varying(50),
    image_url character varying(500),
    display_order integer DEFAULT 0,
    is_requestable boolean DEFAULT true,
    requires_approval boolean DEFAULT true,
    approval_workflow_id uuid,
    available_to character varying(50) DEFAULT 'all'::character varying,
    available_to_roles uuid[],
    available_to_groups uuid[],
    estimated_fulfillment_days integer DEFAULT 3,
    fulfillment_instructions text,
    fulfillment_team uuid,
    has_cost boolean DEFAULT false,
    cost_type character varying(20),
    cost_amount numeric(10,2),
    currency_code character varying(3) DEFAULT 'USD'::character varying,
    cost_center character varying(100),
    track_inventory boolean DEFAULT false,
    available_quantity integer,
    request_form jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    tags character varying(100)[],
    slug character varying(100),
    owner_id uuid,
    approval_config jsonb DEFAULT '{"levels": []}'::jsonb,
    auto_category character varying(100),
    auto_subcategory character varying(100),
    application_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: category_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    suggested_name character varying(100) NOT NULL,
    suggested_description text,
    suggested_parent_id uuid,
    suggested_base_type public.request_category,
    requested_by_type character varying(20) NOT NULL,
    requested_by_user_id uuid,
    ai_confidence numeric(3,2),
    ai_reasoning text,
    sample_ticket_ids uuid[],
    sample_ticket_subjects text[],
    occurrence_count integer DEFAULT 1,
    status character varying(20) DEFAULT 'pending'::character varying,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_category_id uuid,
    merged_into_category_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: certificate_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificate_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    certificate_id uuid NOT NULL,
    days_until_expiry integer,
    alert_type character varying(50),
    status character varying(20) DEFAULT 'open'::character varying,
    ticket_id uuid,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: certificate_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificate_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    certificate_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    usage_type character varying(50),
    installed_at timestamp with time zone,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: certificate_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificate_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    certificate_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    field_name character varying(100),
    old_value text,
    new_value text,
    old_expires_at date,
    new_expires_at date,
    old_serial_number character varying(255),
    new_serial_number character varying(255),
    performed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    domain_id uuid,
    name character varying(255) NOT NULL,
    domain_name character varying(255),
    san_domains text[],
    issuer character varying(255),
    issued_at date,
    expires_at date,
    serial_number character varying(255),
    fingerprint character varying(255),
    cert_type character varying(50),
    is_wildcard boolean DEFAULT false,
    public_key_encrypted text,
    private_key_encrypted text,
    chain_encrypted text,
    is_active boolean DEFAULT true,
    auto_renew boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: chat_handoffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_handoffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    reason character varying(100),
    reason_details text,
    assigned_to uuid,
    assigned_team uuid,
    status character varying(20) DEFAULT 'pending'::character varying,
    requested_at timestamp with time zone DEFAULT now(),
    accepted_at timestamp with time zone,
    resolved_at timestamp with time zone,
    wait_time_seconds integer,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: chat_quick_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_quick_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    shortcut character varying(50),
    category character varying(100),
    tags character varying(100)[],
    usage_count integer DEFAULT 0,
    last_used_at timestamp with time zone,
    available_to character varying(20) DEFAULT 'all'::character varying,
    chat_types character varying(20)[],
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: chat_support_metrics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.chat_support_metrics AS
 SELECT date_trunc('day'::text, created_at) AS date,
    organization_id,
    chat_type,
    count(*) AS total_sessions,
    count(*) FILTER (WHERE is_support_chat) AS support_sessions,
    count(*) FILTER (WHERE ((resolution_status)::text = 'resolved_by_ai'::text)) AS resolved_by_ai,
    count(*) FILTER (WHERE ((resolution_status)::text = 'escalated'::text)) AS escalated,
    count(*) FILTER (WHERE ((resolution_status)::text = 'ticket_created'::text)) AS tickets_created,
    round((((count(*) FILTER (WHERE ((resolution_status)::text = 'resolved_by_ai'::text)))::numeric * (100)::numeric) / (NULLIF(count(*) FILTER (WHERE (resolution_status IS NOT NULL)), 0))::numeric), 1) AS ai_resolution_rate,
    round(avg(satisfaction_rating), 2) AS avg_satisfaction,
    count(*) FILTER (WHERE (satisfaction_rating >= 4)) AS satisfied_count,
    round(avg((EXTRACT(epoch FROM (resolved_at - created_at)) / (60)::numeric)), 1) AS avg_resolution_minutes
   FROM public.ai_chat_sessions s
  WHERE (is_support_chat = true)
  GROUP BY (date_trunc('day'::text, created_at)), organization_id, chat_type;


--
-- Name: chat_ticket_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_ticket_conversions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    created_by character varying(20),
    ai_suggested_fields jsonb,
    user_modified_fields jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: checklist_template_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_template_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    is_required boolean DEFAULT false,
    service_category character varying(100),
    default_assignee_type character varying(50) DEFAULT 'ticket_assignee'::character varying,
    default_assignee_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id uuid,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    abbreviation character varying(20),
    type character varying(50) DEFAULT 'client'::character varying,
    website character varying(255),
    phone character varying(50),
    email character varying(255),
    address text,
    city character varying(100),
    state character varying(100),
    zip character varying(20),
    country character varying(100),
    tax_id character varying(100),
    industry character varying(100),
    employee_count integer,
    currency_code character varying(3) DEFAULT 'USD'::character varying,
    net_terms integer DEFAULT 30,
    hourly_rate numeric(10,2),
    notes text,
    referral_source character varying(255),
    is_active boolean DEFAULT true,
    is_lead boolean DEFAULT false,
    tags character varying(100)[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    external_source character varying(50),
    external_id character varying(255),
    last_synced_at timestamp with time zone,
    support_phone character varying(50),
    support_email character varying(255),
    support_url character varying(500),
    account_number character varying(100),
    account_manager character varying(100),
    account_manager_email character varying(255),
    account_manager_phone character varying(50)
);


--
-- Name: clients; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.clients AS
 SELECT id,
    organization_id,
    name,
    abbreviation,
    type,
    website,
    phone,
    email,
    address,
    city,
    state,
    zip,
    country,
    tax_id,
    industry,
    employee_count,
    currency_code,
    net_terms,
    hourly_rate,
    notes,
    referral_source,
    is_active,
    is_lead,
    tags,
    custom_fields,
    created_at,
    updated_at,
    external_source,
    external_id,
    last_synced_at,
    support_phone,
    support_email,
    support_url,
    account_number,
    account_manager,
    account_manager_email,
    account_manager_phone
   FROM public.companies;


--
-- Name: company_tag_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_tag_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: company_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(20),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contact_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    is_primary boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: contact_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    file_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_type character varying(100),
    file_size integer,
    file_path text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: contact_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contact_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contact_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_tags (
    contact_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    location_id uuid,
    first_name character varying(100),
    last_name character varying(100),
    email character varying(255),
    phone character varying(50),
    mobile character varying(50),
    title character varying(100),
    department_legacy character varying(100),
    photo_url character varying(500),
    is_primary boolean DEFAULT false,
    is_technical boolean DEFAULT false,
    is_billing boolean DEFAULT false,
    is_vip boolean DEFAULT false,
    has_portal_access boolean DEFAULT false,
    portal_password_hash character varying(255),
    portal_pin character varying(10),
    portal_last_login timestamp with time zone,
    notes text,
    is_active boolean DEFAULT true,
    tags character varying(100)[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reports_to_id uuid,
    job_title character varying(255),
    employee_id character varying(50),
    start_date date,
    end_date date,
    contact_type character varying(50) DEFAULT 'employee'::character varying,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid,
    deleted_by_provider_id uuid,
    deleted_by_name character varying(200),
    delete_reason text,
    created_by_provider_id uuid,
    created_by_provider_name character varying(200),
    last_modified_by_provider_id uuid,
    last_modified_by_provider_name character varying(200),
    restored_at timestamp with time zone,
    restored_by_user_id uuid,
    external_source character varying(50),
    external_id character varying(255),
    last_synced_at timestamp with time zone,
    job_title_id uuid,
    department_id uuid,
    employment_type_id uuid,
    embedding public.vector,
    embedding_status character varying(20) DEFAULT 'pending'::character varying,
    embedding_model character varying(100),
    embedded_at timestamp with time zone,
    legal_hold boolean DEFAULT false
);


--
-- Name: contextual_help; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contextual_help (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_key character varying(100) NOT NULL,
    context character varying(50) NOT NULL,
    title character varying(200),
    content text NOT NULL,
    learn_more_url character varying(500),
    video_url character varying(500),
    ui_mode character varying(20)[],
    user_roles character varying(50)[],
    display_order integer DEFAULT 0,
    is_dismissible boolean DEFAULT true,
    show_once boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50),
    start_date date,
    end_date date,
    signed_date date,
    rate_standard numeric(10,2),
    rate_after_hours numeric(10,2),
    rate_emergency numeric(10,2),
    currency_code character varying(3) DEFAULT 'USD'::character varying,
    monthly_hours_included integer,
    hours_rollover boolean DEFAULT false,
    sla_critical_response integer,
    sla_critical_resolution integer,
    sla_high_response integer,
    sla_high_resolution integer,
    sla_medium_response integer,
    sla_medium_resolution integer,
    sla_low_response integer,
    sla_low_resolution integer,
    support_hours_start time without time zone,
    support_hours_end time without time zone,
    support_days character varying(20) DEFAULT 'Mon-Fri'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    document_url character varying(500),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: credential_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credential_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    credential_id uuid NOT NULL,
    user_id uuid,
    role_id uuid,
    access_level character varying(20) DEFAULT 'view'::character varying,
    granted_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT credential_access_target CHECK ((((user_id IS NOT NULL) AND (role_id IS NULL)) OR ((user_id IS NULL) AND (role_id IS NOT NULL))))
);


--
-- Name: credential_access_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credential_access_checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    access_request_id uuid NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now(),
    checked_in_by_name character varying(200),
    checked_in_by_email character varying(255),
    ip_address character varying(45),
    user_agent text,
    access_extended_until timestamp with time zone,
    is_renewal boolean DEFAULT false
);


--
-- Name: credential_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credential_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    credential_id uuid NOT NULL,
    user_id uuid,
    action character varying(50) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: credential_access_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credential_access_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    policy_id uuid,
    provider_api_key_id uuid NOT NULL,
    provider_name character varying(200),
    requester_name character varying(200) NOT NULL,
    requester_email character varying(255) NOT NULL,
    request_mode public.credential_share_mode NOT NULL,
    justification text,
    ticket_reference character varying(100),
    status public.credential_request_status DEFAULT 'pending'::public.credential_request_status NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    denial_reason text,
    access_granted_at timestamp with time zone,
    access_expires_at timestamp with time zone,
    last_check_in_at timestamp with time zone,
    check_ins_count integer DEFAULT 0,
    renewals_count integer DEFAULT 0,
    reveals_count integer DEFAULT 0,
    last_reveal_at timestamp with time zone,
    request_ip character varying(45),
    request_user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone
);


--
-- Name: credential_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credential_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    color character varying(20),
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: credential_contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credential_contributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    credential_id uuid,
    action character varying(20) NOT NULL,
    provider_api_key_id uuid NOT NULL,
    provider_name character varying(200),
    contributor_name character varying(200),
    contributor_email character varying(255),
    service_name character varying(200),
    account_identifier character varying(500),
    reason text,
    related_ticket_id uuid,
    client_notified boolean DEFAULT false,
    client_notified_at timestamp with time zone,
    client_acknowledged boolean DEFAULT false,
    client_acknowledged_at timestamp with time zone,
    client_acknowledged_by uuid,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: credential_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credential_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    credential_id uuid NOT NULL,
    link_type character varying(50) NOT NULL,
    link_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: credential_reveal_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credential_reveal_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    credential_name character varying(200),
    access_request_id uuid,
    revealed_by_type character varying(20) NOT NULL,
    revealed_by_user_id uuid,
    revealed_by_api_key_id uuid,
    revealed_by_name character varying(200),
    revealed_by_email character varying(255),
    reveal_method character varying(50),
    fields_revealed text[],
    ip_address character varying(45),
    user_agent text,
    session_id character varying(100),
    revealed_at timestamp with time zone DEFAULT now(),
    masked_at timestamp with time zone,
    view_duration_seconds integer,
    is_break_glass boolean DEFAULT false,
    break_glass_justification text,
    incident_created boolean DEFAULT false,
    incident_id uuid
);


--
-- Name: credential_sharing_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credential_sharing_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    credential_id uuid NOT NULL,
    provider_api_key_id uuid,
    share_mode public.credential_share_mode DEFAULT 'never'::public.credential_share_mode NOT NULL,
    requires_approval boolean DEFAULT true,
    auto_approve_for_roles uuid[],
    approval_timeout_minutes integer DEFAULT 60,
    access_duration_hours integer DEFAULT 8,
    check_in_required boolean DEFAULT true,
    check_in_interval_hours integer DEFAULT 24,
    max_renewals integer DEFAULT 7,
    alert_on_access boolean DEFAULT true,
    alert_emails text[],
    alert_slack_webhook character varying(500),
    requires_justification boolean DEFAULT true,
    creates_incident boolean DEFAULT true,
    max_reveals_per_session integer DEFAULT 3,
    reveal_duration_seconds integer DEFAULT 30,
    mask_after_reveal boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: credential_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credential_tags (
    credential_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    username character varying(500),
    password_encrypted text,
    otp_secret_encrypted text,
    notes_encrypted text,
    uri character varying(500),
    uri_type character varying(50),
    is_important boolean DEFAULT false,
    expires_at timestamp with time zone,
    password_changed_at timestamp with time zone,
    tags character varying(100)[],
    custom_fields_encrypted text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid,
    deleted_by_provider_id uuid,
    deleted_by_name character varying(200),
    delete_reason text,
    created_by_provider_id uuid,
    created_by_provider_name character varying(200),
    last_modified_by_provider_id uuid,
    last_modified_by_provider_name character varying(200),
    restored_at timestamp with time zone,
    restored_by_user_id uuid,
    legal_hold boolean DEFAULT false
);


--
-- Name: dashboard_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    view_type public.dashboard_view_type NOT NULL,
    is_default_for_role character varying(50),
    assigned_users uuid[],
    assigned_roles text[],
    layout jsonb DEFAULT '{}'::jsonb,
    widgets jsonb DEFAULT '[]'::jsonb,
    default_filters jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: dashboard_widgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_widgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    widget_type character varying(50) NOT NULL,
    data_source character varying(100) NOT NULL,
    available_for public.dashboard_view_type[],
    default_config jsonb DEFAULT '{}'::jsonb,
    min_width integer DEFAULT 1,
    min_height integer DEFAULT 1,
    max_width integer DEFAULT 4,
    max_height integer DEFAULT 4,
    is_active boolean DEFAULT true
);


--
-- Name: data_retention_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_retention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    retention_mode character varying(20) DEFAULT 'manual_only'::character varying NOT NULL,
    retention_days integer,
    exempt_if_closed boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT data_retention_policies_entity_type_check CHECK (((entity_type)::text = ANY (ARRAY[('contacts'::character varying)::text, ('tickets'::character varying)::text, ('assets'::character varying)::text, ('credentials'::character varying)::text, ('kb_articles'::character varying)::text, ('documents'::character varying)::text]))),
    CONSTRAINT data_retention_policies_retention_days_check CHECK (((retention_days IS NULL) OR (retention_days >= 365))),
    CONSTRAINT data_retention_policies_retention_mode_check CHECK (((retention_mode)::text = ANY (ARRAY[('manual_only'::character varying)::text, ('auto_purge'::character varying)::text])))
);


--
-- Name: delegation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delegation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    delegator_type character varying(50) NOT NULL,
    delegator_id uuid,
    action character varying(50) NOT NULL,
    target_scope character varying(50) NOT NULL,
    target_group_id uuid,
    requires_justification boolean DEFAULT false,
    max_cost numeric(10,2),
    allowed_catalog_categories uuid[],
    is_active boolean DEFAULT true,
    starts_at timestamp with time zone DEFAULT now(),
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: delegation_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delegation_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    delegator_id uuid NOT NULL,
    delegate_id uuid NOT NULL,
    delegation_type character varying(50) NOT NULL,
    actions character varying(50)[],
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    notify_on_action boolean DEFAULT true,
    reason text,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    description text,
    parent_id uuid,
    head_contact_id uuid,
    cost_center character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    path text,
    depth integer DEFAULT 0,
    employee_count integer DEFAULT 0
);


--
-- Name: dns_change_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dns_change_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    domain_id uuid NOT NULL,
    record_type character varying(20) NOT NULL,
    record_name character varying(255),
    old_value text,
    new_value text,
    severity character varying(20) DEFAULT 'warning'::character varying,
    title character varying(500),
    description text,
    status character varying(20) DEFAULT 'open'::character varying,
    is_expected boolean DEFAULT false,
    ticket_id uuid,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    resolution_notes text,
    detected_at timestamp with time zone DEFAULT now(),
    snapshot_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    name character varying(255) NOT NULL,
    description text,
    registrar character varying(255),
    registrar_url character varying(500),
    registered_at date,
    expires_at date,
    auto_renew boolean DEFAULT true,
    nameservers character varying(255)[],
    dns_provider character varying(255),
    webhost character varying(255),
    webhost_url character varying(500),
    mail_provider character varying(100),
    mx_records text[],
    is_active boolean DEFAULT true,
    is_important boolean DEFAULT false,
    notes text,
    tags character varying(100)[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: dns_alerts_by_domain; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.dns_alerts_by_domain AS
 SELECT d.organization_id,
    d.id AS domain_id,
    d.name AS domain_name,
    count(*) FILTER (WHERE ((a.status)::text = 'open'::text)) AS open_alerts,
    count(*) FILTER (WHERE (((a.status)::text = 'open'::text) AND ((a.severity)::text = 'critical'::text))) AS critical_alerts,
    count(*) FILTER (WHERE (((a.status)::text = 'open'::text) AND ((a.severity)::text = 'warning'::text))) AS warning_alerts,
    count(*) FILTER (WHERE ((a.status)::text = 'acknowledged'::text)) AS acknowledged_alerts,
    max(a.detected_at) FILTER (WHERE ((a.status)::text = 'open'::text)) AS latest_alert_at
   FROM (public.domains d
     LEFT JOIN public.dns_change_alerts a ON ((d.id = a.domain_id)))
  GROUP BY d.id, d.organization_id, d.name;


--
-- Name: dns_change_windows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dns_change_windows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    domain_id uuid,
    title character varying(255) NOT NULL,
    description text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    expected_changes jsonb,
    ticket_id uuid,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: dns_monitoring_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dns_monitoring_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    domain_id uuid NOT NULL,
    check_frequency_minutes integer DEFAULT 60,
    last_check_at timestamp with time zone,
    next_check_at timestamp with time zone,
    monitor_a_records boolean DEFAULT true,
    monitor_aaaa_records boolean DEFAULT true,
    monitor_mx_records boolean DEFAULT true,
    monitor_txt_records boolean DEFAULT true,
    monitor_ns_records boolean DEFAULT true,
    monitor_cname_records boolean DEFAULT true,
    monitor_whois boolean DEFAULT true,
    monitor_ssl_expiry boolean DEFAULT true,
    alert_on_any_change boolean DEFAULT true,
    alert_severity_default character varying(20) DEFAULT 'warning'::character varying,
    critical_records jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: dns_monitoring_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dns_monitoring_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    a_records jsonb DEFAULT '[]'::jsonb,
    aaaa_records jsonb DEFAULT '[]'::jsonb,
    mx_records jsonb DEFAULT '[]'::jsonb,
    txt_records jsonb DEFAULT '[]'::jsonb,
    ns_records jsonb DEFAULT '[]'::jsonb,
    cname_records jsonb DEFAULT '[]'::jsonb,
    whois_registrar character varying(255),
    whois_expiry date,
    whois_nameservers jsonb DEFAULT '[]'::jsonb,
    whois_raw text,
    ssl_issuer character varying(255),
    ssl_expires_at date,
    ssl_valid boolean,
    checked_at timestamp with time zone DEFAULT now(),
    check_duration_ms integer,
    check_status character varying(20) DEFAULT 'success'::character varying,
    check_error text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: dns_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dns_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    record_type character varying(10) NOT NULL,
    name character varying(255) NOT NULL,
    value text NOT NULL,
    ttl integer DEFAULT 3600,
    priority integer,
    weight integer,
    port integer,
    notes text,
    is_managed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: document_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    document_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_type character varying(100),
    file_size bigint,
    storage_key text NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    document_id uuid NOT NULL,
    share_token character varying(64) NOT NULL,
    shared_by uuid,
    shared_with_email character varying(255),
    access_type character varying(20) DEFAULT 'view'::character varying NOT NULL,
    auth_method character varying(20) DEFAULT 'none'::character varying NOT NULL,
    expires_at timestamp with time zone,
    max_views integer,
    view_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_accessed_at timestamp with time zone
);


--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    content text,
    category character varying(100),
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    version_number integer NOT NULL,
    title character varying(500) NOT NULL,
    content text,
    change_summary text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    folder_id uuid,
    title character varying(500) NOT NULL,
    description text,
    content text,
    content_raw text,
    is_public boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    is_template boolean DEFAULT false,
    is_important boolean DEFAULT false,
    view_count integer DEFAULT 0,
    last_viewed_at timestamp with time zone,
    tags character varying(100)[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid,
    deleted_by_provider_id uuid,
    deleted_by_name character varying(200),
    delete_reason text,
    created_by_provider_id uuid,
    created_by_provider_name character varying(200),
    last_modified_by_provider_id uuid,
    last_modified_by_provider_name character varying(200),
    restored_at timestamp with time zone,
    restored_by_user_id uuid,
    legal_hold boolean DEFAULT false
);


--
-- Name: domain_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    old_value text,
    new_value text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    change_type character varying(50),
    severity character varying(20) DEFAULT 'info'::character varying,
    is_acknowledged boolean DEFAULT false,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    ticket_id uuid,
    is_expected boolean DEFAULT false,
    expected_reason text
);


--
-- Name: dynamic_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dynamic_group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    contact_id uuid,
    user_id uuid,
    asset_id uuid,
    membership_source character varying(20) DEFAULT 'dynamic'::character varying NOT NULL,
    rule_matched_at timestamp with time zone,
    is_active boolean DEFAULT true,
    joined_at timestamp with time zone DEFAULT now(),
    removed_at timestamp with time zone
);


--
-- Name: dynamic_group_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dynamic_group_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    field_name character varying(100) NOT NULL,
    operator character varying(30) NOT NULL,
    value text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: dynamic_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dynamic_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    group_type character varying(50) DEFAULT 'user'::character varying NOT NULL,
    membership_type character varying(20) DEFAULT 'dynamic'::character varying NOT NULL,
    rule_logic character varying(10) DEFAULT 'AND'::character varying,
    refresh_interval_minutes integer DEFAULT 60,
    last_evaluated_at timestamp with time zone,
    member_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: email_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider character varying(20) NOT NULL,
    to_address character varying(320) NOT NULL,
    subject text,
    status character varying(20) NOT NULL,
    error_code character varying(50),
    error_message text,
    provider_message_id text,
    queue_job_id text,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_attempts_status_chk CHECK (((status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: email_delivery_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_delivery_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_queue_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    event_data jsonb,
    external_id character varying(255),
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    event_data jsonb DEFAULT '{}'::jsonb,
    source character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid,
    user_id uuid,
    email character varying(255),
    ticket_notifications boolean DEFAULT true,
    ticket_replies boolean DEFAULT true,
    sla_warnings boolean DEFAULT true,
    system_notifications boolean DEFAULT true,
    marketing boolean DEFAULT false,
    digest_frequency character varying(20) DEFAULT 'immediate'::character varying,
    unsubscribed_at timestamp with time zone,
    unsubscribe_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT email_preferences_unique CHECK ((((contact_id IS NOT NULL) AND (user_id IS NULL) AND (email IS NULL)) OR ((contact_id IS NULL) AND (user_id IS NOT NULL) AND (email IS NULL)) OR ((contact_id IS NULL) AND (user_id IS NULL) AND (email IS NOT NULL))))
);


--
-- Name: email_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    to_email character varying(255) NOT NULL,
    to_name character varying(255),
    cc_emails text[],
    bcc_emails text[],
    reply_to character varying(255),
    subject character varying(500) NOT NULL,
    body_text text,
    body_html text,
    attachments jsonb DEFAULT '[]'::jsonb,
    status character varying(20) DEFAULT 'pending'::character varying,
    priority integer DEFAULT 0,
    scheduled_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    last_error text,
    next_retry_at timestamp with time zone,
    related_type character varying(50),
    related_id uuid,
    template_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    message_id character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_settings (
    organization_id uuid NOT NULL,
    provider character varying(20) DEFAULT 'gmail-relay'::character varying NOT NULL,
    config_envelope text,
    from_address character varying(255) NOT NULL,
    from_name character varying(255),
    reply_to character varying(255),
    last_test_at timestamp with time zone,
    last_test_status character varying(20),
    last_test_error_message text,
    last_send_at timestamp with time zone,
    last_send_status character varying(20),
    last_send_error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT email_settings_provider_chk CHECK (((provider)::text = ANY ((ARRAY['gmail-relay'::character varying, 'gmail-smtp'::character varying, 'resend'::character varying, 'ses'::character varying, 'sendgrid'::character varying, 'smtp'::character varying])::text[]))),
    CONSTRAINT email_settings_send_status_chk CHECK (((last_send_status IS NULL) OR ((last_send_status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying])::text[])))),
    CONSTRAINT email_settings_test_status_chk CHECK (((last_test_status IS NULL) OR ((last_test_status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying])::text[]))))
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    subject character varying(500) NOT NULL,
    body_html text,
    body_text text,
    variables jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: employment_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employment_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    description text,
    max_access_level integer DEFAULT 100,
    requires_background_check boolean DEFAULT false,
    requires_nda boolean DEFAULT false,
    is_temporary boolean DEFAULT false,
    default_duration_days integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: feature_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_registry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_key character varying(100) NOT NULL,
    feature_name character varying(200) NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'coming_soon'::character varying NOT NULL,
    introduced_version character varying(20),
    stable_version character varying(20),
    deprecated_version character varying(20),
    icon character varying(50),
    badge_text character varying(50),
    badge_color character varying(20) DEFAULT 'gray'::character varying,
    depends_on text[],
    conflicts_with text[],
    default_enabled boolean DEFAULT false,
    can_disable boolean DEFAULT true,
    requires_restart boolean DEFAULT false,
    docs_url character varying(500),
    changelog_url character varying(500),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: feature_usage_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_usage_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    feature_key character varying(100) NOT NULL,
    user_id uuid,
    action character varying(50) NOT NULL,
    context jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    reference_type character varying(50) NOT NULL,
    reference_id uuid NOT NULL,
    filename character varying(255) NOT NULL,
    original_filename character varying(255),
    file_path character varying(500),
    file_size bigint,
    mime_type character varying(100),
    file_hash character varying(64),
    description text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: folder_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folder_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    folder_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    permission character varying(20) DEFAULT 'read'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    parent_id uuid,
    name character varying(255) NOT NULL,
    description text,
    icon character varying(50),
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_restricted boolean DEFAULT false NOT NULL
);


--
-- Name: group_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    permission_set_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: inbound_email_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_email_log (
    id bigint NOT NULL,
    mailbox_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    message_id text,
    in_reply_to text,
    references_chain text,
    from_address text,
    to_address text,
    subject text,
    raw_size_bytes integer,
    status character varying(40) NOT NULL,
    ticket_id uuid,
    reply_id uuid,
    match_path character varying(32),
    signature_validated boolean,
    sender_authorized boolean,
    signed_by_previous_key boolean,
    foreign_instance_uuid uuid,
    rejection_reason text,
    parse_error text,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT inbound_email_log_match_path_check CHECK (((match_path)::text = ANY (ARRAY[('duplicate'::character varying)::text, ('signed_valid'::character varying)::text, ('signed_invalid_replay'::character varying)::text, ('header_legacy'::character varying)::text, ('subject_token'::character varying)::text, ('foreign_instance'::character varying)::text, ('new'::character varying)::text]))),
    CONSTRAINT inbound_email_log_status_check CHECK (((status)::text = ANY (ARRAY[('received'::character varying)::text, ('parsed'::character varying)::text, ('threaded_existing'::character varying)::text, ('created_new'::character varying)::text, ('created_new_auth_failed_signed'::character varying)::text, ('created_new_auth_failed_header'::character varying)::text, ('rejected_bounce'::character varying)::text, ('rejected_autoresponder'::character varying)::text, ('rejected_loop'::character varying)::text, ('rejected_size'::character varying)::text, ('rejected_foreign_instance'::character varying)::text, ('failed_parse'::character varying)::text, ('failed_create'::character varying)::text])))
);


--
-- Name: inbound_email_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inbound_email_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inbound_email_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inbound_email_log_id_seq OWNED BY public.inbound_email_log.id;


--
-- Name: inbound_mailboxes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_mailboxes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    host text NOT NULL,
    port integer DEFAULT 993 NOT NULL,
    use_tls boolean DEFAULT true NOT NULL,
    username text NOT NULL,
    password_encrypted text NOT NULL,
    folder text DEFAULT 'INBOX'::text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    poll_interval_seconds integer DEFAULT 60 NOT NULL,
    last_poll_at timestamp with time zone,
    last_poll_status character varying(16),
    last_poll_error text,
    last_uid_seen bigint,
    last_uidvalidity bigint,
    backfill_days_on_activation integer DEFAULT 0 NOT NULL,
    default_ticket_kind character varying(16) DEFAULT 'conversation'::character varying NOT NULL,
    shadow_mode boolean DEFAULT false NOT NULL,
    post_process_mode character varying(20) DEFAULT 'passive'::character varying NOT NULL,
    processed_folder text,
    reply_address text,
    message_id_host text,
    attachment_size_limit_bytes bigint DEFAULT 26214400 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inbound_mailboxes_backfill_days_on_activation_check CHECK (((backfill_days_on_activation >= 0) AND (backfill_days_on_activation <= 90))),
    CONSTRAINT inbound_mailboxes_default_ticket_kind_check CHECK (((default_ticket_kind)::text = ANY (ARRAY[('incident'::character varying)::text, ('request'::character varying)::text, ('conversation'::character varying)::text]))),
    CONSTRAINT inbound_mailboxes_last_poll_status_check CHECK (((last_poll_status)::text = ANY (ARRAY[('ok'::character varying)::text, ('auth_failed'::character varying)::text, ('connect_failed'::character varying)::text, ('parse_failed'::character varying)::text, ('unknown_error'::character varying)::text]))),
    CONSTRAINT inbound_mailboxes_poll_interval_seconds_check CHECK ((poll_interval_seconds >= 30)),
    CONSTRAINT inbound_mailboxes_post_process_mode_check CHECK (((post_process_mode)::text = ANY (ARRAY[('passive'::character varying)::text, ('mark_seen'::character varying)::text, ('move_processed'::character varying)::text, ('delete_processed'::character varying)::text])))
);


--
-- Name: incident_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incident_timeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incident_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    event_data jsonb,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    incident_number integer NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    severity character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    category character varying(100),
    subcategory character varying(100),
    status character varying(20) DEFAULT 'new'::character varying,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    correlation_key character varying(255),
    alert_count integer DEFAULT 0,
    first_alert_at timestamp with time zone,
    last_alert_at timestamp with time zone,
    ticket_id uuid,
    auto_created_ticket boolean DEFAULT false,
    assigned_to uuid,
    assigned_team uuid,
    affected_assets integer DEFAULT 0,
    affected_users integer DEFAULT 0,
    notes text,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: incidents_incident_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incidents_incident_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidents_incident_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incidents_incident_number_seq OWNED BY public.incidents.incident_number;


--
-- Name: interface_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interface_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_interface_id uuid NOT NULL,
    target_interface_id uuid NOT NULL,
    link_type character varying(50),
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: job_title_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_title_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_title_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    entitlement_type character varying(50) NOT NULL,
    resource_id uuid,
    resource_name character varying(255) NOT NULL,
    requires_approval boolean DEFAULT false,
    approval_workflow_id uuid,
    service_category character varying(100),
    default_assignee_type character varying(50) DEFAULT 'it_admin'::character varying,
    default_assignee_id uuid,
    task_title character varying(255),
    task_description text,
    is_required boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: job_titles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_titles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    department character varying(255),
    description text,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cloned_from_id uuid,
    clone_notes text
);


--
-- Name: kb_article_acknowledgments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_article_acknowledgments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    user_id uuid,
    contact_id uuid,
    ip_address character varying(45),
    user_agent text,
    article_version integer DEFAULT 1,
    acknowledged_at timestamp with time zone DEFAULT now()
);


--
-- Name: kb_article_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_article_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    article_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    chunk_text text NOT NULL,
    token_count integer,
    embedding public.vector,
    embedding_status character varying(20) DEFAULT 'pending'::character varying,
    embedding_model character varying(100),
    embedded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: kb_article_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_article_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    article_id uuid NOT NULL,
    storage_key text NOT NULL,
    original_filename character varying(255),
    mime_type character varying(100),
    byte_size bigint,
    sha256 character(64),
    extracted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kb_article_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_article_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    version_number integer NOT NULL,
    title character varying(255),
    content text,
    content_plain text,
    summary text,
    change_note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: kb_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255),
    summary text,
    content text,
    content_plain text,
    category_id uuid,
    author_id uuid,
    status character varying(20) DEFAULT 'draft'::character varying,
    visibility character varying(20) DEFAULT 'public'::character varying,
    is_published boolean DEFAULT false,
    published_at timestamp with time zone,
    view_count integer DEFAULT 0,
    helpful_count integer DEFAULT 0,
    not_helpful_count integer DEFAULT 0,
    requires_acknowledgment boolean DEFAULT false,
    acknowledgment_required_by date,
    expires_at timestamp with time zone,
    approved_by uuid,
    approved_at timestamp with time zone,
    submitted_for_review_at timestamp with time zone,
    visible_to_roles uuid[] DEFAULT '{}'::uuid[],
    visible_to_companies uuid[] DEFAULT '{}'::uuid[],
    visible_to_locations uuid[] DEFAULT '{}'::uuid[],
    visible_to_employment_types uuid[] DEFAULT '{}'::uuid[],
    visible_to_contact_groups uuid[] DEFAULT '{}'::uuid[],
    acknowledgment_days integer,
    last_modified_by_provider_id uuid,
    last_modified_by_provider_name character varying(255),
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid,
    deleted_by_provider_id uuid,
    deleted_by_name character varying(255),
    delete_reason text,
    restored_at timestamp with time zone,
    restored_by_user_id uuid,
    is_system boolean DEFAULT false,
    content_version integer DEFAULT 1,
    article_type character varying(20) DEFAULT 'standard'::character varying,
    tags character varying(100)[] DEFAULT '{}'::character varying[],
    assessment jsonb,
    assessment_dsl text,
    passing_score numeric(5,2) DEFAULT 80,
    is_assigned boolean DEFAULT false,
    embedding public.vector,
    embedding_status character varying(20) DEFAULT 'pending'::character varying,
    embedding_model character varying(100),
    embedded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    legal_hold boolean DEFAULT false,
    required_for_audience_kind character varying(20) DEFAULT 'internal'::character varying NOT NULL,
    required_for_roles uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    required_for_departments uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    required_for_job_titles uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    required_for_employment_types uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    required_for_contact_groups uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    required_for_companies uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    required_for_locations uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    assessment_hash text,
    visible_to_departments uuid[] DEFAULT '{}'::uuid[],
    visible_to_job_titles uuid[] DEFAULT '{}'::uuid[],
    content_format character varying(20) DEFAULT 'html'::character varying NOT NULL,
    CONSTRAINT kb_articles_article_type_chk CHECK (((article_type)::text = ANY (ARRAY[('standard'::character varying)::text, ('policy'::character varying)::text, ('procedure'::character varying)::text, ('training'::character varying)::text]))),
    CONSTRAINT kb_articles_content_format_chk CHECK (((content_format)::text = ANY ((ARRAY['html'::character varying, 'markdown'::character varying])::text[]))),
    CONSTRAINT kb_articles_required_for_audience_kind_chk CHECK (((required_for_audience_kind)::text = ANY (ARRAY[('none'::character varying)::text, ('internal'::character varying)::text, ('targeted'::character varying)::text])))
);


--
-- Name: kb_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    slug character varying(100),
    icon character varying(50),
    color character varying(20),
    parent_id uuid,
    display_order integer DEFAULT 0,
    is_public boolean DEFAULT true,
    is_internal boolean DEFAULT false,
    article_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    inherit_visibility boolean DEFAULT true,
    visible_to_companies uuid[] DEFAULT '{}'::uuid[],
    visible_to_locations uuid[] DEFAULT '{}'::uuid[],
    visible_to_employment_types uuid[] DEFAULT '{}'::uuid[],
    is_system boolean DEFAULT false,
    visible_to_departments uuid[] DEFAULT '{}'::uuid[],
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: kb_contributors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_contributors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    contact_id uuid,
    display_name character varying(100),
    bio text,
    expertise_areas character varying(100)[],
    avatar_url character varying(500),
    articles_published integer DEFAULT 0,
    articles_drafted integer DEFAULT 0,
    total_views integer DEFAULT 0,
    total_helpful_votes integer DEFAULT 0,
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    requires_approval boolean DEFAULT true,
    can_self_publish boolean DEFAULT false,
    allowed_categories uuid[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT kb_contrib_target CHECK ((((user_id IS NOT NULL) AND (contact_id IS NULL)) OR ((user_id IS NULL) AND (contact_id IS NOT NULL))))
);


--
-- Name: kb_gaps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_gaps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    topic character varying(200) NOT NULL,
    search_queries text[] DEFAULT '{}'::text[],
    sample_questions text[] DEFAULT '{}'::text[],
    occurrence_count integer DEFAULT 1 NOT NULL,
    draft_article_id uuid,
    resolved_ticket_id uuid,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kb_gaps_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('draft_created'::character varying)::text, ('resolved'::character varying)::text, ('dismissed'::character varying)::text])))
);


--
-- Name: kb_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    contact_id uuid,
    role_id uuid,
    permission character varying(50) NOT NULL,
    category_ids uuid[],
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    CONSTRAINT kb_perm_target CHECK ((((user_id IS NOT NULL) AND (contact_id IS NULL) AND (role_id IS NULL)) OR ((user_id IS NULL) AND (contact_id IS NOT NULL) AND (role_id IS NULL)) OR ((user_id IS NULL) AND (contact_id IS NULL) AND (role_id IS NOT NULL))))
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    name character varying(255) NOT NULL,
    address text,
    city character varying(100),
    state character varying(100),
    zip character varying(20),
    country character varying(100),
    phone character varying(50),
    is_primary boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: maintenance_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    maintenance_type character varying(50),
    asset_id uuid,
    asset_type character varying(100),
    location_id uuid,
    frequency_type character varying(20) NOT NULL,
    frequency_value integer NOT NULL,
    usage_threshold integer,
    last_maintenance_at date,
    next_maintenance_at date,
    due_soon_days integer DEFAULT 7,
    auto_create_ticket boolean DEFAULT true,
    recurring_ticket_id uuid,
    is_regulatory boolean DEFAULT false,
    regulation_reference character varying(255),
    compliance_notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: maintenance_due_soon; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.maintenance_due_soon AS
 SELECT ms.id,
    ms.organization_id,
    ms.name,
    ms.description,
    ms.maintenance_type,
    ms.asset_id,
    ms.asset_type,
    ms.location_id,
    ms.frequency_type,
    ms.frequency_value,
    ms.usage_threshold,
    ms.last_maintenance_at,
    ms.next_maintenance_at,
    ms.due_soon_days,
    ms.auto_create_ticket,
    ms.recurring_ticket_id,
    ms.is_regulatory,
    ms.regulation_reference,
    ms.compliance_notes,
    ms.is_active,
    ms.created_at,
    ms.updated_at,
    a.name AS asset_name,
    a.serial_number,
    l.name AS location_name,
    (ms.next_maintenance_at - CURRENT_DATE) AS days_until_due,
        CASE
            WHEN (ms.next_maintenance_at <= CURRENT_DATE) THEN 'overdue'::text
            WHEN (ms.next_maintenance_at <= (CURRENT_DATE + ms.due_soon_days)) THEN 'due_soon'::text
            ELSE 'upcoming'::text
        END AS status
   FROM ((public.maintenance_schedules ms
     LEFT JOIN public.assets a ON ((ms.asset_id = a.id)))
     LEFT JOIN public.locations l ON ((ms.location_id = l.id)))
  WHERE ((ms.is_active = true) AND (ms.next_maintenance_at <= (CURRENT_DATE + 30)))
  ORDER BY ms.next_maintenance_at;


--
-- Name: maintenance_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schedule_id uuid NOT NULL,
    performed_at timestamp with time zone NOT NULL,
    scheduled_for date,
    performed_by uuid,
    verified_by uuid,
    work_performed text,
    findings text,
    parts_used jsonb,
    duration_minutes integer,
    downtime_minutes integer,
    result character varying(20),
    next_maintenance_at date,
    ticket_id uuid,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: manager_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manager_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    manager_id uuid NOT NULL,
    relationship_type character varying(50) DEFAULT 'direct'::character varying,
    starts_at timestamp with time zone DEFAULT now(),
    ends_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: master_data_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_data_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    item_type character varying(50) NOT NULL,
    proposed_name character varying(255) NOT NULL,
    proposed_description text,
    proposed_details jsonb DEFAULT '{}'::jsonb,
    business_justification text NOT NULL,
    onboarding_request_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_item_id uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    requested_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: master_data_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_data_settings (
    organization_id uuid NOT NULL,
    enforce_departments boolean DEFAULT false,
    enforce_locations boolean DEFAULT false,
    enforce_job_titles boolean DEFAULT false,
    enforce_asset_types boolean DEFAULT false,
    enforce_asset_models boolean DEFAULT false,
    enforce_vendors boolean DEFAULT false,
    enforce_operating_systems boolean DEFAULT false,
    departments_migrated boolean DEFAULT false,
    locations_migrated boolean DEFAULT false,
    job_titles_migrated boolean DEFAULT false,
    allow_inline_creation boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);


--
-- Name: mcp_tools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_tools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    input_schema jsonb,
    output_schema jsonb,
    handler_type character varying(50),
    handler_config jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: mtp_pairings_legacy_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mtp_pairings_legacy_backup (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    display_name character varying(255) NOT NULL,
    api_key_hash character varying(255) NOT NULL,
    api_key_prefix character varying(20) NOT NULL,
    created_by_user_id uuid,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    scopes text[] DEFAULT ARRAY['tickets:read'::text] NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    revocation_reason text,
    pairing_window_expires_at timestamp with time zone DEFAULT (now() + '00:15:00'::interval) NOT NULL,
    paired_at timestamp with time zone,
    paired_from_ip text,
    paired_user_agent text,
    CONSTRAINT mtp_pairings_status_chk CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('revoked'::character varying)::text])))
);


--
-- Name: project_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    due_date date,
    completed_at timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    milestone_id uuid,
    title character varying(500) NOT NULL,
    description text,
    task_number character varying(50),
    status character varying(50) DEFAULT 'todo'::character varying,
    priority character varying(20) DEFAULT 'medium'::character varying,
    assigned_to uuid,
    reviewer_id uuid,
    estimated_hours numeric(6,2),
    actual_hours numeric(6,2) DEFAULT 0,
    start_date date,
    due_date date,
    completed_at timestamp with time zone,
    depends_on uuid[],
    blocks uuid[],
    sort_order integer DEFAULT 0,
    template_task_id character varying(100),
    ticket_id uuid,
    parent_task_id uuid,
    tags character varying(100)[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    project_number character varying(50),
    category character varying(100),
    project_type character varying(50),
    contact_id uuid,
    status character varying(50) DEFAULT 'planning'::character varying,
    priority character varying(20) DEFAULT 'medium'::character varying,
    health character varying(20) DEFAULT 'on_track'::character varying,
    start_date date,
    target_end_date date,
    actual_end_date date,
    budget_hours integer,
    budget_amount numeric(12,2),
    currency character varying(3) DEFAULT 'USD'::character varying,
    percent_complete integer DEFAULT 0,
    hours_logged numeric(10,2) DEFAULT 0,
    amount_spent numeric(12,2) DEFAULT 0,
    manager_id uuid,
    team_members uuid[],
    template_id uuid,
    parent_project_id uuid,
    tags character varying(100)[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    archived_at timestamp with time zone,
    CONSTRAINT projects_percent_complete_check CHECK (((percent_complete >= 0) AND (percent_complete <= 100)))
);


--
-- Name: my_project_tasks; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.my_project_tasks AS
 SELECT t.id,
    t.project_id,
    t.milestone_id,
    t.title,
    t.description,
    t.task_number,
    t.status,
    t.priority,
    t.assigned_to,
    t.reviewer_id,
    t.estimated_hours,
    t.actual_hours,
    t.start_date,
    t.due_date,
    t.completed_at,
    t.depends_on,
    t.blocks,
    t.sort_order,
    t.template_task_id,
    t.ticket_id,
    t.parent_task_id,
    t.tags,
    t.custom_fields,
    t.created_by,
    t.created_at,
    t.updated_at,
    p.name AS project_name,
    p.project_number,
    p.status AS project_status,
    m.name AS milestone_name,
    m.due_date AS milestone_due_date
   FROM ((public.project_tasks t
     JOIN public.projects p ON ((t.project_id = p.id)))
     LEFT JOIN public.project_milestones m ON ((t.milestone_id = m.id)))
  WHERE ((p.archived_at IS NULL) AND ((t.status)::text <> ALL (ARRAY[('done'::character varying)::text, ('cancelled'::character varying)::text])))
  ORDER BY t.due_date, t.priority DESC;


--
-- Name: networks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.networks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    location_id uuid,
    name character varying(255) NOT NULL,
    description text,
    network cidr NOT NULL,
    gateway character varying(45),
    subnet_mask character varying(45),
    broadcast character varying(45),
    dhcp_enabled boolean DEFAULT false,
    dhcp_start character varying(45),
    dhcp_end character varying(45),
    dhcp_server character varying(45),
    dns_servers character varying(45)[],
    vlan_id integer,
    vlan_name character varying(100),
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event_type character varying(100) NOT NULL,
    email_enabled boolean DEFAULT true,
    in_app_enabled boolean DEFAULT true,
    push_enabled boolean DEFAULT false,
    sms_enabled boolean DEFAULT false,
    digest_enabled boolean DEFAULT false,
    digest_frequency character varying(20),
    quiet_hours_enabled boolean DEFAULT false,
    quiet_hours_start time without time zone,
    quiet_hours_end time without time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    event_type character varying(100) NOT NULL,
    subject_template text,
    body_template text NOT NULL,
    body_html_template text,
    send_email boolean DEFAULT true,
    send_in_app boolean DEFAULT true,
    send_push boolean DEFAULT false,
    send_sms boolean DEFAULT false,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255),
    message text,
    link character varying(500),
    entity_type character varying(50),
    entity_id uuid,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: offboarding_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offboarding_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    request_number integer NOT NULL,
    contact_id uuid NOT NULL,
    reason character varying(50) NOT NULL,
    reason_details text,
    last_working_day date NOT NULL,
    access_termination_date date NOT NULL,
    is_immediate boolean DEFAULT false,
    is_security_concern boolean DEFAULT false,
    status character varying(50) DEFAULT 'draft'::character varying,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: offboarding_requests_request_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.offboarding_requests_request_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: offboarding_requests_request_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.offboarding_requests_request_number_seq OWNED BY public.offboarding_requests.request_number;


--
-- Name: offboarding_task_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offboarding_task_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offboarding_id uuid NOT NULL,
    task_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    resource_type character varying(50),
    resource_id uuid,
    assignment_id uuid,
    expected_quantity integer,
    collected_quantity integer,
    assigned_to uuid,
    status character varying(20) DEFAULT 'pending'::character varying,
    priority integer DEFAULT 50,
    completed_by uuid,
    completed_at timestamp with time zone,
    notes text,
    due_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: offboarding_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offboarding_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    offboarding_date date NOT NULL,
    initiated_by uuid,
    reason character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying,
    total_tasks integer DEFAULT 0,
    completed_tasks integer DEFAULT 0,
    last_day date,
    access_revoked_at timestamp with time zone,
    equipment_collected_at timestamp with time zone,
    notes text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: offboarding_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offboarding_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    offboarding_type character varying(100),
    tasks jsonb DEFAULT '[]'::jsonb,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: office_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.office_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(10),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(100),
    postal_code character varying(20),
    country character varying(100),
    location_type character varying(50) DEFAULT 'office'::character varying,
    is_remote boolean DEFAULT false,
    timezone character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    parent_id uuid,
    location_level character varying(50) DEFAULT 'office'::character varying,
    path text,
    depth integer DEFAULT 0,
    latitude numeric(10,8),
    longitude numeric(11,8),
    employee_count integer DEFAULT 0,
    asset_count integer DEFAULT 0
);


--
-- Name: onboarding_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    contact_id uuid,
    user_id uuid,
    job_title_id uuid,
    job_title_name character varying(255),
    department character varying(255),
    start_date date NOT NULL,
    manager_id uuid,
    buddy_id uuid,
    initiated_by uuid NOT NULL,
    location_id uuid,
    ticket_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying,
    total_tasks integer DEFAULT 0,
    completed_tasks integer DEFAULT 0,
    notes text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: onboarding_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    onboarding_request_id uuid NOT NULL,
    task_type character varying(50) NOT NULL,
    task_name character varying(255) NOT NULL,
    description text,
    service_id uuid,
    asset_request_id uuid,
    assigned_to uuid,
    assigned_team character varying(100),
    status character varying(50) DEFAULT 'pending'::character varying,
    completed_by uuid,
    completed_at timestamp with time zone,
    completion_notes text,
    depends_on_task_id uuid,
    due_days_before_start integer DEFAULT 0,
    due_date date,
    priority integer DEFAULT 50,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: onboarding_wizard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_wizard (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    current_step integer DEFAULT 1,
    completed_steps integer[] DEFAULT '{}'::integer[],
    skipped_steps integer[] DEFAULT '{}'::integer[],
    company_name character varying(255),
    industry character varying(50),
    team_size character varying(20),
    primary_use_case character varying(50),
    enable_tickets boolean DEFAULT true,
    enable_kb boolean DEFAULT true,
    enable_assets boolean DEFAULT true,
    enable_credentials boolean DEFAULT true,
    enable_contacts boolean DEFAULT true,
    enable_network_docs boolean DEFAULT false,
    enable_runbooks boolean DEFAULT false,
    enable_sla boolean DEFAULT false,
    wants_email_integration boolean DEFAULT false,
    wants_sso boolean DEFAULT false,
    wants_api_access boolean DEFAULT false,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: operating_systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operating_systems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    platform character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    version character varying(50),
    build character varying(50),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: organization_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    domain character varying(255) NOT NULL,
    domain_type character varying(20) DEFAULT 'internal'::character varying NOT NULL,
    auto_contact_type character varying(20) DEFAULT 'employee'::character varying,
    auto_role_id uuid,
    auto_department character varying(100),
    is_verified boolean DEFAULT false,
    verified_at timestamp with time zone,
    verification_token character varying(100),
    sso_enabled boolean DEFAULT false,
    sso_provider character varying(50),
    sso_config jsonb DEFAULT '{}'::jsonb,
    allow_self_registration boolean DEFAULT true,
    require_email_verification boolean DEFAULT false,
    auto_approve_users boolean DEFAULT true,
    description text,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: organization_feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    feature_key character varying(100) NOT NULL,
    enabled boolean NOT NULL,
    enabled_at timestamp with time zone,
    enabled_by uuid,
    beta_acknowledged boolean DEFAULT false,
    beta_acknowledged_at timestamp with time zone,
    beta_acknowledged_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: organization_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    tickets_enabled boolean DEFAULT true,
    kb_enabled boolean DEFAULT true,
    contacts_enabled boolean DEFAULT true,
    assets_enabled boolean DEFAULT true,
    credentials_enabled boolean DEFAULT true,
    network_docs_enabled boolean DEFAULT false,
    runbooks_enabled boolean DEFAULT false,
    configurations_enabled boolean DEFAULT false,
    ssl_monitoring_enabled boolean DEFAULT false,
    dns_monitoring_enabled boolean DEFAULT false,
    sla_enabled boolean DEFAULT false,
    workflows_enabled boolean DEFAULT false,
    approval_chains_enabled boolean DEFAULT false,
    audit_log_enabled boolean DEFAULT true,
    multi_tenant_enabled boolean DEFAULT false,
    client_portal_enabled boolean DEFAULT false,
    white_label_enabled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    domain character varying(255),
    phone character varying(50),
    email character varying(255),
    address text,
    city character varying(100),
    state character varying(100),
    zip character varying(20),
    country character varying(100),
    website character varying(255),
    logo_url character varying(500),
    timezone character varying(50) DEFAULT 'UTC'::character varying,
    locale character varying(10) DEFAULT 'en-US'::character varying,
    currency character varying(3) DEFAULT 'USD'::character varying,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ui_mode character varying(20) DEFAULT 'standard'::character varying,
    onboarding_completed boolean DEFAULT false,
    onboarding_step integer DEFAULT 0,
    industry character varying(50),
    team_size character varying(20),
    instance_id character varying(50),
    license_key character varying(25),
    telemetry_tier integer DEFAULT 0,
    portal_guidance_enabled boolean DEFAULT true,
    migration_banner_dismissed_at timestamp with time zone
);


--
-- Name: overdue_project_tasks; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.overdue_project_tasks AS
 SELECT t.id,
    t.project_id,
    t.milestone_id,
    t.title,
    t.description,
    t.task_number,
    t.status,
    t.priority,
    t.assigned_to,
    t.reviewer_id,
    t.estimated_hours,
    t.actual_hours,
    t.start_date,
    t.due_date,
    t.completed_at,
    t.depends_on,
    t.blocks,
    t.sort_order,
    t.template_task_id,
    t.ticket_id,
    t.parent_task_id,
    t.tags,
    t.custom_fields,
    t.created_by,
    t.created_at,
    t.updated_at,
    p.name AS project_name,
    p.manager_id,
    (t.due_date - CURRENT_DATE) AS days_overdue
   FROM (public.project_tasks t
     JOIN public.projects p ON ((t.project_id = p.id)))
  WHERE (((t.status)::text <> ALL (ARRAY[('done'::character varying)::text, ('cancelled'::character varying)::text])) AND (t.due_date < CURRENT_DATE))
  ORDER BY t.due_date;


--
-- Name: password_setup_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_setup_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    purpose character varying(16) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT password_setup_tokens_purpose_chk CHECK (((purpose)::text = ANY (ARRAY['invite'::text, 'reset'::text])))
);


--
-- Name: ticket_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    color character varying(20),
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    description_template text,
    subject_prefix character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    parent_id uuid,
    depth smallint DEFAULT 0 NOT NULL,
    CONSTRAINT ticket_categories_max_depth CHECK (((depth >= 0) AND (depth <= 2)))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    first_name character varying(100),
    last_name character varying(100),
    phone character varying(50),
    avatar_url character varying(500),
    role_id uuid,
    auth_method character varying(50) DEFAULT 'local'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    email_verified boolean DEFAULT false,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ui_mode character varying(20),
    show_tooltips boolean DEFAULT true,
    compact_view boolean DEFAULT false,
    keyboard_shortcuts_enabled boolean DEFAULT true,
    external_source character varying(50),
    external_id character varying(255),
    last_synced_at timestamp with time zone,
    contact_id uuid,
    dismissed_banners text[] DEFAULT '{}'::text[],
    dashboard_view_preference character varying(20),
    user_origin character varying(32) DEFAULT 'customer_native'::character varying NOT NULL,
    msp_pairing_key_id uuid,
    disabled_at timestamp with time zone,
    disabled_reason text,
    key_version bigint DEFAULT 0 NOT NULL,
    CONSTRAINT users_user_origin_chk CHECK (((user_origin)::text = ANY ((ARRAY['msp_provisioned'::character varying, 'customer_native'::character varying, 'customer_linked_to_msp'::character varying])::text[])))
);


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    description text,
    icon character varying(50),
    color character varying(20),
    portal_name character varying(100),
    portal_description text,
    welcome_message text,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    is_internal_only boolean DEFAULT false,
    support_email character varying(255),
    email_enabled boolean DEFAULT false,
    default_sla_id uuid,
    auto_assign_enabled boolean DEFAULT false,
    auto_assign_method character varying(50) DEFAULT 'round_robin'::character varying,
    has_separate_kb boolean DEFAULT false,
    kb_public boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: pending_category_requests; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pending_category_requests AS
 SELECT cr.id,
    cr.workspace_id,
    cr.organization_id,
    cr.suggested_name,
    cr.suggested_description,
    cr.suggested_parent_id,
    cr.suggested_base_type,
    cr.requested_by_type,
    cr.requested_by_user_id,
    cr.ai_confidence,
    cr.ai_reasoning,
    cr.sample_ticket_ids,
    cr.sample_ticket_subjects,
    cr.occurrence_count,
    cr.status,
    cr.reviewed_by,
    cr.reviewed_at,
    cr.review_notes,
    cr.created_category_id,
    cr.merged_into_category_id,
    cr.created_at,
    cr.updated_at,
    w.name AS workspace_name,
    pc.name AS parent_category_name,
    (((u.first_name)::text || ' '::text) || (u.last_name)::text) AS requested_by_name
   FROM (((public.category_requests cr
     JOIN public.workspaces w ON ((cr.workspace_id = w.id)))
     LEFT JOIN public.ticket_categories pc ON ((cr.suggested_parent_id = pc.id)))
     LEFT JOIN public.users u ON ((cr.requested_by_user_id = u.id)))
  WHERE ((cr.status)::text = 'pending'::text)
  ORDER BY cr.occurrence_count DESC, cr.created_at DESC;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    ticket_number integer NOT NULL,
    prefix character varying(10) DEFAULT 'TKT'::character varying,
    subject character varying(500) NOT NULL,
    description text,
    source character varying(50) DEFAULT 'portal'::character varying,
    type character varying(50) DEFAULT 'incident'::character varying,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status_id uuid,
    category_id uuid,
    assigned_to uuid,
    assigned_team character varying(100),
    contact_id uuid,
    asset_id uuid,
    location_id uuid,
    due_at timestamp with time zone,
    first_response_at timestamp with time zone,
    resolved_at timestamp with time zone,
    closed_at timestamp with time zone,
    is_billable boolean DEFAULT false,
    time_spent_minutes integer DEFAULT 0,
    is_scheduled boolean DEFAULT false,
    scheduled_for timestamp with time zone,
    is_onsite boolean DEFAULT false,
    external_ticket_number character varying(100),
    external_url character varying(500),
    satisfaction_rating integer,
    satisfaction_feedback text,
    url_key character varying(100),
    tags character varying(100)[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    closed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    type_id uuid,
    resolution_notes text,
    approved_at timestamp with time zone,
    approved_by uuid,
    sla_paused_at timestamp with time zone,
    sla_total_paused_seconds integer DEFAULT 0,
    sla_due_at timestamp with time zone,
    sla_first_response_due_at timestamp with time zone,
    sla_first_response_at timestamp with time zone,
    sla_resolution_due_at timestamp with time zone,
    sla_resolved_at timestamp with time zone,
    sla_breached boolean DEFAULT false,
    request_category public.request_category DEFAULT 'incident'::public.request_category,
    subcategory_id uuid,
    workspace_id uuid,
    team_id uuid,
    ai_triaged boolean DEFAULT false,
    ai_triage_id uuid,
    ai_category_match_id uuid,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid,
    deleted_by_provider_id uuid,
    deleted_by_name character varying(200),
    delete_reason text,
    created_by_provider_id uuid,
    created_by_provider_name character varying(200),
    last_modified_by_provider_id uuid,
    last_modified_by_provider_name character varying(200),
    restored_at timestamp with time zone,
    restored_by_user_id uuid,
    root_cause text,
    resolution_steps text,
    resolution_category character varying(50),
    first_viewed_at timestamp with time zone,
    first_viewed_by uuid,
    embedding public.vector,
    embedding_status character varying(20) DEFAULT 'pending'::character varying,
    embedding_model character varying(100),
    embedded_at timestamp with time zone,
    legal_hold boolean DEFAULT false,
    action_date_type public.action_date_type DEFAULT 'complete_by'::public.action_date_type,
    lead_time_days integer DEFAULT 3,
    scheduling_active_from timestamp with time zone,
    kind character varying(16) DEFAULT 'incident'::character varying NOT NULL,
    requester_email text,
    cc_list text[] DEFAULT '{}'::text[] NOT NULL,
    collaborators text[] DEFAULT '{}'::text[] NOT NULL,
    source_mailbox_id uuid,
    CONSTRAINT chk_lead_time_days CHECK (((lead_time_days >= 1) AND (lead_time_days <= 30))),
    CONSTRAINT tickets_kind_check CHECK (((kind)::text = ANY (ARRAY[('incident'::character varying)::text, ('request'::character varying)::text, ('conversation'::character varying)::text, ('task'::character varying)::text]))),
    CONSTRAINT tickets_satisfaction_rating_check CHECK (((satisfaction_rating >= 1) AND (satisfaction_rating <= 5)))
);


--
-- Name: pending_credential_acknowledgments; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pending_credential_acknowledgments AS
 SELECT cc.id,
    cc.credential_id,
    c.name AS credential_name,
    cc.action,
    cc.provider_name,
    cc.contributor_name,
    cc.service_name,
    cc.account_identifier,
    cc.reason,
    cc.created_at,
    t.subject AS related_ticket_subject
   FROM ((public.credential_contributions cc
     JOIN public.credentials c ON ((cc.credential_id = c.id)))
     LEFT JOIN public.tickets t ON ((cc.related_ticket_id = t.id)))
  WHERE (cc.client_acknowledged = false)
  ORDER BY cc.created_at DESC;


--
-- Name: permission_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(100) NOT NULL,
    resource character varying(50) NOT NULL,
    action character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    risk_level character varying(20) DEFAULT 'low'::character varying,
    requires_approval boolean DEFAULT false,
    category character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: permission_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    risk_level character varying(20) DEFAULT 'low'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    activity_type character varying(50) NOT NULL,
    description text,
    entity_type character varying(50),
    entity_id uuid,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    document_id uuid NOT NULL,
    description text,
    document_type character varying(50),
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    default_status character varying(50) DEFAULT 'planning'::character varying,
    estimated_hours integer,
    task_templates jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    relationship character varying(50) DEFAULT 'related'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: provider_access_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_access_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    permissions text[] DEFAULT '{}'::text[] NOT NULL,
    scope_config jsonb DEFAULT '{}'::jsonb,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true,
    approved_by uuid,
    approved_at timestamp with time zone,
    approval_notes text,
    revoked_by uuid,
    revoked_at timestamp with time zone,
    revocation_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: provider_action_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_action_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    api_key_id uuid NOT NULL,
    provider_name character varying(200),
    provider_user_name character varying(200),
    provider_user_email character varying(255),
    action character varying(100) NOT NULL,
    scope_used character varying(100),
    resource_type character varying(50),
    resource_id uuid,
    resource_name character varying(500),
    request_method character varying(10),
    request_path character varying(500),
    request_body_hash character varying(64),
    response_status integer,
    response_success boolean,
    error_message text,
    ip_address character varying(45),
    user_agent text,
    request_id character varying(100),
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    duration_ms integer,
    fields_accessed text[],
    fields_modified text[],
    old_values jsonb,
    new_values jsonb
);


--
-- Name: provider_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    key_type public.api_key_type DEFAULT 'provider'::public.api_key_type NOT NULL,
    key_prefix character varying(8) NOT NULL,
    key_hash character varying(64) NOT NULL,
    provider_name character varying(200),
    provider_contact_email character varying(255),
    provider_company character varying(200),
    requires_contract boolean DEFAULT true,
    required_contract_id uuid,
    contract_acknowledged boolean DEFAULT false,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    allowed_ips text[],
    allowed_hours_start time without time zone,
    allowed_hours_end time without time zone,
    allowed_days integer[],
    rate_limit_per_minute integer DEFAULT 60,
    rate_limit_per_hour integer DEFAULT 1000,
    rate_limit_per_day integer DEFAULT 10000,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    is_revoked boolean DEFAULT false,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoked_reason text,
    last_used_at timestamp with time zone,
    last_used_ip character varying(45),
    total_requests bigint DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: provider_contract_acknowledgments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_contract_acknowledgments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    api_key_id uuid NOT NULL,
    acknowledged_by_name character varying(200) NOT NULL,
    acknowledged_by_email character varying(255) NOT NULL,
    acknowledged_by_title character varying(100),
    acknowledged_by_company character varying(200),
    acknowledged_at timestamp with time zone DEFAULT now(),
    ip_address character varying(45),
    user_agent text,
    signature_hash character varying(64),
    expires_at timestamp with time zone
);


--
-- Name: provider_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    version character varying(20) DEFAULT '1.0'::character varying NOT NULL,
    summary text NOT NULL,
    full_text text NOT NULL,
    covers_data_access boolean DEFAULT true,
    covers_data_modification boolean DEFAULT false,
    covers_credential_access boolean DEFAULT false,
    covers_user_management boolean DEFAULT false,
    requires_mfa boolean DEFAULT true,
    requires_ip_whitelist boolean DEFAULT false,
    max_session_hours integer DEFAULT 8,
    data_retention_days integer,
    data_export_allowed boolean DEFAULT false,
    data_sharing_allowed boolean DEFAULT false,
    liability_cap_usd numeric(12,2),
    indemnification_required boolean DEFAULT true,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: provider_access_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.provider_access_summary AS
 SELECT k.id,
    k.name,
    k.provider_name,
    k.provider_contact_email,
    k.key_type,
    k.scopes,
    k.is_active,
    k.contract_acknowledged,
    k.last_used_at,
    k.total_requests,
    k.created_at,
    k.expires_at,
    c.name AS contract_name,
    ca.acknowledged_at AS contract_acknowledged_at,
    ( SELECT count(*) AS count
           FROM public.provider_action_log
          WHERE ((provider_action_log.api_key_id = k.id) AND (provider_action_log.started_at > (now() - '24:00:00'::interval)))) AS requests_24h,
    ( SELECT count(*) AS count
           FROM public.provider_action_log
          WHERE ((provider_action_log.api_key_id = k.id) AND (provider_action_log.response_success = false) AND (provider_action_log.started_at > (now() - '24:00:00'::interval)))) AS errors_24h
   FROM ((public.provider_api_keys k
     LEFT JOIN public.provider_contracts c ON ((k.required_contract_id = c.id)))
     LEFT JOIN public.provider_contract_acknowledgments ca ON (((ca.api_key_id = k.id) AND (ca.contract_id = c.id))))
  WHERE (k.is_revoked = false)
  ORDER BY k.last_used_at DESC NULLS LAST;


--
-- Name: provider_contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_contributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider_api_key_id uuid NOT NULL,
    provider_name character varying(200),
    contributor_name character varying(200),
    contributor_email character varying(255),
    action character varying(20) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    entity_name character varying(500),
    fields_changed text[],
    old_values jsonb,
    new_values jsonb,
    change_summary text,
    delete_reason text,
    related_ticket_id uuid,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: provider_contribution_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.provider_contribution_summary AS
 SELECT provider_api_key_id,
    provider_name,
    count(*) FILTER (WHERE ((action)::text = 'create'::text)) AS items_created,
    count(*) FILTER (WHERE ((action)::text = 'update'::text)) AS items_updated,
    count(*) FILTER (WHERE ((action)::text = 'soft_delete'::text)) AS items_deleted,
    count(DISTINCT entity_type) AS entity_types_touched,
    min(created_at) AS first_contribution,
    max(created_at) AS last_contribution
   FROM public.provider_contributions pc
  GROUP BY provider_api_key_id, provider_name;


--
-- Name: provider_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    session_token_hash character varying(64) NOT NULL,
    user_name character varying(200),
    user_email character varying(255),
    started_at timestamp with time zone DEFAULT now(),
    last_activity_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    ip_address character varying(45),
    user_agent text,
    is_active boolean DEFAULT true,
    ended_at timestamp with time zone,
    end_reason character varying(50)
);


--
-- Name: provider_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    external_user_id character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255),
    is_active boolean DEFAULT true,
    last_access_at timestamp with time zone,
    current_session_id character varying(255),
    session_started_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: public_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size bigint NOT NULL,
    storage_key text NOT NULL,
    alt_text character varying(500),
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recent_credential_reveals; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.recent_credential_reveals AS
 SELECT crl.id,
    crl.credential_name,
    crl.revealed_by_type,
    crl.revealed_by_name,
    crl.revealed_by_email,
    crl.reveal_method,
    crl.fields_revealed,
    crl.is_break_glass,
    crl.revealed_at,
    crl.ip_address,
    car.provider_name
   FROM (public.credential_reveal_log crl
     LEFT JOIN public.credential_access_requests car ON ((crl.access_request_id = car.id)))
  ORDER BY crl.revealed_at DESC
 LIMIT 100;


--
-- Name: recent_provider_activity; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.recent_provider_activity AS
 SELECT l.id,
    l.provider_name,
    l.provider_user_name,
    l.action,
    l.resource_type,
    l.resource_name,
    l.response_success,
    l.ip_address,
    l.started_at,
    k.name AS api_key_name
   FROM (public.provider_action_log l
     JOIN public.provider_api_keys k ON ((l.api_key_id = k.id)))
  ORDER BY l.started_at DESC
 LIMIT 100;


--
-- Name: recent_provider_contributions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.recent_provider_contributions AS
 SELECT pc.id,
    pc.provider_name,
    pc.contributor_name,
    pc.action,
    pc.entity_type,
    pc.entity_name,
    pc.change_summary,
    pc.created_at,
    t.subject AS related_ticket_subject
   FROM (public.provider_contributions pc
     LEFT JOIN public.tickets t ON ((pc.related_ticket_id = t.id)))
  ORDER BY pc.created_at DESC
 LIMIT 100;


--
-- Name: recurring_ticket_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_ticket_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recurring_ticket_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: recurring_ticket_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_ticket_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recurring_ticket_id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    scheduled_for date NOT NULL,
    generated_at timestamp with time zone DEFAULT now(),
    was_on_time boolean,
    generation_notes text
);


--
-- Name: recurring_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    template_id uuid,
    frequency character varying(20) NOT NULL,
    day_of_week integer,
    day_of_month integer,
    time_of_day time without time zone,
    next_run_at timestamp with time zone,
    last_run_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: request_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    activity_type character varying(50) NOT NULL,
    user_id uuid,
    old_value text,
    new_value text,
    comment text,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: request_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    workflow_step_id uuid,
    step_order integer,
    approver_id uuid NOT NULL,
    decision character varying(20),
    decision_notes text,
    decided_at timestamp with time zone,
    delegated_from uuid,
    last_reminder_at timestamp with time zone,
    reminder_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: request_subcategories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_subcategories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    category public.request_category NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    default_priority character varying(20) DEFAULT 'medium'::character varying,
    default_assignee_team character varying(100),
    requires_approval boolean DEFAULT false,
    approval_type character varying(50),
    default_sla_id uuid,
    custom_fields jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission_set_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: role_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    permissions text[] DEFAULT '{}'::text[] NOT NULL,
    for_internal_users boolean DEFAULT true,
    for_providers boolean DEFAULT false,
    risk_level character varying(20) DEFAULT 'low'::character varying,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: routing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routing_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    priority integer DEFAULT 100,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    assign_to_team_id uuid,
    assign_to_user_id uuid,
    set_priority character varying(20),
    add_tags text[],
    set_sla_id uuid,
    send_notification boolean DEFAULT false,
    notification_template character varying(100),
    is_active boolean DEFAULT true,
    times_matched integer DEFAULT 0,
    last_matched_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: saas_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saas_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    vendor character varying(255),
    category character varying(100),
    login_url character varying(500),
    admin_url character varying(500),
    sso_enabled boolean DEFAULT false,
    license_type character varying(50),
    total_licenses integer,
    used_licenses integer DEFAULT 0,
    monthly_cost_per_license numeric(10,2),
    currency_code character varying(3) DEFAULT 'USD'::character varying,
    auto_provision boolean DEFAULT false,
    auto_deprovision boolean DEFAULT false,
    provisioning_notes text,
    requires_offboarding_review boolean DEFAULT true,
    data_retention_days integer,
    is_active boolean DEFAULT true,
    account_owner uuid,
    tags character varying(100)[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    credential_type character varying(50) DEFAULT 'admin'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_owners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_owners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    user_id uuid,
    contact_id uuid,
    role_type character varying(50) NOT NULL,
    can_provision boolean DEFAULT false,
    can_deprovision boolean DEFAULT false,
    can_modify_settings boolean DEFAULT false,
    can_view_audit_log boolean DEFAULT false,
    notify_on_provision boolean DEFAULT true,
    notify_on_deprovision boolean DEFAULT true,
    notify_on_issues boolean DEFAULT true,
    is_primary boolean DEFAULT false,
    is_available boolean DEFAULT true,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT service_owner_person CHECK (((user_id IS NOT NULL) OR (contact_id IS NOT NULL)))
);


--
-- Name: service_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider_id character varying(100) NOT NULL,
    provider_name character varying(255) NOT NULL,
    provider_domain character varying(255),
    contact_email character varying(255),
    contact_phone character varying(50),
    status character varying(20) DEFAULT 'pending'::character varying,
    contract_type character varying(50),
    contract_start date,
    contract_end date,
    api_key_hash character varying(255),
    last_api_key_rotation timestamp with time zone,
    require_mfa boolean DEFAULT true,
    ip_whitelist inet[],
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: service_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    request_number integer NOT NULL,
    requester_id uuid NOT NULL,
    requested_for_id uuid,
    catalog_item_id uuid NOT NULL,
    quantity integer DEFAULT 1,
    form_responses jsonb DEFAULT '{}'::jsonb,
    justification text,
    status character varying(20) DEFAULT 'pending_approval'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    current_approval_step integer DEFAULT 1,
    workflow_id uuid,
    submitted_at timestamp with time zone,
    approved_at timestamp with time zone,
    rejected_at timestamp with time zone,
    fulfilled_at timestamp with time zone,
    fulfilled_by uuid,
    fulfillment_notes text,
    ticket_id uuid,
    assignment_id uuid,
    total_cost numeric(10,2),
    cost_approved boolean,
    notes text,
    approved_by uuid,
    rejected_by uuid,
    rejection_reason text,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_requests_request_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_requests_request_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_requests_request_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_requests_request_number_seq OWNED BY public.service_requests.request_number;


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    company_id uuid,
    name character varying(255) NOT NULL,
    description text,
    category_id uuid,
    price numeric(10,2),
    currency_code character varying(3) DEFAULT 'USD'::character varying,
    frequency character varying(20),
    billing_day integer,
    start_date date,
    end_date date,
    next_billing_date date,
    status character varying(50) DEFAULT 'active'::character varying,
    last_billed_at timestamp with time zone,
    notes text,
    tags character varying(100)[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    id text NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    "ipAddress" text,
    "userAgent" text,
    "userId" text NOT NULL,
    "impersonatedBy" text
);


--
-- Name: setup_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setup_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    industry character varying(50),
    team_size character varying(20),
    ticket_categories jsonb DEFAULT '[]'::jsonb,
    ticket_statuses jsonb DEFAULT '[]'::jsonb,
    kb_folders jsonb DEFAULT '[]'::jsonb,
    asset_types jsonb DEFAULT '[]'::jsonb,
    user_roles jsonb DEFAULT '[]'::jsonb,
    features_to_enable text[],
    recommended_ui_mode character varying(20) DEFAULT 'standard'::character varying,
    is_default boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    key character varying(100) NOT NULL,
    value text,
    value_type character varying(20) DEFAULT 'string'::character varying,
    description text,
    is_sensitive boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: smtp_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smtp_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider character varying(50) DEFAULT 'smtp'::character varying,
    smtp_host character varying(255),
    smtp_port integer DEFAULT 587,
    smtp_username character varying(255),
    smtp_password_encrypted text,
    smtp_encryption character varying(20) DEFAULT 'tls'::character varying,
    api_key_encrypted text,
    api_endpoint character varying(500),
    from_email character varying(255) NOT NULL,
    from_name character varying(255),
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT true,
    last_test_at timestamp with time zone,
    last_test_result character varying(20),
    last_test_error text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: software; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.software (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    version character varying(100),
    vendor character varying(255),
    type character varying(50),
    license_type character varying(50),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: software_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.software_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    software_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid,
    notes text
);


--
-- Name: support_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) DEFAULT 'Support Chat'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    sender_type character varying(20) NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_messages_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('model'::character varying)::text]))),
    CONSTRAINT support_messages_sender_type_check CHECK (((sender_type)::text = ANY (ARRAY[('user'::character varying)::text, ('bot'::character varying)::text])))
);


--
-- Name: system_install; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_install (
    id integer DEFAULT 1 NOT NULL,
    instance_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    installed_at timestamp with time zone DEFAULT now() NOT NULL,
    key_rotated_at timestamp with time zone,
    CONSTRAINT system_install_id_check CHECK ((id = 1))
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(7) DEFAULT '#6366f1'::character varying,
    icon character varying(50),
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: task_checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    title character varying(500) NOT NULL,
    is_completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    completed_by uuid,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    content text NOT NULL,
    is_internal boolean DEFAULT false,
    mentioned_users uuid[],
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: task_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_time_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    hours numeric(6,2) NOT NULL,
    description text,
    is_billable boolean DEFAULT true,
    hourly_rate numeric(10,2),
    work_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: team_backlog_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_backlog_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    team_id uuid,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100),
    status character varying(20) DEFAULT 'backlog'::character varying NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying,
    submitted_by uuid,
    review_by timestamp with time zone DEFAULT (now() + '30 days'::interval),
    converted_ticket_id uuid,
    abort_reason character varying(50),
    abort_notes text,
    aborted_by uuid,
    aborted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_backlog_abort_reason CHECK ((((status)::text <> 'aborted'::text) OR (abort_reason IS NOT NULL))),
    CONSTRAINT chk_backlog_status CHECK (((status)::text = ANY (ARRAY[('backlog'::character varying)::text, ('planning'::character varying)::text, ('converted'::character varying)::text, ('done'::character varying)::text, ('aborted'::character varying)::text])))
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid,
    contact_id uuid,
    role character varying(50) DEFAULT 'member'::character varying,
    is_team_lead boolean DEFAULT false,
    max_open_tickets integer DEFAULT 20,
    current_ticket_count integer DEFAULT 0,
    skills text[],
    is_available boolean DEFAULT true,
    out_of_office_until date,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT team_member_person CHECK (((user_id IS NOT NULL) OR (contact_id IS NOT NULL)))
);


--
-- Name: team_workload; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.team_workload AS
SELECT
    NULL::uuid AS team_id,
    NULL::uuid AS workspace_id,
    NULL::character varying(100) AS team_name,
    NULL::integer AS tier_level,
    NULL::bigint AS member_count,
    NULL::bigint AS total_tickets,
    NULL::bigint AS total_capacity,
    NULL::numeric AS utilization_percentage,
    NULL::bigint AS available_agents;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    description text,
    parent_team_id uuid,
    escalation_team_id uuid,
    tier_level integer DEFAULT 1,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    auto_assign_enabled boolean DEFAULT true,
    auto_assign_method character varying(50) DEFAULT 'round_robin'::character varying,
    working_hours jsonb DEFAULT '{}'::jsonb,
    timezone character varying(50) DEFAULT 'UTC'::character varying,
    skills text[],
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: telemetry_consent_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telemetry_consent_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    action character varying(20) NOT NULL,
    source character varying(40) NOT NULL,
    prev_state character varying(20) NOT NULL,
    new_state character varying(20) NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT telemetry_consent_log_action_chk CHECK (((action)::text = ANY ((ARRAY['acknowledged'::character varying, 'enabled'::character varying, 'disabled'::character varying])::text[]))),
    CONSTRAINT telemetry_consent_log_new_state_chk CHECK (((new_state)::text = ANY ((ARRAY['on'::character varying, 'off'::character varying])::text[]))),
    CONSTRAINT telemetry_consent_log_prev_state_chk CHECK (((prev_state)::text = ANY ((ARRAY['on'::character varying, 'off'::character varying, 'default-on'::character varying])::text[]))),
    CONSTRAINT telemetry_consent_log_source_chk CHECK (((source)::text = ANY ((ARRAY['setup_wizard'::character varying, 'settings_ui'::character varying, 'env_var'::character varying, 'retroactive_pre_consent_release'::character varying])::text[])))
);


--
-- Name: telemetry_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telemetry_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    tier integer NOT NULL,
    event_type character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    response_code integer,
    error_message text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: telemetry_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telemetry_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_user_id uuid
);


--
-- Name: ticket_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    workflow_step_id uuid,
    step_order integer,
    approver_id uuid NOT NULL,
    decision character varying(20),
    decision_notes text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    is_primary boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: ticket_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    reply_id uuid,
    filename character varying(255) NOT NULL,
    original_filename character varying(255),
    file_path character varying(500),
    file_size bigint,
    mime_type character varying(100),
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_closure_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_closure_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    applies_to_type_id uuid,
    applies_to_priority character varying(20)[],
    require_time_entry boolean DEFAULT false,
    minimum_time_minutes integer,
    require_resolution_notes boolean DEFAULT true,
    require_customer_confirmation boolean DEFAULT false,
    require_approval boolean DEFAULT false,
    validation_query text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_document_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_document_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    document_id uuid NOT NULL,
    link_type character varying(50) DEFAULT 'reference'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: ticket_field_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_field_changes (
    id bigint NOT NULL,
    organization_id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    field_name character varying(100) NOT NULL,
    old_value text,
    new_value text,
    changed_by uuid,
    change_source character varying(20) DEFAULT 'user'::character varying NOT NULL,
    change_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_field_changes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_field_changes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_field_changes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_field_changes_id_seq OWNED BY public.ticket_field_changes.id;


--
-- Name: ticket_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    field_name character varying(100),
    old_value text,
    new_value text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_kb_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_kb_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    kb_article_id uuid NOT NULL,
    link_type character varying(50) DEFAULT 'reference'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: ticket_queue_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_queue_scores (
    ticket_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    action_state character varying(30) DEFAULT 'new_unreviewed'::character varying NOT NULL,
    confidence numeric(3,2),
    priority_weight smallint DEFAULT 50 NOT NULL,
    sla_urgency smallint DEFAULT 0 NOT NULL,
    action_boost smallint DEFAULT 0 NOT NULL,
    wait_time_factor smallint DEFAULT 0 NOT NULL,
    customer_impact smallint DEFAULT 0 NOT NULL,
    base_score smallint GENERATED ALWAYS AS (((((((priority_weight * 3) + (sla_urgency * 4)) + (action_boost * 2)) + wait_time_factor) + customer_impact) / 11)) STORED,
    reasoning text,
    scored_at timestamp with time zone DEFAULT now(),
    last_scored_by character varying(20) DEFAULT 'heuristic'::character varying
);


--
-- Name: ticket_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    source_ticket_id uuid NOT NULL,
    target_ticket_id uuid NOT NULL,
    relation_type character varying(50) DEFAULT 'related'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT ticket_relations_no_self CHECK ((source_ticket_id <> target_ticket_id))
);


--
-- Name: ticket_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid,
    contact_id uuid,
    content text NOT NULL,
    content_html text,
    is_internal boolean DEFAULT false,
    time_spent_minutes integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    outbound_message_id text,
    inbound_message_id text,
    source_mailbox_id uuid,
    via_pairing_key_id uuid,
    msp_actor_email character varying(320)
);


--
-- Name: COLUMN ticket_replies.via_pairing_key_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ticket_replies.via_pairing_key_id IS 'MSP pairing key that authored this reply via /api/v1/mtp/tickets/{id}/comment. NULL for replies authored inside this install. Drives the msp actor_type and the D8 cross-MSP internal-note filter.';


--
-- Name: COLUMN ticket_replies.msp_actor_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ticket_replies.msp_actor_email IS 'Asserted acting MSP technician (X-Aegis-Acting-User-Email). Denormalised so authorship survives the tech having no local user row and the pairing key later being revoked.';


--
-- Name: ticket_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    from_status_id uuid,
    to_status_id uuid NOT NULL,
    changed_by uuid,
    reason text,
    sla_paused_seconds_at_change integer DEFAULT 0,
    sla_was_paused boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(20) DEFAULT '#6B7280'::character varying,
    icon character varying(50),
    display_order integer DEFAULT 0,
    is_default boolean DEFAULT false,
    is_closed boolean DEFAULT false,
    sla_paused boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    mapped_state character varying(20) DEFAULT 'open'::character varying,
    requires_time_entry boolean DEFAULT false,
    requires_resolution boolean DEFAULT false,
    auto_close_days integer,
    base_status public.ticket_base_status DEFAULT 'open'::public.ticket_base_status NOT NULL,
    is_system boolean DEFAULT false,
    is_enabled boolean DEFAULT true,
    sort_order integer DEFAULT 0
);


--
-- Name: ticket_status_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ticket_status_summary AS
 SELECT t.organization_id,
    ts.mapped_state,
    ts.name AS status_name,
    count(*) AS ticket_count,
    (avg((EXTRACT(epoch FROM (COALESCE(t.closed_at, now()) - t.created_at)) / (3600)::numeric)))::integer AS avg_age_hours
   FROM (public.tickets t
     JOIN public.ticket_statuses ts ON ((t.status_id = ts.id)))
  GROUP BY t.organization_id, ts.mapped_state, ts.name;


--
-- Name: ticket_status_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_status_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(7) NOT NULL,
    icon character varying(50),
    description text,
    base_status public.ticket_base_status NOT NULL,
    sla_paused boolean DEFAULT false,
    is_default boolean DEFAULT false,
    is_system boolean DEFAULT false,
    sort_order integer DEFAULT 0
);


--
-- Name: ticket_status_transitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_status_transitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    from_status_id uuid,
    to_status_id uuid NOT NULL,
    allowed_roles uuid[],
    allowed_for_creator boolean DEFAULT true,
    requires_comment boolean DEFAULT false,
    requires_time_entry boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_tags (
    ticket_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: ticket_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    is_completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    completed_by uuid,
    sort_order integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    is_required boolean DEFAULT false,
    assigned_to uuid,
    description text,
    service_category character varying(100),
    template_id uuid,
    template_item_id uuid
);


--
-- Name: ticket_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    subject character varying(500),
    description text,
    category_id uuid,
    priority character varying(20),
    assign_to uuid,
    tags character varying(100)[],
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_time_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid NOT NULL,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    duration_minutes integer NOT NULL,
    description text,
    work_type character varying(50),
    is_billable boolean DEFAULT true,
    billing_rate numeric(10,2),
    billed boolean DEFAULT false,
    billed_at timestamp with time zone,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    color character varying(20),
    default_priority character varying(20) DEFAULT 'medium'::character varying,
    default_category_id uuid,
    requires_approval boolean DEFAULT false,
    approval_workflow_id uuid,
    requires_time_entry boolean DEFAULT false,
    requires_resolution boolean DEFAULT true,
    minimum_time_minutes integer,
    sla_response_minutes integer,
    sla_resolution_minutes integer,
    description_template text,
    required_fields jsonb DEFAULT '[]'::jsonb,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_watchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_watchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid,
    contact_id uuid,
    email character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tickets_ticket_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tickets_ticket_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets_ticket_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tickets_ticket_number_seq OWNED BY public.tickets.ticket_number;


--
-- Name: training_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    article_id uuid NOT NULL,
    attempt_number integer DEFAULT 1 NOT NULL,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_questions integer DEFAULT 0 NOT NULL,
    correct_answers integer DEFAULT 0 NOT NULL,
    score numeric(5,2) DEFAULT 0 NOT NULL,
    passed boolean DEFAULT false NOT NULL,
    passing_score numeric(5,2) DEFAULT 80 NOT NULL,
    time_spent_seconds integer DEFAULT 0,
    completed_at timestamp with time zone DEFAULT now(),
    assessment_hash text
);


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean DEFAULT false,
    image text,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    role text DEFAULT 'user'::text,
    "twoFactorEnabled" boolean DEFAULT false,
    "twoFactorSecret" text,
    "twoFactorBackupCodes" text,
    banned boolean DEFAULT false,
    "banReason" text,
    "banExpires" timestamp without time zone
);


--
-- Name: user_accessory_return_rates; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_accessory_return_rates AS
 SELECT ua.organization_id,
    u.id AS user_id,
    (((u.first_name)::text || ' '::text) || (u.last_name)::text) AS user_name,
    u.email,
    count(*) FILTER (WHERE ((ua.status)::text <> 'active'::text)) AS total_completed_assignments,
    count(*) FILTER (WHERE ((ua.status)::text = 'returned'::text)) AS total_returned,
    count(*) FILTER (WHERE ((ua.status)::text <> ALL (ARRAY[('active'::character varying)::text, ('returned'::character varying)::text, ('transferred'::character varying)::text]))) AS total_not_returned,
        CASE
            WHEN (count(*) FILTER (WHERE ((ua.status)::text <> 'active'::text)) > 0) THEN round((((count(*) FILTER (WHERE ((ua.status)::text = 'returned'::text)))::numeric * 100.0) / (count(*) FILTER (WHERE ((ua.status)::text <> 'active'::text)))::numeric), 1)
            ELSE (100)::numeric
        END AS return_rate_percent,
    COALESCE(sum((a.unit_cost * ((ua.quantity - COALESCE(ua.returned_quantity, 0)))::numeric)) FILTER (WHERE ((ua.status)::text <> ALL (ARRAY[('active'::character varying)::text, ('returned'::character varying)::text, ('transferred'::character varying)::text]))), (0)::numeric) AS unreturned_value
   FROM ((public.user_assignments ua
     JOIN public.users u ON ((ua.user_id = u.id)))
     LEFT JOIN public.accessories a ON (((ua.resource_id = a.id) AND ((ua.resource_type)::text = 'accessory'::text))))
  WHERE ((ua.resource_type)::text = 'accessory'::text)
  GROUP BY ua.organization_id, u.id, u.first_name, u.last_name, u.email;


--
-- Name: user_assignment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_assignment_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    old_value jsonb,
    new_value jsonb,
    performed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_delegations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_delegations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    delegator_id uuid NOT NULL,
    delegate_id uuid NOT NULL,
    scope character varying(30) DEFAULT 'queue'::character varying NOT NULL,
    reason text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    CONSTRAINT no_self_delegation CHECK ((delegator_id <> delegate_id)),
    CONSTRAINT valid_date_range CHECK ((ends_at > starts_at))
);


--
-- Name: user_group_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_group_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    group_id uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying,
    joined_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    added_by uuid,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    group_type character varying(50) NOT NULL,
    parent_id uuid,
    path character varying(1000),
    depth integer DEFAULT 0,
    owner_id uuid,
    can_request_for_members boolean DEFAULT true,
    can_approve_for_members boolean DEFAULT true,
    inherit_parent_permissions boolean DEFAULT true,
    external_id character varying(255),
    external_source character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_help_dismissals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_help_dismissals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    help_id uuid NOT NULL,
    dismissed_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    is_archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    permissions jsonb DEFAULT '[]'::jsonb,
    is_system boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_service_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_service_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    service_id uuid NOT NULL,
    access_level character varying(50) DEFAULT 'user'::character varying,
    license_type character varying(50),
    username character varying(255),
    granted_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    granted_by uuid,
    revoked_by uuid,
    revocation_reason text,
    access_request_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(500) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    is_completed boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    completed_at timestamp with time zone,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: v_feature_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_feature_summary AS
 SELECT category,
    status,
    count(*) AS feature_count,
    array_agg(feature_key ORDER BY feature_name) AS features
   FROM public.feature_registry
  GROUP BY category, status
  ORDER BY
        CASE category
            WHEN 'core'::text THEN 1
            WHEN 'standard'::text THEN 2
            WHEN 'advanced'::text THEN 3
            WHEN 'enterprise'::text THEN 4
            ELSE NULL::integer
        END,
        CASE status
            WHEN 'stable'::text THEN 1
            WHEN 'beta'::text THEN 2
            WHEN 'alpha'::text THEN 3
            WHEN 'coming_soon'::text THEN 4
            WHEN 'deprecated'::text THEN 5
            ELSE NULL::integer
        END;


--
-- Name: v_training_best_attempt; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_training_best_attempt AS
 SELECT DISTINCT ON (user_id, article_id) organization_id,
    user_id,
    article_id,
    score,
    passed,
    attempt_number,
    completed_at,
    assessment_hash
   FROM public.training_completions
  ORDER BY user_id, article_id, score DESC, completed_at DESC;


--
-- Name: verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now()
);


--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid,
    contact_id uuid,
    role character varying(50) DEFAULT 'agent'::character varying NOT NULL,
    can_view_all_tickets boolean DEFAULT false,
    can_assign_tickets boolean DEFAULT false,
    can_close_tickets boolean DEFAULT true,
    can_manage_kb boolean DEFAULT false,
    can_view_reports boolean DEFAULT false,
    notify_new_tickets boolean DEFAULT true,
    notify_assignments boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workspace_member_person CHECK (((user_id IS NOT NULL) OR (contact_id IS NOT NULL)))
);


--
-- Name: api_key_usage_logs_2026_03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs ATTACH PARTITION public.api_key_usage_logs_2026_03 FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');


--
-- Name: api_key_usage_logs_2026_04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs ATTACH PARTITION public.api_key_usage_logs_2026_04 FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');


--
-- Name: api_key_usage_logs_2026_05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs ATTACH PARTITION public.api_key_usage_logs_2026_05 FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');


--
-- Name: api_key_usage_logs_2026_06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs ATTACH PARTITION public.api_key_usage_logs_2026_06 FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');


--
-- Name: api_key_usage_logs_2026_07; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs ATTACH PARTITION public.api_key_usage_logs_2026_07 FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');


--
-- Name: api_key_usage_logs_2026_08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs ATTACH PARTITION public.api_key_usage_logs_2026_08 FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');


--
-- Name: api_key_usage_logs_2026_09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs ATTACH PARTITION public.api_key_usage_logs_2026_09 FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');


--
-- Name: api_key_usage_logs_2026_10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs ATTACH PARTITION public.api_key_usage_logs_2026_10 FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');


--
-- Name: api_key_usage_logs_2026_11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs ATTACH PARTITION public.api_key_usage_logs_2026_11 FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');


--
-- Name: access_requests request_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests ALTER COLUMN request_number SET DEFAULT nextval('public.access_requests_request_number_seq'::regclass);


--
-- Name: asset_requests request_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_requests ALTER COLUMN request_number SET DEFAULT nextval('public.asset_requests_request_number_seq'::regclass);


--
-- Name: inbound_email_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_email_log ALTER COLUMN id SET DEFAULT nextval('public.inbound_email_log_id_seq'::regclass);


--
-- Name: incidents incident_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents ALTER COLUMN incident_number SET DEFAULT nextval('public.incidents_incident_number_seq'::regclass);


--
-- Name: offboarding_requests request_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_requests ALTER COLUMN request_number SET DEFAULT nextval('public.offboarding_requests_request_number_seq'::regclass);


--
-- Name: service_requests request_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests ALTER COLUMN request_number SET DEFAULT nextval('public.service_requests_request_number_seq'::regclass);


--
-- Name: ticket_field_changes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_field_changes ALTER COLUMN id SET DEFAULT nextval('public.ticket_field_changes_id_seq'::regclass);


--
-- Name: tickets ticket_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets ALTER COLUMN ticket_number SET DEFAULT nextval('public.tickets_ticket_number_seq'::regclass);


--
-- Name: access_profile_items access_profile_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_profile_items
    ADD CONSTRAINT access_profile_items_pkey PRIMARY KEY (id);


--
-- Name: access_profiles access_profiles_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_profiles
    ADD CONSTRAINT access_profiles_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: access_profiles access_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_profiles
    ADD CONSTRAINT access_profiles_pkey PRIMARY KEY (id);


--
-- Name: access_request_comments access_request_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_request_comments
    ADD CONSTRAINT access_request_comments_pkey PRIMARY KEY (id);


--
-- Name: access_requests access_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_pkey PRIMARY KEY (id);


--
-- Name: accessories accessories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_pkey PRIMARY KEY (id);


--
-- Name: accessory_disposals accessory_disposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_disposals
    ADD CONSTRAINT accessory_disposals_pkey PRIMARY KEY (id);


--
-- Name: accessory_inventory_transactions accessory_inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_inventory_transactions
    ADD CONSTRAINT accessory_inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: accessory_models accessory_models_organization_id_model_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_models
    ADD CONSTRAINT accessory_models_organization_id_model_number_key UNIQUE (organization_id, model_number);


--
-- Name: accessory_models accessory_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_models
    ADD CONSTRAINT accessory_models_pkey PRIMARY KEY (id);


--
-- Name: accessory_purchase_order_items accessory_purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_purchase_order_items
    ADD CONSTRAINT accessory_purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: accessory_purchase_orders accessory_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_purchase_orders
    ADD CONSTRAINT accessory_purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: ai_action_executions ai_action_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_action_executions
    ADD CONSTRAINT ai_action_executions_pkey PRIMARY KEY (id);


--
-- Name: ai_actions ai_actions_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_actions
    ADD CONSTRAINT ai_actions_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: ai_actions ai_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_actions
    ADD CONSTRAINT ai_actions_pkey PRIMARY KEY (id);


--
-- Name: ai_category_matches ai_category_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_category_matches
    ADD CONSTRAINT ai_category_matches_pkey PRIMARY KEY (id);


--
-- Name: ai_chat_data_access_log ai_chat_data_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_data_access_log
    ADD CONSTRAINT ai_chat_data_access_log_pkey PRIMARY KEY (id);


--
-- Name: ai_chat_messages ai_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_messages
    ADD CONSTRAINT ai_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_chat_sessions ai_chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_sessions
    ADD CONSTRAINT ai_chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: ai_data_access_policies ai_data_access_policies_organization_id_context_level_resou_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_data_access_policies
    ADD CONSTRAINT ai_data_access_policies_organization_id_context_level_resou_key UNIQUE (organization_id, context_level, resource_type);


--
-- Name: ai_data_access_policies ai_data_access_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_data_access_policies
    ADD CONSTRAINT ai_data_access_policies_pkey PRIMARY KEY (id);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_presets ai_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_presets
    ADD CONSTRAINT ai_presets_pkey PRIMARY KEY (id);


--
-- Name: ai_providers ai_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_providers
    ADD CONSTRAINT ai_providers_pkey PRIMARY KEY (id);


--
-- Name: ai_settings ai_settings_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_organization_id_key UNIQUE (organization_id);


--
-- Name: ai_settings ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_pkey PRIMARY KEY (id);


--
-- Name: ai_triage_config ai_triage_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_triage_config
    ADD CONSTRAINT ai_triage_config_pkey PRIMARY KEY (id);


--
-- Name: ai_triage_config ai_triage_config_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_triage_config
    ADD CONSTRAINT ai_triage_config_workspace_id_key UNIQUE (workspace_id);


--
-- Name: ai_triage_results ai_triage_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_triage_results
    ADD CONSTRAINT ai_triage_results_pkey PRIMARY KEY (id);


--
-- Name: alert_correlation_rules alert_correlation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_correlation_rules
    ADD CONSTRAINT alert_correlation_rules_pkey PRIMARY KEY (id);


--
-- Name: alert_integrations alert_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_integrations
    ADD CONSTRAINT alert_integrations_pkey PRIMARY KEY (id);


--
-- Name: alert_notification_rules alert_notification_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_notification_rules
    ADD CONSTRAINT alert_notification_rules_pkey PRIMARY KEY (id);


--
-- Name: alert_suppression_rules alert_suppression_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_suppression_rules
    ADD CONSTRAINT alert_suppression_rules_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: api_key_usage_logs api_key_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs
    ADD CONSTRAINT api_key_usage_logs_pkey PRIMARY KEY (id, created_at);


--
-- Name: api_key_usage_logs_2026_03 api_key_usage_logs_2026_03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs_2026_03
    ADD CONSTRAINT api_key_usage_logs_2026_03_pkey PRIMARY KEY (id, created_at);


--
-- Name: api_key_usage_logs_2026_04 api_key_usage_logs_2026_04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs_2026_04
    ADD CONSTRAINT api_key_usage_logs_2026_04_pkey PRIMARY KEY (id, created_at);


--
-- Name: api_key_usage_logs_2026_05 api_key_usage_logs_2026_05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs_2026_05
    ADD CONSTRAINT api_key_usage_logs_2026_05_pkey PRIMARY KEY (id, created_at);


--
-- Name: api_key_usage_logs_2026_06 api_key_usage_logs_2026_06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs_2026_06
    ADD CONSTRAINT api_key_usage_logs_2026_06_pkey PRIMARY KEY (id, created_at);


--
-- Name: api_key_usage_logs_2026_07 api_key_usage_logs_2026_07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs_2026_07
    ADD CONSTRAINT api_key_usage_logs_2026_07_pkey PRIMARY KEY (id, created_at);


--
-- Name: api_key_usage_logs_2026_08 api_key_usage_logs_2026_08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs_2026_08
    ADD CONSTRAINT api_key_usage_logs_2026_08_pkey PRIMARY KEY (id, created_at);


--
-- Name: api_key_usage_logs_2026_09 api_key_usage_logs_2026_09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs_2026_09
    ADD CONSTRAINT api_key_usage_logs_2026_09_pkey PRIMARY KEY (id, created_at);


--
-- Name: api_key_usage_logs_2026_10 api_key_usage_logs_2026_10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs_2026_10
    ADD CONSTRAINT api_key_usage_logs_2026_10_pkey PRIMARY KEY (id, created_at);


--
-- Name: api_key_usage_logs_2026_11 api_key_usage_logs_2026_11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_usage_logs_2026_11
    ADD CONSTRAINT api_key_usage_logs_2026_11_pkey PRIMARY KEY (id, created_at);


--
-- Name: api_keys_legacy_permissions_backup api_keys_legacy_permissions_backup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys_legacy_permissions_backup
    ADD CONSTRAINT api_keys_legacy_permissions_backup_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: api_scopes api_scopes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_scopes
    ADD CONSTRAINT api_scopes_pkey PRIMARY KEY (id);


--
-- Name: api_scopes api_scopes_scope_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_scopes
    ADD CONSTRAINT api_scopes_scope_key UNIQUE (scope);


--
-- Name: applications applications_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: approval_steps approval_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_pkey PRIMARY KEY (id);


--
-- Name: approval_steps approval_steps_workflow_id_step_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_workflow_id_step_number_key UNIQUE (workflow_id, step_number);


--
-- Name: approval_workflow_steps approval_workflow_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflow_steps
    ADD CONSTRAINT approval_workflow_steps_pkey PRIMARY KEY (id);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: asset_contacts asset_contacts_asset_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_contacts
    ADD CONSTRAINT asset_contacts_asset_id_contact_id_key UNIQUE (asset_id, contact_id);


--
-- Name: asset_contacts asset_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_contacts
    ADD CONSTRAINT asset_contacts_pkey PRIMARY KEY (id);


--
-- Name: asset_credentials asset_credentials_asset_id_credential_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_credentials
    ADD CONSTRAINT asset_credentials_asset_id_credential_id_key UNIQUE (asset_id, credential_id);


--
-- Name: asset_credentials asset_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_credentials
    ADD CONSTRAINT asset_credentials_pkey PRIMARY KEY (id);


--
-- Name: asset_documents asset_documents_asset_id_document_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_documents
    ADD CONSTRAINT asset_documents_asset_id_document_id_key UNIQUE (asset_id, document_id);


--
-- Name: asset_documents asset_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_documents
    ADD CONSTRAINT asset_documents_pkey PRIMARY KEY (id);


--
-- Name: asset_files asset_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_files
    ADD CONSTRAINT asset_files_pkey PRIMARY KEY (id);


--
-- Name: asset_history asset_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_pkey PRIMARY KEY (id);


--
-- Name: asset_import_items asset_import_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_import_items
    ADD CONSTRAINT asset_import_items_pkey PRIMARY KEY (id);


--
-- Name: asset_import_jobs asset_import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_import_jobs
    ADD CONSTRAINT asset_import_jobs_pkey PRIMARY KEY (id);


--
-- Name: asset_interfaces asset_interfaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_interfaces
    ADD CONSTRAINT asset_interfaces_pkey PRIMARY KEY (id);


--
-- Name: asset_models asset_models_organization_id_asset_subtype_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_models
    ADD CONSTRAINT asset_models_organization_id_asset_subtype_id_name_key UNIQUE (organization_id, asset_subtype_id, name);


--
-- Name: asset_models asset_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_models
    ADD CONSTRAINT asset_models_pkey PRIMARY KEY (id);


--
-- Name: asset_naming_templates asset_naming_templates_organization_id_asset_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_naming_templates
    ADD CONSTRAINT asset_naming_templates_organization_id_asset_type_id_key UNIQUE (organization_id, asset_type_id);


--
-- Name: asset_naming_templates asset_naming_templates_organization_id_prefix_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_naming_templates
    ADD CONSTRAINT asset_naming_templates_organization_id_prefix_key UNIQUE (organization_id, prefix);


--
-- Name: asset_naming_templates asset_naming_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_naming_templates
    ADD CONSTRAINT asset_naming_templates_pkey PRIMARY KEY (id);


--
-- Name: asset_request_tiers asset_request_tiers_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_request_tiers
    ADD CONSTRAINT asset_request_tiers_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: asset_request_tiers asset_request_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_request_tiers
    ADD CONSTRAINT asset_request_tiers_pkey PRIMARY KEY (id);


--
-- Name: asset_requests asset_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_requests
    ADD CONSTRAINT asset_requests_pkey PRIMARY KEY (id);


--
-- Name: asset_retrieval_assignments asset_retrieval_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_retrieval_assignments
    ADD CONSTRAINT asset_retrieval_assignments_pkey PRIMARY KEY (id);


--
-- Name: asset_software asset_software_asset_id_software_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_software
    ADD CONSTRAINT asset_software_asset_id_software_id_key UNIQUE (asset_id, software_id);


--
-- Name: asset_software asset_software_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_software
    ADD CONSTRAINT asset_software_pkey PRIMARY KEY (id);


--
-- Name: asset_status_requestability asset_status_requestability_organization_id_status_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_status_requestability
    ADD CONSTRAINT asset_status_requestability_organization_id_status_name_key UNIQUE (organization_id, status_name);


--
-- Name: asset_status_requestability asset_status_requestability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_status_requestability
    ADD CONSTRAINT asset_status_requestability_pkey PRIMARY KEY (id);


--
-- Name: asset_subtypes asset_subtypes_organization_id_asset_type_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_subtypes
    ADD CONSTRAINT asset_subtypes_organization_id_asset_type_id_slug_key UNIQUE (organization_id, asset_type_id, slug);


--
-- Name: asset_subtypes asset_subtypes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_subtypes
    ADD CONSTRAINT asset_subtypes_pkey PRIMARY KEY (id);


--
-- Name: asset_tags asset_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_tags
    ADD CONSTRAINT asset_tags_pkey PRIMARY KEY (asset_id, tag_id);


--
-- Name: asset_tickets asset_tickets_asset_id_ticket_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_tickets
    ADD CONSTRAINT asset_tickets_asset_id_ticket_id_key UNIQUE (asset_id, ticket_id);


--
-- Name: asset_tickets asset_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_tickets
    ADD CONSTRAINT asset_tickets_pkey PRIMARY KEY (id);


--
-- Name: asset_types asset_types_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_types
    ADD CONSTRAINT asset_types_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: asset_types asset_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_types
    ADD CONSTRAINT asset_types_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: backlog_comments backlog_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backlog_comments
    ADD CONSTRAINT backlog_comments_pkey PRIMARY KEY (id);


--
-- Name: badge_retrieval_assignments badge_retrieval_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badge_retrieval_assignments
    ADD CONSTRAINT badge_retrieval_assignments_pkey PRIMARY KEY (id);


--
-- Name: break_glass_incidents break_glass_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_incidents
    ADD CONSTRAINT break_glass_incidents_pkey PRIMARY KEY (id);


--
-- Name: bulk_access_operations bulk_access_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_access_operations
    ADD CONSTRAINT bulk_access_operations_pkey PRIMARY KEY (id);


--
-- Name: cascade_revocation_queue cascade_revocation_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cascade_revocation_queue
    ADD CONSTRAINT cascade_revocation_queue_pkey PRIMARY KEY (id);


--
-- Name: catalog_bundles catalog_bundles_bundle_item_id_included_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_bundles
    ADD CONSTRAINT catalog_bundles_bundle_item_id_included_item_id_key UNIQUE (bundle_item_id, included_item_id);


--
-- Name: catalog_bundles catalog_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_bundles
    ADD CONSTRAINT catalog_bundles_pkey PRIMARY KEY (id);


--
-- Name: catalog_categories catalog_categories_organization_id_name_parent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT catalog_categories_organization_id_name_parent_id_key UNIQUE (organization_id, name, parent_id);


--
-- Name: catalog_categories catalog_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT catalog_categories_pkey PRIMARY KEY (id);


--
-- Name: catalog_items catalog_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_items
    ADD CONSTRAINT catalog_items_pkey PRIMARY KEY (id);


--
-- Name: category_requests category_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_requests
    ADD CONSTRAINT category_requests_pkey PRIMARY KEY (id);


--
-- Name: certificate_alerts certificate_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_alerts
    ADD CONSTRAINT certificate_alerts_pkey PRIMARY KEY (id);


--
-- Name: certificate_assets certificate_assets_certificate_id_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_assets
    ADD CONSTRAINT certificate_assets_certificate_id_asset_id_key UNIQUE (certificate_id, asset_id);


--
-- Name: certificate_assets certificate_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_assets
    ADD CONSTRAINT certificate_assets_pkey PRIMARY KEY (id);


--
-- Name: certificate_history certificate_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_history
    ADD CONSTRAINT certificate_history_pkey PRIMARY KEY (id);


--
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);


--
-- Name: chat_handoffs chat_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_handoffs
    ADD CONSTRAINT chat_handoffs_pkey PRIMARY KEY (id);


--
-- Name: chat_quick_replies chat_quick_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_quick_replies
    ADD CONSTRAINT chat_quick_replies_pkey PRIMARY KEY (id);


--
-- Name: chat_ticket_conversions chat_ticket_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_ticket_conversions
    ADD CONSTRAINT chat_ticket_conversions_pkey PRIMARY KEY (id);


--
-- Name: checklist_template_items checklist_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_items
    ADD CONSTRAINT checklist_template_items_pkey PRIMARY KEY (id);


--
-- Name: checklist_templates checklist_templates_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: checklist_templates checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: company_tag_assignments client_tag_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_tag_assignments
    ADD CONSTRAINT client_tag_assignments_pkey PRIMARY KEY (id);


--
-- Name: company_tags client_tags_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_tags
    ADD CONSTRAINT client_tags_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: company_tags client_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_tags
    ADD CONSTRAINT client_tags_pkey PRIMARY KEY (id);


--
-- Name: companies clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: company_tag_assignments company_tag_assignments_company_id_tag_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_tag_assignments
    ADD CONSTRAINT company_tag_assignments_company_id_tag_id_key UNIQUE (company_id, tag_id);


--
-- Name: contact_credentials contact_credentials_contact_id_credential_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_credentials
    ADD CONSTRAINT contact_credentials_contact_id_credential_id_key UNIQUE (contact_id, credential_id);


--
-- Name: contact_credentials contact_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_credentials
    ADD CONSTRAINT contact_credentials_pkey PRIMARY KEY (id);


--
-- Name: contact_files contact_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_files
    ADD CONSTRAINT contact_files_pkey PRIMARY KEY (id);


--
-- Name: contact_group_members contact_group_members_group_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_group_members
    ADD CONSTRAINT contact_group_members_group_id_contact_id_key UNIQUE (group_id, contact_id);


--
-- Name: contact_group_members contact_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_group_members
    ADD CONSTRAINT contact_group_members_pkey PRIMARY KEY (id);


--
-- Name: contact_groups contact_groups_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_groups
    ADD CONSTRAINT contact_groups_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: contact_groups contact_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_groups
    ADD CONSTRAINT contact_groups_pkey PRIMARY KEY (id);


--
-- Name: contact_tags contact_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT contact_tags_pkey PRIMARY KEY (contact_id, tag_id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: contextual_help contextual_help_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contextual_help
    ADD CONSTRAINT contextual_help_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: credential_access_checkins credential_access_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_checkins
    ADD CONSTRAINT credential_access_checkins_pkey PRIMARY KEY (id);


--
-- Name: credential_access_log credential_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_log
    ADD CONSTRAINT credential_access_log_pkey PRIMARY KEY (id);


--
-- Name: credential_access credential_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access
    ADD CONSTRAINT credential_access_pkey PRIMARY KEY (id);


--
-- Name: credential_access_requests credential_access_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_requests
    ADD CONSTRAINT credential_access_requests_pkey PRIMARY KEY (id);


--
-- Name: credential_categories credential_categories_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_categories
    ADD CONSTRAINT credential_categories_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: credential_categories credential_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_categories
    ADD CONSTRAINT credential_categories_pkey PRIMARY KEY (id);


--
-- Name: credential_contributions credential_contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_contributions
    ADD CONSTRAINT credential_contributions_pkey PRIMARY KEY (id);


--
-- Name: credential_links credential_links_credential_id_link_type_link_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_links
    ADD CONSTRAINT credential_links_credential_id_link_type_link_id_key UNIQUE (credential_id, link_type, link_id);


--
-- Name: credential_links credential_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_links
    ADD CONSTRAINT credential_links_pkey PRIMARY KEY (id);


--
-- Name: credential_reveal_log credential_reveal_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_reveal_log
    ADD CONSTRAINT credential_reveal_log_pkey PRIMARY KEY (id);


--
-- Name: credential_sharing_policies credential_sharing_policies_credential_id_provider_api_key__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_sharing_policies
    ADD CONSTRAINT credential_sharing_policies_credential_id_provider_api_key__key UNIQUE (credential_id, provider_api_key_id);


--
-- Name: credential_sharing_policies credential_sharing_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_sharing_policies
    ADD CONSTRAINT credential_sharing_policies_pkey PRIMARY KEY (id);


--
-- Name: credential_tags credential_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_tags
    ADD CONSTRAINT credential_tags_pkey PRIMARY KEY (credential_id, tag_id);


--
-- Name: credentials credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_pkey PRIMARY KEY (id);


--
-- Name: dashboard_configs dashboard_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_configs
    ADD CONSTRAINT dashboard_configs_pkey PRIMARY KEY (id);


--
-- Name: dashboard_widgets dashboard_widgets_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_widgets
    ADD CONSTRAINT dashboard_widgets_name_key UNIQUE (name);


--
-- Name: dashboard_widgets dashboard_widgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_widgets
    ADD CONSTRAINT dashboard_widgets_pkey PRIMARY KEY (id);


--
-- Name: data_retention_policies data_retention_policies_organization_id_entity_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_organization_id_entity_type_key UNIQUE (organization_id, entity_type);


--
-- Name: data_retention_policies data_retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_pkey PRIMARY KEY (id);


--
-- Name: delegation_rules delegation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegation_rules
    ADD CONSTRAINT delegation_rules_pkey PRIMARY KEY (id);


--
-- Name: delegation_transfers delegation_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegation_transfers
    ADD CONSTRAINT delegation_transfers_pkey PRIMARY KEY (id);


--
-- Name: departments departments_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: dns_change_alerts dns_change_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_alerts
    ADD CONSTRAINT dns_change_alerts_pkey PRIMARY KEY (id);


--
-- Name: dns_change_windows dns_change_windows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_windows
    ADD CONSTRAINT dns_change_windows_pkey PRIMARY KEY (id);


--
-- Name: dns_monitoring_schedules dns_monitoring_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_monitoring_schedules
    ADD CONSTRAINT dns_monitoring_schedules_pkey PRIMARY KEY (id);


--
-- Name: dns_monitoring_snapshots dns_monitoring_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_monitoring_snapshots
    ADD CONSTRAINT dns_monitoring_snapshots_pkey PRIMARY KEY (id);


--
-- Name: dns_records dns_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_records
    ADD CONSTRAINT dns_records_pkey PRIMARY KEY (id);


--
-- Name: document_attachments document_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_attachments
    ADD CONSTRAINT document_attachments_pkey PRIMARY KEY (id);


--
-- Name: document_shares document_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_pkey PRIMARY KEY (id);


--
-- Name: document_shares document_shares_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_share_token_key UNIQUE (share_token);


--
-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: domain_history domain_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_history
    ADD CONSTRAINT domain_history_pkey PRIMARY KEY (id);


--
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


--
-- Name: dynamic_group_members dynamic_group_members_group_id_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_group_members
    ADD CONSTRAINT dynamic_group_members_group_id_asset_id_key UNIQUE (group_id, asset_id);


--
-- Name: dynamic_group_members dynamic_group_members_group_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_group_members
    ADD CONSTRAINT dynamic_group_members_group_id_contact_id_key UNIQUE (group_id, contact_id);


--
-- Name: dynamic_group_members dynamic_group_members_group_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_group_members
    ADD CONSTRAINT dynamic_group_members_group_id_user_id_key UNIQUE (group_id, user_id);


--
-- Name: dynamic_group_members dynamic_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_group_members
    ADD CONSTRAINT dynamic_group_members_pkey PRIMARY KEY (id);


--
-- Name: dynamic_group_rules dynamic_group_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_group_rules
    ADD CONSTRAINT dynamic_group_rules_pkey PRIMARY KEY (id);


--
-- Name: dynamic_groups dynamic_groups_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_groups
    ADD CONSTRAINT dynamic_groups_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: dynamic_groups dynamic_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_groups
    ADD CONSTRAINT dynamic_groups_pkey PRIMARY KEY (id);


--
-- Name: email_attempts email_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_attempts
    ADD CONSTRAINT email_attempts_pkey PRIMARY KEY (id);


--
-- Name: email_delivery_logs email_delivery_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_delivery_logs
    ADD CONSTRAINT email_delivery_logs_pkey PRIMARY KEY (id);


--
-- Name: email_events email_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_pkey PRIMARY KEY (id);


--
-- Name: email_preferences email_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_pkey PRIMARY KEY (id);


--
-- Name: email_queue email_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_pkey PRIMARY KEY (id);


--
-- Name: email_settings email_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_settings
    ADD CONSTRAINT email_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: email_templates email_templates_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: employment_types employment_types_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_types
    ADD CONSTRAINT employment_types_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: employment_types employment_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_types
    ADD CONSTRAINT employment_types_pkey PRIMARY KEY (id);


--
-- Name: feature_registry feature_registry_feature_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_registry
    ADD CONSTRAINT feature_registry_feature_key_key UNIQUE (feature_key);


--
-- Name: feature_registry feature_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_registry
    ADD CONSTRAINT feature_registry_pkey PRIMARY KEY (id);


--
-- Name: feature_usage_log feature_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_usage_log
    ADD CONSTRAINT feature_usage_log_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: folder_permissions folder_permissions_folder_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folder_permissions
    ADD CONSTRAINT folder_permissions_folder_id_role_key UNIQUE (folder_id, role);


--
-- Name: folder_permissions folder_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folder_permissions
    ADD CONSTRAINT folder_permissions_pkey PRIMARY KEY (id);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: group_permissions group_permissions_group_id_permission_set_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_permissions
    ADD CONSTRAINT group_permissions_group_id_permission_set_id_key UNIQUE (group_id, permission_set_id);


--
-- Name: group_permissions group_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_permissions
    ADD CONSTRAINT group_permissions_pkey PRIMARY KEY (id);


--
-- Name: inbound_email_log inbound_email_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_email_log
    ADD CONSTRAINT inbound_email_log_pkey PRIMARY KEY (id);


--
-- Name: inbound_mailboxes inbound_mailboxes_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_mailboxes
    ADD CONSTRAINT inbound_mailboxes_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: inbound_mailboxes inbound_mailboxes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_mailboxes
    ADD CONSTRAINT inbound_mailboxes_pkey PRIMARY KEY (id);


--
-- Name: incident_timeline incident_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_timeline
    ADD CONSTRAINT incident_timeline_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: interface_links interface_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interface_links
    ADD CONSTRAINT interface_links_pkey PRIMARY KEY (id);


--
-- Name: job_title_entitlements job_title_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_title_entitlements
    ADD CONSTRAINT job_title_entitlements_pkey PRIMARY KEY (id);


--
-- Name: job_titles job_titles_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_titles
    ADD CONSTRAINT job_titles_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: job_titles job_titles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_titles
    ADD CONSTRAINT job_titles_pkey PRIMARY KEY (id);


--
-- Name: kb_article_acknowledgments kb_article_acknowledgments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_article_acknowledgments
    ADD CONSTRAINT kb_article_acknowledgments_pkey PRIMARY KEY (id);


--
-- Name: kb_article_chunks kb_article_chunks_article_chunk_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_article_chunks
    ADD CONSTRAINT kb_article_chunks_article_chunk_unique UNIQUE (article_id, chunk_index);


--
-- Name: kb_article_chunks kb_article_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_article_chunks
    ADD CONSTRAINT kb_article_chunks_pkey PRIMARY KEY (id);


--
-- Name: kb_article_sources kb_article_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_article_sources
    ADD CONSTRAINT kb_article_sources_pkey PRIMARY KEY (id);


--
-- Name: kb_article_versions kb_article_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_article_versions
    ADD CONSTRAINT kb_article_versions_pkey PRIMARY KEY (id);


--
-- Name: kb_articles kb_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_articles
    ADD CONSTRAINT kb_articles_pkey PRIMARY KEY (id);


--
-- Name: kb_categories kb_categories_organization_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_categories
    ADD CONSTRAINT kb_categories_organization_id_slug_key UNIQUE (organization_id, slug);


--
-- Name: kb_categories kb_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_categories
    ADD CONSTRAINT kb_categories_pkey PRIMARY KEY (id);


--
-- Name: kb_contributors kb_contributors_organization_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_contributors
    ADD CONSTRAINT kb_contributors_organization_id_contact_id_key UNIQUE (organization_id, contact_id);


--
-- Name: kb_contributors kb_contributors_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_contributors
    ADD CONSTRAINT kb_contributors_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: kb_contributors kb_contributors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_contributors
    ADD CONSTRAINT kb_contributors_pkey PRIMARY KEY (id);


--
-- Name: kb_gaps kb_gaps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_gaps
    ADD CONSTRAINT kb_gaps_pkey PRIMARY KEY (id);


--
-- Name: kb_permissions kb_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_permissions
    ADD CONSTRAINT kb_permissions_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: maintenance_history maintenance_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_history
    ADD CONSTRAINT maintenance_history_pkey PRIMARY KEY (id);


--
-- Name: maintenance_schedules maintenance_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_pkey PRIMARY KEY (id);


--
-- Name: manager_relationships manager_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_relationships
    ADD CONSTRAINT manager_relationships_pkey PRIMARY KEY (id);


--
-- Name: manager_relationships manager_relationships_user_id_manager_id_relationship_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_relationships
    ADD CONSTRAINT manager_relationships_user_id_manager_id_relationship_type_key UNIQUE (user_id, manager_id, relationship_type);


--
-- Name: master_data_requests master_data_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_requests
    ADD CONSTRAINT master_data_requests_pkey PRIMARY KEY (id);


--
-- Name: master_data_settings master_data_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_settings
    ADD CONSTRAINT master_data_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: mcp_tools mcp_tools_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_tools
    ADD CONSTRAINT mcp_tools_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: mcp_tools mcp_tools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_tools
    ADD CONSTRAINT mcp_tools_pkey PRIMARY KEY (id);


--
-- Name: mtp_pairings_legacy_backup mtp_pairings_legacy_backup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mtp_pairings_legacy_backup
    ADD CONSTRAINT mtp_pairings_legacy_backup_pkey PRIMARY KEY (id);


--
-- Name: networks networks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.networks
    ADD CONSTRAINT networks_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_event_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_event_type_key UNIQUE (user_id, event_type);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offboarding_requests offboarding_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_requests
    ADD CONSTRAINT offboarding_requests_pkey PRIMARY KEY (id);


--
-- Name: offboarding_task_items offboarding_task_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_task_items
    ADD CONSTRAINT offboarding_task_items_pkey PRIMARY KEY (id);


--
-- Name: offboarding_tasks offboarding_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_pkey PRIMARY KEY (id);


--
-- Name: offboarding_templates offboarding_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_templates
    ADD CONSTRAINT offboarding_templates_pkey PRIMARY KEY (id);


--
-- Name: office_locations office_locations_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_locations
    ADD CONSTRAINT office_locations_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: office_locations office_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_locations
    ADD CONSTRAINT office_locations_pkey PRIMARY KEY (id);


--
-- Name: onboarding_requests onboarding_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_requests
    ADD CONSTRAINT onboarding_requests_pkey PRIMARY KEY (id);


--
-- Name: onboarding_tasks onboarding_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_pkey PRIMARY KEY (id);


--
-- Name: onboarding_wizard onboarding_wizard_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_wizard
    ADD CONSTRAINT onboarding_wizard_organization_id_key UNIQUE (organization_id);


--
-- Name: onboarding_wizard onboarding_wizard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_wizard
    ADD CONSTRAINT onboarding_wizard_pkey PRIMARY KEY (id);


--
-- Name: operating_systems operating_systems_organization_id_name_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operating_systems
    ADD CONSTRAINT operating_systems_organization_id_name_version_key UNIQUE (organization_id, name, version);


--
-- Name: operating_systems operating_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operating_systems
    ADD CONSTRAINT operating_systems_pkey PRIMARY KEY (id);


--
-- Name: organization_domains organization_domains_organization_id_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_domains
    ADD CONSTRAINT organization_domains_organization_id_domain_key UNIQUE (organization_id, domain);


--
-- Name: organization_domains organization_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_domains
    ADD CONSTRAINT organization_domains_pkey PRIMARY KEY (id);


--
-- Name: organization_feature_flags organization_feature_flags_organization_id_feature_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_feature_flags
    ADD CONSTRAINT organization_feature_flags_organization_id_feature_key_key UNIQUE (organization_id, feature_key);


--
-- Name: organization_feature_flags organization_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_feature_flags
    ADD CONSTRAINT organization_feature_flags_pkey PRIMARY KEY (id);


--
-- Name: organization_features organization_features_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_features
    ADD CONSTRAINT organization_features_organization_id_key UNIQUE (organization_id);


--
-- Name: organization_features organization_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_features
    ADD CONSTRAINT organization_features_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: password_setup_tokens password_setup_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_setup_tokens
    ADD CONSTRAINT password_setup_tokens_pkey PRIMARY KEY (id);


--
-- Name: permission_definitions permission_definitions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_definitions
    ADD CONSTRAINT permission_definitions_code_key UNIQUE (code);


--
-- Name: permission_definitions permission_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_definitions
    ADD CONSTRAINT permission_definitions_pkey PRIMARY KEY (id);


--
-- Name: permission_sets permission_sets_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_sets
    ADD CONSTRAINT permission_sets_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: permission_sets permission_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_sets
    ADD CONSTRAINT permission_sets_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: project_activity project_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_activity
    ADD CONSTRAINT project_activity_pkey PRIMARY KEY (id);


--
-- Name: project_documents project_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_pkey PRIMARY KEY (id);


--
-- Name: project_documents project_documents_project_id_document_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_project_id_document_id_key UNIQUE (project_id, document_id);


--
-- Name: project_milestones project_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_pkey PRIMARY KEY (id);


--
-- Name: project_tasks project_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);


--
-- Name: project_templates project_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_templates
    ADD CONSTRAINT project_templates_pkey PRIMARY KEY (id);


--
-- Name: project_tickets project_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tickets
    ADD CONSTRAINT project_tickets_pkey PRIMARY KEY (id);


--
-- Name: project_tickets project_tickets_project_id_ticket_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tickets
    ADD CONSTRAINT project_tickets_project_id_ticket_id_key UNIQUE (project_id, ticket_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: provider_access_grants provider_access_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_access_grants
    ADD CONSTRAINT provider_access_grants_pkey PRIMARY KEY (id);


--
-- Name: provider_action_log provider_action_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_action_log
    ADD CONSTRAINT provider_action_log_pkey PRIMARY KEY (id);


--
-- Name: provider_api_keys provider_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_api_keys
    ADD CONSTRAINT provider_api_keys_pkey PRIMARY KEY (id);


--
-- Name: provider_contract_acknowledgments provider_contract_acknowledgments_contract_id_api_key_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contract_acknowledgments
    ADD CONSTRAINT provider_contract_acknowledgments_contract_id_api_key_id_key UNIQUE (contract_id, api_key_id);


--
-- Name: provider_contract_acknowledgments provider_contract_acknowledgments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contract_acknowledgments
    ADD CONSTRAINT provider_contract_acknowledgments_pkey PRIMARY KEY (id);


--
-- Name: provider_contracts provider_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contracts
    ADD CONSTRAINT provider_contracts_pkey PRIMARY KEY (id);


--
-- Name: provider_contributions provider_contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contributions
    ADD CONSTRAINT provider_contributions_pkey PRIMARY KEY (id);


--
-- Name: provider_sessions provider_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_sessions
    ADD CONSTRAINT provider_sessions_pkey PRIMARY KEY (id);


--
-- Name: provider_users provider_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_users
    ADD CONSTRAINT provider_users_pkey PRIMARY KEY (id);


--
-- Name: provider_users provider_users_provider_id_external_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_users
    ADD CONSTRAINT provider_users_provider_id_external_user_id_key UNIQUE (provider_id, external_user_id);


--
-- Name: public_assets public_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_assets
    ADD CONSTRAINT public_assets_pkey PRIMARY KEY (id);


--
-- Name: recurring_ticket_assets recurring_ticket_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_ticket_assets
    ADD CONSTRAINT recurring_ticket_assets_pkey PRIMARY KEY (id);


--
-- Name: recurring_ticket_assets recurring_ticket_assets_recurring_ticket_id_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_ticket_assets
    ADD CONSTRAINT recurring_ticket_assets_recurring_ticket_id_asset_id_key UNIQUE (recurring_ticket_id, asset_id);


--
-- Name: recurring_ticket_instances recurring_ticket_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_ticket_instances
    ADD CONSTRAINT recurring_ticket_instances_pkey PRIMARY KEY (id);


--
-- Name: recurring_ticket_instances recurring_ticket_instances_recurring_ticket_id_scheduled_fo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_ticket_instances
    ADD CONSTRAINT recurring_ticket_instances_recurring_ticket_id_scheduled_fo_key UNIQUE (recurring_ticket_id, scheduled_for);


--
-- Name: recurring_tickets recurring_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_tickets
    ADD CONSTRAINT recurring_tickets_pkey PRIMARY KEY (id);


--
-- Name: request_activity request_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_activity
    ADD CONSTRAINT request_activity_pkey PRIMARY KEY (id);


--
-- Name: request_approvals request_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_pkey PRIMARY KEY (id);


--
-- Name: request_subcategories request_subcategories_organization_id_category_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_subcategories
    ADD CONSTRAINT request_subcategories_organization_id_category_name_key UNIQUE (organization_id, category, name);


--
-- Name: request_subcategories request_subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_subcategories
    ADD CONSTRAINT request_subcategories_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_set_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_set_id_key UNIQUE (role_id, permission_set_id);


--
-- Name: role_templates role_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_templates
    ADD CONSTRAINT role_templates_pkey PRIMARY KEY (id);


--
-- Name: roles roles_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: routing_rules routing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_rules
    ADD CONSTRAINT routing_rules_pkey PRIMARY KEY (id);


--
-- Name: saas_services saas_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_services
    ADD CONSTRAINT saas_services_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: service_assets service_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_assets
    ADD CONSTRAINT service_assets_pkey PRIMARY KEY (id);


--
-- Name: service_assets service_assets_service_id_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_assets
    ADD CONSTRAINT service_assets_service_id_asset_id_key UNIQUE (service_id, asset_id);


--
-- Name: service_categories service_categories_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- Name: service_credentials service_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_credentials
    ADD CONSTRAINT service_credentials_pkey PRIMARY KEY (id);


--
-- Name: service_credentials service_credentials_service_id_credential_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_credentials
    ADD CONSTRAINT service_credentials_service_id_credential_id_key UNIQUE (service_id, credential_id);


--
-- Name: service_owners service_owners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_owners
    ADD CONSTRAINT service_owners_pkey PRIMARY KEY (id);


--
-- Name: service_owners service_owners_service_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_owners
    ADD CONSTRAINT service_owners_service_id_contact_id_key UNIQUE (service_id, contact_id);


--
-- Name: service_owners service_owners_service_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_owners
    ADD CONSTRAINT service_owners_service_id_user_id_key UNIQUE (service_id, user_id);


--
-- Name: service_providers service_providers_organization_id_provider_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_providers
    ADD CONSTRAINT service_providers_organization_id_provider_id_key UNIQUE (organization_id, provider_id);


--
-- Name: service_providers service_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_providers
    ADD CONSTRAINT service_providers_pkey PRIMARY KEY (id);


--
-- Name: service_requests service_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_token_key UNIQUE (token);


--
-- Name: setup_templates setup_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setup_templates
    ADD CONSTRAINT setup_templates_pkey PRIMARY KEY (id);


--
-- Name: site_settings site_settings_organization_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_organization_id_key_key UNIQUE (organization_id, key);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);


--
-- Name: smtp_settings smtp_settings_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_settings
    ADD CONSTRAINT smtp_settings_organization_id_key UNIQUE (organization_id);


--
-- Name: smtp_settings smtp_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_settings
    ADD CONSTRAINT smtp_settings_pkey PRIMARY KEY (id);


--
-- Name: software_contacts software_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software_contacts
    ADD CONSTRAINT software_contacts_pkey PRIMARY KEY (id);


--
-- Name: software_contacts software_contacts_software_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software_contacts
    ADD CONSTRAINT software_contacts_software_id_contact_id_key UNIQUE (software_id, contact_id);


--
-- Name: software software_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software
    ADD CONSTRAINT software_pkey PRIMARY KEY (id);


--
-- Name: support_conversations support_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: system_install system_install_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_install
    ADD CONSTRAINT system_install_pkey PRIMARY KEY (id);


--
-- Name: tags tags_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: task_checklist_items task_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_checklist_items
    ADD CONSTRAINT task_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: task_time_entries task_time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_time_entries
    ADD CONSTRAINT task_time_entries_pkey PRIMARY KEY (id);


--
-- Name: team_backlog_items team_backlog_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_backlog_items
    ADD CONSTRAINT team_backlog_items_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_contact_id_key UNIQUE (team_id, contact_id);


--
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: teams teams_workspace_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_workspace_id_name_key UNIQUE (workspace_id, name);


--
-- Name: telemetry_consent_log telemetry_consent_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_consent_log
    ADD CONSTRAINT telemetry_consent_log_pkey PRIMARY KEY (id);


--
-- Name: telemetry_log telemetry_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_log
    ADD CONSTRAINT telemetry_log_pkey PRIMARY KEY (id);


--
-- Name: telemetry_settings telemetry_settings_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_settings
    ADD CONSTRAINT telemetry_settings_organization_id_key UNIQUE (organization_id);


--
-- Name: telemetry_settings telemetry_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_settings
    ADD CONSTRAINT telemetry_settings_pkey PRIMARY KEY (id);


--
-- Name: ticket_approvals ticket_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_approvals
    ADD CONSTRAINT ticket_approvals_pkey PRIMARY KEY (id);


--
-- Name: ticket_assets ticket_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assets
    ADD CONSTRAINT ticket_assets_pkey PRIMARY KEY (id);


--
-- Name: ticket_assets ticket_assets_ticket_id_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assets
    ADD CONSTRAINT ticket_assets_ticket_id_asset_id_key UNIQUE (ticket_id, asset_id);


--
-- Name: ticket_attachments ticket_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_pkey PRIMARY KEY (id);


--
-- Name: ticket_categories ticket_categories_org_parent_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categories
    ADD CONSTRAINT ticket_categories_org_parent_name_key UNIQUE (organization_id, parent_id, name);


--
-- Name: ticket_categories ticket_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categories
    ADD CONSTRAINT ticket_categories_pkey PRIMARY KEY (id);


--
-- Name: ticket_closure_rules ticket_closure_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_closure_rules
    ADD CONSTRAINT ticket_closure_rules_pkey PRIMARY KEY (id);


--
-- Name: ticket_document_links ticket_document_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_document_links
    ADD CONSTRAINT ticket_document_links_pkey PRIMARY KEY (id);


--
-- Name: ticket_document_links ticket_document_links_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_document_links
    ADD CONSTRAINT ticket_document_links_unique UNIQUE (ticket_id, document_id);


--
-- Name: ticket_field_changes ticket_field_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_field_changes
    ADD CONSTRAINT ticket_field_changes_pkey PRIMARY KEY (id);


--
-- Name: ticket_history ticket_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_pkey PRIMARY KEY (id);


--
-- Name: ticket_kb_links ticket_kb_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_kb_links
    ADD CONSTRAINT ticket_kb_links_pkey PRIMARY KEY (id);


--
-- Name: ticket_kb_links ticket_kb_links_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_kb_links
    ADD CONSTRAINT ticket_kb_links_unique UNIQUE (ticket_id, kb_article_id);


--
-- Name: ticket_queue_scores ticket_queue_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_queue_scores
    ADD CONSTRAINT ticket_queue_scores_pkey PRIMARY KEY (ticket_id);


--
-- Name: ticket_relations ticket_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations
    ADD CONSTRAINT ticket_relations_pkey PRIMARY KEY (id);


--
-- Name: ticket_relations ticket_relations_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations
    ADD CONSTRAINT ticket_relations_unique UNIQUE (source_ticket_id, target_ticket_id, relation_type);


--
-- Name: ticket_replies ticket_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_replies
    ADD CONSTRAINT ticket_replies_pkey PRIMARY KEY (id);


--
-- Name: ticket_status_history ticket_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_pkey PRIMARY KEY (id);


--
-- Name: ticket_status_templates ticket_status_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_templates
    ADD CONSTRAINT ticket_status_templates_name_key UNIQUE (name);


--
-- Name: ticket_status_templates ticket_status_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_templates
    ADD CONSTRAINT ticket_status_templates_pkey PRIMARY KEY (id);


--
-- Name: ticket_status_transitions ticket_status_transitions_organization_id_from_status_id_to_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_transitions
    ADD CONSTRAINT ticket_status_transitions_organization_id_from_status_id_to_key UNIQUE (organization_id, from_status_id, to_status_id);


--
-- Name: ticket_status_transitions ticket_status_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_transitions
    ADD CONSTRAINT ticket_status_transitions_pkey PRIMARY KEY (id);


--
-- Name: ticket_statuses ticket_statuses_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_statuses
    ADD CONSTRAINT ticket_statuses_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: ticket_statuses ticket_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_statuses
    ADD CONSTRAINT ticket_statuses_pkey PRIMARY KEY (id);


--
-- Name: ticket_tags ticket_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tags
    ADD CONSTRAINT ticket_tags_pkey PRIMARY KEY (ticket_id, tag_id);


--
-- Name: ticket_tasks ticket_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tasks
    ADD CONSTRAINT ticket_tasks_pkey PRIMARY KEY (id);


--
-- Name: ticket_templates ticket_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_templates
    ADD CONSTRAINT ticket_templates_pkey PRIMARY KEY (id);


--
-- Name: ticket_time_entries ticket_time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_time_entries
    ADD CONSTRAINT ticket_time_entries_pkey PRIMARY KEY (id);


--
-- Name: ticket_types ticket_types_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT ticket_types_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: ticket_types ticket_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT ticket_types_pkey PRIMARY KEY (id);


--
-- Name: ticket_watchers ticket_watchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_watchers
    ADD CONSTRAINT ticket_watchers_pkey PRIMARY KEY (id);


--
-- Name: ticket_watchers ticket_watchers_ticket_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_watchers
    ADD CONSTRAINT ticket_watchers_ticket_id_contact_id_key UNIQUE (ticket_id, contact_id);


--
-- Name: ticket_watchers ticket_watchers_ticket_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_watchers
    ADD CONSTRAINT ticket_watchers_ticket_id_email_key UNIQUE (ticket_id, email);


--
-- Name: ticket_watchers ticket_watchers_ticket_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_watchers
    ADD CONSTRAINT ticket_watchers_ticket_id_user_id_key UNIQUE (ticket_id, user_id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_url_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_url_key_key UNIQUE (url_key);


--
-- Name: training_completions training_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_completions
    ADD CONSTRAINT training_completions_pkey PRIMARY KEY (id);


--
-- Name: training_completions training_completions_user_article_attempt; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_completions
    ADD CONSTRAINT training_completions_user_article_attempt UNIQUE (user_id, article_id, attempt_number);


--
-- Name: user_assignment_history user_assignment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignment_history
    ADD CONSTRAINT user_assignment_history_pkey PRIMARY KEY (id);


--
-- Name: user_assignments user_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_pkey PRIMARY KEY (id);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user_group_memberships user_group_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_pkey PRIMARY KEY (id);


--
-- Name: user_group_memberships user_group_memberships_user_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_user_id_group_id_key UNIQUE (user_id, group_id);


--
-- Name: user_groups user_groups_organization_id_name_group_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_organization_id_name_group_type_key UNIQUE (organization_id, name, group_type);


--
-- Name: user_groups user_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_pkey PRIMARY KEY (id);


--
-- Name: user_help_dismissals user_help_dismissals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_help_dismissals
    ADD CONSTRAINT user_help_dismissals_pkey PRIMARY KEY (id);


--
-- Name: user_help_dismissals user_help_dismissals_user_id_help_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_help_dismissals
    ADD CONSTRAINT user_help_dismissals_user_id_help_id_key UNIQUE (user_id, help_id);


--
-- Name: user_notes user_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_service_access user_service_access_contact_id_service_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_service_access
    ADD CONSTRAINT user_service_access_contact_id_service_id_key UNIQUE (contact_id, service_id);


--
-- Name: user_service_access user_service_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_service_access
    ADD CONSTRAINT user_service_access_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_tasks user_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_pkey PRIMARY KEY (id);


--
-- Name: users users_organization_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_email_key UNIQUE (organization_id, email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_workspace_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_contact_id_key UNIQUE (workspace_id, contact_id);


--
-- Name: workspace_members workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: workspaces workspaces_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: idx_api_key_usage_logs_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_key_usage_logs_key ON ONLY public.api_key_usage_logs USING btree (api_key_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_03_api_key_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_03_api_key_id_created_at_idx ON public.api_key_usage_logs_2026_03 USING btree (api_key_id, created_at DESC);


--
-- Name: idx_api_key_usage_logs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_key_usage_logs_org ON ONLY public.api_key_usage_logs USING btree (organization_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_03_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_03_organization_id_created_at_idx ON public.api_key_usage_logs_2026_03 USING btree (organization_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_04_api_key_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_04_api_key_id_created_at_idx ON public.api_key_usage_logs_2026_04 USING btree (api_key_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_04_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_04_organization_id_created_at_idx ON public.api_key_usage_logs_2026_04 USING btree (organization_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_05_api_key_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_05_api_key_id_created_at_idx ON public.api_key_usage_logs_2026_05 USING btree (api_key_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_05_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_05_organization_id_created_at_idx ON public.api_key_usage_logs_2026_05 USING btree (organization_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_06_api_key_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_06_api_key_id_created_at_idx ON public.api_key_usage_logs_2026_06 USING btree (api_key_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_06_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_06_organization_id_created_at_idx ON public.api_key_usage_logs_2026_06 USING btree (organization_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_07_api_key_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_07_api_key_id_created_at_idx ON public.api_key_usage_logs_2026_07 USING btree (api_key_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_07_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_07_organization_id_created_at_idx ON public.api_key_usage_logs_2026_07 USING btree (organization_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_08_api_key_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_08_api_key_id_created_at_idx ON public.api_key_usage_logs_2026_08 USING btree (api_key_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_08_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_08_organization_id_created_at_idx ON public.api_key_usage_logs_2026_08 USING btree (organization_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_09_api_key_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_09_api_key_id_created_at_idx ON public.api_key_usage_logs_2026_09 USING btree (api_key_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_09_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_09_organization_id_created_at_idx ON public.api_key_usage_logs_2026_09 USING btree (organization_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_10_api_key_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_10_api_key_id_created_at_idx ON public.api_key_usage_logs_2026_10 USING btree (api_key_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_10_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_10_organization_id_created_at_idx ON public.api_key_usage_logs_2026_10 USING btree (organization_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_11_api_key_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_11_api_key_id_created_at_idx ON public.api_key_usage_logs_2026_11 USING btree (api_key_id, created_at DESC);


--
-- Name: api_key_usage_logs_2026_11_organization_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_usage_logs_2026_11_organization_id_created_at_idx ON public.api_key_usage_logs_2026_11 USING btree (organization_id, created_at DESC);


--
-- Name: idx_access_profile_items_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_profile_items_profile ON public.access_profile_items USING btree (profile_id);


--
-- Name: idx_access_profiles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_profiles_org ON public.access_profiles USING btree (organization_id);


--
-- Name: idx_access_requests_approver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_requests_approver ON public.access_requests USING btree (approver_id);


--
-- Name: idx_access_requests_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_requests_org ON public.access_requests USING btree (organization_id);


--
-- Name: idx_access_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_requests_requester ON public.access_requests USING btree (requester_id);


--
-- Name: idx_access_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_requests_status ON public.access_requests USING btree (status);


--
-- Name: idx_accessories_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_category ON public.accessories USING btree (category);


--
-- Name: idx_accessories_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_organization ON public.accessories USING btree (organization_id);


--
-- Name: idx_accessory_disposals_accessory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_disposals_accessory ON public.accessory_disposals USING btree (accessory_id);


--
-- Name: idx_accessory_disposals_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_disposals_org ON public.accessory_disposals USING btree (organization_id);


--
-- Name: idx_accessory_disposals_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_disposals_type ON public.accessory_disposals USING btree (disposal_type);


--
-- Name: idx_accessory_inventory_transactions_accessory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_inventory_transactions_accessory ON public.accessory_inventory_transactions USING btree (accessory_id);


--
-- Name: idx_accessory_models_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_models_org ON public.accessory_models USING btree (organization_id);


--
-- Name: idx_accessory_purchase_order_items_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_purchase_order_items_po ON public.accessory_purchase_order_items USING btree (purchase_order_id);


--
-- Name: idx_accessory_purchase_orders_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_purchase_orders_org ON public.accessory_purchase_orders USING btree (organization_id);


--
-- Name: idx_accessory_purchase_orders_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessory_purchase_orders_vendor ON public.accessory_purchase_orders USING btree (vendor_id);


--
-- Name: idx_account_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_user_id ON public.account USING btree ("userId");


--
-- Name: idx_ai_action_executions_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_action_executions_session ON public.ai_action_executions USING btree (session_id);


--
-- Name: idx_ai_actions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_actions_org ON public.ai_actions USING btree (organization_id);


--
-- Name: idx_ai_category_matches_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_category_matches_ticket ON public.ai_category_matches USING btree (ticket_id);


--
-- Name: idx_ai_category_matches_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_category_matches_workspace ON public.ai_category_matches USING btree (workspace_id);


--
-- Name: idx_ai_chat_messages_kb_gap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_messages_kb_gap ON public.ai_chat_messages USING btree (session_id) WHERE (kb_gap = true);


--
-- Name: idx_ai_chat_messages_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_messages_session ON public.ai_chat_messages USING btree (session_id);


--
-- Name: idx_ai_chat_sessions_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_sessions_contact ON public.ai_chat_sessions USING btree (contact_id);


--
-- Name: idx_ai_chat_sessions_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_sessions_context ON public.ai_chat_sessions USING btree (context_level);


--
-- Name: idx_ai_chat_sessions_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_sessions_organization ON public.ai_chat_sessions USING btree (organization_id);


--
-- Name: idx_ai_chat_sessions_resolution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_sessions_resolution ON public.ai_chat_sessions USING btree (resolution_status);


--
-- Name: idx_ai_chat_sessions_support; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_sessions_support ON public.ai_chat_sessions USING btree (is_support_chat);


--
-- Name: idx_ai_chat_sessions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_sessions_type ON public.ai_chat_sessions USING btree (chat_type);


--
-- Name: idx_ai_chat_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_sessions_user ON public.ai_chat_sessions USING btree (user_id);


--
-- Name: idx_ai_data_access_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_data_access_log_created ON public.ai_chat_data_access_log USING btree (created_at);


--
-- Name: idx_ai_data_access_log_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_data_access_log_resource ON public.ai_chat_data_access_log USING btree (resource_type, resource_id);


--
-- Name: idx_ai_data_access_log_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_data_access_log_session ON public.ai_chat_data_access_log USING btree (session_id);


--
-- Name: idx_ai_data_access_policies_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_data_access_policies_level ON public.ai_data_access_policies USING btree (context_level);


--
-- Name: idx_ai_data_access_policies_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_data_access_policies_org ON public.ai_data_access_policies USING btree (organization_id);


--
-- Name: idx_ai_models_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_models_provider ON public.ai_models USING btree (provider_id);


--
-- Name: idx_ai_providers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_providers_org ON public.ai_providers USING btree (organization_id);


--
-- Name: idx_ai_settings_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_settings_org ON public.ai_settings USING btree (organization_id);


--
-- Name: idx_ai_triage_results_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_triage_results_ticket ON public.ai_triage_results USING btree (ticket_id);


--
-- Name: idx_ai_triage_results_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_triage_results_workspace ON public.ai_triage_results USING btree (workspace_id);


--
-- Name: idx_alert_correlation_rules_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_correlation_rules_org ON public.alert_correlation_rules USING btree (organization_id, is_active);


--
-- Name: idx_alert_suppression_rules_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_suppression_rules_org ON public.alert_suppression_rules USING btree (organization_id, is_active);


--
-- Name: idx_alerts_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_asset ON public.alerts USING btree (asset_id);


--
-- Name: idx_alerts_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_correlation ON public.alerts USING btree (correlation_key);


--
-- Name: idx_alerts_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_fingerprint ON public.alerts USING btree (fingerprint);


--
-- Name: idx_alerts_fired_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_fired_at ON public.alerts USING btree (fired_at);


--
-- Name: idx_alerts_incident; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_incident ON public.alerts USING btree (incident_id);


--
-- Name: idx_alerts_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_organization ON public.alerts USING btree (organization_id);


--
-- Name: idx_alerts_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_source ON public.alerts USING btree (source, source_alert_id);


--
-- Name: idx_alerts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_status ON public.alerts USING btree (status);


--
-- Name: idx_api_keys_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_hash ON public.api_keys USING btree (key_hash);


--
-- Name: idx_api_keys_is_revoked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_is_revoked ON public.api_keys USING btree (is_revoked) WHERE (is_revoked = false);


--
-- Name: idx_api_keys_key_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_key_type ON public.api_keys USING btree (key_type);


--
-- Name: idx_api_keys_legacy_backup_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_legacy_backup_key ON public.api_keys_legacy_permissions_backup USING btree (api_key_id);


--
-- Name: idx_api_keys_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_org_active ON public.api_keys USING btree (organization_id, is_active);


--
-- Name: idx_api_keys_org_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_org_type ON public.api_keys USING btree (organization_id, key_type);


--
-- Name: idx_api_keys_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_owner ON public.api_keys USING btree (key_owner_user_id) WHERE (key_owner_user_id IS NOT NULL);


--
-- Name: idx_api_keys_pairing_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_pairing_lookup ON public.api_keys USING btree (key_prefix) WHERE (((key_type)::text = 'aegis-mtp-pairing'::text) AND (paired_at IS NULL));


--
-- Name: idx_api_keys_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_parent ON public.api_keys USING btree (parent_key_id) WHERE (parent_key_id IS NOT NULL);


--
-- Name: idx_applications_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_active ON public.applications USING btree (organization_id, is_active) WHERE (is_active = true);


--
-- Name: idx_applications_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_org ON public.applications USING btree (organization_id);


--
-- Name: idx_approval_steps_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_steps_workflow ON public.approval_steps USING btree (workflow_id);


--
-- Name: idx_approval_workflow_steps_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_workflow_steps_workflow ON public.approval_workflow_steps USING btree (workflow_id);


--
-- Name: idx_approval_workflows_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_workflows_org ON public.approval_workflows USING btree (organization_id);


--
-- Name: idx_asset_contacts_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_contacts_asset ON public.asset_contacts USING btree (asset_id);


--
-- Name: idx_asset_contacts_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_contacts_contact ON public.asset_contacts USING btree (contact_id);


--
-- Name: idx_asset_credentials_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_credentials_asset ON public.asset_credentials USING btree (asset_id);


--
-- Name: idx_asset_credentials_credential; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_credentials_credential ON public.asset_credentials USING btree (credential_id);


--
-- Name: idx_asset_documents_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_documents_asset ON public.asset_documents USING btree (asset_id);


--
-- Name: idx_asset_documents_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_documents_document ON public.asset_documents USING btree (document_id);


--
-- Name: idx_asset_history_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_history_asset ON public.asset_history USING btree (asset_id);


--
-- Name: idx_asset_import_items_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_import_items_job ON public.asset_import_items USING btree (import_job_id);


--
-- Name: idx_asset_import_jobs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_import_jobs_org ON public.asset_import_jobs USING btree (organization_id);


--
-- Name: idx_asset_import_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_import_jobs_status ON public.asset_import_jobs USING btree (status);


--
-- Name: idx_asset_interfaces_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_interfaces_asset ON public.asset_interfaces USING btree (asset_id);


--
-- Name: idx_asset_models_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_models_org ON public.asset_models USING btree (organization_id);


--
-- Name: idx_asset_models_subtype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_models_subtype ON public.asset_models USING btree (asset_subtype_id);


--
-- Name: idx_asset_models_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_models_vendor ON public.asset_models USING btree (vendor_id);


--
-- Name: idx_asset_naming_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_naming_templates_org ON public.asset_naming_templates USING btree (organization_id);


--
-- Name: idx_asset_request_tiers_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_request_tiers_category ON public.asset_request_tiers USING btree (category);


--
-- Name: idx_asset_request_tiers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_request_tiers_org ON public.asset_request_tiers USING btree (organization_id);


--
-- Name: idx_asset_requests_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_org ON public.asset_requests USING btree (organization_id);


--
-- Name: idx_asset_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_requester ON public.asset_requests USING btree (requester_id);


--
-- Name: idx_asset_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_status ON public.asset_requests USING btree (status);


--
-- Name: idx_asset_requests_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_requests_tier ON public.asset_requests USING btree (tier_id);


--
-- Name: idx_asset_retrieval_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_retrieval_request ON public.asset_retrieval_assignments USING btree (offboarding_request_id);


--
-- Name: idx_asset_retrieval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_retrieval_status ON public.asset_retrieval_assignments USING btree (status);


--
-- Name: idx_asset_software_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_software_asset ON public.asset_software USING btree (asset_id);


--
-- Name: idx_asset_software_software; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_software_software ON public.asset_software USING btree (software_id);


--
-- Name: idx_asset_subtypes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_subtypes_active ON public.asset_subtypes USING btree (organization_id, is_active) WHERE (is_active = true);


--
-- Name: idx_asset_subtypes_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_subtypes_org ON public.asset_subtypes USING btree (organization_id);


--
-- Name: idx_asset_subtypes_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_subtypes_type ON public.asset_subtypes USING btree (asset_type_id);


--
-- Name: idx_asset_tickets_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_tickets_asset ON public.asset_tickets USING btree (asset_id);


--
-- Name: idx_asset_tickets_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_tickets_ticket ON public.asset_tickets USING btree (ticket_id);


--
-- Name: idx_assets_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_company ON public.assets USING btree (company_id);


--
-- Name: idx_assets_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_deleted ON public.assets USING btree (is_deleted) WHERE (is_deleted = true);


--
-- Name: idx_assets_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_external ON public.assets USING btree (external_source, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: idx_assets_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_model ON public.assets USING btree (model_id);


--
-- Name: idx_assets_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_organization ON public.assets USING btree (organization_id);


--
-- Name: idx_assets_os; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_os ON public.assets USING btree (os_id);


--
-- Name: idx_assets_requestable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_requestable ON public.assets USING btree (is_requestable) WHERE (is_requestable = true);


--
-- Name: idx_assets_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_serial ON public.assets USING btree (serial_number);


--
-- Name: idx_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_status ON public.assets USING btree (status);


--
-- Name: idx_assets_subtype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_subtype ON public.assets USING btree (subtype_id);


--
-- Name: idx_assets_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_tier ON public.assets USING btree (request_tier_id);


--
-- Name: idx_assets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_type ON public.assets USING btree (type_id);


--
-- Name: idx_audit_log_actor_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_actor_type ON public.audit_log USING btree (actor_type);


--
-- Name: idx_audit_log_cascade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_cascade ON public.audit_log USING btree (revoked_by_cascade_id) WHERE (revoked_by_cascade_id IS NOT NULL);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (created_at);


--
-- Name: idx_audit_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_entity ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: idx_audit_log_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_entity_type ON public.audit_log USING btree (entity_type);


--
-- Name: idx_audit_log_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_org_created ON public.audit_log USING btree (organization_id, created_at DESC);


--
-- Name: idx_audit_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_user_id ON public.audit_log USING btree (user_id);


--
-- Name: idx_backlog_comments; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backlog_comments ON public.backlog_comments USING btree (backlog_item_id);


--
-- Name: idx_backlog_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backlog_org ON public.team_backlog_items USING btree (organization_id, status);


--
-- Name: idx_backlog_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backlog_review ON public.team_backlog_items USING btree (review_by) WHERE ((status)::text = ANY (ARRAY[('backlog'::character varying)::text, ('planning'::character varying)::text]));


--
-- Name: idx_backlog_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backlog_team ON public.team_backlog_items USING btree (team_id, status);


--
-- Name: idx_break_glass_incidents_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_break_glass_incidents_org ON public.break_glass_incidents USING btree (organization_id);


--
-- Name: idx_break_glass_incidents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_break_glass_incidents_status ON public.break_glass_incidents USING btree (status);


--
-- Name: idx_cascade_queue_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cascade_queue_org ON public.cascade_revocation_queue USING btree (organization_id, state);


--
-- Name: idx_cascade_queue_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cascade_queue_pending ON public.cascade_revocation_queue USING btree (commit_after) WHERE ((state)::text = 'queued'::text);


--
-- Name: idx_catalog_categories_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_categories_org ON public.catalog_categories USING btree (organization_id);


--
-- Name: idx_catalog_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_categories_parent ON public.catalog_categories USING btree (parent_id);


--
-- Name: idx_catalog_items_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_items_active ON public.catalog_items USING btree (is_active, is_requestable);


--
-- Name: idx_catalog_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_items_category ON public.catalog_items USING btree (category_id);


--
-- Name: idx_catalog_items_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_items_org ON public.catalog_items USING btree (organization_id);


--
-- Name: idx_catalog_items_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_catalog_items_org_slug ON public.catalog_items USING btree (organization_id, slug) WHERE (slug IS NOT NULL);


--
-- Name: idx_catalog_items_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_items_type ON public.catalog_items USING btree (item_type);


--
-- Name: idx_category_requests_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_requests_pending ON public.category_requests USING btree (workspace_id) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_category_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_requests_status ON public.category_requests USING btree (status);


--
-- Name: idx_category_requests_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_requests_workspace ON public.category_requests USING btree (workspace_id);


--
-- Name: idx_certificate_alerts_cert; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificate_alerts_cert ON public.certificate_alerts USING btree (certificate_id);


--
-- Name: idx_certificate_alerts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificate_alerts_status ON public.certificate_alerts USING btree (status);


--
-- Name: idx_certificate_assets_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificate_assets_asset ON public.certificate_assets USING btree (asset_id);


--
-- Name: idx_certificate_assets_cert; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificate_assets_cert ON public.certificate_assets USING btree (certificate_id);


--
-- Name: idx_certificate_history_cert; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificate_history_cert ON public.certificate_history USING btree (certificate_id);


--
-- Name: idx_certificates_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_domain ON public.certificates USING btree (domain_id);


--
-- Name: idx_certificates_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_expires ON public.certificates USING btree (expires_at);


--
-- Name: idx_certificates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_org ON public.certificates USING btree (organization_id);


--
-- Name: idx_certificates_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_organization ON public.certificates USING btree (organization_id);


--
-- Name: idx_chat_handoffs_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_handoffs_assigned ON public.chat_handoffs USING btree (assigned_to);


--
-- Name: idx_chat_handoffs_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_handoffs_session ON public.chat_handoffs USING btree (session_id);


--
-- Name: idx_chat_handoffs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_handoffs_status ON public.chat_handoffs USING btree (status);


--
-- Name: idx_chat_quick_replies_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_quick_replies_org ON public.chat_quick_replies USING btree (organization_id);


--
-- Name: idx_chat_quick_replies_shortcut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_quick_replies_shortcut ON public.chat_quick_replies USING btree (shortcut);


--
-- Name: idx_chat_ticket_conversions_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_ticket_conversions_session ON public.chat_ticket_conversions USING btree (session_id);


--
-- Name: idx_chat_ticket_conversions_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_ticket_conversions_ticket ON public.chat_ticket_conversions USING btree (ticket_id);


--
-- Name: idx_checklist_template_items; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_template_items ON public.checklist_template_items USING btree (template_id);


--
-- Name: idx_checklist_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_templates_category ON public.checklist_templates USING btree (category_id) WHERE (is_active = true);


--
-- Name: idx_clients_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_external ON public.companies USING btree (external_source, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: idx_clients_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_name ON public.companies USING btree (name);


--
-- Name: idx_clients_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_organization ON public.companies USING btree (organization_id);


--
-- Name: idx_contact_credentials_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_credentials_contact ON public.contact_credentials USING btree (contact_id);


--
-- Name: idx_contact_credentials_credential; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_credentials_credential ON public.contact_credentials USING btree (credential_id);


--
-- Name: idx_contacts_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_company ON public.contacts USING btree (company_id);


--
-- Name: idx_contacts_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_deleted ON public.contacts USING btree (is_deleted) WHERE (is_deleted = true);


--
-- Name: idx_contacts_department_new; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_department_new ON public.contacts USING btree (department_id);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (email);


--
-- Name: idx_contacts_embedding_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_embedding_status ON public.contacts USING btree (embedding_status) WHERE ((embedding_status)::text <> 'complete'::text);


--
-- Name: idx_contacts_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_external ON public.contacts USING btree (external_source, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: idx_contacts_job_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_job_title ON public.contacts USING btree (job_title_id);


--
-- Name: idx_contacts_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_location ON public.contacts USING btree (location_id);


--
-- Name: idx_contacts_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_organization ON public.contacts USING btree (organization_id);


--
-- Name: idx_contacts_reports_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_reports_to ON public.contacts USING btree (reports_to_id);


--
-- Name: idx_contacts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_type ON public.contacts USING btree (contact_type);


--
-- Name: idx_contextual_help_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contextual_help_feature ON public.contextual_help USING btree (feature_key, context);


--
-- Name: idx_contracts_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_company ON public.contracts USING btree (company_id);


--
-- Name: idx_contracts_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_organization ON public.contracts USING btree (organization_id);


--
-- Name: idx_cred_access_requests_cred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cred_access_requests_cred ON public.credential_access_requests USING btree (credential_id);


--
-- Name: idx_cred_access_requests_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cred_access_requests_key ON public.credential_access_requests USING btree (provider_api_key_id);


--
-- Name: idx_cred_access_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cred_access_requests_status ON public.credential_access_requests USING btree (status, access_expires_at);


--
-- Name: idx_cred_reveal_log_break_glass; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cred_reveal_log_break_glass ON public.credential_reveal_log USING btree (is_break_glass) WHERE (is_break_glass = true);


--
-- Name: idx_cred_reveal_log_cred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cred_reveal_log_cred ON public.credential_reveal_log USING btree (credential_id);


--
-- Name: idx_cred_reveal_log_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cred_reveal_log_time ON public.credential_reveal_log USING btree (revealed_at DESC);


--
-- Name: idx_cred_sharing_policies_cred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cred_sharing_policies_cred ON public.credential_sharing_policies USING btree (credential_id);


--
-- Name: idx_cred_sharing_policies_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cred_sharing_policies_key ON public.credential_sharing_policies USING btree (provider_api_key_id);


--
-- Name: idx_credential_access_credential; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credential_access_credential ON public.credential_access USING btree (credential_id);


--
-- Name: idx_credential_access_log_credential; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credential_access_log_credential ON public.credential_access_log USING btree (credential_id);


--
-- Name: idx_credential_access_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credential_access_user ON public.credential_access USING btree (user_id);


--
-- Name: idx_credential_contributions_ack; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credential_contributions_ack ON public.credential_contributions USING btree (client_acknowledged) WHERE (client_acknowledged = false);


--
-- Name: idx_credential_contributions_cred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credential_contributions_cred ON public.credential_contributions USING btree (credential_id);


--
-- Name: idx_credential_contributions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credential_contributions_org ON public.credential_contributions USING btree (organization_id);


--
-- Name: idx_credential_links_credential; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credential_links_credential ON public.credential_links USING btree (credential_id);


--
-- Name: idx_credential_links_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credential_links_target ON public.credential_links USING btree (link_type, link_id);


--
-- Name: idx_credentials_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credentials_company ON public.credentials USING btree (company_id);


--
-- Name: idx_credentials_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credentials_deleted ON public.credentials USING btree (is_deleted) WHERE (is_deleted = true);


--
-- Name: idx_credentials_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credentials_name ON public.credentials USING btree (name);


--
-- Name: idx_credentials_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credentials_organization ON public.credentials USING btree (organization_id);


--
-- Name: idx_dashboard_configs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_configs_org ON public.dashboard_configs USING btree (organization_id);


--
-- Name: idx_dashboard_configs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_configs_type ON public.dashboard_configs USING btree (view_type);


--
-- Name: idx_delegation_rules_delegator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delegation_rules_delegator ON public.delegation_rules USING btree (delegator_type, delegator_id);


--
-- Name: idx_delegation_rules_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delegation_rules_org ON public.delegation_rules USING btree (organization_id);


--
-- Name: idx_delegation_transfers_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delegation_transfers_dates ON public.delegation_transfers USING btree (starts_at, ends_at);


--
-- Name: idx_delegation_transfers_delegate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delegation_transfers_delegate ON public.delegation_transfers USING btree (delegate_id);


--
-- Name: idx_delegation_transfers_delegator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delegation_transfers_delegator ON public.delegation_transfers USING btree (delegator_id);


--
-- Name: idx_delegations_delegate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delegations_delegate ON public.user_delegations USING btree (delegate_id, is_active);


--
-- Name: idx_delegations_delegator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delegations_delegator ON public.user_delegations USING btree (delegator_id, is_active);


--
-- Name: idx_delegations_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delegations_org_active ON public.user_delegations USING btree (organization_id, is_active) WHERE (is_active = true);


--
-- Name: idx_departments_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_org ON public.departments USING btree (organization_id);


--
-- Name: idx_departments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_parent ON public.departments USING btree (parent_id);


--
-- Name: idx_departments_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_path ON public.departments USING btree (path);


--
-- Name: idx_dns_change_alerts_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dns_change_alerts_domain ON public.dns_change_alerts USING btree (domain_id);


--
-- Name: idx_dns_change_alerts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dns_change_alerts_org ON public.dns_change_alerts USING btree (organization_id, status);


--
-- Name: idx_dns_change_alerts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dns_change_alerts_status ON public.dns_change_alerts USING btree (status);


--
-- Name: idx_dns_change_windows_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dns_change_windows_dates ON public.dns_change_windows USING btree (starts_at, ends_at);


--
-- Name: idx_dns_change_windows_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dns_change_windows_domain ON public.dns_change_windows USING btree (domain_id);


--
-- Name: idx_dns_monitoring_schedules_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dns_monitoring_schedules_domain ON public.dns_monitoring_schedules USING btree (domain_id);


--
-- Name: idx_dns_monitoring_schedules_next; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dns_monitoring_schedules_next ON public.dns_monitoring_schedules USING btree (next_check_at, is_active);


--
-- Name: idx_dns_monitoring_snapshots_checked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dns_monitoring_snapshots_checked ON public.dns_monitoring_snapshots USING btree (checked_at);


--
-- Name: idx_dns_monitoring_snapshots_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dns_monitoring_snapshots_domain ON public.dns_monitoring_snapshots USING btree (domain_id);


--
-- Name: idx_dns_records_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dns_records_domain ON public.dns_records USING btree (domain_id);


--
-- Name: idx_document_attachments_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_attachments_document ON public.document_attachments USING btree (document_id);


--
-- Name: idx_document_attachments_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_attachments_org ON public.document_attachments USING btree (organization_id);


--
-- Name: idx_document_shares_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_shares_document ON public.document_shares USING btree (document_id);


--
-- Name: idx_document_shares_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_shares_token ON public.document_shares USING btree (share_token);


--
-- Name: idx_documents_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_company ON public.documents USING btree (company_id);


--
-- Name: idx_documents_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_deleted ON public.documents USING btree (is_deleted) WHERE (is_deleted = true);


--
-- Name: idx_documents_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_folder ON public.documents USING btree (folder_id);


--
-- Name: idx_documents_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_organization ON public.documents USING btree (organization_id);


--
-- Name: idx_documents_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_search ON public.documents USING gin (to_tsvector('english'::regconfig, (((COALESCE(title, ''::character varying))::text || ' '::text) || COALESCE(content_raw, ''::text))));


--
-- Name: idx_documents_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_title ON public.documents USING btree (title);


--
-- Name: idx_domains_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_domains_company ON public.domains USING btree (company_id);


--
-- Name: idx_domains_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_domains_expires ON public.domains USING btree (expires_at);


--
-- Name: idx_domains_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_domains_organization ON public.domains USING btree (organization_id);


--
-- Name: idx_dynamic_group_members_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_group_members_asset ON public.dynamic_group_members USING btree (asset_id) WHERE (is_active = true);


--
-- Name: idx_dynamic_group_members_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_group_members_contact ON public.dynamic_group_members USING btree (contact_id) WHERE (is_active = true);


--
-- Name: idx_dynamic_group_members_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_group_members_group ON public.dynamic_group_members USING btree (group_id) WHERE (is_active = true);


--
-- Name: idx_dynamic_group_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_group_members_user ON public.dynamic_group_members USING btree (user_id) WHERE (is_active = true);


--
-- Name: idx_dynamic_group_rules_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_group_rules_group ON public.dynamic_group_rules USING btree (group_id);


--
-- Name: idx_dynamic_groups_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_groups_org ON public.dynamic_groups USING btree (organization_id);


--
-- Name: idx_dynamic_groups_refresh; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_groups_refresh ON public.dynamic_groups USING btree (last_evaluated_at) WHERE (((membership_type)::text = 'dynamic'::text) AND (refresh_interval_minutes > 0));


--
-- Name: idx_dynamic_groups_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_groups_type ON public.dynamic_groups USING btree (group_type);


--
-- Name: idx_email_attempts_attempted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_attempts_attempted_at ON public.email_attempts USING btree (attempted_at);


--
-- Name: idx_email_attempts_org_attempted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_attempts_org_attempted_at ON public.email_attempts USING btree (organization_id, attempted_at DESC);


--
-- Name: idx_email_delivery_logs_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_delivery_logs_queue ON public.email_delivery_logs USING btree (email_queue_id);


--
-- Name: idx_email_events_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_events_email ON public.email_events USING btree (email_id);


--
-- Name: idx_email_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_events_type ON public.email_events USING btree (event_type);


--
-- Name: idx_email_preferences_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_preferences_contact ON public.email_preferences USING btree (contact_id);


--
-- Name: idx_email_preferences_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_preferences_email ON public.email_preferences USING btree (email);


--
-- Name: idx_email_preferences_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_preferences_user ON public.email_preferences USING btree (user_id);


--
-- Name: idx_email_queue_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_queue_created ON public.email_queue USING btree (created_at);


--
-- Name: idx_email_queue_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_queue_pending ON public.email_queue USING btree (status, scheduled_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_email_queue_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_queue_retry ON public.email_queue USING btree (status, next_retry_at) WHERE ((status)::text = 'failed'::text);


--
-- Name: idx_email_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_queue_status ON public.email_queue USING btree (status);


--
-- Name: idx_email_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_org ON public.email_templates USING btree (organization_id);


--
-- Name: idx_employment_types_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employment_types_org ON public.employment_types USING btree (organization_id);


--
-- Name: idx_feature_registry_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_registry_category ON public.feature_registry USING btree (category);


--
-- Name: idx_feature_registry_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_registry_status ON public.feature_registry USING btree (status);


--
-- Name: idx_feature_usage_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_usage_log_created ON public.feature_usage_log USING btree (created_at);


--
-- Name: idx_feature_usage_log_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_usage_log_feature ON public.feature_usage_log USING btree (feature_key);


--
-- Name: idx_feature_usage_log_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_usage_log_org ON public.feature_usage_log USING btree (organization_id);


--
-- Name: idx_files_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_reference ON public.files USING btree (reference_type, reference_id);


--
-- Name: idx_folder_permissions_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_folder_permissions_folder ON public.folder_permissions USING btree (folder_id);


--
-- Name: idx_folders_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_folders_organization ON public.folders USING btree (organization_id);


--
-- Name: idx_folders_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_folders_parent ON public.folders USING btree (parent_id);


--
-- Name: idx_inbound_email_log_mailbox_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_email_log_mailbox_time ON public.inbound_email_log USING btree (mailbox_id, received_at DESC);


--
-- Name: idx_inbound_email_log_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_email_log_message_id ON public.inbound_email_log USING btree (mailbox_id, message_id) WHERE (message_id IS NOT NULL);


--
-- Name: idx_inbound_email_log_security_events; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_email_log_security_events ON public.inbound_email_log USING btree (received_at DESC) WHERE ((status)::text = ANY (ARRAY[('created_new_auth_failed_signed'::character varying)::text, ('created_new_auth_failed_header'::character varying)::text, ('rejected_foreign_instance'::character varying)::text]));


--
-- Name: idx_inbound_email_log_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_email_log_ticket ON public.inbound_email_log USING btree (ticket_id) WHERE (ticket_id IS NOT NULL);


--
-- Name: idx_inbound_mailboxes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_mailboxes_active ON public.inbound_mailboxes USING btree (is_active, last_poll_at);


--
-- Name: idx_incident_timeline_incident; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incident_timeline_incident ON public.incident_timeline USING btree (incident_id);


--
-- Name: idx_incidents_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_correlation ON public.incidents USING btree (correlation_key);


--
-- Name: idx_incidents_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_organization ON public.incidents USING btree (organization_id);


--
-- Name: idx_incidents_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_severity ON public.incidents USING btree (severity);


--
-- Name: idx_incidents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_status ON public.incidents USING btree (status);


--
-- Name: idx_incidents_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_ticket ON public.incidents USING btree (ticket_id);


--
-- Name: idx_job_title_entitlements_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_title_entitlements_org ON public.job_title_entitlements USING btree (organization_id);


--
-- Name: idx_job_title_entitlements_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_title_entitlements_title ON public.job_title_entitlements USING btree (job_title_id);


--
-- Name: idx_job_titles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_titles_active ON public.job_titles USING btree (organization_id, is_active);


--
-- Name: idx_job_titles_cloned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_titles_cloned ON public.job_titles USING btree (cloned_from_id);


--
-- Name: idx_job_titles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_titles_org ON public.job_titles USING btree (organization_id);


--
-- Name: idx_kb_article_ack_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_article_ack_article ON public.kb_article_acknowledgments USING btree (article_id);


--
-- Name: idx_kb_article_ack_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_article_ack_user ON public.kb_article_acknowledgments USING btree (user_id);


--
-- Name: idx_kb_article_chunks_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_article_chunks_article ON public.kb_article_chunks USING btree (article_id);


--
-- Name: idx_kb_article_chunks_embedding_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_article_chunks_embedding_status ON public.kb_article_chunks USING btree (embedding_status) WHERE ((embedding_status)::text <> 'complete'::text);


--
-- Name: idx_kb_article_chunks_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_article_chunks_org ON public.kb_article_chunks USING btree (organization_id);


--
-- Name: idx_kb_article_sources_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_article_sources_article ON public.kb_article_sources USING btree (article_id);


--
-- Name: idx_kb_article_sources_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_article_sources_org ON public.kb_article_sources USING btree (organization_id);


--
-- Name: idx_kb_article_versions_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_article_versions_article ON public.kb_article_versions USING btree (article_id);


--
-- Name: idx_kb_articles_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_category ON public.kb_articles USING btree (category_id);


--
-- Name: idx_kb_articles_embedding_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_embedding_status ON public.kb_articles USING btree (embedding_status) WHERE ((embedding_status)::text <> 'complete'::text);


--
-- Name: idx_kb_articles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_org ON public.kb_articles USING btree (organization_id);


--
-- Name: idx_kb_articles_required_for_companies; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_required_for_companies ON public.kb_articles USING gin (required_for_companies);


--
-- Name: idx_kb_articles_required_for_contact_groups; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_required_for_contact_groups ON public.kb_articles USING gin (required_for_contact_groups);


--
-- Name: idx_kb_articles_required_for_departments; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_required_for_departments ON public.kb_articles USING gin (required_for_departments);


--
-- Name: idx_kb_articles_required_for_employment_types; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_required_for_employment_types ON public.kb_articles USING gin (required_for_employment_types);


--
-- Name: idx_kb_articles_required_for_job_titles; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_required_for_job_titles ON public.kb_articles USING gin (required_for_job_titles);


--
-- Name: idx_kb_articles_required_for_locations; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_required_for_locations ON public.kb_articles USING gin (required_for_locations);


--
-- Name: idx_kb_articles_required_for_roles; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_required_for_roles ON public.kb_articles USING gin (required_for_roles);


--
-- Name: idx_kb_articles_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_kb_articles_slug ON public.kb_articles USING btree (organization_id, slug);


--
-- Name: idx_kb_articles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_status ON public.kb_articles USING btree (organization_id, status);


--
-- Name: idx_kb_articles_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_system ON public.kb_articles USING btree (organization_id, is_system) WHERE (is_system = true);


--
-- Name: idx_kb_articles_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_tags ON public.kb_articles USING gin (tags);


--
-- Name: idx_kb_articles_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_articles_type ON public.kb_articles USING btree (organization_id, article_type);


--
-- Name: idx_kb_categories_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_categories_org ON public.kb_categories USING btree (organization_id);


--
-- Name: idx_kb_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_categories_parent ON public.kb_categories USING btree (parent_id);


--
-- Name: idx_kb_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_categories_slug ON public.kb_categories USING btree (slug);


--
-- Name: idx_kb_contributors_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_contributors_contact ON public.kb_contributors USING btree (contact_id);


--
-- Name: idx_kb_contributors_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_contributors_user ON public.kb_contributors USING btree (user_id);


--
-- Name: idx_kb_gaps_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_gaps_org_status ON public.kb_gaps USING btree (organization_id, status);


--
-- Name: idx_kb_gaps_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_gaps_topic ON public.kb_gaps USING btree (organization_id, topic);


--
-- Name: idx_kb_permissions_perm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_permissions_perm ON public.kb_permissions USING btree (permission);


--
-- Name: idx_kb_permissions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_permissions_role ON public.kb_permissions USING btree (role_id);


--
-- Name: idx_kb_permissions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_permissions_user ON public.kb_permissions USING btree (user_id);


--
-- Name: idx_locations_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_company ON public.locations USING btree (company_id);


--
-- Name: idx_maintenance_history_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_history_schedule ON public.maintenance_history USING btree (schedule_id);


--
-- Name: idx_maintenance_schedules_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_schedules_asset ON public.maintenance_schedules USING btree (asset_id);


--
-- Name: idx_maintenance_schedules_next; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_schedules_next ON public.maintenance_schedules USING btree (next_maintenance_at);


--
-- Name: idx_maintenance_schedules_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_schedules_org ON public.maintenance_schedules USING btree (organization_id);


--
-- Name: idx_manager_relationships_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manager_relationships_manager ON public.manager_relationships USING btree (manager_id);


--
-- Name: idx_manager_relationships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manager_relationships_user ON public.manager_relationships USING btree (user_id);


--
-- Name: idx_master_data_requests_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_data_requests_org ON public.master_data_requests USING btree (organization_id);


--
-- Name: idx_master_data_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_data_requests_status ON public.master_data_requests USING btree (status);


--
-- Name: idx_networks_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_networks_company ON public.networks USING btree (company_id);


--
-- Name: idx_networks_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_networks_organization ON public.networks USING btree (organization_id);


--
-- Name: idx_notification_prefs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_prefs_user ON public.notification_preferences USING btree (user_id);


--
-- Name: idx_notification_templates_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_templates_event ON public.notification_templates USING btree (event_type);


--
-- Name: idx_notification_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_templates_org ON public.notification_templates USING btree (organization_id);


--
-- Name: idx_notifications_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_entity ON public.notifications USING btree (entity_type, entity_id);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_offboarding_requests_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offboarding_requests_org ON public.offboarding_requests USING btree (organization_id);


--
-- Name: idx_offboarding_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offboarding_requests_status ON public.offboarding_requests USING btree (status);


--
-- Name: idx_offboarding_task_items_offboarding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offboarding_task_items_offboarding ON public.offboarding_task_items USING btree (offboarding_id);


--
-- Name: idx_offboarding_task_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offboarding_task_items_status ON public.offboarding_task_items USING btree (status);


--
-- Name: idx_offboarding_tasks_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offboarding_tasks_organization ON public.offboarding_tasks USING btree (organization_id);


--
-- Name: idx_offboarding_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offboarding_tasks_status ON public.offboarding_tasks USING btree (status);


--
-- Name: idx_offboarding_tasks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offboarding_tasks_user ON public.offboarding_tasks USING btree (user_id);


--
-- Name: idx_office_locations_coords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_locations_coords ON public.office_locations USING btree (latitude, longitude) WHERE (latitude IS NOT NULL);


--
-- Name: idx_office_locations_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_locations_level ON public.office_locations USING btree (location_level);


--
-- Name: idx_office_locations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_locations_org ON public.office_locations USING btree (organization_id);


--
-- Name: idx_office_locations_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_locations_parent ON public.office_locations USING btree (parent_id);


--
-- Name: idx_office_locations_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_locations_path ON public.office_locations USING btree (path);


--
-- Name: idx_onboarding_requests_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_requests_org ON public.onboarding_requests USING btree (organization_id);


--
-- Name: idx_onboarding_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_requests_status ON public.onboarding_requests USING btree (organization_id, status);


--
-- Name: idx_onboarding_requests_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_requests_ticket ON public.onboarding_requests USING btree (ticket_id);


--
-- Name: idx_onboarding_tasks_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_tasks_request ON public.onboarding_tasks USING btree (onboarding_request_id);


--
-- Name: idx_onboarding_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_tasks_status ON public.onboarding_tasks USING btree (status);


--
-- Name: idx_operating_systems_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operating_systems_org ON public.operating_systems USING btree (organization_id);


--
-- Name: idx_operating_systems_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operating_systems_platform ON public.operating_systems USING btree (platform);


--
-- Name: idx_org_domains_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_domains_domain ON public.organization_domains USING btree (domain);


--
-- Name: idx_org_domains_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_domains_org ON public.organization_domains USING btree (organization_id);


--
-- Name: idx_org_domains_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_domains_type ON public.organization_domains USING btree (domain_type);


--
-- Name: idx_org_feature_flags_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_feature_flags_feature ON public.organization_feature_flags USING btree (feature_key);


--
-- Name: idx_org_feature_flags_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_feature_flags_org ON public.organization_feature_flags USING btree (organization_id);


--
-- Name: idx_permission_sets_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permission_sets_org ON public.permission_sets USING btree (organization_id);


--
-- Name: idx_project_activity_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_activity_project ON public.project_activity USING btree (project_id);


--
-- Name: idx_project_milestones_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_milestones_due ON public.project_milestones USING btree (due_date);


--
-- Name: idx_project_milestones_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_milestones_project ON public.project_milestones USING btree (project_id);


--
-- Name: idx_project_tasks_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_assigned ON public.project_tasks USING btree (assigned_to);


--
-- Name: idx_project_tasks_milestone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_milestone ON public.project_tasks USING btree (milestone_id);


--
-- Name: idx_project_tasks_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_project ON public.project_tasks USING btree (project_id);


--
-- Name: idx_project_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_status ON public.project_tasks USING btree (status);


--
-- Name: idx_projects_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_contact ON public.projects USING btree (contact_id);


--
-- Name: idx_projects_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_dates ON public.projects USING btree (start_date, target_end_date);


--
-- Name: idx_projects_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_manager ON public.projects USING btree (manager_id);


--
-- Name: idx_projects_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_org ON public.projects USING btree (organization_id);


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_status ON public.projects USING btree (status);


--
-- Name: idx_provider_access_grants_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_access_grants_active ON public.provider_access_grants USING btree (is_active, valid_until);


--
-- Name: idx_provider_access_grants_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_access_grants_provider ON public.provider_access_grants USING btree (provider_id);


--
-- Name: idx_provider_action_log_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_action_log_key ON public.provider_action_log USING btree (api_key_id);


--
-- Name: idx_provider_action_log_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_action_log_org ON public.provider_action_log USING btree (organization_id);


--
-- Name: idx_provider_action_log_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_action_log_resource ON public.provider_action_log USING btree (resource_type, resource_id);


--
-- Name: idx_provider_action_log_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_action_log_time ON public.provider_action_log USING btree (started_at DESC);


--
-- Name: idx_provider_api_keys_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_api_keys_active ON public.provider_api_keys USING btree (is_active, is_revoked);


--
-- Name: idx_provider_api_keys_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_api_keys_hash ON public.provider_api_keys USING btree (key_hash);


--
-- Name: idx_provider_api_keys_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_api_keys_org ON public.provider_api_keys USING btree (organization_id);


--
-- Name: idx_provider_contract_acks_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_contract_acks_key ON public.provider_contract_acknowledgments USING btree (api_key_id);


--
-- Name: idx_provider_contracts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_contracts_org ON public.provider_contracts USING btree (organization_id);


--
-- Name: idx_provider_contributions_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_contributions_entity ON public.provider_contributions USING btree (entity_type, entity_id);


--
-- Name: idx_provider_contributions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_contributions_org ON public.provider_contributions USING btree (organization_id);


--
-- Name: idx_provider_contributions_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_contributions_provider ON public.provider_contributions USING btree (provider_api_key_id);


--
-- Name: idx_provider_contributions_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_contributions_time ON public.provider_contributions USING btree (created_at DESC);


--
-- Name: idx_provider_sessions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_sessions_active ON public.provider_sessions USING btree (is_active, expires_at);


--
-- Name: idx_provider_sessions_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_sessions_key ON public.provider_sessions USING btree (api_key_id);


--
-- Name: idx_provider_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_users_email ON public.provider_users USING btree (email);


--
-- Name: idx_provider_users_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_users_provider ON public.provider_users USING btree (provider_id);


--
-- Name: idx_public_assets_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_assets_org ON public.public_assets USING btree (organization_id);


--
-- Name: idx_queue_scores_action_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_scores_action_state ON public.ticket_queue_scores USING btree (organization_id, action_state);


--
-- Name: idx_queue_scores_org_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_scores_org_score ON public.ticket_queue_scores USING btree (organization_id, base_score DESC);


--
-- Name: idx_recurring_instances_recurring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurring_instances_recurring ON public.recurring_ticket_instances USING btree (recurring_ticket_id);


--
-- Name: idx_recurring_instances_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurring_instances_ticket ON public.recurring_ticket_instances USING btree (ticket_id);


--
-- Name: idx_recurring_tickets_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurring_tickets_active ON public.recurring_tickets USING btree (is_active);


--
-- Name: idx_recurring_tickets_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurring_tickets_org ON public.recurring_tickets USING btree (organization_id);


--
-- Name: idx_request_activity_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_activity_request ON public.request_activity USING btree (request_id);


--
-- Name: idx_request_approvals_approver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_approvals_approver ON public.request_approvals USING btree (approver_id, decision);


--
-- Name: idx_request_approvals_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_approvals_request ON public.request_approvals USING btree (request_id);


--
-- Name: idx_request_subcategories_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_subcategories_category ON public.request_subcategories USING btree (category);


--
-- Name: idx_request_subcategories_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_subcategories_org ON public.request_subcategories USING btree (organization_id);


--
-- Name: idx_role_permissions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role_id);


--
-- Name: idx_roles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_org ON public.roles USING btree (organization_id);


--
-- Name: idx_routing_rules_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routing_rules_priority ON public.routing_rules USING btree (workspace_id, priority) WHERE (is_active = true);


--
-- Name: idx_routing_rules_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routing_rules_workspace ON public.routing_rules USING btree (workspace_id);


--
-- Name: idx_saas_services_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saas_services_category ON public.saas_services USING btree (category);


--
-- Name: idx_saas_services_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saas_services_organization ON public.saas_services USING btree (organization_id);


--
-- Name: idx_service_owners_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_owners_available ON public.service_owners USING btree (is_available) WHERE (is_available = true);


--
-- Name: idx_service_owners_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_owners_contact ON public.service_owners USING btree (contact_id);


--
-- Name: idx_service_owners_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_owners_service ON public.service_owners USING btree (service_id);


--
-- Name: idx_service_owners_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_owners_user ON public.service_owners USING btree (user_id);


--
-- Name: idx_service_providers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_providers_org ON public.service_providers USING btree (organization_id);


--
-- Name: idx_service_providers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_providers_status ON public.service_providers USING btree (status);


--
-- Name: idx_service_requests_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_requests_item ON public.service_requests USING btree (catalog_item_id);


--
-- Name: idx_service_requests_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_requests_org ON public.service_requests USING btree (organization_id);


--
-- Name: idx_service_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_requests_requester ON public.service_requests USING btree (requester_id, status);


--
-- Name: idx_service_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_requests_status ON public.service_requests USING btree (organization_id, status);


--
-- Name: idx_services_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_company ON public.services USING btree (company_id);


--
-- Name: idx_services_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_org ON public.services USING btree (organization_id);


--
-- Name: idx_services_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_organization ON public.services USING btree (organization_id);


--
-- Name: idx_services_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_status ON public.services USING btree (status);


--
-- Name: idx_session_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_token ON public.session USING btree (token);


--
-- Name: idx_session_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_user_id ON public.session USING btree ("userId");


--
-- Name: idx_setup_templates_industry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setup_templates_industry ON public.setup_templates USING btree (industry);


--
-- Name: idx_software_contacts_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_software_contacts_contact ON public.software_contacts USING btree (contact_id);


--
-- Name: idx_software_contacts_software; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_software_contacts_software ON public.software_contacts USING btree (software_id);


--
-- Name: idx_software_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_software_org ON public.software USING btree (organization_id);


--
-- Name: idx_support_conversations_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_conversations_updated_at ON public.support_conversations USING btree (updated_at DESC);


--
-- Name: idx_support_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_conversations_user_id ON public.support_conversations USING btree (user_id);


--
-- Name: idx_support_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_conversation_id ON public.support_messages USING btree (conversation_id);


--
-- Name: idx_support_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_created_at ON public.support_messages USING btree (created_at);


--
-- Name: idx_tags_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_org ON public.tags USING btree (organization_id);


--
-- Name: idx_task_time_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_time_entries_date ON public.task_time_entries USING btree (work_date);


--
-- Name: idx_task_time_entries_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_time_entries_task ON public.task_time_entries USING btree (task_id);


--
-- Name: idx_task_time_entries_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_time_entries_user ON public.task_time_entries USING btree (user_id);


--
-- Name: idx_team_members_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_available ON public.team_members USING btree (is_available) WHERE (is_available = true);


--
-- Name: idx_team_members_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_team ON public.team_members USING btree (team_id);


--
-- Name: idx_team_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_user ON public.team_members USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_teams_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teams_active ON public.teams USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_teams_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teams_workspace ON public.teams USING btree (workspace_id);


--
-- Name: idx_telemetry_consent_log_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telemetry_consent_log_org_created ON public.telemetry_consent_log USING btree (organization_id, created_at DESC);


--
-- Name: idx_telemetry_log_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telemetry_log_org ON public.telemetry_log USING btree (organization_id, created_at DESC);


--
-- Name: idx_telemetry_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telemetry_log_status ON public.telemetry_log USING btree (status) WHERE ((status)::text = ('pending'::character varying)::text);


--
-- Name: idx_telemetry_settings_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telemetry_settings_org ON public.telemetry_settings USING btree (organization_id);


--
-- Name: idx_ticket_approvals_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_approvals_ticket ON public.ticket_approvals USING btree (ticket_id);


--
-- Name: idx_ticket_assets_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_assets_asset ON public.ticket_assets USING btree (asset_id);


--
-- Name: idx_ticket_assets_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_assets_ticket ON public.ticket_assets USING btree (ticket_id);


--
-- Name: idx_ticket_categories_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_categories_active ON public.ticket_categories USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_ticket_categories_org_name_root; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ticket_categories_org_name_root ON public.ticket_categories USING btree (organization_id, name) WHERE (parent_id IS NULL);


--
-- Name: idx_ticket_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_categories_parent ON public.ticket_categories USING btree (parent_id);


--
-- Name: idx_ticket_document_links_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_document_links_document ON public.ticket_document_links USING btree (document_id);


--
-- Name: idx_ticket_document_links_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_document_links_ticket ON public.ticket_document_links USING btree (ticket_id);


--
-- Name: idx_ticket_field_changes_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_field_changes_created ON public.ticket_field_changes USING btree (created_at);


--
-- Name: idx_ticket_field_changes_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_field_changes_org ON public.ticket_field_changes USING btree (organization_id);


--
-- Name: idx_ticket_field_changes_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_field_changes_ticket ON public.ticket_field_changes USING btree (ticket_id);


--
-- Name: idx_ticket_history_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_history_ticket ON public.ticket_history USING btree (ticket_id);


--
-- Name: idx_ticket_kb_links_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_kb_links_article ON public.ticket_kb_links USING btree (kb_article_id);


--
-- Name: idx_ticket_kb_links_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_kb_links_ticket ON public.ticket_kb_links USING btree (ticket_id);


--
-- Name: idx_ticket_relations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_relations_org ON public.ticket_relations USING btree (organization_id);


--
-- Name: idx_ticket_relations_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_relations_source ON public.ticket_relations USING btree (source_ticket_id);


--
-- Name: idx_ticket_relations_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_relations_target ON public.ticket_relations USING btree (target_ticket_id);


--
-- Name: idx_ticket_replies_inbound_msgid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_replies_inbound_msgid ON public.ticket_replies USING btree (inbound_message_id) WHERE (inbound_message_id IS NOT NULL);


--
-- Name: idx_ticket_replies_outbound_msgid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_replies_outbound_msgid ON public.ticket_replies USING btree (outbound_message_id) WHERE (outbound_message_id IS NOT NULL);


--
-- Name: idx_ticket_replies_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_replies_ticket ON public.ticket_replies USING btree (ticket_id);


--
-- Name: idx_ticket_replies_via_pairing_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_replies_via_pairing_key ON public.ticket_replies USING btree (via_pairing_key_id) WHERE (via_pairing_key_id IS NOT NULL);


--
-- Name: idx_ticket_status_history_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_status_history_created ON public.ticket_status_history USING btree (created_at);


--
-- Name: idx_ticket_status_history_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_status_history_ticket ON public.ticket_status_history USING btree (ticket_id);


--
-- Name: idx_ticket_status_transitions_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_status_transitions_from ON public.ticket_status_transitions USING btree (from_status_id);


--
-- Name: idx_ticket_status_transitions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_status_transitions_org ON public.ticket_status_transitions USING btree (organization_id);


--
-- Name: idx_ticket_statuses_base; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_statuses_base ON public.ticket_statuses USING btree (base_status);


--
-- Name: idx_ticket_statuses_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_statuses_enabled ON public.ticket_statuses USING btree (is_enabled) WHERE (is_enabled = true);


--
-- Name: idx_ticket_statuses_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_statuses_org ON public.ticket_statuses USING btree (organization_id);


--
-- Name: idx_ticket_tasks_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_tasks_assigned ON public.ticket_tasks USING btree (assigned_to) WHERE ((assigned_to IS NOT NULL) AND (is_completed = false));


--
-- Name: idx_ticket_tasks_service_cat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_tasks_service_cat ON public.ticket_tasks USING btree (service_category) WHERE ((service_category IS NOT NULL) AND (is_completed = false));


--
-- Name: idx_ticket_tasks_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_tasks_ticket ON public.ticket_tasks USING btree (ticket_id);


--
-- Name: idx_ticket_time_entries_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_time_entries_ticket ON public.ticket_time_entries USING btree (ticket_id);


--
-- Name: idx_ticket_time_entries_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_time_entries_user ON public.ticket_time_entries USING btree (user_id);


--
-- Name: idx_ticket_types_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_types_org ON public.ticket_types USING btree (organization_id);


--
-- Name: idx_tickets_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_assigned ON public.tickets USING btree (assigned_to);


--
-- Name: idx_tickets_assigned_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_assigned_status ON public.tickets USING btree (assigned_to, status_id) WHERE (assigned_to IS NOT NULL);


--
-- Name: idx_tickets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_category ON public.tickets USING btree (request_category);


--
-- Name: idx_tickets_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_contact ON public.tickets USING btree (contact_id);


--
-- Name: idx_tickets_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_created ON public.tickets USING btree (created_at);


--
-- Name: idx_tickets_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_deleted ON public.tickets USING btree (is_deleted) WHERE (is_deleted = true);


--
-- Name: idx_tickets_embedding_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_embedding_status ON public.tickets USING btree (embedding_status) WHERE ((embedding_status)::text <> 'complete'::text);


--
-- Name: idx_tickets_first_viewed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_first_viewed ON public.tickets USING btree (first_viewed_at) WHERE (first_viewed_at IS NULL);


--
-- Name: idx_tickets_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_kind ON public.tickets USING btree (kind);


--
-- Name: idx_tickets_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_number ON public.tickets USING btree (organization_id, ticket_number);


--
-- Name: idx_tickets_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_organization ON public.tickets USING btree (organization_id);


--
-- Name: idx_tickets_requester_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_requester_email ON public.tickets USING btree (requester_email) WHERE (requester_email IS NOT NULL);


--
-- Name: idx_tickets_resolution_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_resolution_category ON public.tickets USING btree (organization_id, resolution_category) WHERE (resolution_category IS NOT NULL);


--
-- Name: idx_tickets_scheduling; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_scheduling ON public.tickets USING btree (organization_id, scheduling_active_from) WHERE ((is_scheduled = true) AND (is_deleted = false));


--
-- Name: idx_tickets_sla_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_sla_due ON public.tickets USING btree (sla_due_at) WHERE (sla_breached = false);


--
-- Name: idx_tickets_source_mailbox; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_source_mailbox ON public.tickets USING btree (source_mailbox_id) WHERE (source_mailbox_id IS NOT NULL);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_status ON public.tickets USING btree (status_id);


--
-- Name: idx_tickets_subcategory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_subcategory ON public.tickets USING btree (subcategory_id);


--
-- Name: idx_tickets_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_team ON public.tickets USING btree (team_id);


--
-- Name: idx_tickets_unassigned_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_unassigned_open ON public.tickets USING btree (organization_id, created_at DESC) WHERE (assigned_to IS NULL);


--
-- Name: idx_tickets_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_workspace ON public.tickets USING btree (workspace_id);


--
-- Name: idx_training_completions_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_completions_article ON public.training_completions USING btree (article_id);


--
-- Name: idx_training_completions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_completions_org ON public.training_completions USING btree (organization_id);


--
-- Name: idx_training_completions_passed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_completions_passed ON public.training_completions USING btree (organization_id, article_id, passed);


--
-- Name: idx_training_completions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_completions_user ON public.training_completions USING btree (user_id, article_id);


--
-- Name: idx_user_assignment_history_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_assignment_history_assignment ON public.user_assignment_history USING btree (assignment_id);


--
-- Name: idx_user_assignments_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_assignments_organization ON public.user_assignments USING btree (organization_id);


--
-- Name: idx_user_assignments_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_assignments_resource ON public.user_assignments USING btree (resource_type, resource_id);


--
-- Name: idx_user_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_assignments_status ON public.user_assignments USING btree (status);


--
-- Name: idx_user_assignments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_assignments_user ON public.user_assignments USING btree (user_id);


--
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_email ON public."user" USING btree (email);


--
-- Name: idx_user_group_memberships_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_group_memberships_group ON public.user_group_memberships USING btree (group_id);


--
-- Name: idx_user_group_memberships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_group_memberships_user ON public.user_group_memberships USING btree (user_id);


--
-- Name: idx_user_groups_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_groups_external ON public.user_groups USING btree (external_source, external_id);


--
-- Name: idx_user_groups_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_groups_org ON public.user_groups USING btree (organization_id);


--
-- Name: idx_user_groups_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_groups_owner ON public.user_groups USING btree (owner_id);


--
-- Name: idx_user_groups_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_groups_parent ON public.user_groups USING btree (parent_id);


--
-- Name: idx_user_groups_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_groups_path ON public.user_groups USING btree (path);


--
-- Name: idx_user_groups_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_groups_type ON public.user_groups USING btree (group_type);


--
-- Name: idx_user_help_dismissals_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_help_dismissals_user ON public.user_help_dismissals USING btree (user_id);


--
-- Name: idx_user_notes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notes_user ON public.user_notes USING btree (user_id, is_archived);


--
-- Name: idx_user_service_access_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_service_access_active ON public.user_service_access USING btree (contact_id, service_id) WHERE (revoked_at IS NULL);


--
-- Name: idx_user_service_access_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_service_access_contact ON public.user_service_access USING btree (contact_id);


--
-- Name: idx_user_service_access_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_service_access_service ON public.user_service_access USING btree (service_id);


--
-- Name: idx_user_tasks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tasks_user ON public.user_tasks USING btree (user_id, is_archived);


--
-- Name: idx_users_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_contact ON public.users USING btree (contact_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_external ON public.users USING btree (external_source, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: idx_users_msp_pairing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_msp_pairing ON public.users USING btree (msp_pairing_key_id) WHERE (msp_pairing_key_id IS NOT NULL);


--
-- Name: idx_users_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_organization ON public.users USING btree (organization_id);


--
-- Name: idx_workspace_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_user ON public.workspace_members USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_workspace_members_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_workspace ON public.workspace_members USING btree (workspace_id);


--
-- Name: idx_workspaces_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_active ON public.workspaces USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_workspaces_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_org ON public.workspaces USING btree (organization_id);


--
-- Name: mtp_pairings_legacy_backup_api_key_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mtp_pairings_legacy_backup_api_key_hash_idx ON public.mtp_pairings_legacy_backup USING btree (api_key_hash) WHERE ((status)::text = 'active'::text);


--
-- Name: mtp_pairings_legacy_backup_api_key_prefix_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mtp_pairings_legacy_backup_api_key_prefix_idx ON public.mtp_pairings_legacy_backup USING btree (api_key_prefix) WHERE ((status)::text = 'active'::text);


--
-- Name: mtp_pairings_legacy_backup_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mtp_pairings_legacy_backup_organization_id_idx ON public.mtp_pairings_legacy_backup USING btree (organization_id);


--
-- Name: password_setup_tokens_token_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_setup_tokens_token_hash_idx ON public.password_setup_tokens USING btree (token_hash);


--
-- Name: password_setup_tokens_user_purpose_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_setup_tokens_user_purpose_idx ON public.password_setup_tokens USING btree (user_id, purpose);


--
-- Name: api_key_usage_logs_2026_03_api_key_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_key ATTACH PARTITION public.api_key_usage_logs_2026_03_api_key_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_03_organization_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_org ATTACH PARTITION public.api_key_usage_logs_2026_03_organization_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.api_key_usage_logs_pkey ATTACH PARTITION public.api_key_usage_logs_2026_03_pkey;


--
-- Name: api_key_usage_logs_2026_04_api_key_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_key ATTACH PARTITION public.api_key_usage_logs_2026_04_api_key_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_04_organization_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_org ATTACH PARTITION public.api_key_usage_logs_2026_04_organization_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.api_key_usage_logs_pkey ATTACH PARTITION public.api_key_usage_logs_2026_04_pkey;


--
-- Name: api_key_usage_logs_2026_05_api_key_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_key ATTACH PARTITION public.api_key_usage_logs_2026_05_api_key_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_05_organization_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_org ATTACH PARTITION public.api_key_usage_logs_2026_05_organization_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.api_key_usage_logs_pkey ATTACH PARTITION public.api_key_usage_logs_2026_05_pkey;


--
-- Name: api_key_usage_logs_2026_06_api_key_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_key ATTACH PARTITION public.api_key_usage_logs_2026_06_api_key_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_06_organization_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_org ATTACH PARTITION public.api_key_usage_logs_2026_06_organization_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.api_key_usage_logs_pkey ATTACH PARTITION public.api_key_usage_logs_2026_06_pkey;


--
-- Name: api_key_usage_logs_2026_07_api_key_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_key ATTACH PARTITION public.api_key_usage_logs_2026_07_api_key_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_07_organization_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_org ATTACH PARTITION public.api_key_usage_logs_2026_07_organization_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.api_key_usage_logs_pkey ATTACH PARTITION public.api_key_usage_logs_2026_07_pkey;


--
-- Name: api_key_usage_logs_2026_08_api_key_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_key ATTACH PARTITION public.api_key_usage_logs_2026_08_api_key_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_08_organization_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_org ATTACH PARTITION public.api_key_usage_logs_2026_08_organization_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.api_key_usage_logs_pkey ATTACH PARTITION public.api_key_usage_logs_2026_08_pkey;


--
-- Name: api_key_usage_logs_2026_09_api_key_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_key ATTACH PARTITION public.api_key_usage_logs_2026_09_api_key_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_09_organization_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_org ATTACH PARTITION public.api_key_usage_logs_2026_09_organization_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.api_key_usage_logs_pkey ATTACH PARTITION public.api_key_usage_logs_2026_09_pkey;


--
-- Name: api_key_usage_logs_2026_10_api_key_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_key ATTACH PARTITION public.api_key_usage_logs_2026_10_api_key_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_10_organization_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_org ATTACH PARTITION public.api_key_usage_logs_2026_10_organization_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.api_key_usage_logs_pkey ATTACH PARTITION public.api_key_usage_logs_2026_10_pkey;


--
-- Name: api_key_usage_logs_2026_11_api_key_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_key ATTACH PARTITION public.api_key_usage_logs_2026_11_api_key_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_11_organization_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_api_key_usage_logs_org ATTACH PARTITION public.api_key_usage_logs_2026_11_organization_id_created_at_idx;


--
-- Name: api_key_usage_logs_2026_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.api_key_usage_logs_pkey ATTACH PARTITION public.api_key_usage_logs_2026_11_pkey;


--
-- Name: team_workload _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.team_workload AS
 SELECT t.id AS team_id,
    t.workspace_id,
    t.name AS team_name,
    t.tier_level,
    count(DISTINCT tm.id) AS member_count,
    sum(tm.current_ticket_count) AS total_tickets,
    sum(tm.max_open_tickets) AS total_capacity,
    round((((sum(tm.current_ticket_count))::numeric / (NULLIF(sum(tm.max_open_tickets), 0))::numeric) * (100)::numeric), 1) AS utilization_percentage,
    count(DISTINCT tm.id) FILTER (WHERE (tm.is_available = true)) AS available_agents
   FROM (public.teams t
     LEFT JOIN public.team_members tm ON ((t.id = tm.team_id)))
  WHERE (t.is_active = true)
  GROUP BY t.id;


--
-- Name: departments department_path_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER department_path_trigger BEFORE INSERT OR UPDATE OF parent_id, name ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_department_path();


--
-- Name: kb_articles kb_articles_assessment_hash_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER kb_articles_assessment_hash_trg BEFORE INSERT OR UPDATE OF assessment ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION public.kb_articles_compute_assessment_hash();


--
-- Name: office_locations location_path_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER location_path_trigger BEFORE INSERT OR UPDATE OF parent_id, name ON public.office_locations FOR EACH ROW EXECUTE FUNCTION public.update_location_path();


--
-- Name: tickets ticket_status_change_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ticket_status_change_trigger BEFORE UPDATE OF status_id ON public.tickets FOR EACH ROW WHEN ((old.status_id IS DISTINCT FROM new.status_id)) EXECUTE FUNCTION public.handle_ticket_status_change();


--
-- Name: api_keys trg_api_keys_flat_cascade; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_api_keys_flat_cascade BEFORE INSERT OR UPDATE OF parent_key_id ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.enforce_flat_cascade();


--
-- Name: tickets trg_compute_scheduling_active_from; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_compute_scheduling_active_from BEFORE INSERT OR UPDATE OF action_date_type, scheduled_for, lead_time_days ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.compute_scheduling_active_from();


--
-- Name: projects trigger_generate_project_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_project_number BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.generate_project_number();


--
-- Name: project_tasks trigger_generate_task_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_task_number BEFORE INSERT ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.generate_task_number();


--
-- Name: domain_history trigger_set_domain_history_severity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_domain_history_severity BEFORE INSERT ON public.domain_history FOR EACH ROW EXECUTE FUNCTION public.set_domain_history_severity();


--
-- Name: project_tasks trigger_task_update_project_progress; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_task_update_project_progress AFTER INSERT OR DELETE OR UPDATE OF status, actual_hours ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.trigger_update_project_progress();


--
-- Name: accessory_inventory_transactions trigger_update_accessory_quantities; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_accessory_quantities BEFORE INSERT ON public.accessory_inventory_transactions FOR EACH ROW EXECUTE FUNCTION public.update_accessory_quantities();


--
-- Name: user_groups trigger_update_group_path; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_group_path BEFORE INSERT OR UPDATE OF parent_id ON public.user_groups FOR EACH ROW EXECUTE FUNCTION public.update_group_path();


--
-- Name: access_profile_items access_profile_items_asset_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_profile_items
    ADD CONSTRAINT access_profile_items_asset_tier_id_fkey FOREIGN KEY (asset_tier_id) REFERENCES public.asset_request_tiers(id) ON DELETE CASCADE;


--
-- Name: access_profile_items access_profile_items_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_profile_items
    ADD CONSTRAINT access_profile_items_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.access_profiles(id) ON DELETE CASCADE;


--
-- Name: access_profile_items access_profile_items_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_profile_items
    ADD CONSTRAINT access_profile_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: access_profiles access_profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_profiles
    ADD CONSTRAINT access_profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: access_request_comments access_request_comments_access_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_request_comments
    ADD CONSTRAINT access_request_comments_access_request_id_fkey FOREIGN KEY (access_request_id) REFERENCES public.access_requests(id) ON DELETE CASCADE;


--
-- Name: access_request_comments access_request_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_request_comments
    ADD CONSTRAINT access_request_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: access_requests access_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: access_requests access_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: access_requests access_requests_for_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_for_contact_id_fkey FOREIGN KEY (for_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: access_requests access_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: access_requests access_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: accessories accessories_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.accessory_models(id);


--
-- Name: accessories accessories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: accessory_disposals accessory_disposals_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_disposals
    ADD CONSTRAINT accessory_disposals_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id);


--
-- Name: accessory_disposals accessory_disposals_assigned_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_disposals
    ADD CONSTRAINT accessory_disposals_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id);


--
-- Name: accessory_disposals accessory_disposals_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_disposals
    ADD CONSTRAINT accessory_disposals_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.user_assignments(id);


--
-- Name: accessory_disposals accessory_disposals_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_disposals
    ADD CONSTRAINT accessory_disposals_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.accessory_models(id);


--
-- Name: accessory_disposals accessory_disposals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_disposals
    ADD CONSTRAINT accessory_disposals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: accessory_disposals accessory_disposals_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_disposals
    ADD CONSTRAINT accessory_disposals_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: accessory_disposals accessory_disposals_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_disposals
    ADD CONSTRAINT accessory_disposals_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: accessory_inventory_transactions accessory_inventory_transactions_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_inventory_transactions
    ADD CONSTRAINT accessory_inventory_transactions_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE CASCADE;


--
-- Name: accessory_inventory_transactions accessory_inventory_transactions_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_inventory_transactions
    ADD CONSTRAINT accessory_inventory_transactions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.user_assignments(id);


--
-- Name: accessory_inventory_transactions accessory_inventory_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_inventory_transactions
    ADD CONSTRAINT accessory_inventory_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: accessory_inventory_transactions accessory_inventory_transactions_disposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_inventory_transactions
    ADD CONSTRAINT accessory_inventory_transactions_disposal_id_fkey FOREIGN KEY (disposal_id) REFERENCES public.accessory_disposals(id);


--
-- Name: accessory_inventory_transactions accessory_inventory_transactions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_inventory_transactions
    ADD CONSTRAINT accessory_inventory_transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: accessory_inventory_transactions accessory_inventory_transactions_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_inventory_transactions
    ADD CONSTRAINT accessory_inventory_transactions_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.accessory_purchase_orders(id);


--
-- Name: accessory_inventory_transactions accessory_inventory_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_inventory_transactions
    ADD CONSTRAINT accessory_inventory_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: accessory_models accessory_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_models
    ADD CONSTRAINT accessory_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: accessory_models accessory_models_preferred_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_models
    ADD CONSTRAINT accessory_models_preferred_vendor_id_fkey FOREIGN KEY (preferred_vendor_id) REFERENCES public.companies(id);


--
-- Name: accessory_purchase_order_items accessory_purchase_order_items_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_purchase_order_items
    ADD CONSTRAINT accessory_purchase_order_items_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id);


--
-- Name: accessory_purchase_order_items accessory_purchase_order_items_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_purchase_order_items
    ADD CONSTRAINT accessory_purchase_order_items_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.accessory_models(id);


--
-- Name: accessory_purchase_order_items accessory_purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_purchase_order_items
    ADD CONSTRAINT accessory_purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.accessory_purchase_orders(id) ON DELETE CASCADE;


--
-- Name: accessory_purchase_orders accessory_purchase_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_purchase_orders
    ADD CONSTRAINT accessory_purchase_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: accessory_purchase_orders accessory_purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_purchase_orders
    ADD CONSTRAINT accessory_purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: accessory_purchase_orders accessory_purchase_orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_purchase_orders
    ADD CONSTRAINT accessory_purchase_orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: accessory_purchase_orders accessory_purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessory_purchase_orders
    ADD CONSTRAINT accessory_purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.companies(id);


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: ai_action_executions ai_action_executions_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_action_executions
    ADD CONSTRAINT ai_action_executions_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.ai_actions(id);


--
-- Name: ai_action_executions ai_action_executions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_action_executions
    ADD CONSTRAINT ai_action_executions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.ai_chat_messages(id);


--
-- Name: ai_action_executions ai_action_executions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_action_executions
    ADD CONSTRAINT ai_action_executions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_actions ai_actions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_actions
    ADD CONSTRAINT ai_actions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ai_category_matches ai_category_matches_best_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_category_matches
    ADD CONSTRAINT ai_category_matches_best_match_id_fkey FOREIGN KEY (best_match_id) REFERENCES public.ticket_categories(id) ON DELETE SET NULL;


--
-- Name: ai_category_matches ai_category_matches_category_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_category_matches
    ADD CONSTRAINT ai_category_matches_category_request_id_fkey FOREIGN KEY (category_request_id) REFERENCES public.category_requests(id) ON DELETE SET NULL;


--
-- Name: ai_category_matches ai_category_matches_final_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_category_matches
    ADD CONSTRAINT ai_category_matches_final_category_id_fkey FOREIGN KEY (final_category_id) REFERENCES public.ticket_categories(id) ON DELETE SET NULL;


--
-- Name: ai_category_matches ai_category_matches_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_category_matches
    ADD CONSTRAINT ai_category_matches_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ai_category_matches ai_category_matches_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_category_matches
    ADD CONSTRAINT ai_category_matches_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: ai_chat_data_access_log ai_chat_data_access_log_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_data_access_log
    ADD CONSTRAINT ai_chat_data_access_log_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_chat_messages ai_chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_messages
    ADD CONSTRAINT ai_chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_chat_sessions ai_chat_sessions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_sessions
    ADD CONSTRAINT ai_chat_sessions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: ai_chat_sessions ai_chat_sessions_created_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_sessions
    ADD CONSTRAINT ai_chat_sessions_created_ticket_id_fkey FOREIGN KEY (created_ticket_id) REFERENCES public.tickets(id);


--
-- Name: ai_chat_sessions ai_chat_sessions_escalated_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_sessions
    ADD CONSTRAINT ai_chat_sessions_escalated_to_user_id_fkey FOREIGN KEY (escalated_to_user_id) REFERENCES public.users(id);


--
-- Name: ai_chat_sessions ai_chat_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_sessions
    ADD CONSTRAINT ai_chat_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ai_chat_sessions ai_chat_sessions_preset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_sessions
    ADD CONSTRAINT ai_chat_sessions_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES public.ai_presets(id) ON DELETE SET NULL;


--
-- Name: ai_chat_sessions ai_chat_sessions_provider_access_grant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_sessions
    ADD CONSTRAINT ai_chat_sessions_provider_access_grant_id_fkey FOREIGN KEY (provider_access_grant_id) REFERENCES public.provider_access_grants(id) ON DELETE SET NULL;


--
-- Name: ai_chat_sessions ai_chat_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_sessions
    ADD CONSTRAINT ai_chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_data_access_policies ai_data_access_policies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_data_access_policies
    ADD CONSTRAINT ai_data_access_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ai_models ai_models_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.ai_providers(id) ON DELETE CASCADE;


--
-- Name: ai_presets ai_presets_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_presets
    ADD CONSTRAINT ai_presets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ai_presets ai_presets_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_presets
    ADD CONSTRAINT ai_presets_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.ai_providers(id) ON DELETE SET NULL;


--
-- Name: ai_providers ai_providers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_providers
    ADD CONSTRAINT ai_providers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ai_settings ai_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ai_triage_config ai_triage_config_fallback_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_triage_config
    ADD CONSTRAINT ai_triage_config_fallback_team_id_fkey FOREIGN KEY (fallback_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: ai_triage_config ai_triage_config_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_triage_config
    ADD CONSTRAINT ai_triage_config_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: ai_triage_results ai_triage_results_feedback_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_triage_results
    ADD CONSTRAINT ai_triage_results_feedback_by_fkey FOREIGN KEY (feedback_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_triage_results ai_triage_results_suggested_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_triage_results
    ADD CONSTRAINT ai_triage_results_suggested_team_id_fkey FOREIGN KEY (suggested_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: ai_triage_results ai_triage_results_suggested_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_triage_results
    ADD CONSTRAINT ai_triage_results_suggested_user_id_fkey FOREIGN KEY (suggested_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_triage_results ai_triage_results_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_triage_results
    ADD CONSTRAINT ai_triage_results_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ai_triage_results ai_triage_results_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_triage_results
    ADD CONSTRAINT ai_triage_results_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: alert_correlation_rules alert_correlation_rules_escalate_to_team_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_correlation_rules
    ADD CONSTRAINT alert_correlation_rules_escalate_to_team_fkey FOREIGN KEY (escalate_to_team) REFERENCES public.user_roles(id);


--
-- Name: alert_correlation_rules alert_correlation_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_correlation_rules
    ADD CONSTRAINT alert_correlation_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: alert_integrations alert_integrations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_integrations
    ADD CONSTRAINT alert_integrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: alert_notification_rules alert_notification_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_notification_rules
    ADD CONSTRAINT alert_notification_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: alert_suppression_rules alert_suppression_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_suppression_rules
    ADD CONSTRAINT alert_suppression_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: alert_suppression_rules alert_suppression_rules_match_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_suppression_rules
    ADD CONSTRAINT alert_suppression_rules_match_asset_id_fkey FOREIGN KEY (match_asset_id) REFERENCES public.assets(id);


--
-- Name: alert_suppression_rules alert_suppression_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_suppression_rules
    ADD CONSTRAINT alert_suppression_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: alerts alerts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE SET NULL;


--
-- Name: alerts alerts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: api_keys api_keys_key_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_owner_user_id_fkey FOREIGN KEY (key_owner_user_id) REFERENCES public.users(id);


--
-- Name: api_keys api_keys_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_parent_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_parent_key_id_fkey FOREIGN KEY (parent_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL;


--
-- Name: applications applications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: applications applications_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: applications applications_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: approval_steps approval_steps_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: approval_steps approval_steps_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id) ON DELETE CASCADE;


--
-- Name: approval_workflow_steps approval_workflow_steps_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflow_steps
    ADD CONSTRAINT approval_workflow_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id) ON DELETE CASCADE;


--
-- Name: approval_workflows approval_workflows_escalation_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_escalation_to_fkey FOREIGN KEY (escalation_to) REFERENCES public.users(id);


--
-- Name: approval_workflows approval_workflows_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_contacts asset_contacts_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_contacts
    ADD CONSTRAINT asset_contacts_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_contacts asset_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_contacts
    ADD CONSTRAINT asset_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: asset_contacts asset_contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_contacts
    ADD CONSTRAINT asset_contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_credentials asset_credentials_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_credentials
    ADD CONSTRAINT asset_credentials_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_documents asset_documents_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_documents
    ADD CONSTRAINT asset_documents_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_files asset_files_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_files
    ADD CONSTRAINT asset_files_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_files asset_files_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_files
    ADD CONSTRAINT asset_files_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_history asset_history_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_history asset_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_import_items asset_import_items_created_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_import_items
    ADD CONSTRAINT asset_import_items_created_asset_id_fkey FOREIGN KEY (created_asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: asset_import_items asset_import_items_import_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_import_items
    ADD CONSTRAINT asset_import_items_import_job_id_fkey FOREIGN KEY (import_job_id) REFERENCES public.asset_import_jobs(id) ON DELETE CASCADE;


--
-- Name: asset_import_jobs asset_import_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_import_jobs
    ADD CONSTRAINT asset_import_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_import_jobs asset_import_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_import_jobs
    ADD CONSTRAINT asset_import_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_interfaces asset_interfaces_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_interfaces
    ADD CONSTRAINT asset_interfaces_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_models asset_models_asset_subtype_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_models
    ADD CONSTRAINT asset_models_asset_subtype_id_fkey FOREIGN KEY (asset_subtype_id) REFERENCES public.asset_subtypes(id) ON DELETE CASCADE;


--
-- Name: asset_models asset_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_models
    ADD CONSTRAINT asset_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_models asset_models_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_models
    ADD CONSTRAINT asset_models_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: asset_naming_templates asset_naming_templates_asset_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_naming_templates
    ADD CONSTRAINT asset_naming_templates_asset_type_id_fkey FOREIGN KEY (asset_type_id) REFERENCES public.asset_types(id) ON DELETE CASCADE;


--
-- Name: asset_naming_templates asset_naming_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_naming_templates
    ADD CONSTRAINT asset_naming_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_request_tiers asset_request_tiers_approver_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_request_tiers
    ADD CONSTRAINT asset_request_tiers_approver_role_id_fkey FOREIGN KEY (approver_role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- Name: asset_request_tiers asset_request_tiers_approver_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_request_tiers
    ADD CONSTRAINT asset_request_tiers_approver_user_id_fkey FOREIGN KEY (approver_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_request_tiers asset_request_tiers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_request_tiers
    ADD CONSTRAINT asset_request_tiers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_requests asset_requests_assigned_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_requests
    ADD CONSTRAINT asset_requests_assigned_asset_id_fkey FOREIGN KEY (assigned_asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: asset_requests asset_requests_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_requests
    ADD CONSTRAINT asset_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_requests asset_requests_for_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_requests
    ADD CONSTRAINT asset_requests_for_contact_id_fkey FOREIGN KEY (for_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: asset_requests asset_requests_fulfilled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_requests
    ADD CONSTRAINT asset_requests_fulfilled_by_fkey FOREIGN KEY (fulfilled_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_requests asset_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_requests
    ADD CONSTRAINT asset_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_requests asset_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_requests
    ADD CONSTRAINT asset_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: asset_requests asset_requests_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_requests
    ADD CONSTRAINT asset_requests_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.asset_request_tiers(id) ON DELETE CASCADE;


--
-- Name: asset_retrieval_assignments asset_retrieval_assignments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_retrieval_assignments
    ADD CONSTRAINT asset_retrieval_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_retrieval_assignments asset_retrieval_assignments_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_retrieval_assignments
    ADD CONSTRAINT asset_retrieval_assignments_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: asset_retrieval_assignments asset_retrieval_assignments_collected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_retrieval_assignments
    ADD CONSTRAINT asset_retrieval_assignments_collected_by_fkey FOREIGN KEY (collected_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_retrieval_assignments asset_retrieval_assignments_offboarding_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_retrieval_assignments
    ADD CONSTRAINT asset_retrieval_assignments_offboarding_request_id_fkey FOREIGN KEY (offboarding_request_id) REFERENCES public.offboarding_requests(id) ON DELETE CASCADE;


--
-- Name: asset_retrieval_assignments asset_retrieval_assignments_returned_to_stock_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_retrieval_assignments
    ADD CONSTRAINT asset_retrieval_assignments_returned_to_stock_by_fkey FOREIGN KEY (returned_to_stock_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_retrieval_assignments asset_retrieval_assignments_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_retrieval_assignments
    ADD CONSTRAINT asset_retrieval_assignments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_software asset_software_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_software
    ADD CONSTRAINT asset_software_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_software asset_software_software_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_software
    ADD CONSTRAINT asset_software_software_id_fkey FOREIGN KEY (software_id) REFERENCES public.software(id) ON DELETE CASCADE;


--
-- Name: asset_status_requestability asset_status_requestability_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_status_requestability
    ADD CONSTRAINT asset_status_requestability_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_subtypes asset_subtypes_asset_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_subtypes
    ADD CONSTRAINT asset_subtypes_asset_type_id_fkey FOREIGN KEY (asset_type_id) REFERENCES public.asset_types(id) ON DELETE CASCADE;


--
-- Name: asset_subtypes asset_subtypes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_subtypes
    ADD CONSTRAINT asset_subtypes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_tags asset_tags_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_tags
    ADD CONSTRAINT asset_tags_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_tags asset_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_tags
    ADD CONSTRAINT asset_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: asset_tickets asset_tickets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_tickets
    ADD CONSTRAINT asset_tickets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_tickets asset_tickets_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_tickets
    ADD CONSTRAINT asset_tickets_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: asset_types asset_types_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_types
    ADD CONSTRAINT asset_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: assets assets_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: assets assets_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: assets assets_created_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_created_by_provider_id_fkey FOREIGN KEY (created_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: assets assets_deleted_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_deleted_by_provider_id_fkey FOREIGN KEY (deleted_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: assets assets_deleted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES public.users(id);


--
-- Name: assets assets_last_modified_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_last_modified_by_provider_id_fkey FOREIGN KEY (last_modified_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: assets assets_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: assets assets_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.asset_models(id) ON DELETE SET NULL;


--
-- Name: assets assets_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: assets assets_os_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_os_id_fkey FOREIGN KEY (os_id) REFERENCES public.operating_systems(id) ON DELETE SET NULL;


--
-- Name: assets assets_request_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_request_tier_id_fkey FOREIGN KEY (request_tier_id) REFERENCES public.asset_request_tiers(id) ON DELETE SET NULL;


--
-- Name: assets assets_restored_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_restored_by_user_id_fkey FOREIGN KEY (restored_by_user_id) REFERENCES public.users(id);


--
-- Name: assets assets_subtype_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_subtype_id_fkey FOREIGN KEY (subtype_id) REFERENCES public.asset_subtypes(id) ON DELETE SET NULL;


--
-- Name: assets assets_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.asset_types(id);


--
-- Name: audit_log audit_log_revoked_by_cascade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_revoked_by_cascade_id_fkey FOREIGN KEY (revoked_by_cascade_id) REFERENCES public.audit_log(id);


--
-- Name: backlog_comments backlog_comments_backlog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backlog_comments
    ADD CONSTRAINT backlog_comments_backlog_item_id_fkey FOREIGN KEY (backlog_item_id) REFERENCES public.team_backlog_items(id) ON DELETE CASCADE;


--
-- Name: backlog_comments backlog_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backlog_comments
    ADD CONSTRAINT backlog_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: badge_retrieval_assignments badge_retrieval_assignments_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badge_retrieval_assignments
    ADD CONSTRAINT badge_retrieval_assignments_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: badge_retrieval_assignments badge_retrieval_assignments_collected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badge_retrieval_assignments
    ADD CONSTRAINT badge_retrieval_assignments_collected_by_fkey FOREIGN KEY (collected_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: badge_retrieval_assignments badge_retrieval_assignments_deactivated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badge_retrieval_assignments
    ADD CONSTRAINT badge_retrieval_assignments_deactivated_by_fkey FOREIGN KEY (deactivated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: badge_retrieval_assignments badge_retrieval_assignments_offboarding_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badge_retrieval_assignments
    ADD CONSTRAINT badge_retrieval_assignments_offboarding_request_id_fkey FOREIGN KEY (offboarding_request_id) REFERENCES public.offboarding_requests(id) ON DELETE CASCADE;


--
-- Name: break_glass_incidents break_glass_incidents_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_incidents
    ADD CONSTRAINT break_glass_incidents_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.credentials(id);


--
-- Name: break_glass_incidents break_glass_incidents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_incidents
    ADD CONSTRAINT break_glass_incidents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: break_glass_incidents break_glass_incidents_provider_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_incidents
    ADD CONSTRAINT break_glass_incidents_provider_api_key_id_fkey FOREIGN KEY (provider_api_key_id) REFERENCES public.provider_api_keys(id);


--
-- Name: break_glass_incidents break_glass_incidents_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_incidents
    ADD CONSTRAINT break_glass_incidents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: bulk_access_operations bulk_access_operations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_access_operations
    ADD CONSTRAINT bulk_access_operations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bulk_access_operations bulk_access_operations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_access_operations
    ADD CONSTRAINT bulk_access_operations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: bulk_access_operations bulk_access_operations_target_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_access_operations
    ADD CONSTRAINT bulk_access_operations_target_contact_id_fkey FOREIGN KEY (target_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: bulk_access_operations bulk_access_operations_target_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_access_operations
    ADD CONSTRAINT bulk_access_operations_target_service_id_fkey FOREIGN KEY (target_service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: cascade_revocation_queue cascade_revocation_queue_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cascade_revocation_queue
    ADD CONSTRAINT cascade_revocation_queue_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: cascade_revocation_queue cascade_revocation_queue_cascade_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cascade_revocation_queue
    ADD CONSTRAINT cascade_revocation_queue_cascade_audit_id_fkey FOREIGN KEY (cascade_audit_id) REFERENCES public.audit_log(id);


--
-- Name: cascade_revocation_queue cascade_revocation_queue_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cascade_revocation_queue
    ADD CONSTRAINT cascade_revocation_queue_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: cascade_revocation_queue cascade_revocation_queue_pairing_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cascade_revocation_queue
    ADD CONSTRAINT cascade_revocation_queue_pairing_key_id_fkey FOREIGN KEY (pairing_key_id) REFERENCES public.api_keys(id);


--
-- Name: catalog_bundles catalog_bundles_bundle_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_bundles
    ADD CONSTRAINT catalog_bundles_bundle_item_id_fkey FOREIGN KEY (bundle_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE;


--
-- Name: catalog_bundles catalog_bundles_included_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_bundles
    ADD CONSTRAINT catalog_bundles_included_item_id_fkey FOREIGN KEY (included_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE;


--
-- Name: catalog_categories catalog_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT catalog_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: catalog_categories catalog_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT catalog_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.catalog_categories(id) ON DELETE CASCADE;


--
-- Name: catalog_items catalog_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_items
    ADD CONSTRAINT catalog_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.catalog_categories(id);


--
-- Name: catalog_items catalog_items_fulfillment_team_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_items
    ADD CONSTRAINT catalog_items_fulfillment_team_fkey FOREIGN KEY (fulfillment_team) REFERENCES public.user_roles(id);


--
-- Name: catalog_items catalog_items_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_items
    ADD CONSTRAINT catalog_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: category_requests category_requests_created_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_requests
    ADD CONSTRAINT category_requests_created_category_id_fkey FOREIGN KEY (created_category_id) REFERENCES public.ticket_categories(id) ON DELETE SET NULL;


--
-- Name: category_requests category_requests_merged_into_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_requests
    ADD CONSTRAINT category_requests_merged_into_category_id_fkey FOREIGN KEY (merged_into_category_id) REFERENCES public.ticket_categories(id) ON DELETE SET NULL;


--
-- Name: category_requests category_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_requests
    ADD CONSTRAINT category_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: category_requests category_requests_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_requests
    ADD CONSTRAINT category_requests_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: category_requests category_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_requests
    ADD CONSTRAINT category_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: category_requests category_requests_suggested_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_requests
    ADD CONSTRAINT category_requests_suggested_parent_id_fkey FOREIGN KEY (suggested_parent_id) REFERENCES public.ticket_categories(id) ON DELETE SET NULL;


--
-- Name: category_requests category_requests_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_requests
    ADD CONSTRAINT category_requests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: certificate_alerts certificate_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_alerts
    ADD CONSTRAINT certificate_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: certificate_alerts certificate_alerts_certificate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_alerts
    ADD CONSTRAINT certificate_alerts_certificate_id_fkey FOREIGN KEY (certificate_id) REFERENCES public.certificates(id) ON DELETE CASCADE;


--
-- Name: certificate_alerts certificate_alerts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_alerts
    ADD CONSTRAINT certificate_alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: certificate_alerts certificate_alerts_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_alerts
    ADD CONSTRAINT certificate_alerts_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: certificate_assets certificate_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_assets
    ADD CONSTRAINT certificate_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: certificate_assets certificate_assets_certificate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_assets
    ADD CONSTRAINT certificate_assets_certificate_id_fkey FOREIGN KEY (certificate_id) REFERENCES public.certificates(id) ON DELETE CASCADE;


--
-- Name: certificate_history certificate_history_certificate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_history
    ADD CONSTRAINT certificate_history_certificate_id_fkey FOREIGN KEY (certificate_id) REFERENCES public.certificates(id) ON DELETE CASCADE;


--
-- Name: certificate_history certificate_history_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_history
    ADD CONSTRAINT certificate_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: certificates certificates_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: certificates certificates_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE SET NULL;


--
-- Name: certificates certificates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: chat_handoffs chat_handoffs_assigned_team_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_handoffs
    ADD CONSTRAINT chat_handoffs_assigned_team_fkey FOREIGN KEY (assigned_team) REFERENCES public.user_roles(id);


--
-- Name: chat_handoffs chat_handoffs_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_handoffs
    ADD CONSTRAINT chat_handoffs_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: chat_handoffs chat_handoffs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_handoffs
    ADD CONSTRAINT chat_handoffs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_quick_replies chat_quick_replies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_quick_replies
    ADD CONSTRAINT chat_quick_replies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: chat_quick_replies chat_quick_replies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_quick_replies
    ADD CONSTRAINT chat_quick_replies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: chat_ticket_conversions chat_ticket_conversions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_ticket_conversions
    ADD CONSTRAINT chat_ticket_conversions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_ticket_conversions chat_ticket_conversions_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_ticket_conversions
    ADD CONSTRAINT chat_ticket_conversions_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: checklist_template_items checklist_template_items_default_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_items
    ADD CONSTRAINT checklist_template_items_default_assignee_id_fkey FOREIGN KEY (default_assignee_id) REFERENCES public.users(id);


--
-- Name: checklist_template_items checklist_template_items_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_items
    ADD CONSTRAINT checklist_template_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: checklist_template_items checklist_template_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_items
    ADD CONSTRAINT checklist_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE CASCADE;


--
-- Name: checklist_templates checklist_templates_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id);


--
-- Name: checklist_templates checklist_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: checklist_templates checklist_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: company_tag_assignments client_tag_assignments_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_tag_assignments
    ADD CONSTRAINT client_tag_assignments_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.company_tags(id) ON DELETE CASCADE;


--
-- Name: company_tags client_tags_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_tags
    ADD CONSTRAINT client_tags_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: companies clients_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT clients_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: company_tag_assignments company_tag_assignments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_tag_assignments
    ADD CONSTRAINT company_tag_assignments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: contact_credentials contact_credentials_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_credentials
    ADD CONSTRAINT contact_credentials_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: contact_credentials contact_credentials_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_credentials
    ADD CONSTRAINT contact_credentials_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contact_credentials contact_credentials_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_credentials
    ADD CONSTRAINT contact_credentials_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.credentials(id) ON DELETE CASCADE;


--
-- Name: contact_files contact_files_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_files
    ADD CONSTRAINT contact_files_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: contact_files contact_files_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_files
    ADD CONSTRAINT contact_files_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contact_group_members contact_group_members_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_group_members
    ADD CONSTRAINT contact_group_members_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: contact_group_members contact_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_group_members
    ADD CONSTRAINT contact_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.contact_groups(id) ON DELETE CASCADE;


--
-- Name: contact_groups contact_groups_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_groups
    ADD CONSTRAINT contact_groups_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contact_tags contact_tags_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT contact_tags_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: contact_tags contact_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT contact_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_created_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_created_by_provider_id_fkey FOREIGN KEY (created_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: contacts contacts_deleted_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_deleted_by_provider_id_fkey FOREIGN KEY (deleted_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: contacts contacts_deleted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES public.users(id);


--
-- Name: contacts contacts_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_employment_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_employment_type_id_fkey FOREIGN KEY (employment_type_id) REFERENCES public.employment_types(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_job_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_job_title_id_fkey FOREIGN KEY (job_title_id) REFERENCES public.job_titles(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_last_modified_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_last_modified_by_provider_id_fkey FOREIGN KEY (last_modified_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: contacts contacts_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_reports_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_reports_to_id_fkey FOREIGN KEY (reports_to_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_restored_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_restored_by_user_id_fkey FOREIGN KEY (restored_by_user_id) REFERENCES public.users(id);


--
-- Name: contracts contracts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: credential_access_checkins credential_access_checkins_access_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_checkins
    ADD CONSTRAINT credential_access_checkins_access_request_id_fkey FOREIGN KEY (access_request_id) REFERENCES public.credential_access_requests(id) ON DELETE CASCADE;


--
-- Name: credential_access credential_access_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access
    ADD CONSTRAINT credential_access_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.credentials(id) ON DELETE CASCADE;


--
-- Name: credential_access credential_access_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access
    ADD CONSTRAINT credential_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: credential_access_log credential_access_log_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_log
    ADD CONSTRAINT credential_access_log_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.credentials(id) ON DELETE CASCADE;


--
-- Name: credential_access_log credential_access_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_log
    ADD CONSTRAINT credential_access_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: credential_access_requests credential_access_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_requests
    ADD CONSTRAINT credential_access_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: credential_access_requests credential_access_requests_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_requests
    ADD CONSTRAINT credential_access_requests_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.credentials(id) ON DELETE CASCADE;


--
-- Name: credential_access_requests credential_access_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_requests
    ADD CONSTRAINT credential_access_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: credential_access_requests credential_access_requests_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_requests
    ADD CONSTRAINT credential_access_requests_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.credential_sharing_policies(id);


--
-- Name: credential_access_requests credential_access_requests_provider_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_requests
    ADD CONSTRAINT credential_access_requests_provider_api_key_id_fkey FOREIGN KEY (provider_api_key_id) REFERENCES public.provider_api_keys(id);


--
-- Name: credential_access credential_access_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access
    ADD CONSTRAINT credential_access_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;


--
-- Name: credential_access credential_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access
    ADD CONSTRAINT credential_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: credential_categories credential_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_categories
    ADD CONSTRAINT credential_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: credential_contributions credential_contributions_client_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_contributions
    ADD CONSTRAINT credential_contributions_client_acknowledged_by_fkey FOREIGN KEY (client_acknowledged_by) REFERENCES public.users(id);


--
-- Name: credential_contributions credential_contributions_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_contributions
    ADD CONSTRAINT credential_contributions_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.credentials(id) ON DELETE SET NULL;


--
-- Name: credential_contributions credential_contributions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_contributions
    ADD CONSTRAINT credential_contributions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: credential_contributions credential_contributions_provider_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_contributions
    ADD CONSTRAINT credential_contributions_provider_api_key_id_fkey FOREIGN KEY (provider_api_key_id) REFERENCES public.provider_api_keys(id);


--
-- Name: credential_contributions credential_contributions_related_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_contributions
    ADD CONSTRAINT credential_contributions_related_ticket_id_fkey FOREIGN KEY (related_ticket_id) REFERENCES public.tickets(id);


--
-- Name: credential_links credential_links_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_links
    ADD CONSTRAINT credential_links_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.credentials(id) ON DELETE CASCADE;


--
-- Name: credential_reveal_log credential_reveal_log_access_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_reveal_log
    ADD CONSTRAINT credential_reveal_log_access_request_id_fkey FOREIGN KEY (access_request_id) REFERENCES public.credential_access_requests(id);


--
-- Name: credential_reveal_log credential_reveal_log_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_reveal_log
    ADD CONSTRAINT credential_reveal_log_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.credentials(id) ON DELETE CASCADE;


--
-- Name: credential_reveal_log credential_reveal_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_reveal_log
    ADD CONSTRAINT credential_reveal_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: credential_reveal_log credential_reveal_log_revealed_by_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_reveal_log
    ADD CONSTRAINT credential_reveal_log_revealed_by_api_key_id_fkey FOREIGN KEY (revealed_by_api_key_id) REFERENCES public.provider_api_keys(id);


--
-- Name: credential_reveal_log credential_reveal_log_revealed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_reveal_log
    ADD CONSTRAINT credential_reveal_log_revealed_by_user_id_fkey FOREIGN KEY (revealed_by_user_id) REFERENCES public.users(id);


--
-- Name: credential_sharing_policies credential_sharing_policies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_sharing_policies
    ADD CONSTRAINT credential_sharing_policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: credential_sharing_policies credential_sharing_policies_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_sharing_policies
    ADD CONSTRAINT credential_sharing_policies_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.credentials(id) ON DELETE CASCADE;


--
-- Name: credential_sharing_policies credential_sharing_policies_provider_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_sharing_policies
    ADD CONSTRAINT credential_sharing_policies_provider_api_key_id_fkey FOREIGN KEY (provider_api_key_id) REFERENCES public.provider_api_keys(id) ON DELETE CASCADE;


--
-- Name: credential_tags credential_tags_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_tags
    ADD CONSTRAINT credential_tags_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.credentials(id) ON DELETE CASCADE;


--
-- Name: credential_tags credential_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_tags
    ADD CONSTRAINT credential_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: credentials credentials_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: credentials credentials_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: credentials credentials_created_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_created_by_provider_id_fkey FOREIGN KEY (created_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: credentials credentials_deleted_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_deleted_by_provider_id_fkey FOREIGN KEY (deleted_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: credentials credentials_deleted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES public.users(id);


--
-- Name: credentials credentials_last_modified_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_last_modified_by_provider_id_fkey FOREIGN KEY (last_modified_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: credentials credentials_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: credentials credentials_restored_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_restored_by_user_id_fkey FOREIGN KEY (restored_by_user_id) REFERENCES public.users(id);


--
-- Name: credentials credentials_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dashboard_configs dashboard_configs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_configs
    ADD CONSTRAINT dashboard_configs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dashboard_configs dashboard_configs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_configs
    ADD CONSTRAINT dashboard_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: data_retention_policies data_retention_policies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: delegation_rules delegation_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegation_rules
    ADD CONSTRAINT delegation_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: delegation_rules delegation_rules_target_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegation_rules
    ADD CONSTRAINT delegation_rules_target_group_id_fkey FOREIGN KEY (target_group_id) REFERENCES public.user_groups(id);


--
-- Name: delegation_transfers delegation_transfers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegation_transfers
    ADD CONSTRAINT delegation_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: delegation_transfers delegation_transfers_delegate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegation_transfers
    ADD CONSTRAINT delegation_transfers_delegate_id_fkey FOREIGN KEY (delegate_id) REFERENCES public.users(id);


--
-- Name: delegation_transfers delegation_transfers_delegator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegation_transfers
    ADD CONSTRAINT delegation_transfers_delegator_id_fkey FOREIGN KEY (delegator_id) REFERENCES public.users(id);


--
-- Name: delegation_transfers delegation_transfers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegation_transfers
    ADD CONSTRAINT delegation_transfers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: departments departments_head_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_head_contact_id_fkey FOREIGN KEY (head_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: departments departments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: dns_change_alerts dns_change_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_alerts
    ADD CONSTRAINT dns_change_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: dns_change_alerts dns_change_alerts_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_alerts
    ADD CONSTRAINT dns_change_alerts_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: dns_change_alerts dns_change_alerts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_alerts
    ADD CONSTRAINT dns_change_alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: dns_change_alerts dns_change_alerts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_alerts
    ADD CONSTRAINT dns_change_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: dns_change_alerts dns_change_alerts_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_alerts
    ADD CONSTRAINT dns_change_alerts_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.dns_monitoring_snapshots(id);


--
-- Name: dns_change_alerts dns_change_alerts_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_alerts
    ADD CONSTRAINT dns_change_alerts_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: dns_change_windows dns_change_windows_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_windows
    ADD CONSTRAINT dns_change_windows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: dns_change_windows dns_change_windows_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_windows
    ADD CONSTRAINT dns_change_windows_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: dns_change_windows dns_change_windows_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_windows
    ADD CONSTRAINT dns_change_windows_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: dns_change_windows dns_change_windows_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_change_windows
    ADD CONSTRAINT dns_change_windows_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: dns_monitoring_schedules dns_monitoring_schedules_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_monitoring_schedules
    ADD CONSTRAINT dns_monitoring_schedules_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: dns_monitoring_schedules dns_monitoring_schedules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_monitoring_schedules
    ADD CONSTRAINT dns_monitoring_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: dns_monitoring_snapshots dns_monitoring_snapshots_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_monitoring_snapshots
    ADD CONSTRAINT dns_monitoring_snapshots_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: dns_records dns_records_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dns_records
    ADD CONSTRAINT dns_records_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: document_attachments document_attachments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_attachments
    ADD CONSTRAINT document_attachments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_attachments document_attachments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_attachments
    ADD CONSTRAINT document_attachments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: document_attachments document_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_attachments
    ADD CONSTRAINT document_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_shares document_shares_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_shares document_shares_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: document_shares document_shares_shared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_templates document_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_templates document_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: document_versions document_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_versions document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: documents documents_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: documents documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: documents documents_created_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_provider_id_fkey FOREIGN KEY (created_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: documents documents_deleted_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_deleted_by_provider_id_fkey FOREIGN KEY (deleted_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: documents documents_deleted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES public.users(id);


--
-- Name: documents documents_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: documents documents_last_modified_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_last_modified_by_provider_id_fkey FOREIGN KEY (last_modified_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: documents documents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: documents documents_restored_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_restored_by_user_id_fkey FOREIGN KEY (restored_by_user_id) REFERENCES public.users(id);


--
-- Name: documents documents_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: domain_history domain_history_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_history
    ADD CONSTRAINT domain_history_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: domain_history domain_history_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_history
    ADD CONSTRAINT domain_history_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: domain_history domain_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_history
    ADD CONSTRAINT domain_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: domain_history domain_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_history
    ADD CONSTRAINT domain_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: domains domains_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: domains domains_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: dynamic_group_members dynamic_group_members_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_group_members
    ADD CONSTRAINT dynamic_group_members_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: dynamic_group_members dynamic_group_members_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_group_members
    ADD CONSTRAINT dynamic_group_members_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: dynamic_group_members dynamic_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_group_members
    ADD CONSTRAINT dynamic_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.dynamic_groups(id) ON DELETE CASCADE;


--
-- Name: dynamic_group_members dynamic_group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_group_members
    ADD CONSTRAINT dynamic_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dynamic_group_rules dynamic_group_rules_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_group_rules
    ADD CONSTRAINT dynamic_group_rules_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.dynamic_groups(id) ON DELETE CASCADE;


--
-- Name: dynamic_groups dynamic_groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_groups
    ADD CONSTRAINT dynamic_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dynamic_groups dynamic_groups_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_groups
    ADD CONSTRAINT dynamic_groups_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: email_attempts email_attempts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_attempts
    ADD CONSTRAINT email_attempts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: email_delivery_logs email_delivery_logs_email_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_delivery_logs
    ADD CONSTRAINT email_delivery_logs_email_queue_id_fkey FOREIGN KEY (email_queue_id) REFERENCES public.email_queue(id) ON DELETE CASCADE;


--
-- Name: email_events email_events_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.email_queue(id) ON DELETE CASCADE;


--
-- Name: email_preferences email_preferences_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: email_preferences email_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: email_queue email_queue_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: email_queue email_queue_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id);


--
-- Name: email_settings email_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_settings
    ADD CONSTRAINT email_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: email_templates email_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employment_types employment_types_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_types
    ADD CONSTRAINT employment_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: feature_usage_log feature_usage_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_usage_log
    ADD CONSTRAINT feature_usage_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: feature_usage_log feature_usage_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_usage_log
    ADD CONSTRAINT feature_usage_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: files files_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: files files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_credentials fk_asset_credentials_credential; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_credentials
    ADD CONSTRAINT fk_asset_credentials_credential FOREIGN KEY (credential_id) REFERENCES public.credentials(id) ON DELETE CASCADE;


--
-- Name: asset_documents fk_asset_documents_document; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_documents
    ADD CONSTRAINT fk_asset_documents_document FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: inbound_email_log fk_inbound_email_log_reply; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_email_log
    ADD CONSTRAINT fk_inbound_email_log_reply FOREIGN KEY (reply_id) REFERENCES public.ticket_replies(id) ON DELETE SET NULL;


--
-- Name: ticket_replies fk_ticket_replies_source_mailbox; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_replies
    ADD CONSTRAINT fk_ticket_replies_source_mailbox FOREIGN KEY (source_mailbox_id) REFERENCES public.inbound_mailboxes(id) ON DELETE SET NULL;


--
-- Name: tickets fk_tickets_asset; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT fk_tickets_asset FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: tickets fk_tickets_contact; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT fk_tickets_contact FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: tickets fk_tickets_location; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT fk_tickets_location FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: tickets fk_tickets_source_mailbox; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT fk_tickets_source_mailbox FOREIGN KEY (source_mailbox_id) REFERENCES public.inbound_mailboxes(id) ON DELETE SET NULL;


--
-- Name: folder_permissions folder_permissions_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folder_permissions
    ADD CONSTRAINT folder_permissions_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: folder_permissions folder_permissions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folder_permissions
    ADD CONSTRAINT folder_permissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: folders folders_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: folders folders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: folders folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: group_permissions group_permissions_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_permissions
    ADD CONSTRAINT group_permissions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.user_groups(id) ON DELETE CASCADE;


--
-- Name: group_permissions group_permissions_permission_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_permissions
    ADD CONSTRAINT group_permissions_permission_set_id_fkey FOREIGN KEY (permission_set_id) REFERENCES public.permission_sets(id) ON DELETE CASCADE;


--
-- Name: inbound_email_log inbound_email_log_mailbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_email_log
    ADD CONSTRAINT inbound_email_log_mailbox_id_fkey FOREIGN KEY (mailbox_id) REFERENCES public.inbound_mailboxes(id) ON DELETE CASCADE;


--
-- Name: inbound_email_log inbound_email_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_email_log
    ADD CONSTRAINT inbound_email_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: inbound_email_log inbound_email_log_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_email_log
    ADD CONSTRAINT inbound_email_log_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: inbound_mailboxes inbound_mailboxes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_mailboxes
    ADD CONSTRAINT inbound_mailboxes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: inbound_mailboxes inbound_mailboxes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_mailboxes
    ADD CONSTRAINT inbound_mailboxes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: incident_timeline incident_timeline_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_timeline
    ADD CONSTRAINT incident_timeline_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE CASCADE;


--
-- Name: incident_timeline incident_timeline_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_timeline
    ADD CONSTRAINT incident_timeline_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: incidents incidents_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: incidents incidents_assigned_team_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_assigned_team_fkey FOREIGN KEY (assigned_team) REFERENCES public.user_roles(id);


--
-- Name: incidents incidents_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: incidents incidents_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: incidents incidents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: incidents incidents_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: incidents incidents_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: interface_links interface_links_source_interface_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interface_links
    ADD CONSTRAINT interface_links_source_interface_id_fkey FOREIGN KEY (source_interface_id) REFERENCES public.asset_interfaces(id) ON DELETE CASCADE;


--
-- Name: interface_links interface_links_target_interface_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interface_links
    ADD CONSTRAINT interface_links_target_interface_id_fkey FOREIGN KEY (target_interface_id) REFERENCES public.asset_interfaces(id) ON DELETE CASCADE;


--
-- Name: job_title_entitlements job_title_entitlements_approval_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_title_entitlements
    ADD CONSTRAINT job_title_entitlements_approval_workflow_id_fkey FOREIGN KEY (approval_workflow_id) REFERENCES public.approval_workflows(id);


--
-- Name: job_title_entitlements job_title_entitlements_default_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_title_entitlements
    ADD CONSTRAINT job_title_entitlements_default_assignee_id_fkey FOREIGN KEY (default_assignee_id) REFERENCES public.users(id);


--
-- Name: job_title_entitlements job_title_entitlements_job_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_title_entitlements
    ADD CONSTRAINT job_title_entitlements_job_title_id_fkey FOREIGN KEY (job_title_id) REFERENCES public.job_titles(id) ON DELETE CASCADE;


--
-- Name: job_title_entitlements job_title_entitlements_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_title_entitlements
    ADD CONSTRAINT job_title_entitlements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: job_titles job_titles_cloned_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_titles
    ADD CONSTRAINT job_titles_cloned_from_id_fkey FOREIGN KEY (cloned_from_id) REFERENCES public.job_titles(id) ON DELETE SET NULL;


--
-- Name: job_titles job_titles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_titles
    ADD CONSTRAINT job_titles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: job_titles job_titles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_titles
    ADD CONSTRAINT job_titles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: kb_article_chunks kb_article_chunks_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_article_chunks
    ADD CONSTRAINT kb_article_chunks_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.kb_articles(id) ON DELETE CASCADE;


--
-- Name: kb_article_sources kb_article_sources_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_article_sources
    ADD CONSTRAINT kb_article_sources_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.kb_articles(id) ON DELETE CASCADE;


--
-- Name: kb_article_sources kb_article_sources_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_article_sources
    ADD CONSTRAINT kb_article_sources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: kb_categories kb_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_categories
    ADD CONSTRAINT kb_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: kb_categories kb_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_categories
    ADD CONSTRAINT kb_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.kb_categories(id) ON DELETE CASCADE;


--
-- Name: kb_contributors kb_contributors_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_contributors
    ADD CONSTRAINT kb_contributors_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: kb_contributors kb_contributors_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_contributors
    ADD CONSTRAINT kb_contributors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: kb_contributors kb_contributors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_contributors
    ADD CONSTRAINT kb_contributors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: kb_gaps kb_gaps_draft_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_gaps
    ADD CONSTRAINT kb_gaps_draft_article_id_fkey FOREIGN KEY (draft_article_id) REFERENCES public.kb_articles(id) ON DELETE SET NULL;


--
-- Name: kb_gaps kb_gaps_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_gaps
    ADD CONSTRAINT kb_gaps_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: kb_gaps kb_gaps_resolved_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_gaps
    ADD CONSTRAINT kb_gaps_resolved_ticket_id_fkey FOREIGN KEY (resolved_ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: kb_permissions kb_permissions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_permissions
    ADD CONSTRAINT kb_permissions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: kb_permissions kb_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_permissions
    ADD CONSTRAINT kb_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: kb_permissions kb_permissions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_permissions
    ADD CONSTRAINT kb_permissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: kb_permissions kb_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_permissions
    ADD CONSTRAINT kb_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;


--
-- Name: kb_permissions kb_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_permissions
    ADD CONSTRAINT kb_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: locations locations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: locations locations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: maintenance_history maintenance_history_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_history
    ADD CONSTRAINT maintenance_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: maintenance_history maintenance_history_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_history
    ADD CONSTRAINT maintenance_history_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.maintenance_schedules(id) ON DELETE CASCADE;


--
-- Name: maintenance_history maintenance_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_history
    ADD CONSTRAINT maintenance_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: maintenance_history maintenance_history_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_history
    ADD CONSTRAINT maintenance_history_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: maintenance_schedules maintenance_schedules_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: maintenance_schedules maintenance_schedules_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: maintenance_schedules maintenance_schedules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: maintenance_schedules maintenance_schedules_recurring_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_recurring_ticket_id_fkey FOREIGN KEY (recurring_ticket_id) REFERENCES public.recurring_tickets(id);


--
-- Name: manager_relationships manager_relationships_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_relationships
    ADD CONSTRAINT manager_relationships_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: manager_relationships manager_relationships_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_relationships
    ADD CONSTRAINT manager_relationships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: manager_relationships manager_relationships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_relationships
    ADD CONSTRAINT manager_relationships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: master_data_requests master_data_requests_onboarding_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_requests
    ADD CONSTRAINT master_data_requests_onboarding_request_id_fkey FOREIGN KEY (onboarding_request_id) REFERENCES public.onboarding_requests(id) ON DELETE SET NULL;


--
-- Name: master_data_requests master_data_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_requests
    ADD CONSTRAINT master_data_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: master_data_requests master_data_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_requests
    ADD CONSTRAINT master_data_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: master_data_requests master_data_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_requests
    ADD CONSTRAINT master_data_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: master_data_settings master_data_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_settings
    ADD CONSTRAINT master_data_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: master_data_settings master_data_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_settings
    ADD CONSTRAINT master_data_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: mcp_tools mcp_tools_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_tools
    ADD CONSTRAINT mcp_tools_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: networks networks_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.networks
    ADD CONSTRAINT networks_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: networks networks_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.networks
    ADD CONSTRAINT networks_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: networks networks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.networks
    ADD CONSTRAINT networks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notification_templates notification_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: notification_templates notification_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: offboarding_requests offboarding_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_requests
    ADD CONSTRAINT offboarding_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: offboarding_requests offboarding_requests_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_requests
    ADD CONSTRAINT offboarding_requests_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: offboarding_requests offboarding_requests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_requests
    ADD CONSTRAINT offboarding_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: offboarding_requests offboarding_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_requests
    ADD CONSTRAINT offboarding_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: offboarding_task_items offboarding_task_items_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_task_items
    ADD CONSTRAINT offboarding_task_items_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: offboarding_task_items offboarding_task_items_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_task_items
    ADD CONSTRAINT offboarding_task_items_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.user_assignments(id);


--
-- Name: offboarding_task_items offboarding_task_items_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_task_items
    ADD CONSTRAINT offboarding_task_items_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: offboarding_task_items offboarding_task_items_offboarding_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_task_items
    ADD CONSTRAINT offboarding_task_items_offboarding_id_fkey FOREIGN KEY (offboarding_id) REFERENCES public.offboarding_tasks(id) ON DELETE CASCADE;


--
-- Name: offboarding_tasks offboarding_tasks_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.users(id);


--
-- Name: offboarding_tasks offboarding_tasks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: offboarding_tasks offboarding_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: offboarding_templates offboarding_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_templates
    ADD CONSTRAINT offboarding_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: office_locations office_locations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_locations
    ADD CONSTRAINT office_locations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: office_locations office_locations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_locations
    ADD CONSTRAINT office_locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.office_locations(id) ON DELETE SET NULL;


--
-- Name: onboarding_requests onboarding_requests_buddy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_requests
    ADD CONSTRAINT onboarding_requests_buddy_id_fkey FOREIGN KEY (buddy_id) REFERENCES public.users(id);


--
-- Name: onboarding_requests onboarding_requests_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_requests
    ADD CONSTRAINT onboarding_requests_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: onboarding_requests onboarding_requests_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_requests
    ADD CONSTRAINT onboarding_requests_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.users(id);


--
-- Name: onboarding_requests onboarding_requests_job_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_requests
    ADD CONSTRAINT onboarding_requests_job_title_id_fkey FOREIGN KEY (job_title_id) REFERENCES public.job_titles(id) ON DELETE SET NULL;


--
-- Name: onboarding_requests onboarding_requests_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_requests
    ADD CONSTRAINT onboarding_requests_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: onboarding_requests onboarding_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_requests
    ADD CONSTRAINT onboarding_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: onboarding_requests onboarding_requests_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_requests
    ADD CONSTRAINT onboarding_requests_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: onboarding_requests onboarding_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_requests
    ADD CONSTRAINT onboarding_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: onboarding_tasks onboarding_tasks_asset_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_asset_request_id_fkey FOREIGN KEY (asset_request_id) REFERENCES public.asset_requests(id) ON DELETE SET NULL;


--
-- Name: onboarding_tasks onboarding_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: onboarding_tasks onboarding_tasks_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: onboarding_tasks onboarding_tasks_depends_on_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_depends_on_task_id_fkey FOREIGN KEY (depends_on_task_id) REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL;


--
-- Name: onboarding_tasks onboarding_tasks_onboarding_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_onboarding_request_id_fkey FOREIGN KEY (onboarding_request_id) REFERENCES public.onboarding_requests(id) ON DELETE CASCADE;


--
-- Name: onboarding_tasks onboarding_tasks_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: onboarding_wizard onboarding_wizard_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_wizard
    ADD CONSTRAINT onboarding_wizard_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: operating_systems operating_systems_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operating_systems
    ADD CONSTRAINT operating_systems_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_domains organization_domains_auto_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_domains
    ADD CONSTRAINT organization_domains_auto_role_id_fkey FOREIGN KEY (auto_role_id) REFERENCES public.user_roles(id);


--
-- Name: organization_domains organization_domains_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_domains
    ADD CONSTRAINT organization_domains_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_feature_flags organization_feature_flags_beta_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_feature_flags
    ADD CONSTRAINT organization_feature_flags_beta_acknowledged_by_fkey FOREIGN KEY (beta_acknowledged_by) REFERENCES public.users(id);


--
-- Name: organization_feature_flags organization_feature_flags_enabled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_feature_flags
    ADD CONSTRAINT organization_feature_flags_enabled_by_fkey FOREIGN KEY (enabled_by) REFERENCES public.users(id);


--
-- Name: organization_feature_flags organization_feature_flags_feature_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_feature_flags
    ADD CONSTRAINT organization_feature_flags_feature_key_fkey FOREIGN KEY (feature_key) REFERENCES public.feature_registry(feature_key) ON DELETE CASCADE;


--
-- Name: organization_feature_flags organization_feature_flags_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_feature_flags
    ADD CONSTRAINT organization_feature_flags_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_features organization_features_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_features
    ADD CONSTRAINT organization_features_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: permission_sets permission_sets_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_sets
    ADD CONSTRAINT permission_sets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_activity project_activity_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_activity
    ADD CONSTRAINT project_activity_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: project_activity project_activity_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_activity
    ADD CONSTRAINT project_activity_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_documents project_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_documents project_documents_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: project_documents project_documents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_milestones project_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: project_tasks project_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_tasks project_tasks_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.project_milestones(id) ON DELETE SET NULL;


--
-- Name: project_tasks project_tasks_parent_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.project_tasks(id);


--
-- Name: project_tasks project_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id);


--
-- Name: project_tasks project_tasks_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: project_templates project_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_templates
    ADD CONSTRAINT project_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_templates project_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_templates
    ADD CONSTRAINT project_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_tickets project_tickets_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tickets
    ADD CONSTRAINT project_tickets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_tickets project_tickets_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tickets
    ADD CONSTRAINT project_tickets_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: projects projects_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: projects projects_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_parent_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_parent_project_id_fkey FOREIGN KEY (parent_project_id) REFERENCES public.projects(id);


--
-- Name: projects projects_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.project_templates(id);


--
-- Name: provider_access_grants provider_access_grants_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_access_grants
    ADD CONSTRAINT provider_access_grants_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: provider_access_grants provider_access_grants_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_access_grants
    ADD CONSTRAINT provider_access_grants_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: provider_access_grants provider_access_grants_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_access_grants
    ADD CONSTRAINT provider_access_grants_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.service_providers(id) ON DELETE CASCADE;


--
-- Name: provider_access_grants provider_access_grants_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_access_grants
    ADD CONSTRAINT provider_access_grants_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);


--
-- Name: provider_action_log provider_action_log_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_action_log
    ADD CONSTRAINT provider_action_log_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.provider_api_keys(id);


--
-- Name: provider_action_log provider_action_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_action_log
    ADD CONSTRAINT provider_action_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: provider_api_keys provider_api_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_api_keys
    ADD CONSTRAINT provider_api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: provider_api_keys provider_api_keys_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_api_keys
    ADD CONSTRAINT provider_api_keys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: provider_api_keys provider_api_keys_required_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_api_keys
    ADD CONSTRAINT provider_api_keys_required_contract_id_fkey FOREIGN KEY (required_contract_id) REFERENCES public.provider_contracts(id);


--
-- Name: provider_api_keys provider_api_keys_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_api_keys
    ADD CONSTRAINT provider_api_keys_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);


--
-- Name: provider_contract_acknowledgments provider_contract_acknowledgments_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contract_acknowledgments
    ADD CONSTRAINT provider_contract_acknowledgments_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.provider_contracts(id) ON DELETE CASCADE;


--
-- Name: provider_contracts provider_contracts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contracts
    ADD CONSTRAINT provider_contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: provider_contracts provider_contracts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contracts
    ADD CONSTRAINT provider_contracts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: provider_contributions provider_contributions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contributions
    ADD CONSTRAINT provider_contributions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: provider_contributions provider_contributions_provider_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contributions
    ADD CONSTRAINT provider_contributions_provider_api_key_id_fkey FOREIGN KEY (provider_api_key_id) REFERENCES public.provider_api_keys(id);


--
-- Name: provider_contributions provider_contributions_related_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_contributions
    ADD CONSTRAINT provider_contributions_related_ticket_id_fkey FOREIGN KEY (related_ticket_id) REFERENCES public.tickets(id);


--
-- Name: provider_sessions provider_sessions_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_sessions
    ADD CONSTRAINT provider_sessions_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.provider_api_keys(id) ON DELETE CASCADE;


--
-- Name: provider_users provider_users_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_users
    ADD CONSTRAINT provider_users_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.service_providers(id) ON DELETE CASCADE;


--
-- Name: public_assets public_assets_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_assets
    ADD CONSTRAINT public_assets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: public_assets public_assets_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_assets
    ADD CONSTRAINT public_assets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: recurring_ticket_assets recurring_ticket_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_ticket_assets
    ADD CONSTRAINT recurring_ticket_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: recurring_ticket_assets recurring_ticket_assets_recurring_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_ticket_assets
    ADD CONSTRAINT recurring_ticket_assets_recurring_ticket_id_fkey FOREIGN KEY (recurring_ticket_id) REFERENCES public.recurring_tickets(id) ON DELETE CASCADE;


--
-- Name: recurring_ticket_instances recurring_ticket_instances_recurring_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_ticket_instances
    ADD CONSTRAINT recurring_ticket_instances_recurring_ticket_id_fkey FOREIGN KEY (recurring_ticket_id) REFERENCES public.recurring_tickets(id) ON DELETE CASCADE;


--
-- Name: recurring_ticket_instances recurring_ticket_instances_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_ticket_instances
    ADD CONSTRAINT recurring_ticket_instances_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: recurring_tickets recurring_tickets_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_tickets
    ADD CONSTRAINT recurring_tickets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: recurring_tickets recurring_tickets_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_tickets
    ADD CONSTRAINT recurring_tickets_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.ticket_templates(id) ON DELETE CASCADE;


--
-- Name: request_activity request_activity_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_activity
    ADD CONSTRAINT request_activity_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE CASCADE;


--
-- Name: request_activity request_activity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_activity
    ADD CONSTRAINT request_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: request_approvals request_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: request_approvals request_approvals_delegated_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_delegated_from_fkey FOREIGN KEY (delegated_from) REFERENCES public.users(id);


--
-- Name: request_approvals request_approvals_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE CASCADE;


--
-- Name: request_approvals request_approvals_workflow_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_workflow_step_id_fkey FOREIGN KEY (workflow_step_id) REFERENCES public.approval_workflow_steps(id);


--
-- Name: request_subcategories request_subcategories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_subcategories
    ADD CONSTRAINT request_subcategories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_set_id_fkey FOREIGN KEY (permission_set_id) REFERENCES public.permission_sets(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;


--
-- Name: roles roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: routing_rules routing_rules_assign_to_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_rules
    ADD CONSTRAINT routing_rules_assign_to_team_id_fkey FOREIGN KEY (assign_to_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: routing_rules routing_rules_assign_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_rules
    ADD CONSTRAINT routing_rules_assign_to_user_id_fkey FOREIGN KEY (assign_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: routing_rules routing_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_rules
    ADD CONSTRAINT routing_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: routing_rules routing_rules_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_rules
    ADD CONSTRAINT routing_rules_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: saas_services saas_services_account_owner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_services
    ADD CONSTRAINT saas_services_account_owner_fkey FOREIGN KEY (account_owner) REFERENCES public.users(id);


--
-- Name: saas_services saas_services_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_services
    ADD CONSTRAINT saas_services_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: service_assets service_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_assets
    ADD CONSTRAINT service_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: service_assets service_assets_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_assets
    ADD CONSTRAINT service_assets_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: service_categories service_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: service_credentials service_credentials_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_credentials
    ADD CONSTRAINT service_credentials_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.credentials(id) ON DELETE CASCADE;


--
-- Name: service_credentials service_credentials_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_credentials
    ADD CONSTRAINT service_credentials_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: service_owners service_owners_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_owners
    ADD CONSTRAINT service_owners_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: service_owners service_owners_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_owners
    ADD CONSTRAINT service_owners_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: service_owners service_owners_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_owners
    ADD CONSTRAINT service_owners_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: service_providers service_providers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_providers
    ADD CONSTRAINT service_providers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: service_providers service_providers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_providers
    ADD CONSTRAINT service_providers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: service_requests service_requests_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.user_assignments(id);


--
-- Name: service_requests service_requests_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id);


--
-- Name: service_requests service_requests_fulfilled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_fulfilled_by_fkey FOREIGN KEY (fulfilled_by) REFERENCES public.users(id);


--
-- Name: service_requests service_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: service_requests service_requests_requested_for_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_requested_for_id_fkey FOREIGN KEY (requested_for_id) REFERENCES public.users(id);


--
-- Name: service_requests service_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id);


--
-- Name: service_requests service_requests_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: service_requests service_requests_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id);


--
-- Name: services services_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id);


--
-- Name: services services_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: services services_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: site_settings site_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: smtp_settings smtp_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_settings
    ADD CONSTRAINT smtp_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: software_contacts software_contacts_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software_contacts
    ADD CONSTRAINT software_contacts_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: software_contacts software_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software_contacts
    ADD CONSTRAINT software_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: software_contacts software_contacts_software_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software_contacts
    ADD CONSTRAINT software_contacts_software_id_fkey FOREIGN KEY (software_id) REFERENCES public.software(id) ON DELETE CASCADE;


--
-- Name: software software_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software
    ADD CONSTRAINT software_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: support_conversations support_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: support_messages support_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.support_conversations(id) ON DELETE CASCADE;


--
-- Name: tags tags_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: task_checklist_items task_checklist_items_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_checklist_items
    ADD CONSTRAINT task_checklist_items_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: task_checklist_items task_checklist_items_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_checklist_items
    ADD CONSTRAINT task_checklist_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.project_tasks(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.project_tasks(id) ON DELETE CASCADE;


--
-- Name: task_time_entries task_time_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_time_entries
    ADD CONSTRAINT task_time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_time_entries task_time_entries_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_time_entries
    ADD CONSTRAINT task_time_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.project_tasks(id) ON DELETE CASCADE;


--
-- Name: task_time_entries task_time_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_time_entries
    ADD CONSTRAINT task_time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: team_backlog_items team_backlog_items_aborted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_backlog_items
    ADD CONSTRAINT team_backlog_items_aborted_by_fkey FOREIGN KEY (aborted_by) REFERENCES public.users(id);


--
-- Name: team_backlog_items team_backlog_items_converted_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_backlog_items
    ADD CONSTRAINT team_backlog_items_converted_ticket_id_fkey FOREIGN KEY (converted_ticket_id) REFERENCES public.tickets(id);


--
-- Name: team_backlog_items team_backlog_items_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_backlog_items
    ADD CONSTRAINT team_backlog_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: team_backlog_items team_backlog_items_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_backlog_items
    ADD CONSTRAINT team_backlog_items_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: team_backlog_items team_backlog_items_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_backlog_items
    ADD CONSTRAINT team_backlog_items_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: team_members team_members_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: teams teams_escalation_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_escalation_team_id_fkey FOREIGN KEY (escalation_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: teams teams_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: teams teams_parent_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_parent_team_id_fkey FOREIGN KEY (parent_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: teams teams_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: telemetry_consent_log telemetry_consent_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_consent_log
    ADD CONSTRAINT telemetry_consent_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: telemetry_consent_log telemetry_consent_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_consent_log
    ADD CONSTRAINT telemetry_consent_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: telemetry_log telemetry_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_log
    ADD CONSTRAINT telemetry_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: telemetry_settings telemetry_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_settings
    ADD CONSTRAINT telemetry_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: telemetry_settings telemetry_settings_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_settings
    ADD CONSTRAINT telemetry_settings_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_approvals ticket_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_approvals
    ADD CONSTRAINT ticket_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: ticket_approvals ticket_approvals_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_approvals
    ADD CONSTRAINT ticket_approvals_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_approvals ticket_approvals_workflow_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_approvals
    ADD CONSTRAINT ticket_approvals_workflow_step_id_fkey FOREIGN KEY (workflow_step_id) REFERENCES public.approval_workflow_steps(id);


--
-- Name: ticket_assets ticket_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assets
    ADD CONSTRAINT ticket_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: ticket_assets ticket_assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assets
    ADD CONSTRAINT ticket_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_assets ticket_assets_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assets
    ADD CONSTRAINT ticket_assets_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_attachments ticket_attachments_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES public.ticket_replies(id) ON DELETE CASCADE;


--
-- Name: ticket_attachments ticket_attachments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_attachments ticket_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_categories ticket_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categories
    ADD CONSTRAINT ticket_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ticket_categories ticket_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categories
    ADD CONSTRAINT ticket_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.ticket_categories(id) ON DELETE CASCADE;


--
-- Name: ticket_closure_rules ticket_closure_rules_applies_to_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_closure_rules
    ADD CONSTRAINT ticket_closure_rules_applies_to_type_id_fkey FOREIGN KEY (applies_to_type_id) REFERENCES public.ticket_types(id);


--
-- Name: ticket_closure_rules ticket_closure_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_closure_rules
    ADD CONSTRAINT ticket_closure_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ticket_document_links ticket_document_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_document_links
    ADD CONSTRAINT ticket_document_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ticket_document_links ticket_document_links_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_document_links
    ADD CONSTRAINT ticket_document_links_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: ticket_document_links ticket_document_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_document_links
    ADD CONSTRAINT ticket_document_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: ticket_document_links ticket_document_links_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_document_links
    ADD CONSTRAINT ticket_document_links_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_field_changes ticket_field_changes_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_field_changes
    ADD CONSTRAINT ticket_field_changes_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: ticket_field_changes ticket_field_changes_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_field_changes
    ADD CONSTRAINT ticket_field_changes_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_history ticket_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_history ticket_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_kb_links ticket_kb_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_kb_links
    ADD CONSTRAINT ticket_kb_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ticket_kb_links ticket_kb_links_kb_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_kb_links
    ADD CONSTRAINT ticket_kb_links_kb_article_id_fkey FOREIGN KEY (kb_article_id) REFERENCES public.kb_articles(id) ON DELETE CASCADE;


--
-- Name: ticket_kb_links ticket_kb_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_kb_links
    ADD CONSTRAINT ticket_kb_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: ticket_kb_links ticket_kb_links_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_kb_links
    ADD CONSTRAINT ticket_kb_links_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_queue_scores ticket_queue_scores_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_queue_scores
    ADD CONSTRAINT ticket_queue_scores_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ticket_queue_scores ticket_queue_scores_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_queue_scores
    ADD CONSTRAINT ticket_queue_scores_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_relations ticket_relations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations
    ADD CONSTRAINT ticket_relations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ticket_relations ticket_relations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations
    ADD CONSTRAINT ticket_relations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: ticket_relations ticket_relations_source_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations
    ADD CONSTRAINT ticket_relations_source_ticket_id_fkey FOREIGN KEY (source_ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_relations ticket_relations_target_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations
    ADD CONSTRAINT ticket_relations_target_ticket_id_fkey FOREIGN KEY (target_ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_replies ticket_replies_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_replies
    ADD CONSTRAINT ticket_replies_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_replies ticket_replies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_replies
    ADD CONSTRAINT ticket_replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_replies ticket_replies_via_pairing_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_replies
    ADD CONSTRAINT ticket_replies_via_pairing_key_id_fkey FOREIGN KEY (via_pairing_key_id) REFERENCES public.api_keys(id) ON DELETE RESTRICT;


--
-- Name: ticket_status_history ticket_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_status_history ticket_status_history_from_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_from_status_id_fkey FOREIGN KEY (from_status_id) REFERENCES public.ticket_statuses(id) ON DELETE SET NULL;


--
-- Name: ticket_status_history ticket_status_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_status_history ticket_status_history_to_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_to_status_id_fkey FOREIGN KEY (to_status_id) REFERENCES public.ticket_statuses(id) ON DELETE CASCADE;


--
-- Name: ticket_status_transitions ticket_status_transitions_from_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_transitions
    ADD CONSTRAINT ticket_status_transitions_from_status_id_fkey FOREIGN KEY (from_status_id) REFERENCES public.ticket_statuses(id) ON DELETE CASCADE;


--
-- Name: ticket_status_transitions ticket_status_transitions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_transitions
    ADD CONSTRAINT ticket_status_transitions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ticket_status_transitions ticket_status_transitions_to_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_transitions
    ADD CONSTRAINT ticket_status_transitions_to_status_id_fkey FOREIGN KEY (to_status_id) REFERENCES public.ticket_statuses(id) ON DELETE CASCADE;


--
-- Name: ticket_statuses ticket_statuses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_statuses
    ADD CONSTRAINT ticket_statuses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ticket_tags ticket_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tags
    ADD CONSTRAINT ticket_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: ticket_tags ticket_tags_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tags
    ADD CONSTRAINT ticket_tags_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_tasks ticket_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tasks
    ADD CONSTRAINT ticket_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: ticket_tasks ticket_tasks_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tasks
    ADD CONSTRAINT ticket_tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: ticket_tasks ticket_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tasks
    ADD CONSTRAINT ticket_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ticket_tasks ticket_tasks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tasks
    ADD CONSTRAINT ticket_tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: ticket_tasks ticket_tasks_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tasks
    ADD CONSTRAINT ticket_tasks_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id);


--
-- Name: ticket_tasks ticket_tasks_template_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tasks
    ADD CONSTRAINT ticket_tasks_template_item_id_fkey FOREIGN KEY (template_item_id) REFERENCES public.checklist_template_items(id);


--
-- Name: ticket_tasks ticket_tasks_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tasks
    ADD CONSTRAINT ticket_tasks_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_templates ticket_templates_assign_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_templates
    ADD CONSTRAINT ticket_templates_assign_to_fkey FOREIGN KEY (assign_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_templates ticket_templates_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_templates
    ADD CONSTRAINT ticket_templates_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id);


--
-- Name: ticket_templates ticket_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_templates
    ADD CONSTRAINT ticket_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_templates ticket_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_templates
    ADD CONSTRAINT ticket_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ticket_time_entries ticket_time_entries_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_time_entries
    ADD CONSTRAINT ticket_time_entries_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_time_entries ticket_time_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_time_entries
    ADD CONSTRAINT ticket_time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: ticket_types ticket_types_approval_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT ticket_types_approval_workflow_id_fkey FOREIGN KEY (approval_workflow_id) REFERENCES public.approval_workflows(id);


--
-- Name: ticket_types ticket_types_default_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT ticket_types_default_category_id_fkey FOREIGN KEY (default_category_id) REFERENCES public.ticket_categories(id);


--
-- Name: ticket_types ticket_types_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT ticket_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ticket_watchers ticket_watchers_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_watchers
    ADD CONSTRAINT ticket_watchers_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_watchers ticket_watchers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_watchers
    ADD CONSTRAINT ticket_watchers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_ai_category_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ai_category_match_id_fkey FOREIGN KEY (ai_category_match_id) REFERENCES public.ai_category_matches(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_ai_triage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ai_triage_id_fkey FOREIGN KEY (ai_triage_id) REFERENCES public.ai_triage_results(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: tickets tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id);


--
-- Name: tickets tickets_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_created_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_created_by_provider_id_fkey FOREIGN KEY (created_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: tickets tickets_deleted_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_deleted_by_provider_id_fkey FOREIGN KEY (deleted_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: tickets tickets_deleted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES public.users(id);


--
-- Name: tickets tickets_first_viewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_first_viewed_by_fkey FOREIGN KEY (first_viewed_by) REFERENCES public.users(id);


--
-- Name: tickets tickets_last_modified_by_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_last_modified_by_provider_id_fkey FOREIGN KEY (last_modified_by_provider_id) REFERENCES public.provider_api_keys(id);


--
-- Name: tickets tickets_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_restored_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_restored_by_user_id_fkey FOREIGN KEY (restored_by_user_id) REFERENCES public.users(id);


--
-- Name: tickets tickets_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.ticket_statuses(id);


--
-- Name: tickets tickets_subcategory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.request_subcategories(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.ticket_types(id);


--
-- Name: tickets tickets_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: user_assignment_history user_assignment_history_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignment_history
    ADD CONSTRAINT user_assignment_history_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.user_assignments(id) ON DELETE CASCADE;


--
-- Name: user_assignment_history user_assignment_history_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignment_history
    ADD CONSTRAINT user_assignment_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: user_assignments user_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_assignments user_assignments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_assignments user_assignments_returned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_returned_to_fkey FOREIGN KEY (returned_to) REFERENCES public.users(id);


--
-- Name: user_assignments user_assignments_transferred_to_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_transferred_to_user_fkey FOREIGN KEY (transferred_to_user) REFERENCES public.users(id);


--
-- Name: user_assignments user_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_group_memberships user_group_memberships_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- Name: user_group_memberships user_group_memberships_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.user_groups(id) ON DELETE CASCADE;


--
-- Name: user_group_memberships user_group_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_groups user_groups_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_groups user_groups_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: user_groups user_groups_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.user_groups(id) ON DELETE SET NULL;


--
-- Name: user_help_dismissals user_help_dismissals_help_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_help_dismissals
    ADD CONSTRAINT user_help_dismissals_help_id_fkey FOREIGN KEY (help_id) REFERENCES public.contextual_help(id) ON DELETE CASCADE;


--
-- Name: user_help_dismissals user_help_dismissals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_help_dismissals
    ADD CONSTRAINT user_help_dismissals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_notes user_notes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: user_notes user_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_service_access user_service_access_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_service_access
    ADD CONSTRAINT user_service_access_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: user_service_access user_service_access_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_service_access
    ADD CONSTRAINT user_service_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_service_access user_service_access_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_service_access
    ADD CONSTRAINT user_service_access_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_service_access user_service_access_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_service_access
    ADD CONSTRAINT user_service_access_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_tasks user_tasks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: user_tasks user_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: users users_msp_pairing_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_msp_pairing_key_id_fkey FOREIGN KEY (msp_pairing_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id);


--
-- Name: workspace_members workspace_members_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict QH3wgHWHMd4LAj5VShf9Kvt3NkqEDbYYIhRBhBCiIMvtrAqtICsFTF0Lleq86eI

--
-- Seed data: ticket status templates (carried over from the previous
-- init.sql; a schema-only dump does not include them).
--

INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('43051d9c-b691-4845-9dcb-9288e23f892f', 'New', '#3b82f6', 'inbox', 'Newly created ticket, not yet triaged', 'open', false, true, true, 10) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('06d79835-3f91-4df8-8ead-86b8eb98dbcc', 'Open', '#8b5cf6', 'folder-open', 'Ticket triaged and ready for work', 'open', false, false, true, 15) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('6bffe3c0-a724-4822-aa1a-99d1db74c379', 'In Progress', '#eab308', 'play', 'Actively being worked on', 'open', false, false, true, 20) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('114672fe-3ebe-4aec-9043-cdece312dd41', 'Escalated', '#ef4444', 'arrow-up', 'Escalated to higher tier support', 'open', false, false, false, 25) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('e87c9a1f-4039-4ca6-a614-3737ce2ac35d', 'Pending User', '#8b5cf6', 'user-clock', 'Waiting for customer response', 'pending', true, false, true, 30) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('8129cf13-7973-4e5a-8b7a-4b02f9864238', 'Pending Approval', '#f97316', 'shield-check', 'Waiting for approval before work can begin', 'pending', true, false, false, 35) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('a958c48e-4832-4eeb-94d4-cc26dea8d3ef', 'Pending Vendor', '#f97316', 'building', 'Waiting for third-party vendor', 'pending', true, false, true, 40) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('32d857a4-b23a-4a41-b594-fb4182c2b86d', 'Pending Internal', '#78716c', 'users', 'Waiting for internal team or approval', 'pending', true, false, false, 45) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('684d3cec-0868-47c7-9b43-cc5f862f3cc4', 'Scheduled', '#06b6d4', 'calendar', 'Work scheduled for a future date', 'pending', true, false, true, 50) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('a374bb61-fd84-4c77-ae5e-b0b993e90ca0', 'Blocked', '#dc2626', 'ban', 'Cannot proceed due to blocker', 'pending', true, false, false, 55) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('01a49098-0f72-4b88-9475-def71d69465c', 'On Order', '#d97706', 'package', 'Waiting for parts or equipment', 'pending', true, false, false, 60) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('26fe7583-a277-456e-858a-48067dea1f53', 'On Hold', '#6b7280', 'pause', 'Temporarily on hold', 'pending', true, false, false, 65) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('1c9cd5a1-a31c-46ef-b184-73d3e1b18cb7', 'Resolved', '#22c55e', 'check-circle', 'Issue resolved, awaiting confirmation', 'closed', false, false, true, 70) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('de52cd7e-371d-4434-84a6-d485c5812e44', 'Closed', '#64748b', 'check', 'Ticket complete', 'closed', false, false, true, 80) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.ticket_status_templates (id, name, color, icon, description, base_status, sla_paused, is_default, is_system, sort_order) VALUES ('1e774140-6f45-462b-bdb4-e0ea84b23715', 'Cancelled', '#374151', 'x-circle', 'Ticket cancelled or aborted', 'closed', false, false, false, 90) ON CONFLICT (name) DO NOTHING;


--
-- Migration ledger: mark every migration folded into this file as applied so
-- the entrypoint's loop skips them. NOTE the explicit `public.` qualification:
-- pg_dump ends by resetting search_path to '', so unqualified DDL appended
-- after the dump fails with "no schema has been selected to create in".
-- the entrypoint's loop skips them on a fresh install (see header note 2).
--

CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.schema_migrations (version) VALUES
    ('088_mtp_pairing_mode'),
    ('089_role_capability_canonical_names'),
    ('090_email_settings'),
    ('091_api_keys_typed_scoped'),
    ('092_api_keys_mtp_unification'),
    ('093_cascade_revocation'),
    ('094_telemetry_consent'),
    ('095_kb_render_and_sources'),
    ('096_kb_categories_sort_order'),
    ('097_mtp_write_provenance')
ON CONFLICT (version) DO NOTHING;
