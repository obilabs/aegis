-- Seed default ticket types
INSERT INTO ticket_types (organization_id, name, description, icon, color, default_priority, requires_approval, requires_resolution, sla_response_minutes, sla_resolution_minutes, display_order)
SELECT o.id, v.name, v.description, v.icon, v.color, v.default_priority, v.requires_approval, v.requires_resolution, v.sla_response_minutes, v.sla_resolution_minutes, v.display_order
FROM organizations o,
(VALUES
  ('Incident', 'Unplanned interruption or degradation of service', 'alert-triangle', '#EF4444', 'medium', false, true, 60, 480, 1),
  ('Service Request', 'Formal request for something to be provided', 'shopping-cart', '#3B82F6', 'medium', false, true, 120, 1440, 2),
  ('Problem', 'Root cause of one or more incidents', 'search', '#8B5CF6', 'high', false, true, 240, 10080, 3),
  ('Change Request', 'Request to modify IT infrastructure or services', 'git-branch', '#F59E0B', 'medium', true, true, 480, 40320, 4)
) AS v(name, description, icon, color, default_priority, requires_approval, requires_resolution, sla_response_minutes, sla_resolution_minutes, display_order)
ON CONFLICT (organization_id, name) DO NOTHING;

-- Seed default ticket categories
INSERT INTO ticket_categories (organization_id, name, description, icon, display_order)
SELECT o.id, v.name, v.description, v.icon, v.display_order
FROM organizations o,
(VALUES
  ('General', 'General support requests', 'chat-bubble-left', 0),
  ('Hardware', 'Hardware issues and requests', 'computer-desktop', 1),
  ('Software', 'Software issues and requests', 'window', 2),
  ('Network', 'Network and connectivity', 'globe-alt', 3),
  ('Account', 'Account and access requests', 'user', 4),
  ('Email', 'Email and communication issues', 'envelope', 5),
  ('Security', 'Security incidents and concerns', 'shield-check', 6),
  ('Other', 'Other issues not covered', 'ellipsis-horizontal', 99)
) AS v(name, description, icon, display_order)
ON CONFLICT (organization_id, name) DO NOTHING;

-- Seed default user roles
INSERT INTO user_roles (organization_id, name, description, is_system, permissions)
SELECT o.id, v.name, v.description, v.is_system, v.permissions::jsonb
FROM organizations o,
(VALUES
  ('System Admin', 'Full system access', true, '{"capabilities":["manage_tickets","manage_users","manage_settings","manage_kb","manage_assets","manage_contacts","manage_companies","manage_credentials","view_audit_log","manage_ai","manage_providers","manage_catalog"],"ticket_access":"all","admin_access":true}'),
  ('Helpdesk Admin', 'Helpdesk administration', true, '{"capabilities":["manage_tickets","manage_users","manage_kb","manage_assets","manage_contacts","manage_companies","manage_credentials","view_audit_log"],"ticket_access":"all","admin_access":false}'),
  ('Technician', 'IT support technician', true, '{"capabilities":["manage_tickets","manage_kb","manage_assets","manage_contacts","manage_companies","manage_credentials"],"ticket_access":"all","admin_access":false}'),
  ('HR', 'Human resources', true, '{"capabilities":["manage_tickets","manage_contacts"],"ticket_access":"team","admin_access":false}'),
  ('Manager', 'Team manager', true, '{"capabilities":["manage_tickets","manage_contacts"],"ticket_access":"team","admin_access":false}'),
  ('End User', 'Regular end user', true, '{"capabilities":["manage_tickets"],"ticket_access":"own","admin_access":false}')
) AS v(name, description, is_system, permissions)
ON CONFLICT (organization_id, name) DO NOTHING;

-- Assign System Admin role to admin user
UPDATE users SET role_id = (
  SELECT ur.id FROM user_roles ur
  JOIN organizations o ON ur.organization_id = o.id
  WHERE ur.name = 'System Admin' LIMIT 1
)
WHERE email = 'admin@aegis.local' AND role_id IS NULL;
