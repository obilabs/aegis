DROP FUNCTION IF EXISTS search_kb_articles_for_user(uuid,text,uuid,uuid,uuid,integer);

CREATE OR REPLACE FUNCTION public.search_kb_articles_for_user(
    p_organization_id uuid,
    p_query text,
    p_user_id uuid DEFAULT NULL::uuid,
    p_contact_id uuid DEFAULT NULL::uuid,
    p_category_id uuid DEFAULT NULL::uuid,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    title character varying,
    summary text,
    slug character varying,
    category_id uuid,
    category_name character varying,
    visibility character varying,
    relevance_score real,
    view_count integer,
    helpful_ratio numeric,
    requires_acknowledgment boolean,
    is_acknowledged boolean
)
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
        END as is_acknowledged
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
