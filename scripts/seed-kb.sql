-- ============================================================================
-- Aegis KB Seed Data
-- Generated from seed-articles.ts, seed-policies.ts, seed-procedures.ts, seed-training.ts
-- ============================================================================

-- Create categories (idempotent)
INSERT INTO kb_categories (organization_id, name, slug, description, icon, display_order)
VALUES (
  (SELECT id FROM organizations LIMIT 1),
  'Aegis Admin Guide', 'aegis-admin-guide',
  'System administration guides for Aegis ITSM', 'cog', 10
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_categories (organization_id, name, slug, description, icon, display_order)
VALUES (
  (SELECT id FROM organizations LIMIT 1),
  'Policies & Procedures', 'policies-and-procedures',
  'Organizational policies and standard operating procedures', 'document-text', 20
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_categories (organization_id, name, slug, description, icon, display_order)
VALUES (
  (SELECT id FROM organizations LIMIT 1),
  'Training', 'training',
  'Training courses and assessments', 'academic-cap', 50
) ON CONFLICT (organization_id, slug) DO NOTHING;


-- ============================================================================
-- Aegis Admin Guide Articles
-- ============================================================================

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-welcome',
  'Welcome to Aegis',
  'Introduction to Aegis ITSM: key concepts, terminology, and how to get started.',
  $body_1$<h2>Welcome to Aegis</h2>
<p>Aegis is a self-hosted IT Service Management (ITSM) platform designed for organizations that want complete control over their IT operations, data, and support workflows.</p>

<h3>Key Concepts</h3>
<ul>
<li><strong>Organization</strong> &mdash; Your company. Aegis is single-tenant: one installation serves one organization.</li>
<li><strong>Contacts</strong> &mdash; People records. Every person in the system (employees, customers, vendor contacts, partners) is a contact. Not every contact needs a login.</li>
<li><strong>Users</strong> &mdash; Login accounts. A user account is linked to a contact record and gives that person access to the portal.</li>
<li><strong>Companies</strong> &mdash; External organizations you work with: customers, vendors, and partners.</li>
<li><strong>Tickets</strong> &mdash; Work items. Incidents (something is broken), service requests (I need something), problems (root cause investigations), and change requests (planned modifications).</li>
<li><strong>Knowledge Base (KB)</strong> &mdash; Articles that document procedures, policies, and solutions. The AI assistant uses these to answer questions.</li>
</ul>

<h3>Getting Started</h3>
<p>If you just completed the setup wizard, follow the <a href="/portal/kb/aegis-setup-order">Recommended Setup Order</a> to configure your instance step by step.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-setup-order">Recommended Setup Order</a></li>
<li><a href="/portal/kb/aegis-contacts-users">Understanding Contacts &amp; Users</a></li>
<li><a href="/portal/kb/aegis-ticket-types">Ticket Types &amp; Workflows</a></li>
</ul>$body_1$,
  $plain_1$Welcome to Aegis Aegis is a self-hosted IT Service Management (ITSM) platform designed for organizations that want complete control over their IT operations, data, and support workflows. Key Concepts Organization &mdash; Your company. Aegis is single-tenant: one installation serves one organization. Contacts &mdash; People records. Every person in the system (employees, customers, vendor contacts, partners) is a contact. Not every contact needs a login. Users &mdash; Login accounts. A user account is linked to a contact record and gives that person access to the portal. Companies &mdash; External organizations you work with: customers, vendors, and partners. Tickets &mdash; Work items. Incidents (something is broken), service requests (I need something), problems (root cause investigations), and change requests (planned modifications). Knowledge Base (KB) &mdash; Articles that document procedures, policies, and solutions. The AI assistant uses these to answer questions. Getting Started If you just completed the setup wizard, follow the Recommended Setup Order to configure your instance step by step. Related Articles Recommended Setup Order Understanding Contacts &amp; Users Ticket Types &amp; Workflows$plain_1$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-setup-order',
  'Recommended Setup Order',
  'The optimal sequence for configuring Aegis after initial setup, with dependency explanations.',
  $body_2$<h2>Recommended Setup Order</h2>
<p>After completing the setup wizard, configure Aegis in this order. Each step builds on the previous one.</p>

<h3>Step 1: General Settings</h3>
<p>Go to <strong>Settings &rarr; General</strong>. Set your organization name, timezone, and business hours. Business hours affect SLA calculations.</p>

<h3>Step 2: Locations</h3>
<p>Go to <strong>Settings &rarr; Locations</strong>. Add your physical offices and sites. Locations are used for contact assignment, asset tracking, and KB article visibility.</p>

<h3>Step 3: Departments</h3>
<p>Go to <strong>People &rarr; Departments</strong> or create them inline when adding contacts. Departments group employees and drive ticket routing, KB visibility, and onboarding automation.</p>

<h3>Step 4: Job Titles</h3>
<p>Go to <strong>Settings &rarr; Job Titles</strong>. Job titles connect to entitlements &mdash; when someone with a specific job title is onboarded, the system knows which software, access, and equipment they need.</p>

<h3>Step 5: Companies</h3>
<p>Go to <strong>Companies</strong>. Add the external organizations you work with: your customers, vendors, and partners. Contacts are linked to companies.</p>

<h3>Step 6: Roles &amp; Permissions</h3>
<p>Go to <strong>Settings &rarr; Roles</strong>. Review the 6 default roles and customize if needed. Roles control what users can see and do in the portal.</p>

<h3>Step 7: Users &amp; Contacts</h3>
<p>Go to <strong>People</strong>. Add your employees as contacts, then create user accounts for those who need portal access. Link customer contacts to their companies.</p>

<h3>Step 8: Ticket Configuration</h3>
<p>Go to <strong>Settings &rarr; Categories</strong> and <strong>Settings &rarr; Statuses</strong>. Customize ticket categories for your organization and review the default status workflow.</p>

<h3>Step 9: Knowledge Base</h3>
<p>Go to <strong>KB</strong>. Create categories and start writing articles. These power the AI assistant and serve as self-service documentation for your users.</p>

<h3>Step 10: AI Configuration</h3>
<p>Go to <strong>Settings &rarr; AI</strong>. Connect an AI provider and enable the AI assistant. The AI uses your KB articles to answer questions, so populate the KB first.</p>

<h3>Why Order Matters</h3>
<p>Each step creates data that downstream steps reference. For example, you cannot assign a contact to a department that does not exist yet. Similarly, the AI assistant is only as good as your KB content.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-dropdowns-philosophy">Controlled Vocabulary: Why Dropdowns</a></li>
<li><a href="/portal/kb/aegis-contacts-users">Understanding Contacts &amp; Users</a></li>
<li><a href="/portal/kb/aegis-roles-permissions">Roles &amp; Permissions</a></li>
</ul>$body_2$,
  $plain_2$Recommended Setup Order After completing the setup wizard, configure Aegis in this order. Each step builds on the previous one. Step 1: General Settings Go to Settings &rarr; General . Set your organization name, timezone, and business hours. Business hours affect SLA calculations. Step 2: Locations Go to Settings &rarr; Locations . Add your physical offices and sites. Locations are used for contact assignment, asset tracking, and KB article visibility. Step 3: Departments Go to People &rarr; Departments or create them inline when adding contacts. Departments group employees and drive ticket routing, KB visibility, and onboarding automation. Step 4: Job Titles Go to Settings &rarr; Job Titles . Job titles connect to entitlements &mdash; when someone with a specific job title is onboarded, the system knows which software, access, and equipment they need. Step 5: Companies Go to Companies . Add the external organizations you work with: your customers, vendors, and partners. Contacts are linked to companies. Step 6: Roles &amp; Permissions Go to Settings &rarr; Roles . Review the 6 default roles and customize if needed. Roles control what users can see and do in the portal. Step 7: Users &amp; Contacts Go to People . Add your employees as contacts, then create user accounts for those who need portal access. Link customer contacts to their companies. Step 8: Ticket Configuration Go to Settings &rarr; Categories and Settings &rarr; Statuses . Customize ticket categories for your organization and review the default status workflow. Step 9: Knowledge Base Go to KB . Create categories and start writing articles. These power the AI assistant and serve as self-service documentation for your users. Step 10: AI Configuration Go to Settings &rarr; AI . Connect an AI provider and enable the AI assistant. The AI uses your KB articles to answer questions, so populate the KB first. Why Order Matters Each step creates data that downstream steps reference. For example, you cannot assign a contact to a department that does not exist yet. Similarly, the AI assistant is only as good as your KB content. Related Articles Controlled Vocabulary: Why Dropdowns Understanding Contacts &amp; Users Roles &amp; Permissions$plain_2$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-contacts-users',
  'Understanding Contacts & Users',
  'How people are modeled in Aegis: contacts, users, and the four contact types.',
  $body_3$<h2>Understanding Contacts &amp; Users</h2>
<p>Aegis separates the concept of a <strong>person</strong> (contact) from a <strong>login account</strong> (user). This is intentional: not everyone who appears in your system needs to log in.</p>

<h3>Contacts</h3>
<p>A contact is a person record. Every person in the system &mdash; employees, customers, vendor representatives, partners &mdash; is stored as a contact. Contacts have:</p>
<ul>
<li>Name, email, phone</li>
<li>A <strong>contact type</strong>: employee, customer, vendor, or partner</li>
<li>Optional links to a company, department, job title, location, and manager</li>
</ul>

<h3>The Four Contact Types</h3>
<table>
<thead><tr><th>Type</th><th>Description</th><th>Typical Use</th></tr></thead>
<tbody>
<tr><td><strong>Employee</strong></td><td>Someone who works for your organization</td><td>Has department, job title, location. Can have a user account for portal access.</td></tr>
<tr><td><strong>Customer</strong></td><td>Someone at a client company</td><td>Belongs to a company. Can submit tickets via email or portal.</td></tr>
<tr><td><strong>Vendor</strong></td><td>Someone at a supplier/service provider</td><td>Belongs to a vendor company. May need limited access for asset or credential management.</td></tr>
<tr><td><strong>Partner</strong></td><td>Someone at a partner organization</td><td>Belongs to a partner company. Access level depends on the partnership model.</td></tr>
</tbody>
</table>

<h3>Users</h3>
<p>A user is a login account. Creating a user account links it to an existing contact record. The user inherits the contact's name, email, and organizational context. Users are assigned a role that controls their permissions.</p>

<h3>When to Create a User Account</h3>
<ul>
<li><strong>Always</strong>: IT staff, admins, managers who need to work in the portal</li>
<li><strong>Usually</strong>: Employees who will submit tickets via the portal</li>
<li><strong>Sometimes</strong>: Customer contacts who need self-service portal access</li>
<li><strong>Rarely</strong>: Vendor contacts (use provider access instead)</li>
</ul>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-companies">Company Management</a></li>
<li><a href="/portal/kb/aegis-onboarding">Onboarding &amp; Offboarding</a></li>
<li><a href="/portal/kb/aegis-roles-permissions">Roles &amp; Permissions</a></li>
</ul>$body_3$,
  $plain_3$Understanding Contacts &amp; Users Aegis separates the concept of a person (contact) from a login account (user). This is intentional: not everyone who appears in your system needs to log in. Contacts A contact is a person record. Every person in the system &mdash; employees, customers, vendor representatives, partners &mdash; is stored as a contact. Contacts have: Name, email, phone A contact type : employee, customer, vendor, or partner Optional links to a company, department, job title, location, and manager The Four Contact Types Type Description Typical Use Employee Someone who works for your organization Has department, job title, location. Can have a user account for portal access. Customer Someone at a client company Belongs to a company. Can submit tickets via email or portal. Vendor Someone at a supplier/service provider Belongs to a vendor company. May need limited access for asset or credential management. Partner Someone at a partner organization Belongs to a partner company. Access level depends on the partnership model. Users A user is a login account. Creating a user account links it to an existing contact record. The user inherits the contact's name, email, and organizational context. Users are assigned a role that controls their permissions. When to Create a User Account Always : IT staff, admins, managers who need to work in the portal Usually : Employees who will submit tickets via the portal Sometimes : Customer contacts who need self-service portal access Rarely : Vendor contacts (use provider access instead) Related Articles Company Management Onboarding &amp; Offboarding Roles &amp; Permissions$plain_3$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-companies',
  'Company Management',
  'How to manage external organizations: customers, vendors, and partners.',
  $body_4$<h2>Company Management</h2>
<p>In Aegis, a <strong>company</strong> represents an external organization that your organization works with. This includes your customers, vendors, and partners.</p>

<h3>Company Types</h3>
<ul>
<li><strong>Customer</strong> &mdash; Organizations you provide services to</li>
<li><strong>Vendor</strong> &mdash; Organizations that provide services or products to you</li>
<li><strong>Partner</strong> &mdash; Strategic alliance organizations</li>
<li><strong>Prospect</strong> &mdash; Potential customers not yet converted</li>
<li><strong>Internal</strong> &mdash; Your own organization (for multi-location setups)</li>
</ul>

<h3>Single-Tenant Context</h3>
<p>Your Aegis installation serves <strong>one organization</strong>: yours. Companies are the external parties you interact with. Your employees are contacts with type "employee," not a separate company.</p>

<h3>How Companies Connect</h3>
<ul>
<li><strong>Contacts</strong> belong to companies. When you add a customer contact, you link them to their company.</li>
<li><strong>Assets</strong> can be associated with companies for tracking what equipment is deployed where.</li>
<li><strong>Tickets</strong> from customer contacts inherit the company association, making it easy to see all issues for a given customer.</li>
</ul>

<h3>Creating Companies</h3>
<p>Go to <strong>Companies</strong> in the main navigation. You can also create companies inline when adding a contact &mdash; use the "Create New" option in the company dropdown.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-contacts-users">Understanding Contacts &amp; Users</a></li>
<li><a href="/portal/kb/aegis-dropdowns-philosophy">Controlled Vocabulary: Why Dropdowns</a></li>
</ul>$body_4$,
  $plain_4$Company Management In Aegis, a company represents an external organization that your organization works with. This includes your customers, vendors, and partners. Company Types Customer &mdash; Organizations you provide services to Vendor &mdash; Organizations that provide services or products to you Partner &mdash; Strategic alliance organizations Prospect &mdash; Potential customers not yet converted Internal &mdash; Your own organization (for multi-location setups) Single-Tenant Context Your Aegis installation serves one organization : yours. Companies are the external parties you interact with. Your employees are contacts with type "employee," not a separate company. How Companies Connect Contacts belong to companies. When you add a customer contact, you link them to their company. Assets can be associated with companies for tracking what equipment is deployed where. Tickets from customer contacts inherit the company association, making it easy to see all issues for a given customer. Creating Companies Go to Companies in the main navigation. You can also create companies inline when adding a contact &mdash; use the "Create New" option in the company dropdown. Related Articles Understanding Contacts &amp; Users Controlled Vocabulary: Why Dropdowns$plain_4$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-dropdowns-philosophy',
  'Controlled Vocabulary: Why Dropdowns',
  'Why Aegis uses dropdown selections instead of freetext for departments, locations, and other fields.',
  $body_5$<h2>Controlled Vocabulary: Why Dropdowns</h2>
<p>You will notice that fields like Department, Location, Job Title, and Category are dropdown selections rather than freetext inputs. This is a deliberate design choice.</p>

<h3>The Problem with Freetext</h3>
<p>When people type department names freely, you get variations like:</p>
<ul>
<li>"IT", "Information Technology", "I.T.", "Tech", "it dept"</li>
<li>"Edmonton", "YEG", "EDM", "edmonton", "Edmonton Office"</li>
</ul>
<p>These all mean the same thing but the system treats them as different values. This destroys your ability to filter, report, route, and automate.</p>

<h3>The Solution: Controlled Lists</h3>
<p>Aegis uses pre-defined dropdown lists that admins maintain. Every dropdown also includes a <strong>"Create New"</strong> option so authorized users can add entries without leaving the form they are working in.</p>

<h3>What This Enables</h3>
<ul>
<li><strong>Accurate reporting</strong> &mdash; "Show me all tickets from the Finance department" works perfectly because there is exactly one "Finance."</li>
<li><strong>AI understanding</strong> &mdash; The AI assistant knows what "Finance" means because it is a defined entity, not a string guess.</li>
<li><strong>Onboarding automation</strong> &mdash; Job title entitlements work because "Software Developer" is always "Software Developer," not "Dev" or "SWE."</li>
<li><strong>Ticket routing</strong> &mdash; Auto-assignment rules reference departments and categories by ID, not string matching.</li>
<li><strong>KB visibility</strong> &mdash; Articles can be scoped to specific departments, locations, or companies because these are known entities.</li>
</ul>

<h3>Managing Dropdown Lists</h3>
<p>Admins can manage these lists in <strong>Settings</strong>. Most dropdowns can also have entries added inline from any form that uses them.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-setup-order">Recommended Setup Order</a></li>
<li><a href="/portal/kb/aegis-contacts-users">Understanding Contacts &amp; Users</a></li>
</ul>$body_5$,
  $plain_5$Controlled Vocabulary: Why Dropdowns You will notice that fields like Department, Location, Job Title, and Category are dropdown selections rather than freetext inputs. This is a deliberate design choice. The Problem with Freetext When people type department names freely, you get variations like: "IT", "Information Technology", "I.T.", "Tech", "it dept" "Edmonton", "YEG", "EDM", "edmonton", "Edmonton Office" These all mean the same thing but the system treats them as different values. This destroys your ability to filter, report, route, and automate. The Solution: Controlled Lists Aegis uses pre-defined dropdown lists that admins maintain. Every dropdown also includes a "Create New" option so authorized users can add entries without leaving the form they are working in. What This Enables Accurate reporting &mdash; "Show me all tickets from the Finance department" works perfectly because there is exactly one "Finance." AI understanding &mdash; The AI assistant knows what "Finance" means because it is a defined entity, not a string guess. Onboarding automation &mdash; Job title entitlements work because "Software Developer" is always "Software Developer," not "Dev" or "SWE." Ticket routing &mdash; Auto-assignment rules reference departments and categories by ID, not string matching. KB visibility &mdash; Articles can be scoped to specific departments, locations, or companies because these are known entities. Managing Dropdown Lists Admins can manage these lists in Settings . Most dropdowns can also have entries added inline from any form that uses them. Related Articles Recommended Setup Order Understanding Contacts &amp; Users$plain_5$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-ticket-types',
  'Ticket Types & Workflows',
  'The four default ticket types, status lifecycle, and SLA basics.',
  $body_6$<h2>Ticket Types &amp; Workflows</h2>
<p>Aegis ships with four ticket types aligned to ITIL best practices. Each type has its own SLA targets and workflow expectations.</p>

<h3>The Four Ticket Types</h3>
<table>
<thead><tr><th>Type</th><th>When to Use</th><th>Response SLA</th><th>Resolution SLA</th></tr></thead>
<tbody>
<tr><td><strong>Incident</strong></td><td>Something is broken or not working</td><td>1 hour</td><td>8 hours</td></tr>
<tr><td><strong>Service Request</strong></td><td>I need access, hardware, or software</td><td>2 hours</td><td>24 hours</td></tr>
<tr><td><strong>Problem</strong></td><td>Investigating the root cause of recurring incidents</td><td>4 hours</td><td>7 days</td></tr>
<tr><td><strong>Change Request</strong></td><td>Proposing a planned change to infrastructure or services</td><td>8 hours</td><td>28 days</td></tr>
</tbody>
</table>

<h3>Status Lifecycle</h3>
<p>Every ticket moves through statuses. The default lifecycle:</p>
<ol>
<li><strong>New</strong> &mdash; Just created, not yet seen by a technician</li>
<li><strong>Open</strong> &mdash; Acknowledged and being worked on</li>
<li><strong>In Progress</strong> &mdash; Actively being resolved</li>
<li><strong>Pending</strong> &mdash; Waiting for external input (user response, vendor, approval). SLA clock pauses.</li>
<li><strong>Resolved</strong> &mdash; Fix applied, awaiting confirmation</li>
<li><strong>Closed</strong> &mdash; Confirmed resolved or auto-closed after timeout</li>
</ol>

<h3>SLA Basics</h3>
<ul>
<li><strong>Response SLA</strong> &mdash; Time from ticket creation to first technician response</li>
<li><strong>Resolution SLA</strong> &mdash; Time from creation to resolution</li>
<li><strong>SLA pause</strong> &mdash; When a ticket moves to a pending status, the SLA clock pauses automatically</li>
<li><strong>SLA breach</strong> &mdash; When the target time is exceeded. Breached tickets are flagged for management visibility.</li>
</ul>

<h3>Custom Statuses</h3>
<p>Admins can create additional statuses and map them to a base status (open, pending, or closed). This lets you have statuses like "Waiting for Parts" or "Scheduled" while preserving SLA behavior.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-roles-permissions">Roles &amp; Permissions</a></li>
<li><a href="/portal/kb/aegis-feature-flags">Feature Flags Guide</a></li>
</ul>$body_6$,
  $plain_6$Ticket Types &amp; Workflows Aegis ships with four ticket types aligned to ITIL best practices. Each type has its own SLA targets and workflow expectations. The Four Ticket Types Type When to Use Response SLA Resolution SLA Incident Something is broken or not working 1 hour 8 hours Service Request I need access, hardware, or software 2 hours 24 hours Problem Investigating the root cause of recurring incidents 4 hours 7 days Change Request Proposing a planned change to infrastructure or services 8 hours 28 days Status Lifecycle Every ticket moves through statuses. The default lifecycle: New &mdash; Just created, not yet seen by a technician Open &mdash; Acknowledged and being worked on In Progress &mdash; Actively being resolved Pending &mdash; Waiting for external input (user response, vendor, approval). SLA clock pauses. Resolved &mdash; Fix applied, awaiting confirmation Closed &mdash; Confirmed resolved or auto-closed after timeout SLA Basics Response SLA &mdash; Time from ticket creation to first technician response Resolution SLA &mdash; Time from creation to resolution SLA pause &mdash; When a ticket moves to a pending status, the SLA clock pauses automatically SLA breach &mdash; When the target time is exceeded. Breached tickets are flagged for management visibility. Custom Statuses Admins can create additional statuses and map them to a base status (open, pending, or closed). This lets you have statuses like "Waiting for Parts" or "Scheduled" while preserving SLA behavior. Related Articles Roles &amp; Permissions Feature Flags Guide$plain_6$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-roles-permissions',
  'Roles & Permissions',
  'The six default roles and how permissions control access in Aegis.',
  $body_7$<h2>Roles &amp; Permissions</h2>
<p>Every user in Aegis is assigned a role. Roles control what a user can see and do.</p>

<h3>Default Roles</h3>
<table>
<thead><tr><th>Role</th><th>Ticket Access</th><th>Capabilities</th></tr></thead>
<tbody>
<tr><td><strong>System Admin</strong></td><td>All tickets</td><td>Triage, bulk actions, reports, settings, user management. Full admin access.</td></tr>
<tr><td><strong>Helpdesk Admin</strong></td><td>All tickets</td><td>Triage, bulk actions, reports. Cannot access system settings.</td></tr>
<tr><td><strong>Technician</strong></td><td>Team tickets</td><td>Can work tickets assigned to their team.</td></tr>
<tr><td><strong>Manager</strong></td><td>Team tickets</td><td>Reports access. Can view their team's performance.</td></tr>
<tr><td><strong>HR</strong></td><td>Own tickets</td><td>Limited access for onboarding/offboarding workflows.</td></tr>
<tr><td><strong>End User</strong></td><td>Own tickets</td><td>Can submit and track their own tickets.</td></tr>
</tbody>
</table>

<h3>Permission Components</h3>
<ul>
<li><strong>Ticket Access</strong> &mdash; <code>own</code> (only tickets they created or are assigned to), <code>team</code> (tickets for their team), or <code>all</code> (every ticket in the organization).</li>
<li><strong>Capabilities</strong> &mdash; Specific actions: <code>triage</code> (manage the queue), <code>bulk_actions</code> (multi-ticket operations), <code>reports</code> (view dashboards), <code>settings</code> (system configuration), <code>user_management</code> (create/edit users and roles).</li>
<li><strong>Admin Access</strong> &mdash; Full access to all settings and configuration. Only System Admin has this by default.</li>
</ul>

<h3>Custom Roles</h3>
<p>You can create additional roles with any combination of ticket access level and capabilities. Custom roles are useful for specialized positions like "Network Admin" (all ticket access + settings but no user management) or "Department Lead" (team access + reports).</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-contacts-users">Understanding Contacts &amp; Users</a></li>
<li><a href="/portal/kb/aegis-ticket-types">Ticket Types &amp; Workflows</a></li>
</ul>$body_7$,
  $plain_7$Roles &amp; Permissions Every user in Aegis is assigned a role. Roles control what a user can see and do. Default Roles Role Ticket Access Capabilities System Admin All tickets Triage, bulk actions, reports, settings, user management. Full admin access. Helpdesk Admin All tickets Triage, bulk actions, reports. Cannot access system settings. Technician Team tickets Can work tickets assigned to their team. Manager Team tickets Reports access. Can view their team's performance. HR Own tickets Limited access for onboarding/offboarding workflows. End User Own tickets Can submit and track their own tickets. Permission Components Ticket Access &mdash; own (only tickets they created or are assigned to), team (tickets for their team), or all (every ticket in the organization). Capabilities &mdash; Specific actions: triage (manage the queue), bulk_actions (multi-ticket operations), reports (view dashboards), settings (system configuration), user_management (create/edit users and roles). Admin Access &mdash; Full access to all settings and configuration. Only System Admin has this by default. Custom Roles You can create additional roles with any combination of ticket access level and capabilities. Custom roles are useful for specialized positions like "Network Admin" (all ticket access + settings but no user management) or "Department Lead" (team access + reports). Related Articles Understanding Contacts &amp; Users Ticket Types &amp; Workflows$plain_7$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-feature-flags',
  'Feature Flags Guide',
  'How to enable and manage optional features in Aegis.',
  $body_8$<h2>Feature Flags Guide</h2>
<p>Aegis includes optional features that can be enabled or disabled. This lets you start simple and add complexity as your organization is ready.</p>

<h3>Feature Categories</h3>
<table>
<thead><tr><th>Category</th><th>Description</th></tr></thead>
<tbody>
<tr><td><strong>Core</strong></td><td>Always enabled. Tickets, contacts, KB, basic reporting.</td></tr>
<tr><td><strong>Standard</strong></td><td>Enabled by default. Common ITSM features most organizations use.</td></tr>
<tr><td><strong>Advanced</strong></td><td>Disabled by default. Powerful features for mature IT operations.</td></tr>
<tr><td><strong>Enterprise</strong></td><td>Disabled by default. Features designed for large-scale deployments.</td></tr>
<tr><td><strong>Experimental</strong></td><td>Disabled by default. New features in development, may change.</td></tr>
</tbody>
</table>

<h3>Stability Levels</h3>
<ul>
<li><strong>Stable</strong> &mdash; Fully tested and production-ready</li>
<li><strong>Beta</strong> &mdash; Functional but may have rough edges. Safe to use with awareness.</li>
<li><strong>Alpha</strong> &mdash; Early implementation. May change significantly between updates.</li>
</ul>

<h3>How to Enable Features</h3>
<p>Go to <strong>Settings &rarr; Features</strong>. Each feature shows its category, stability level, and a description of what it does. Toggle the switch to enable or disable.</p>

<h3>When to Enable</h3>
<ul>
<li><strong>During initial setup</strong> &mdash; Review features after completing the setup wizard. Enable what your organization needs now.</li>
<li><strong>As you grow</strong> &mdash; Enable advanced features when basic workflows are established and running smoothly.</li>
<li><strong>After updates</strong> &mdash; New features may appear after upgrading. Check the Features page to see what is new.</li>
</ul>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-ai-setup">AI Assistant Setup</a></li>
<li><a href="/portal/kb/aegis-kb-management">Knowledge Base Management</a></li>
</ul>$body_8$,
  $plain_8$Feature Flags Guide Aegis includes optional features that can be enabled or disabled. This lets you start simple and add complexity as your organization is ready. Feature Categories Category Description Core Always enabled. Tickets, contacts, KB, basic reporting. Standard Enabled by default. Common ITSM features most organizations use. Advanced Disabled by default. Powerful features for mature IT operations. Enterprise Disabled by default. Features designed for large-scale deployments. Experimental Disabled by default. New features in development, may change. Stability Levels Stable &mdash; Fully tested and production-ready Beta &mdash; Functional but may have rough edges. Safe to use with awareness. Alpha &mdash; Early implementation. May change significantly between updates. How to Enable Features Go to Settings &rarr; Features . Each feature shows its category, stability level, and a description of what it does. Toggle the switch to enable or disable. When to Enable During initial setup &mdash; Review features after completing the setup wizard. Enable what your organization needs now. As you grow &mdash; Enable advanced features when basic workflows are established and running smoothly. After updates &mdash; New features may appear after upgrading. Check the Features page to see what is new. Related Articles AI Assistant Setup Knowledge Base Management$plain_8$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-ai-setup',
  'AI Assistant Setup',
  'How to configure an AI provider and enable the AI assistant in Aegis.',
  $body_9$<h2>AI Assistant Setup</h2>
<p>Aegis includes an AI assistant that helps users find answers, assists technicians with ticket triage, and suggests relevant KB articles. The AI <strong>only uses your Knowledge Base</strong> &mdash; it does not make up answers from general knowledge.</p>

<h3>Supported Providers</h3>
<ul>
<li><strong>Ollama</strong> &mdash; Run AI models locally on your own hardware. No data leaves your network. Best for organizations with strict data sovereignty requirements.</li>
<li><strong>OpenAI</strong> &mdash; Cloud-based AI using GPT models. Requires an OpenAI API key.</li>
<li><strong>Google Gemini</strong> &mdash; Cloud-based AI using Gemini models. Requires a Google AI API key.</li>
</ul>

<h3>Configuration Steps</h3>
<ol>
<li>Go to <strong>Settings &rarr; AI Configuration</strong></li>
<li>Select your AI provider</li>
<li>Enter the required credentials (API key or Ollama server URL)</li>
<li>Select a model (the system will show available models for your provider)</li>
<li>Test the connection</li>
<li>Enable the AI feature flag in <strong>Settings &rarr; Features</strong> if not already enabled</li>
</ol>

<h3>Security Levels</h3>
<p>The AI respects access control. What it can search depends on the user's role:</p>
<ul>
<li><strong>End users</strong> &mdash; Can only access public KB articles</li>
<li><strong>Technicians</strong> &mdash; Can access public and internal articles</li>
<li><strong>Admins</strong> &mdash; Can access all articles including system documentation</li>
</ul>

<h3>How AI Uses Your KB</h3>
<p>When a user asks a question, the AI uses <a href="/portal/kb/aegis-ai-search">hybrid search</a> to find relevant KB articles, tickets, and contacts (based on access level), then formulates an answer from this context. If no relevant content exists, the AI will say it does not have enough information rather than guessing.</p>

<h3>Best Practices</h3>
<ul>
<li>Populate your KB <strong>before</strong> enabling AI &mdash; the assistant is only as good as your documentation</li>
<li>Write clear, structured articles with headings and step-by-step instructions</li>
<li>Mark articles as "internal" if they contain sensitive procedures that only staff should see</li>
</ul>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-kb-management">Knowledge Base Management</a></li>
<li><a href="/portal/kb/aegis-ai-search">How Aegis AI Search Works</a></li>
<li><a href="/portal/kb/aegis-ai-provider-setup">AI Provider Setup Guide</a></li>
<li><a href="/portal/kb/aegis-feature-flags">Feature Flags Guide</a></li>
</ul>$body_9$,
  $plain_9$AI Assistant Setup Aegis includes an AI assistant that helps users find answers, assists technicians with ticket triage, and suggests relevant KB articles. The AI only uses your Knowledge Base &mdash; it does not make up answers from general knowledge. Supported Providers Ollama &mdash; Run AI models locally on your own hardware. No data leaves your network. Best for organizations with strict data sovereignty requirements. OpenAI &mdash; Cloud-based AI using GPT models. Requires an OpenAI API key. Google Gemini &mdash; Cloud-based AI using Gemini models. Requires a Google AI API key. Configuration Steps Go to Settings &rarr; AI Configuration Select your AI provider Enter the required credentials (API key or Ollama server URL) Select a model (the system will show available models for your provider) Test the connection Enable the AI feature flag in Settings &rarr; Features if not already enabled Security Levels The AI respects access control. What it can search depends on the user's role: End users &mdash; Can only access public KB articles Technicians &mdash; Can access public and internal articles Admins &mdash; Can access all articles including system documentation How AI Uses Your KB When a user asks a question, the AI uses hybrid search to find relevant KB articles, tickets, and contacts (based on access level), then formulates an answer from this context. If no relevant content exists, the AI will say it does not have enough information rather than guessing. Best Practices Populate your KB before enabling AI &mdash; the assistant is only as good as your documentation Write clear, structured articles with headings and step-by-step instructions Mark articles as "internal" if they contain sensitive procedures that only staff should see Related Articles Knowledge Base Management How Aegis AI Search Works AI Provider Setup Guide Feature Flags Guide$plain_9$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-kb-management',
  'Knowledge Base Management',
  'Creating categories, writing articles, and managing your organization\',
  $body_10$<h2>Knowledge Base Management</h2>
<p>The Knowledge Base (KB) is where your organization's procedures, guides, and solutions live. Good KB content improves self-service resolution rates, powers the AI assistant, and reduces repetitive ticket volume.</p>

<h3>Categories</h3>
<p>Organize articles into categories. Go to <strong>KB &rarr; Categories</strong> to create them. Categories can be nested (parent/child). Each category can have visibility restrictions.</p>

<h3>Writing Articles</h3>
<p>Go to <strong>KB &rarr; New Article</strong>. Each article has:</p>
<ul>
<li><strong>Title</strong> &mdash; Clear and searchable</li>
<li><strong>Summary</strong> &mdash; A one-line description shown in search results</li>
<li><strong>Content</strong> &mdash; The full article body with rich text formatting</li>
<li><strong>Category</strong> &mdash; Where this article belongs</li>
<li><strong>Visibility</strong> &mdash; Who can see it</li>
</ul>

<h3>Visibility Levels</h3>
<ul>
<li><strong>Public</strong> &mdash; Visible to all users, including end users</li>
<li><strong>Authenticated</strong> &mdash; Visible only to logged-in users</li>
<li><strong>Internal</strong> &mdash; Visible only to technicians and admins</li>
<li><strong>Private</strong> &mdash; Visible only to specific roles, departments, companies, or locations</li>
</ul>

<h3>Publishing Workflow</h3>
<ol>
<li><strong>Draft</strong> &mdash; Article is being written. Not visible to anyone except the author.</li>
<li><strong>Review</strong> &mdash; Submitted for approval (if contributor requires approval).</li>
<li><strong>Published</strong> &mdash; Live and visible according to the visibility setting.</li>
</ol>

<h3>System Articles</h3>
<p>Aegis ships with pre-installed admin guide articles (like this one). These are marked with a lock icon and cannot be deleted, but you can unpublish them if you prefer to hide them. They are set to "internal" visibility, so only technicians and admins can see them.</p>

<h3>Tips for Good Articles</h3>
<ul>
<li>Use descriptive titles that match how users search</li>
<li>Include step-by-step instructions with numbered lists</li>
<li>Add a summary &mdash; it appears in search results and AI responses</li>
<li>Link related articles together</li>
<li>Keep articles focused on one topic</li>
</ul>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-ai-setup">AI Assistant Setup</a></li>
<li><a href="/portal/kb/aegis-getting-help">Getting Help &amp; Support</a></li>
</ul>$body_10$,
  $plain_10$Knowledge Base Management The Knowledge Base (KB) is where your organization's procedures, guides, and solutions live. Good KB content improves self-service resolution rates, powers the AI assistant, and reduces repetitive ticket volume. Categories Organize articles into categories. Go to KB &rarr; Categories to create them. Categories can be nested (parent/child). Each category can have visibility restrictions. Writing Articles Go to KB &rarr; New Article . Each article has: Title &mdash; Clear and searchable Summary &mdash; A one-line description shown in search results Content &mdash; The full article body with rich text formatting Category &mdash; Where this article belongs Visibility &mdash; Who can see it Visibility Levels Public &mdash; Visible to all users, including end users Authenticated &mdash; Visible only to logged-in users Internal &mdash; Visible only to technicians and admins Private &mdash; Visible only to specific roles, departments, companies, or locations Publishing Workflow Draft &mdash; Article is being written. Not visible to anyone except the author. Review &mdash; Submitted for approval (if contributor requires approval). Published &mdash; Live and visible according to the visibility setting. System Articles Aegis ships with pre-installed admin guide articles (like this one). These are marked with a lock icon and cannot be deleted, but you can unpublish them if you prefer to hide them. They are set to "internal" visibility, so only technicians and admins can see them. Tips for Good Articles Use descriptive titles that match how users search Include step-by-step instructions with numbered lists Add a summary &mdash; it appears in search results and AI responses Link related articles together Keep articles focused on one topic Related Articles AI Assistant Setup Getting Help &amp; Support$plain_10$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-onboarding',
  'Onboarding & Offboarding',
  'How Aegis automates employee onboarding and offboarding using job title entitlements.',
  $body_11$<h2>Onboarding &amp; Offboarding</h2>
<p>Aegis can automate the provisioning and deprovisioning of access, equipment, and software when employees join or leave your organization.</p>

<h3>How It Works</h3>
<ol>
<li><strong>Define entitlements per job title</strong> &mdash; Go to <strong>Settings &rarr; Job Titles</strong> and define what each role needs: software licenses, hardware, system access, group memberships.</li>
<li><strong>Create a new employee contact</strong> &mdash; When you add someone with a job title that has entitlements, the system automatically generates provisioning tasks.</li>
<li><strong>Tasks are assigned to service owners</strong> &mdash; Each entitlement has a default assignee (the person or team responsible for provisioning that resource).</li>
<li><strong>Track progress</strong> &mdash; View all provisioning tasks on the onboarding dashboard. Nothing falls through the cracks.</li>
</ol>

<h3>Entitlement Types</h3>
<ul>
<li><strong>Software</strong> &mdash; Applications and licenses to provision</li>
<li><strong>Hardware</strong> &mdash; Equipment to order or assign</li>
<li><strong>Access</strong> &mdash; System accounts, network drives, VPN access</li>
<li><strong>Group</strong> &mdash; Distribution lists, Teams channels, security groups</li>
</ul>

<h3>Offboarding</h3>
<p>When an employee leaves, their contact record is deactivated. The system generates deprovisioning tasks that mirror their entitlements: revoke access, recover equipment, transfer knowledge. This ensures nothing is missed during the exit process.</p>

<h3>Service Owners</h3>
<p>Each entitlement can specify a default assignee &mdash; the person or team responsible for provisioning that particular resource. For example, the "Microsoft 365" entitlement might be assigned to the IT Admin team, while the "Laptop" entitlement goes to the Hardware team.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-contacts-users">Understanding Contacts &amp; Users</a></li>
<li><a href="/portal/kb/aegis-setup-order">Recommended Setup Order</a></li>
</ul>$body_11$,
  $plain_11$Onboarding &amp; Offboarding Aegis can automate the provisioning and deprovisioning of access, equipment, and software when employees join or leave your organization. How It Works Define entitlements per job title &mdash; Go to Settings &rarr; Job Titles and define what each role needs: software licenses, hardware, system access, group memberships. Create a new employee contact &mdash; When you add someone with a job title that has entitlements, the system automatically generates provisioning tasks. Tasks are assigned to service owners &mdash; Each entitlement has a default assignee (the person or team responsible for provisioning that resource). Track progress &mdash; View all provisioning tasks on the onboarding dashboard. Nothing falls through the cracks. Entitlement Types Software &mdash; Applications and licenses to provision Hardware &mdash; Equipment to order or assign Access &mdash; System accounts, network drives, VPN access Group &mdash; Distribution lists, Teams channels, security groups Offboarding When an employee leaves, their contact record is deactivated. The system generates deprovisioning tasks that mirror their entitlements: revoke access, recover equipment, transfer knowledge. This ensures nothing is missed during the exit process. Service Owners Each entitlement can specify a default assignee &mdash; the person or team responsible for provisioning that particular resource. For example, the "Microsoft 365" entitlement might be assigned to the IT Admin team, while the "Laptop" entitlement goes to the Hardware team. Related Articles Understanding Contacts &amp; Users Recommended Setup Order$plain_11$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-getting-help',
  'Getting Help & Support',
  'Where to find help with Aegis: community resources, reporting bugs, and self-hosted responsibilities.',
  $body_12$<h2>Getting Help &amp; Support</h2>
<p>Aegis is open-source software licensed under AGPL-3.0. Here is how to get help and contribute back.</p>

<h3>Community Resources</h3>
<ul>
<li><strong>GitHub Repository</strong> &mdash; Source code, issue tracking, and release notes</li>
<li><strong>Documentation</strong> &mdash; These admin guide articles and the project README</li>
<li><strong>GitHub Discussions</strong> &mdash; Ask questions, share ideas, and connect with other Aegis users</li>
</ul>

<h3>Reporting Bugs</h3>
<p>If you encounter a bug:</p>
<ol>
<li>Check existing GitHub issues to see if it has been reported</li>
<li>If not, create a new issue with: steps to reproduce, expected behavior, actual behavior, and your Aegis version</li>
<li>Include relevant logs if possible (remove any sensitive data first)</li>
</ol>

<h3>Feature Requests</h3>
<p>Have an idea? Open a GitHub Discussion in the "Ideas" category. Describe the problem you are solving and your proposed solution. Community feedback helps prioritize development.</p>

<h3>Self-Hosted Responsibilities</h3>
<p>As a self-hosted application, you are responsible for:</p>
<ul>
<li><strong>Backups</strong> &mdash; Regular database backups. Test your restore process.</li>
<li><strong>Updates</strong> &mdash; Apply updates to get security patches and new features.</li>
<li><strong>Security</strong> &mdash; Keep your server patched, use HTTPS, restrict network access to the portal.</li>
<li><strong>Monitoring</strong> &mdash; Watch disk space, database performance, and application logs.</li>
</ul>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-welcome">Welcome to Aegis</a></li>
<li><a href="/portal/kb/aegis-feature-flags">Feature Flags Guide</a></li>
</ul>$body_12$,
  $plain_12$Getting Help &amp; Support Aegis is open-source software licensed under AGPL-3.0. Here is how to get help and contribute back. Community Resources GitHub Repository &mdash; Source code, issue tracking, and release notes Documentation &mdash; These admin guide articles and the project README GitHub Discussions &mdash; Ask questions, share ideas, and connect with other Aegis users Reporting Bugs If you encounter a bug: Check existing GitHub issues to see if it has been reported If not, create a new issue with: steps to reproduce, expected behavior, actual behavior, and your Aegis version Include relevant logs if possible (remove any sensitive data first) Feature Requests Have an idea? Open a GitHub Discussion in the "Ideas" category. Describe the problem you are solving and your proposed solution. Community feedback helps prioritize development. Self-Hosted Responsibilities As a self-hosted application, you are responsible for: Backups &mdash; Regular database backups. Test your restore process. Updates &mdash; Apply updates to get security patches and new features. Security &mdash; Keep your server patched, use HTTPS, restrict network access to the portal. Monitoring &mdash; Watch disk space, database performance, and application logs. Related Articles Welcome to Aegis Feature Flags Guide$plain_12$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-ai-search',
  'How Aegis AI Search Works',
  'How hybrid search combines keyword matching and semantic understanding to find relevant content.',
  $body_13$<h2>How Aegis AI Search Works</h2>
<p>Aegis uses a <strong>hybrid search</strong> system that combines two complementary techniques to find the most relevant content. This powers both the KB search bar and the AI assistant's context retrieval.</p>

<h3>Full-Text Search (FTS)</h3>
<p>FTS is traditional keyword matching, powered by PostgreSQL's built-in text search engine. When you search for "password reset," FTS finds articles that contain those exact words.</p>
<ul>
<li>Works immediately with no configuration</li>
<li>Excellent for exact terms, error codes, and product names</li>
<li>Uses word stemming (e.g., "resetting" matches "reset")</li>
<li>Falls back to partial matching (ILIKE) when FTS returns no results</li>
</ul>

<h3>Vector Search (Semantic)</h3>
<p>Vector search understands <strong>meaning</strong>, not just keywords. When you configure an embedding model, Aegis converts your articles, tickets, and contacts into numerical vectors that capture their semantic content.</p>
<ul>
<li>Finds results even when exact keywords do not match (e.g., "laptop won't start" finds "Power Troubleshooting Guide")</li>
<li>Requires an embedding model (configured in Settings &rarr; AI)</li>
<li>Improves as more content is embedded</li>
<li>Uses pgvector for efficient similarity calculations</li>
</ul>

<h3>Hybrid Scoring (RRF)</h3>
<p>When both FTS and vector search return results, Aegis merges them using <strong>Reciprocal Rank Fusion (RRF)</strong>. This algorithm gives each result a score based on its rank in each list, then combines the scores:</p>
<ul>
<li>Content that ranks highly in <strong>both</strong> FTS and vector search gets the highest score</li>
<li>Content found by only one method still appears, ranked lower</li>
<li>The combined ranking is more accurate than either method alone</li>
</ul>

<h3>What Gets Searched</h3>
<p>The search scope depends on the context:</p>
<table>
<thead><tr><th>Source</th><th>Fields Searched</th><th>Who Can Access</th></tr></thead>
<tbody>
<tr><td><strong>KB Articles</strong></td><td>Title, summary, content</td><td>All users (respects visibility levels)</td></tr>
<tr><td><strong>Tickets</strong></td><td>Subject, description</td><td>Technicians and admins only</td></tr>
<tr><td><strong>Contacts</strong></td><td>Name, email, notes</td><td>Admins and providers only</td></tr>
</tbody>
</table>

<h3>Embedding Generation</h3>
<p>When you configure an embedding model, Aegis automatically generates embeddings for existing content in the background. New content is embedded as it is created or updated. Long KB articles are split into smaller chunks (approximately 500 tokens each) so that specific sections can be found independently.</p>

<h3>Graceful Degradation</h3>
<p>If no embedding model is configured, Aegis uses FTS only. This means search works out of the box without any AI provider. Adding an embedding model later is seamless &mdash; existing content will be embedded in the background and search quality improves automatically.</p>

<h3>Why Results Improve Over Time</h3>
<ul>
<li><strong>More content</strong> &mdash; The more KB articles, tickets, and contacts you have, the more the AI can reference</li>
<li><strong>Embeddings</strong> &mdash; Once an embedding model is configured, semantic search activates and catches queries that keywords miss</li>
<li><strong>Chunking</strong> &mdash; Long articles are chunked so that specific sections surface even if the rest of the article is not relevant</li>
</ul>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-ai-setup">AI Assistant Setup</a></li>
<li><a href="/portal/kb/aegis-ai-provider-setup">AI Provider Setup Guide</a></li>
<li><a href="/portal/kb/aegis-doc-import">Importing Documents to Knowledge Base</a></li>
</ul>$body_13$,
  $plain_13$How Aegis AI Search Works Aegis uses a hybrid search system that combines two complementary techniques to find the most relevant content. This powers both the KB search bar and the AI assistant's context retrieval. Full-Text Search (FTS) FTS is traditional keyword matching, powered by PostgreSQL's built-in text search engine. When you search for "password reset," FTS finds articles that contain those exact words. Works immediately with no configuration Excellent for exact terms, error codes, and product names Uses word stemming (e.g., "resetting" matches "reset") Falls back to partial matching (ILIKE) when FTS returns no results Vector Search (Semantic) Vector search understands meaning , not just keywords. When you configure an embedding model, Aegis converts your articles, tickets, and contacts into numerical vectors that capture their semantic content. Finds results even when exact keywords do not match (e.g., "laptop won't start" finds "Power Troubleshooting Guide") Requires an embedding model (configured in Settings &rarr; AI) Improves as more content is embedded Uses pgvector for efficient similarity calculations Hybrid Scoring (RRF) When both FTS and vector search return results, Aegis merges them using Reciprocal Rank Fusion (RRF) . This algorithm gives each result a score based on its rank in each list, then combines the scores: Content that ranks highly in both FTS and vector search gets the highest score Content found by only one method still appears, ranked lower The combined ranking is more accurate than either method alone What Gets Searched The search scope depends on the context: Source Fields Searched Who Can Access KB Articles Title, summary, content All users (respects visibility levels) Tickets Subject, description Technicians and admins only Contacts Name, email, notes Admins and providers only Embedding Generation When you configure an embedding model, Aegis automatically generates embeddings for existing content in the background. New content is embedded as it is created or updated. Long KB articles are split into smaller chunks (approximately 500 tokens each) so that specific sections can be found independently. Graceful Degradation If no embedding model is configured, Aegis uses FTS only. This means search works out of the box without any AI provider. Adding an embedding model later is seamless &mdash; existing content will be embedded in the background and search quality improves automatically. Why Results Improve Over Time More content &mdash; The more KB articles, tickets, and contacts you have, the more the AI can reference Embeddings &mdash; Once an embedding model is configured, semantic search activates and catches queries that keywords miss Chunking &mdash; Long articles are chunked so that specific sections surface even if the rest of the article is not relevant Related Articles AI Assistant Setup AI Provider Setup Guide Importing Documents to Knowledge Base$plain_13$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-doc-import',
  'Importing Documents to Knowledge Base',
  'How to enable Docling for PDF/DOCX import and upload documents to the Knowledge Base.',
  $body_14$<h2>Importing Documents to Knowledge Base</h2>
<p>Aegis can import documents (PDF, DOCX, PPTX, and more) directly into the Knowledge Base using an optional document processing service called <strong>Docling</strong>.</p>

<h3>What is Docling?</h3>
<p>Docling is an open-source document extraction service that converts files into structured text. It runs as a separate Docker container alongside Aegis. Docling is <strong>optional</strong> &mdash; it is only needed if you want to import existing documents.</p>

<h3>Enabling Docling</h3>
<ol>
<li>Open your <code>docker-compose.yml</code> file</li>
<li>Find the commented-out <code>docling</code> service section</li>
<li>Uncomment it (remove the <code>#</code> characters)</li>
<li>In your <code>.env</code> file, uncomment: <code>DOCLING_URL=http://docling:5001</code></li>
<li>Run <code>docker compose up -d</code> to start the Docling container</li>
</ol>
<p><strong>Note:</strong> Docling requires approximately 2 GB of memory. Ensure your server has sufficient resources.</p>

<h3>Supported Formats</h3>
<table>
<thead><tr><th>Format</th><th>Extension</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>PDF</td><td>.pdf</td><td>Including scanned documents (OCR)</td></tr>
<tr><td>Word</td><td>.docx</td><td>Modern Word documents</td></tr>
<tr><td>PowerPoint</td><td>.pptx</td><td>Slides extracted as structured text</td></tr>
<tr><td>Excel</td><td>.xlsx</td><td>Tables and data</td></tr>
<tr><td>HTML</td><td>.html</td><td>Web pages</td></tr>
<tr><td>Images</td><td>.png, .jpg</td><td>OCR text extraction</td></tr>
</tbody>
</table>

<h3>How to Import</h3>
<ol>
<li>Go to <strong>KB &rarr; Import</strong> (only visible when Docling is running)</li>
<li>Select a file (maximum 50 MB)</li>
<li>Aegis sends the file to Docling for text extraction</li>
<li>The extracted content becomes one or more KB articles in draft status</li>
<li>Review the imported article(s), edit as needed, then publish</li>
</ol>

<h3>Large Documents</h3>
<p>If a document contains more than approximately 10,000 tokens (roughly 15-20 pages of text), Aegis automatically splits it into multiple articles. The split follows document structure (headings) when possible, or uses size boundaries. Each resulting article links back to the original document name.</p>

<h3>After Import</h3>
<ul>
<li>Imported articles are created as <strong>drafts</strong> with <strong>internal</strong> visibility &mdash; review them before publishing</li>
<li>They are placed in an "Imported Documents" category</li>
<li>If an embedding model is configured, embedding jobs are queued automatically</li>
<li>Edit titles, summaries, and content to make the imported text more useful</li>
</ul>

<h3>Troubleshooting</h3>
<ul>
<li><strong>Import button not visible</strong> &mdash; Docling is not running or not reachable. Check that the service is running and DOCLING_URL is set.</li>
<li><strong>503 error</strong> &mdash; Docling is starting up (can take 30-60 seconds) or has run out of memory.</li>
<li><strong>Poor text quality</strong> &mdash; Scanned PDFs depend on OCR quality. Try a cleaner scan or use the original digital document.</li>
</ul>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-kb-management">Knowledge Base Management</a></li>
<li><a href="/portal/kb/aegis-ai-search">How Aegis AI Search Works</a></li>
<li><a href="/portal/kb/aegis-ai-provider-setup">AI Provider Setup Guide</a></li>
</ul>$body_14$,
  $plain_14$Importing Documents to Knowledge Base Aegis can import documents (PDF, DOCX, PPTX, and more) directly into the Knowledge Base using an optional document processing service called Docling . What is Docling? Docling is an open-source document extraction service that converts files into structured text. It runs as a separate Docker container alongside Aegis. Docling is optional &mdash; it is only needed if you want to import existing documents. Enabling Docling Open your docker-compose.yml file Find the commented-out docling service section Uncomment it (remove the # characters) In your .env file, uncomment: DOCLING_URL=http://docling:5001 Run docker compose up -d to start the Docling container Note: Docling requires approximately 2 GB of memory. Ensure your server has sufficient resources. Supported Formats Format Extension Notes PDF .pdf Including scanned documents (OCR) Word .docx Modern Word documents PowerPoint .pptx Slides extracted as structured text Excel .xlsx Tables and data HTML .html Web pages Images .png, .jpg OCR text extraction How to Import Go to KB &rarr; Import (only visible when Docling is running) Select a file (maximum 50 MB) Aegis sends the file to Docling for text extraction The extracted content becomes one or more KB articles in draft status Review the imported article(s), edit as needed, then publish Large Documents If a document contains more than approximately 10,000 tokens (roughly 15-20 pages of text), Aegis automatically splits it into multiple articles. The split follows document structure (headings) when possible, or uses size boundaries. Each resulting article links back to the original document name. After Import Imported articles are created as drafts with internal visibility &mdash; review them before publishing They are placed in an "Imported Documents" category If an embedding model is configured, embedding jobs are queued automatically Edit titles, summaries, and content to make the imported text more useful Troubleshooting Import button not visible &mdash; Docling is not running or not reachable. Check that the service is running and DOCLING_URL is set. 503 error &mdash; Docling is starting up (can take 30-60 seconds) or has run out of memory. Poor text quality &mdash; Scanned PDFs depend on OCR quality. Try a cleaner scan or use the original digital document. Related Articles Knowledge Base Management How Aegis AI Search Works AI Provider Setup Guide$plain_14$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-ai-provider-setup',
  'AI Provider Setup Guide',
  'Configuring Ollama, OpenAI, or Google Gemini as your AI provider, including embedding models.',
  $body_15$<h2>AI Provider Setup Guide</h2>
<p>Aegis supports multiple AI providers for both chat (answering questions) and embeddings (powering semantic search). You can use different providers for each purpose, or the same provider for both.</p>

<h3>Supported Providers</h3>
<table>
<thead><tr><th>Provider</th><th>Chat Models</th><th>Embedding Models</th><th>Data Location</th></tr></thead>
<tbody>
<tr><td><strong>Ollama</strong></td><td>llama3, mistral, gemma2, etc.</td><td>nomic-embed-text, all-minilm, mxbai-embed-large</td><td>Your server (local)</td></tr>
<tr><td><strong>OpenAI</strong></td><td>gpt-4o, gpt-4o-mini, etc.</td><td>text-embedding-3-small, text-embedding-3-large</td><td>OpenAI cloud (US)</td></tr>
<tr><td><strong>Google Gemini</strong></td><td>gemini-pro, gemini-flash, etc.</td><td>text-embedding-004</td><td>Google cloud</td></tr>
</tbody>
</table>

<h3>Setting Up Ollama (Local AI)</h3>
<ol>
<li><strong>Install Ollama</strong> on the same server as Aegis, or a server accessible from the Aegis network</li>
<li>Pull models: <code>ollama pull mistral</code> for chat, <code>ollama pull nomic-embed-text</code> for embeddings</li>
<li>In Aegis, go to <strong>Settings &rarr; AI Configuration</strong></li>
<li>Add a provider: Name = "Ollama", API URL = <code>http://host.docker.internal:11434</code> (if Ollama runs on the Docker host) or <code>http://ollama:11434</code> (if added to docker-compose)</li>
<li>Select your chat model and embedding model</li>
</ol>
<p><strong>Ollama advantages:</strong> No API costs. No data leaves your network. No rate limits. Ideal for data-sovereign environments.</p>

<h3>Setting Up OpenAI</h3>
<ol>
<li>Get an API key from <a href="https://platform.openai.com/api-keys">platform.openai.com</a></li>
<li>In Aegis, go to <strong>Settings &rarr; AI Configuration</strong></li>
<li>Add a provider: Name = "OpenAI", API Key = your key</li>
<li>Select models (recommended: gpt-4o-mini for chat, text-embedding-3-small for embeddings)</li>
</ol>

<h3>Setting Up Google Gemini</h3>
<ol>
<li>Get an API key from <a href="https://aistudio.google.com/app/apikey">Google AI Studio</a></li>
<li>In Aegis, go to <strong>Settings &rarr; AI Configuration</strong></li>
<li>Add a provider: Name = "Gemini", API Key = your key</li>
<li>Select models</li>
</ol>

<h3>Understanding Embedding Models</h3>
<p>Embedding models convert text into numerical vectors that capture meaning. They are different from chat models:</p>
<ul>
<li><strong>Chat models</strong> generate text responses (answer questions, summarize, triage)</li>
<li><strong>Embedding models</strong> convert text to vectors for semantic search (finding similar content)</li>
<li>Embedding models are much smaller and cheaper to run than chat models</li>
<li>A small local embedding model (e.g., nomic-embed-text at 274 MB) provides excellent search quality</li>
</ul>

<h3>Recommended Configurations</h3>
<table>
<thead><tr><th>Scenario</th><th>Chat Model</th><th>Embedding Model</th></tr></thead>
<tbody>
<tr><td><strong>Fully local (free)</strong></td><td>Ollama: mistral or llama3</td><td>Ollama: nomic-embed-text</td></tr>
<tr><td><strong>Best quality</strong></td><td>OpenAI: gpt-4o</td><td>OpenAI: text-embedding-3-small</td></tr>
<tr><td><strong>Local embeddings + cloud chat</strong></td><td>OpenAI: gpt-4o-mini</td><td>Ollama: nomic-embed-text</td></tr>
<tr><td><strong>Budget cloud</strong></td><td>Google: gemini-flash</td><td>Google: text-embedding-004</td></tr>
</tbody>
</table>

<h3>Embedding Dimensions</h3>
<p>Each embedding model produces vectors of a specific size (dimension). Common dimensions:</p>
<ul>
<li><strong>nomic-embed-text</strong>: 768 dimensions</li>
<li><strong>text-embedding-3-small</strong>: 1536 dimensions</li>
<li><strong>text-embedding-3-large</strong>: 3072 dimensions</li>
<li><strong>text-embedding-004</strong>: 768 dimensions</li>
</ul>
<p>Higher dimensions can capture more nuance but use more storage. For most ITSM use cases, 768 dimensions (nomic-embed-text) provides an excellent balance of quality and efficiency.</p>

<h3>What Happens When You Configure Embeddings</h3>
<ol>
<li>Set the embedding model and dimension in the AI provider settings</li>
<li>Aegis automatically queues all existing KB articles, tickets, and contacts for embedding</li>
<li>Background jobs process the queue (you can continue using Aegis normally)</li>
<li>New content is automatically embedded as it is created or updated</li>
<li>Search results begin including semantic matches as embeddings complete</li>
</ol>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-ai-setup">AI Assistant Setup</a></li>
<li><a href="/portal/kb/aegis-ai-search">How Aegis AI Search Works</a></li>
<li><a href="/portal/kb/aegis-doc-import">Importing Documents to Knowledge Base</a></li>
</ul>$body_15$,
  $plain_15$AI Provider Setup Guide Aegis supports multiple AI providers for both chat (answering questions) and embeddings (powering semantic search). You can use different providers for each purpose, or the same provider for both. Supported Providers Provider Chat Models Embedding Models Data Location Ollama llama3, mistral, gemma2, etc. nomic-embed-text, all-minilm, mxbai-embed-large Your server (local) OpenAI gpt-4o, gpt-4o-mini, etc. text-embedding-3-small, text-embedding-3-large OpenAI cloud (US) Google Gemini gemini-pro, gemini-flash, etc. text-embedding-004 Google cloud Setting Up Ollama (Local AI) Install Ollama on the same server as Aegis, or a server accessible from the Aegis network Pull models: ollama pull mistral for chat, ollama pull nomic-embed-text for embeddings In Aegis, go to Settings &rarr; AI Configuration Add a provider: Name = "Ollama", API URL = http://host.docker.internal:11434 (if Ollama runs on the Docker host) or http://ollama:11434 (if added to docker-compose) Select your chat model and embedding model Ollama advantages: No API costs. No data leaves your network. No rate limits. Ideal for data-sovereign environments. Setting Up OpenAI Get an API key from platform.openai.com In Aegis, go to Settings &rarr; AI Configuration Add a provider: Name = "OpenAI", API Key = your key Select models (recommended: gpt-4o-mini for chat, text-embedding-3-small for embeddings) Setting Up Google Gemini Get an API key from Google AI Studio In Aegis, go to Settings &rarr; AI Configuration Add a provider: Name = "Gemini", API Key = your key Select models Understanding Embedding Models Embedding models convert text into numerical vectors that capture meaning. They are different from chat models: Chat models generate text responses (answer questions, summarize, triage) Embedding models convert text to vectors for semantic search (finding similar content) Embedding models are much smaller and cheaper to run than chat models A small local embedding model (e.g., nomic-embed-text at 274 MB) provides excellent search quality Recommended Configurations Scenario Chat Model Embedding Model Fully local (free) Ollama: mistral or llama3 Ollama: nomic-embed-text Best quality OpenAI: gpt-4o OpenAI: text-embedding-3-small Local embeddings + cloud chat OpenAI: gpt-4o-mini Ollama: nomic-embed-text Budget cloud Google: gemini-flash Google: text-embedding-004 Embedding Dimensions Each embedding model produces vectors of a specific size (dimension). Common dimensions: nomic-embed-text : 768 dimensions text-embedding-3-small : 1536 dimensions text-embedding-3-large : 3072 dimensions text-embedding-004 : 768 dimensions Higher dimensions can capture more nuance but use more storage. For most ITSM use cases, 768 dimensions (nomic-embed-text) provides an excellent balance of quality and efficiency. What Happens When You Configure Embeddings Set the embedding model and dimension in the AI provider settings Aegis automatically queues all existing KB articles, tickets, and contacts for embedding Background jobs process the queue (you can continue using Aegis normally) New content is automatically embedded as it is created or updated Search results begin including semantic matches as embeddings complete Related Articles AI Assistant Setup How Aegis AI Search Works Importing Documents to Knowledge Base$plain_15$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-policy-management',
  'Policy & Procedure Management',
  'How to create, edit, publish, and manage policies and procedures in Aegis.',
  $body_16$<h2>Policy &amp; Procedure Management</h2>
<p>Aegis includes a built-in policy and procedure system within the Knowledge Base. This guide explains how policies and procedures are organized and how to manage them.</p>

<h3>Policies vs. Procedures</h3>
<ul>
<li><strong>Policies</strong> are commitments &mdash; they state <em>what</em> the organization will do and <em>why</em>. Example: "All employees must use multi-factor authentication." Policies are seeded as published articles that employees can read and acknowledge.</li>
<li><strong>Procedures</strong> are instructions &mdash; they explain <em>how</em> to carry out a policy. Example: "How to enroll in MFA using an authenticator app." Procedures are seeded as drafts so you can customize them for your environment before publishing.</li>
</ul>
<p>Each policy has a paired procedure. They share the same slug pattern: <code>policy-incident-response</code> pairs with <code>procedure-incident-response</code>.</p>

<h3>Article Types</h3>
<p>KB articles have an <code>article_type</code> field that determines how they appear:</p>
<ul>
<li><strong>standard</strong> &mdash; General knowledge base articles (how-tos, FAQs, guides)</li>
<li><strong>policy</strong> &mdash; Organizational policies (seeded by Aegis, customizable)</li>
<li><strong>procedure</strong> &mdash; Step-by-step procedures paired with policies</li>
<li><strong>training</strong> &mdash; Training materials with optional assessments</li>
</ul>

<h3>Creating &amp; Editing Policies</h3>
<ol>
<li>Navigate to <strong>Knowledge Base</strong> in the admin portal</li>
<li>Click <strong>New Article</strong> and select "Policy" as the article type</li>
<li>Fill in the title, summary, and content. Use clear, authoritative language.</li>
<li>Add <strong>framework tags</strong> (e.g., <code>soc2</code>, <code>hipaa</code>) to link the policy to compliance frameworks</li>
<li>Set <strong>visibility</strong> (usually "Authenticated" so all logged-in users can read it)</li>
<li>Save as draft, then publish when approved</li>
</ol>

<h3>Framework Tags</h3>
<p>Policies can be tagged with one or more compliance framework identifiers. Tags help you filter and report on which policies address which compliance requirements:</p>
<ul>
<li><code>soc2</code> &mdash; SOC 2 Trust Services Criteria</li>
<li><code>nist-csf</code> &mdash; NIST Cybersecurity Framework</li>
<li><code>itil4</code> &mdash; ITIL 4 service management</li>
<li><code>hipaa</code> &mdash; HIPAA healthcare compliance</li>
<li><code>pci-dss</code> &mdash; PCI DSS payment card security</li>
<li><code>universal</code> &mdash; Applies to all organizations</li>
</ul>
<p>See <a href="/portal/kb/aegis-framework-tags">Compliance Framework Tags</a> for details on each framework.</p>

<h3>Customizing Seeded Templates</h3>
<p>Aegis seeds 25 policies and 25 procedures on setup. These are starting templates &mdash; customize them for your organization:</p>
<ol>
<li>Review each seeded policy and update the language to match your organization's practices</li>
<li>For procedures (seeded as drafts), fill in organization-specific details like tool names, team structures, and schedules</li>
<li>Publish procedures once customized</li>
<li>System-owned articles (<code>is_system = true</code>) may receive content updates when Aegis is upgraded. If you've customized them, your changes are preserved.</li>
</ol>

<h3>Publishing Workflow</h3>
<ol>
<li><strong>Draft</strong> &mdash; Article is being written or reviewed. Not visible to end users.</li>
<li><strong>Published</strong> &mdash; Article is live and visible per its visibility settings.</li>
<li><strong>Archived</strong> &mdash; Article is retired but preserved for reference.</li>
</ol>
<p>Policies should go through an internal review before publishing. Consider having a manager or compliance officer review the content.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-acknowledgment-tracking">Acknowledgment &amp; Compliance Tracking</a></li>
<li><a href="/portal/kb/aegis-soc2-guide">SOC 2 Compliance with Aegis</a></li>
<li><a href="/portal/kb/aegis-framework-tags">Compliance Framework Tags</a></li>
</ul>$body_16$,
  $plain_16$Policy &amp; Procedure Management Aegis includes a built-in policy and procedure system within the Knowledge Base. This guide explains how policies and procedures are organized and how to manage them. Policies vs. Procedures Policies are commitments &mdash; they state what the organization will do and why . Example: "All employees must use multi-factor authentication." Policies are seeded as published articles that employees can read and acknowledge. Procedures are instructions &mdash; they explain how to carry out a policy. Example: "How to enroll in MFA using an authenticator app." Procedures are seeded as drafts so you can customize them for your environment before publishing. Each policy has a paired procedure. They share the same slug pattern: policy-incident-response pairs with procedure-incident-response . Article Types KB articles have an article_type field that determines how they appear: standard &mdash; General knowledge base articles (how-tos, FAQs, guides) policy &mdash; Organizational policies (seeded by Aegis, customizable) procedure &mdash; Step-by-step procedures paired with policies training &mdash; Training materials with optional assessments Creating &amp; Editing Policies Navigate to Knowledge Base in the admin portal Click New Article and select "Policy" as the article type Fill in the title, summary, and content. Use clear, authoritative language. Add framework tags (e.g., soc2 , hipaa ) to link the policy to compliance frameworks Set visibility (usually "Authenticated" so all logged-in users can read it) Save as draft, then publish when approved Framework Tags Policies can be tagged with one or more compliance framework identifiers. Tags help you filter and report on which policies address which compliance requirements: soc2 &mdash; SOC 2 Trust Services Criteria nist-csf &mdash; NIST Cybersecurity Framework itil4 &mdash; ITIL 4 service management hipaa &mdash; HIPAA healthcare compliance pci-dss &mdash; PCI DSS payment card security universal &mdash; Applies to all organizations See Compliance Framework Tags for details on each framework. Customizing Seeded Templates Aegis seeds 25 policies and 25 procedures on setup. These are starting templates &mdash; customize them for your organization: Review each seeded policy and update the language to match your organization's practices For procedures (seeded as drafts), fill in organization-specific details like tool names, team structures, and schedules Publish procedures once customized System-owned articles ( is_system = true ) may receive content updates when Aegis is upgraded. If you've customized them, your changes are preserved. Publishing Workflow Draft &mdash; Article is being written or reviewed. Not visible to end users. Published &mdash; Article is live and visible per its visibility settings. Archived &mdash; Article is retired but preserved for reference. Policies should go through an internal review before publishing. Consider having a manager or compliance officer review the content. Related Articles Acknowledgment &amp; Compliance Tracking SOC 2 Compliance with Aegis Compliance Framework Tags$plain_16$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-acknowledgment-tracking',
  'Acknowledgment & Compliance Tracking',
  'How to require policy acknowledgments, target specific groups, and track compliance.',
  $body_17$<h2>Acknowledgment &amp; Compliance Tracking</h2>
<p>Aegis lets you require employees to acknowledge that they have read and understood specific policies. This guide explains how the acknowledgment system works.</p>

<h3>Enabling Acknowledgment</h3>
<p>When editing a policy article, toggle <strong>Requires Acknowledgment</strong> to enable it. Once enabled:</p>
<ul>
<li>The policy appears in each user's "Pending Acknowledgments" list</li>
<li>Users see a prominent acknowledgment button when viewing the policy</li>
<li>Admins can track who has and hasn't acknowledged</li>
</ul>

<h3>Setting Deadlines</h3>
<p>Aegis supports two types of acknowledgment deadlines:</p>

<h4>Fixed Date Deadline</h4>
<p>Set <strong>Acknowledgment Required By</strong> to a specific date. All targeted users must acknowledge by this date. Use this for:</p>
<ul>
<li>Annual policy renewals ("Acknowledge by December 31")</li>
<li>New policy rollouts ("Acknowledge within 30 days of publication")</li>
<li>Regulatory deadlines</li>
</ul>

<h4>Relative Deadline (Days from Start Date)</h4>
<p>Set <strong>Acknowledgment Days</strong> to a number of days. Each contact's deadline is calculated individually:</p>
<p><code>deadline = contact's start_date + acknowledgment_days</code></p>
<p>If a contact has no <code>start_date</code>, their <code>created_at</code> date is used instead. Use this for:</p>
<ul>
<li>New hire onboarding ("Acknowledge within 14 days of starting")</li>
<li>Rolling compliance requirements</li>
</ul>

<h4>Combined Deadlines</h4>
<p>If both a fixed date and relative days are set, the <strong>earlier</strong> of the two is used as the effective deadline. This ensures compliance regardless of which deadline comes first.</p>

<h3>Targeting Specific Groups</h3>
<p>By default, all authenticated users in the organization are required to acknowledge a policy. To target specific groups:</p>
<ol>
<li>Create contact groups (e.g., "Engineering", "Finance", "All Employees")</li>
<li>Assign contacts to the appropriate groups</li>
<li>On the policy, set <strong>Visible To Contact Groups</strong> to the group(s) that should acknowledge</li>
<li>Set <strong>Visibility</strong> to "Private" so the policy is only visible to those groups</li>
</ol>
<p>When groups are specified:</p>
<ul>
<li>Only contacts in those groups see the policy</li>
<li>Only contacts in those groups are counted in the "total required" for compliance tracking</li>
<li>The acknowledgment pending list only shows the policy to targeted contacts</li>
</ul>
<p>If no groups are specified (empty array), the policy targets all authenticated users in the organization &mdash; the default behavior.</p>

<h3>Viewing Compliance Status</h3>
<p>The <strong>Policies</strong> page shows compliance metrics for each policy:</p>
<ul>
<li><strong>Total Assigned</strong> &mdash; Number of users/contacts required to acknowledge</li>
<li><strong>Acknowledged</strong> &mdash; Number who have acknowledged</li>
<li><strong>Pending</strong> &mdash; Number who haven't acknowledged yet</li>
<li><strong>Overdue</strong> &mdash; Number past their deadline who haven't acknowledged</li>
<li><strong>Compliance %</strong> &mdash; Percentage of required users who have acknowledged</li>
</ul>

<h3>Overdue Indicators</h3>
<p>A user is considered "overdue" when:</p>
<ul>
<li>They haven't acknowledged the policy AND</li>
<li>Their effective deadline (fixed date or relative deadline, whichever is earlier) has passed</li>
</ul>
<p>For policies with relative deadlines, each user's overdue status is calculated individually based on their own start date.</p>

<h3>Re-Acknowledgment</h3>
<p>When a policy is updated (content changes, new version), you can require re-acknowledgment by updating the acknowledgment deadline. The system tracks acknowledgments per article version.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-policy-management">Policy &amp; Procedure Management</a></li>
<li><a href="/portal/kb/aegis-soc2-guide">SOC 2 Compliance with Aegis</a></li>
</ul>$body_17$,
  $plain_17$Acknowledgment &amp; Compliance Tracking Aegis lets you require employees to acknowledge that they have read and understood specific policies. This guide explains how the acknowledgment system works. Enabling Acknowledgment When editing a policy article, toggle Requires Acknowledgment to enable it. Once enabled: The policy appears in each user's "Pending Acknowledgments" list Users see a prominent acknowledgment button when viewing the policy Admins can track who has and hasn't acknowledged Setting Deadlines Aegis supports two types of acknowledgment deadlines: Fixed Date Deadline Set Acknowledgment Required By to a specific date. All targeted users must acknowledge by this date. Use this for: Annual policy renewals ("Acknowledge by December 31") New policy rollouts ("Acknowledge within 30 days of publication") Regulatory deadlines Relative Deadline (Days from Start Date) Set Acknowledgment Days to a number of days. Each contact's deadline is calculated individually: deadline = contact's start_date + acknowledgment_days If a contact has no start_date , their created_at date is used instead. Use this for: New hire onboarding ("Acknowledge within 14 days of starting") Rolling compliance requirements Combined Deadlines If both a fixed date and relative days are set, the earlier of the two is used as the effective deadline. This ensures compliance regardless of which deadline comes first. Targeting Specific Groups By default, all authenticated users in the organization are required to acknowledge a policy. To target specific groups: Create contact groups (e.g., "Engineering", "Finance", "All Employees") Assign contacts to the appropriate groups On the policy, set Visible To Contact Groups to the group(s) that should acknowledge Set Visibility to "Private" so the policy is only visible to those groups When groups are specified: Only contacts in those groups see the policy Only contacts in those groups are counted in the "total required" for compliance tracking The acknowledgment pending list only shows the policy to targeted contacts If no groups are specified (empty array), the policy targets all authenticated users in the organization &mdash; the default behavior. Viewing Compliance Status The Policies page shows compliance metrics for each policy: Total Assigned &mdash; Number of users/contacts required to acknowledge Acknowledged &mdash; Number who have acknowledged Pending &mdash; Number who haven't acknowledged yet Overdue &mdash; Number past their deadline who haven't acknowledged Compliance % &mdash; Percentage of required users who have acknowledged Overdue Indicators A user is considered "overdue" when: They haven't acknowledged the policy AND Their effective deadline (fixed date or relative deadline, whichever is earlier) has passed For policies with relative deadlines, each user's overdue status is calculated individually based on their own start date. Re-Acknowledgment When a policy is updated (content changes, new version), you can require re-acknowledgment by updating the acknowledgment deadline. The system tracks acknowledgments per article version. Related Articles Policy &amp; Procedure Management SOC 2 Compliance with Aegis$plain_17$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-soc2-guide',
  'SOC 2 Compliance with Aegis',
  'How Aegis-seeded policies map to SOC 2 Trust Services Criteria and what to do next.',
  $body_18$<h2>SOC 2 Compliance with Aegis</h2>
<p>Aegis seeds policies that address SOC 2 Trust Services Criteria. This guide maps each criteria category to the relevant Aegis policies and explains what additional steps you may need.</p>

<h3>What is SOC 2?</h3>
<p>SOC 2 (System and Organization Controls 2) is an auditing framework developed by the AICPA. It evaluates an organization's controls related to security, availability, processing integrity, confidentiality, and privacy. SOC 2 compliance is demonstrated through an audit by an independent CPA firm.</p>

<h3>Trust Services Criteria Mapping</h3>

<h4>CC1: Control Environment</h4>
<p>The organization demonstrates a commitment to integrity and ethical values.</p>
<ul>
<li><a href="/portal/kb/policy-information-security">Information Security Policy</a> &mdash; Establishes security commitment</li>
<li><a href="/portal/kb/policy-acceptable-use">Acceptable Use Policy</a> &mdash; Defines ethical use standards</li>
<li><a href="/portal/kb/policy-segregation-of-duties">Segregation of Duties Policy</a> &mdash; Prevents conflicts of interest</li>
</ul>

<h4>CC2: Communication &amp; Information</h4>
<p>The organization uses relevant, quality information and communicates it internally and externally.</p>
<ul>
<li><a href="/portal/kb/policy-data-classification">Data Classification Policy</a> &mdash; Defines information categories</li>
<li><a href="/portal/kb/policy-security-awareness">Security Awareness Policy</a> &mdash; Communicates security requirements</li>
</ul>

<h4>CC3: Risk Assessment</h4>
<p>The organization identifies and analyzes risks to achieving its objectives.</p>
<ul>
<li><a href="/portal/kb/policy-information-security">Information Security Policy</a> &mdash; Includes risk assessment requirements</li>
<li><a href="/portal/kb/policy-vendor-management">Vendor &amp; Third-Party Management Policy</a> &mdash; Assesses vendor risks</li>
</ul>

<h4>CC4: Monitoring Activities</h4>
<p>The organization monitors internal controls and evaluates deficiencies.</p>
<ul>
<li><a href="/portal/kb/policy-audit-trail">Audit Trail &amp; Logging Policy</a> &mdash; Defines monitoring and logging requirements</li>
<li><a href="/portal/kb/policy-network-security">Network Security Policy</a> &mdash; Network monitoring controls</li>
</ul>

<h4>CC5: Control Activities</h4>
<p>The organization deploys control activities through policies and procedures.</p>
<ul>
<li><a href="/portal/kb/policy-access-control">Access Control Policy</a> &mdash; Logical access controls</li>
<li><a href="/portal/kb/policy-change-management">Change Management Policy</a> &mdash; Change control processes</li>
<li><a href="/portal/kb/policy-password-authentication">Password &amp; Authentication Policy</a> &mdash; Authentication controls</li>
</ul>

<h4>CC6: Logical &amp; Physical Access</h4>
<p>The organization restricts logical and physical access to authorized users.</p>
<ul>
<li><a href="/portal/kb/policy-access-control">Access Control Policy</a> &mdash; Least-privilege access</li>
<li><a href="/portal/kb/policy-physical-security">Physical Security Policy</a> &mdash; Facility and server room access</li>
<li><a href="/portal/kb/policy-remote-access-byod">Remote Access &amp; BYOD Policy</a> &mdash; Remote access controls</li>
</ul>

<h4>CC7: System Operations</h4>
<p>The organization manages system operations to detect and respond to deviations.</p>
<ul>
<li><a href="/portal/kb/policy-incident-response">Incident Response Policy</a> &mdash; Incident detection and response</li>
<li><a href="/portal/kb/policy-backup-recovery">Backup &amp; Recovery Policy</a> &mdash; System resilience</li>
<li><a href="/portal/kb/policy-network-security">Network Security Policy</a> &mdash; Operational security monitoring</li>
</ul>

<h4>CC8: Change Management</h4>
<p>The organization manages changes to infrastructure and software.</p>
<ul>
<li><a href="/portal/kb/policy-change-management">Change Management Policy</a> &mdash; Change advisory board, approval workflows</li>
<li><a href="/portal/kb/policy-software-licensing">Software Licensing &amp; Installation Policy</a> &mdash; Software control</li>
</ul>

<h4>CC9: Risk Mitigation</h4>
<p>The organization identifies and mitigates risks from business disruptions and vendor dependencies.</p>
<ul>
<li><a href="/portal/kb/policy-vendor-management">Vendor &amp; Third-Party Management Policy</a> &mdash; Vendor risk management</li>
<li><a href="/portal/kb/policy-backup-recovery">Backup &amp; Recovery Policy</a> &mdash; Business continuity</li>
</ul>

<h4>Availability</h4>
<ul>
<li><a href="/portal/kb/policy-backup-recovery">Backup &amp; Recovery Policy</a> &mdash; Recovery time and point objectives</li>
<li><a href="/portal/kb/policy-incident-response">Incident Response Policy</a> &mdash; Availability incident handling</li>
</ul>

<h4>Confidentiality</h4>
<ul>
<li><a href="/portal/kb/policy-data-classification">Data Classification Policy</a> &mdash; Identifies confidential data</li>
<li><a href="/portal/kb/policy-access-control">Access Control Policy</a> &mdash; Restricts access to confidential data</li>
<li><a href="/portal/kb/policy-records-retention">Records Retention Policy</a> &mdash; Retention and disposal</li>
</ul>

<h4>Processing Integrity</h4>
<ul>
<li><a href="/portal/kb/policy-change-management">Change Management Policy</a> &mdash; Ensures changes are tested and approved</li>
<li><a href="/portal/kb/policy-audit-trail">Audit Trail &amp; Logging Policy</a> &mdash; Tracks processing activities</li>
</ul>

<h4>Privacy</h4>
<ul>
<li><a href="/portal/kb/policy-data-classification">Data Classification Policy</a> &mdash; Identifies personal data</li>
<li><a href="/portal/kb/policy-acceptable-use">Acceptable Use Policy</a> &mdash; Governs data usage</li>
<li><a href="/portal/kb/policy-records-retention">Records Retention Policy</a> &mdash; Data retention and disposal</li>
</ul>

<h3>What You Still Need</h3>
<p>Aegis provides the policy foundation, but SOC 2 compliance also requires:</p>
<ol>
<li><strong>Customize policies</strong> &mdash; Review each seeded policy and update it with your organization's specific practices, tools, and teams</li>
<li><strong>Complete procedures</strong> &mdash; Seeded procedures are drafts. Fill in your operational details and publish them</li>
<li><strong>Collect evidence</strong> &mdash; Run the procedures and keep records (logs, reports, approvals) as audit evidence</li>
<li><strong>Conduct risk assessments</strong> &mdash; Perform formal risk assessments at least annually</li>
<li><strong>Train your team</strong> &mdash; Use the training articles and acknowledgment system to verify staff awareness</li>
<li><strong>Engage an auditor</strong> &mdash; Hire a CPA firm to perform the SOC 2 audit when ready</li>
</ol>

<h3>Recommended Review Cadence</h3>
<table>
<tr><th>Activity</th><th>Frequency</th></tr>
<tr><td>Policy review and update</td><td>Annually</td></tr>
<tr><td>Procedure review and update</td><td>Annually</td></tr>
<tr><td>Risk assessment</td><td>Annually</td></tr>
<tr><td>Access reviews</td><td>Quarterly</td></tr>
<tr><td>Vulnerability scanning</td><td>Monthly</td></tr>
<tr><td>Security awareness training</td><td>Annually</td></tr>
<tr><td>Backup test restore</td><td>Monthly</td></tr>
<tr><td>Incident response drill</td><td>Bi-annually</td></tr>
</table>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-policy-management">Policy &amp; Procedure Management</a></li>
<li><a href="/portal/kb/aegis-framework-tags">Compliance Framework Tags</a></li>
<li><a href="/portal/kb/aegis-acknowledgment-tracking">Acknowledgment &amp; Compliance Tracking</a></li>
</ul>$body_18$,
  $plain_18$SOC 2 Compliance with Aegis Aegis seeds policies that address SOC 2 Trust Services Criteria. This guide maps each criteria category to the relevant Aegis policies and explains what additional steps you may need. What is SOC 2? SOC 2 (System and Organization Controls 2) is an auditing framework developed by the AICPA. It evaluates an organization's controls related to security, availability, processing integrity, confidentiality, and privacy. SOC 2 compliance is demonstrated through an audit by an independent CPA firm. Trust Services Criteria Mapping CC1: Control Environment The organization demonstrates a commitment to integrity and ethical values. Information Security Policy &mdash; Establishes security commitment Acceptable Use Policy &mdash; Defines ethical use standards Segregation of Duties Policy &mdash; Prevents conflicts of interest CC2: Communication &amp; Information The organization uses relevant, quality information and communicates it internally and externally. Data Classification Policy &mdash; Defines information categories Security Awareness Policy &mdash; Communicates security requirements CC3: Risk Assessment The organization identifies and analyzes risks to achieving its objectives. Information Security Policy &mdash; Includes risk assessment requirements Vendor &amp; Third-Party Management Policy &mdash; Assesses vendor risks CC4: Monitoring Activities The organization monitors internal controls and evaluates deficiencies. Audit Trail &amp; Logging Policy &mdash; Defines monitoring and logging requirements Network Security Policy &mdash; Network monitoring controls CC5: Control Activities The organization deploys control activities through policies and procedures. Access Control Policy &mdash; Logical access controls Change Management Policy &mdash; Change control processes Password &amp; Authentication Policy &mdash; Authentication controls CC6: Logical &amp; Physical Access The organization restricts logical and physical access to authorized users. Access Control Policy &mdash; Least-privilege access Physical Security Policy &mdash; Facility and server room access Remote Access &amp; BYOD Policy &mdash; Remote access controls CC7: System Operations The organization manages system operations to detect and respond to deviations. Incident Response Policy &mdash; Incident detection and response Backup &amp; Recovery Policy &mdash; System resilience Network Security Policy &mdash; Operational security monitoring CC8: Change Management The organization manages changes to infrastructure and software. Change Management Policy &mdash; Change advisory board, approval workflows Software Licensing &amp; Installation Policy &mdash; Software control CC9: Risk Mitigation The organization identifies and mitigates risks from business disruptions and vendor dependencies. Vendor &amp; Third-Party Management Policy &mdash; Vendor risk management Backup &amp; Recovery Policy &mdash; Business continuity Availability Backup &amp; Recovery Policy &mdash; Recovery time and point objectives Incident Response Policy &mdash; Availability incident handling Confidentiality Data Classification Policy &mdash; Identifies confidential data Access Control Policy &mdash; Restricts access to confidential data Records Retention Policy &mdash; Retention and disposal Processing Integrity Change Management Policy &mdash; Ensures changes are tested and approved Audit Trail &amp; Logging Policy &mdash; Tracks processing activities Privacy Data Classification Policy &mdash; Identifies personal data Acceptable Use Policy &mdash; Governs data usage Records Retention Policy &mdash; Data retention and disposal What You Still Need Aegis provides the policy foundation, but SOC 2 compliance also requires: Customize policies &mdash; Review each seeded policy and update it with your organization's specific practices, tools, and teams Complete procedures &mdash; Seeded procedures are drafts. Fill in your operational details and publish them Collect evidence &mdash; Run the procedures and keep records (logs, reports, approvals) as audit evidence Conduct risk assessments &mdash; Perform formal risk assessments at least annually Train your team &mdash; Use the training articles and acknowledgment system to verify staff awareness Engage an auditor &mdash; Hire a CPA firm to perform the SOC 2 audit when ready Recommended Review Cadence Activity Frequency Policy review and update Annually Procedure review and update Annually Risk assessment Annually Access reviews Quarterly Vulnerability scanning Monthly Security awareness training Annually Backup test restore Monthly Incident response drill Bi-annually Related Articles Policy &amp; Procedure Management Compliance Framework Tags Acknowledgment &amp; Compliance Tracking$plain_18$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'aegis-admin-guide'),
  'aegis-framework-tags',
  'Compliance Framework Tags',
  'Reference guide for all compliance framework tags used in Aegis policies.',
  $body_19$<h2>Compliance Framework Tags</h2>
<p>Aegis policies and procedures use framework tags to indicate which compliance standards they address. Tags are stored in the <code>tags</code> field and can be used to filter and report on policy coverage.</p>

<h3>Available Framework Tags</h3>

<h4><code>soc2</code> &mdash; SOC 2 Trust Services Criteria</h4>
<p>SOC 2 is an auditing standard developed by the AICPA for service organizations. It evaluates controls across five Trust Services Criteria: Security (mandatory), Availability, Processing Integrity, Confidentiality, and Privacy. SOC 2 reports are issued by independent CPA firms after an audit.</p>
<p><strong>Relevant industries:</strong> SaaS, technology, cloud services, any organization handling customer data</p>
<p><strong>Aegis policies tagged:</strong> Information Security, Access Control, Change Management, Incident Response, Backup &amp; Recovery, Audit Trail, Segregation of Duties, Records Retention, and more</p>

<h4><code>nist-csf</code> &mdash; NIST Cybersecurity Framework</h4>
<p>The NIST Cybersecurity Framework (CSF) is a voluntary framework published by the U.S. National Institute of Standards and Technology. Version 2.0 organizes cybersecurity activities into six functions: Govern, Identify, Protect, Detect, Respond, and Recover. While voluntary, it is widely adopted and often referenced by regulators.</p>
<p><strong>Relevant industries:</strong> All industries, especially government contractors and critical infrastructure</p>
<p><strong>Aegis policies tagged:</strong> Most universal policies are tagged with <code>nist-csf</code> because the framework covers broad cybersecurity practices</p>

<h4><code>itil4</code> &mdash; ITIL 4 Service Management</h4>
<p>ITIL 4 (Information Technology Infrastructure Library) is a framework for IT service management (ITSM). It provides practices for aligning IT services with business needs, including incident management, change management, asset management, and service design.</p>
<p><strong>Relevant industries:</strong> IT departments, managed service providers, any organization with structured IT operations</p>
<p><strong>Aegis policies tagged:</strong> Acceptable Use, Information Security, Incident Response, Access Control, Change Management, Backup &amp; Recovery, Vendor Management, Asset Management</p>

<h4><code>hipaa</code> &mdash; HIPAA (Health Insurance Portability and Accountability Act)</h4>
<p>HIPAA is a U.S. federal law that establishes standards for protecting sensitive patient health information (PHI). It applies to covered entities (healthcare providers, health plans, clearinghouses) and their business associates. Key rules include the Privacy Rule, Security Rule, and Breach Notification Rule.</p>
<p><strong>Relevant industries:</strong> Healthcare, health insurance, healthcare IT, any organization handling PHI</p>
<p><strong>Aegis policies tagged:</strong> PHI Handling, HIPAA Breach Notification, Business Associate Management, Workforce Security</p>

<h4><code>pci-dss</code> &mdash; PCI DSS (Payment Card Industry Data Security Standard)</h4>
<p>PCI DSS is a set of security standards designed to protect cardholder data. It applies to any organization that stores, processes, or transmits credit card information. Version 4.0 includes 12 requirements covering network security, access control, vulnerability management, and monitoring.</p>
<p><strong>Relevant industries:</strong> Retail, e-commerce, financial services, any organization accepting card payments</p>
<p><strong>Aegis policies tagged:</strong> Cardholder Data Protection, Cryptography &amp; Data Transmission</p>

<h4><code>universal</code> &mdash; Universal (All Organizations)</h4>
<p>The <code>universal</code> tag indicates policies that apply to all organizations regardless of industry or regulatory requirements. These represent security and operational best practices that every organization should have in place.</p>
<p><strong>Relevant industries:</strong> All</p>
<p><strong>Aegis policies tagged:</strong> All 15 universal policies (Acceptable Use, Password &amp; Authentication, Information Security, Data Classification, Incident Response, Access Control, Change Management, Backup &amp; Recovery, Remote Access, Physical Security, Network Security, Vendor Management, Security Awareness, Asset Management, Software Licensing)</p>

<h3>How Tags Are Used</h3>
<ul>
<li><strong>Filtering:</strong> On the Policies page, filter by tag to see all policies for a specific framework</li>
<li><strong>Reporting:</strong> Generate compliance coverage reports showing which frameworks have full policy coverage</li>
<li><strong>AI Assistance:</strong> When you ask the AI assistant about compliance (e.g., "Are we ready for SOC 2?"), it uses tags to identify relevant policies</li>
<li><strong>Gap Analysis:</strong> Compare your published policies against framework requirements to identify gaps</li>
</ul>

<h3>Adding Custom Tags</h3>
<p>You can add custom tags to any policy. Common additions include:</p>
<ul>
<li><code>gdpr</code> for EU data protection requirements</li>
<li><code>iso27001</code> for ISO 27001 information security management</li>
<li><code>cmmc</code> for Cybersecurity Maturity Model Certification (DoD contractors)</li>
<li><code>fedramp</code> for Federal Risk and Authorization Management Program</li>
</ul>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-policy-management">Policy &amp; Procedure Management</a></li>
<li><a href="/portal/kb/aegis-soc2-guide">SOC 2 Compliance with Aegis</a></li>
</ul>$body_19$,
  $plain_19$Compliance Framework Tags Aegis policies and procedures use framework tags to indicate which compliance standards they address. Tags are stored in the tags field and can be used to filter and report on policy coverage. Available Framework Tags soc2 &mdash; SOC 2 Trust Services Criteria SOC 2 is an auditing standard developed by the AICPA for service organizations. It evaluates controls across five Trust Services Criteria: Security (mandatory), Availability, Processing Integrity, Confidentiality, and Privacy. SOC 2 reports are issued by independent CPA firms after an audit. Relevant industries: SaaS, technology, cloud services, any organization handling customer data Aegis policies tagged: Information Security, Access Control, Change Management, Incident Response, Backup &amp; Recovery, Audit Trail, Segregation of Duties, Records Retention, and more nist-csf &mdash; NIST Cybersecurity Framework The NIST Cybersecurity Framework (CSF) is a voluntary framework published by the U.S. National Institute of Standards and Technology. Version 2.0 organizes cybersecurity activities into six functions: Govern, Identify, Protect, Detect, Respond, and Recover. While voluntary, it is widely adopted and often referenced by regulators. Relevant industries: All industries, especially government contractors and critical infrastructure Aegis policies tagged: Most universal policies are tagged with nist-csf because the framework covers broad cybersecurity practices itil4 &mdash; ITIL 4 Service Management ITIL 4 (Information Technology Infrastructure Library) is a framework for IT service management (ITSM). It provides practices for aligning IT services with business needs, including incident management, change management, asset management, and service design. Relevant industries: IT departments, managed service providers, any organization with structured IT operations Aegis policies tagged: Acceptable Use, Information Security, Incident Response, Access Control, Change Management, Backup &amp; Recovery, Vendor Management, Asset Management hipaa &mdash; HIPAA (Health Insurance Portability and Accountability Act) HIPAA is a U.S. federal law that establishes standards for protecting sensitive patient health information (PHI). It applies to covered entities (healthcare providers, health plans, clearinghouses) and their business associates. Key rules include the Privacy Rule, Security Rule, and Breach Notification Rule. Relevant industries: Healthcare, health insurance, healthcare IT, any organization handling PHI Aegis policies tagged: PHI Handling, HIPAA Breach Notification, Business Associate Management, Workforce Security pci-dss &mdash; PCI DSS (Payment Card Industry Data Security Standard) PCI DSS is a set of security standards designed to protect cardholder data. It applies to any organization that stores, processes, or transmits credit card information. Version 4.0 includes 12 requirements covering network security, access control, vulnerability management, and monitoring. Relevant industries: Retail, e-commerce, financial services, any organization accepting card payments Aegis policies tagged: Cardholder Data Protection, Cryptography &amp; Data Transmission universal &mdash; Universal (All Organizations) The universal tag indicates policies that apply to all organizations regardless of industry or regulatory requirements. These represent security and operational best practices that every organization should have in place. Relevant industries: All Aegis policies tagged: All 15 universal policies (Acceptable Use, Password &amp; Authentication, Information Security, Data Classification, Incident Response, Access Control, Change Management, Backup &amp; Recovery, Remote Access, Physical Security, Network Security, Vendor Management, Security Awareness, Asset Management, Software Licensing) How Tags Are Used Filtering: On the Policies page, filter by tag to see all policies for a specific framework Reporting: Generate compliance coverage reports showing which frameworks have full policy coverage AI Assistance: When you ask the AI assistant about compliance (e.g., "Are we ready for SOC 2?"), it uses tags to identify relevant policies Gap Analysis: Compare your published policies against framework requirements to identify gaps Adding Custom Tags You can add custom tags to any policy. Common additions include: gdpr for EU data protection requirements iso27001 for ISO 27001 information security management cmmc for Cybersecurity Maturity Model Certification (DoD contractors) fedramp for Federal Risk and Authorization Management Program Related Articles Policy &amp; Procedure Management SOC 2 Compliance with Aegis$plain_19$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 3, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;


-- ============================================================================
-- Policy Articles
-- ============================================================================

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-acceptable-use',
  'Acceptable Use Policy',
  'Rules for using company technology, internet, and email responsibly.',
  $body_20$<h2>Acceptable Use Policy</h2>

<h3>Purpose</h3>
<p>This policy defines acceptable and unacceptable use of company technology resources including computers, networks, email, internet access, and software.</p>

<h3>Policy</h3>
<ul>
<li>Company technology resources are provided for business purposes. Reasonable personal use is permitted if it does not interfere with work duties, consume excessive bandwidth, or violate any other policy.</li>
<li>You must not use company resources for illegal activities, harassment, distributing malware, unauthorized access to systems, or any activity that could damage the organization's reputation.</li>
<li>Software may only be installed if approved by IT. Unauthorized software may introduce security vulnerabilities or licensing issues.</li>
<li>Do not share your login credentials with anyone. You are responsible for all actions taken under your account.</li>
<li>Company communications (email, chat, file storage) may be monitored for security and compliance purposes.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Use company technology professionally and responsibly</li>
<li>Report any suspected misuse or security concerns to IT immediately</li>
<li>Lock your workstation when stepping away (Win+L or Cmd+L)</li>
<li>Keep your software and operating system up to date when prompted</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> PR.AC (Access Control), PR.AT (Awareness & Training) | <strong>SOC2:</strong> CC6.1, CC6.8 | <strong>ITIL 4:</strong> Information Security Management</p>$body_20$,
  $plain_20$Acceptable Use Policy Purpose This policy defines acceptable and unacceptable use of company technology resources including computers, networks, email, internet access, and software. Policy Company technology resources are provided for business purposes. Reasonable personal use is permitted if it does not interfere with work duties, consume excessive bandwidth, or violate any other policy. You must not use company resources for illegal activities, harassment, distributing malware, unauthorized access to systems, or any activity that could damage the organization's reputation. Software may only be installed if approved by IT. Unauthorized software may introduce security vulnerabilities or licensing issues. Do not share your login credentials with anyone. You are responsible for all actions taken under your account. Company communications (email, chat, file storage) may be monitored for security and compliance purposes. Your Responsibilities Use company technology professionally and responsibly Report any suspected misuse or security concerns to IT immediately Lock your workstation when stepping away (Win+L or Cmd+L) Keep your software and operating system up to date when prompted Compliance References NIST CSF 2.0: PR.AC (Access Control), PR.AT (Awareness & Training) | SOC2: CC6.1, CC6.8 | ITIL 4: Information Security Management$plain_20$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-password-authentication',
  'Password & Authentication Policy',
  'Requirements for creating strong passwords and protecting your account access.',
  $body_21$<h2>Password &amp; Authentication Policy</h2>

<h3>Purpose</h3>
<p>This policy establishes requirements for password strength, account protection, and authentication practices to prevent unauthorized access to company systems.</p>

<h3>Policy</h3>
<ul>
<li>Passwords must be at least 12 characters and include a mix of letters, numbers, and symbols. Passphrases (e.g., "correct-horse-battery-staple") are encouraged.</li>
<li>Do not reuse passwords across different systems. Each account should have a unique password.</li>
<li>Multi-factor authentication (MFA) must be enabled on all accounts that support it, especially email, VPN, and admin accounts.</li>
<li>Passwords must not be shared, written on sticky notes, stored in unencrypted files, or communicated via email or chat.</li>
<li>Use the company-approved password manager to generate and store passwords securely.</li>
<li>Service accounts and API keys must follow the same complexity requirements and be rotated on a defined schedule.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Create strong, unique passwords for every account</li>
<li>Enable MFA wherever available</li>
<li>Use the approved password manager</li>
<li>Report any suspected compromised credentials immediately</li>
<li>Never share your passwords with anyone, including IT staff</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> PR.AC-1 (Identities & Credentials), PR.AC-7 (Authentication) | <strong>SOC2:</strong> CC6.1, CC6.2, CC6.3 | <strong>ITIL 4:</strong> Information Security Management</p>$body_21$,
  $plain_21$Password &amp; Authentication Policy Purpose This policy establishes requirements for password strength, account protection, and authentication practices to prevent unauthorized access to company systems. Policy Passwords must be at least 12 characters and include a mix of letters, numbers, and symbols. Passphrases (e.g., "correct-horse-battery-staple") are encouraged. Do not reuse passwords across different systems. Each account should have a unique password. Multi-factor authentication (MFA) must be enabled on all accounts that support it, especially email, VPN, and admin accounts. Passwords must not be shared, written on sticky notes, stored in unencrypted files, or communicated via email or chat. Use the company-approved password manager to generate and store passwords securely. Service accounts and API keys must follow the same complexity requirements and be rotated on a defined schedule. Your Responsibilities Create strong, unique passwords for every account Enable MFA wherever available Use the approved password manager Report any suspected compromised credentials immediately Never share your passwords with anyone, including IT staff Compliance References NIST CSF 2.0: PR.AC-1 (Identities & Credentials), PR.AC-7 (Authentication) | SOC2: CC6.1, CC6.2, CC6.3 | ITIL 4: Information Security Management$plain_21$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-information-security',
  'Information Security Policy',
  'How we protect company information and the role everyone plays in keeping data safe.',
  $body_22$<h2>Information Security Policy</h2>

<h3>Purpose</h3>
<p>This policy outlines our approach to protecting company information assets from unauthorized access, disclosure, modification, or destruction.</p>

<h3>Policy</h3>
<ul>
<li>All company information must be handled according to its classification level. When in doubt, treat information as confidential.</li>
<li>Access to information systems and data follows the principle of least privilege: you receive only the access necessary for your role.</li>
<li>Security incidents must be reported immediately to IT. Do not attempt to investigate on your own.</li>
<li>All devices used for company work must have current antivirus/endpoint protection and full-disk encryption enabled.</li>
<li>Information must not be transferred to personal devices, personal email accounts, or unapproved cloud services without authorization.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Protect company information based on its sensitivity</li>
<li>Report security incidents and suspicious activity immediately</li>
<li>Keep your devices secure and up to date</li>
<li>Use only approved tools and services for company data</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> GV.OC (Organizational Context), PR.DS (Data Security) | <strong>SOC2:</strong> CC3.1, CC6.1 | <strong>ITIL 4:</strong> Information Security Management, Risk Management</p>$body_22$,
  $plain_22$Information Security Policy Purpose This policy outlines our approach to protecting company information assets from unauthorized access, disclosure, modification, or destruction. Policy All company information must be handled according to its classification level. When in doubt, treat information as confidential. Access to information systems and data follows the principle of least privilege: you receive only the access necessary for your role. Security incidents must be reported immediately to IT. Do not attempt to investigate on your own. All devices used for company work must have current antivirus/endpoint protection and full-disk encryption enabled. Information must not be transferred to personal devices, personal email accounts, or unapproved cloud services without authorization. Your Responsibilities Protect company information based on its sensitivity Report security incidents and suspicious activity immediately Keep your devices secure and up to date Use only approved tools and services for company data Compliance References NIST CSF 2.0: GV.OC (Organizational Context), PR.DS (Data Security) | SOC2: CC3.1, CC6.1 | ITIL 4: Information Security Management, Risk Management$plain_22$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-data-classification',
  'Data Classification Policy',
  'How to identify and handle different types of company information.',
  $body_23$<h2>Data Classification Policy</h2>

<h3>Purpose</h3>
<p>This policy defines how information is categorized and the handling requirements for each classification level.</p>

<h3>Policy</h3>
<table>
<thead><tr><th>Classification</th><th>Description</th><th>Examples</th><th>Handling</th></tr></thead>
<tbody>
<tr><td><strong>Public</strong></td><td>Information approved for external sharing</td><td>Marketing materials, published KB articles, press releases</td><td>No restrictions on sharing</td></tr>
<tr><td><strong>Internal</strong></td><td>Routine business information for employees only</td><td>Meeting notes, org charts, internal procedures</td><td>Share within the organization; do not post externally</td></tr>
<tr><td><strong>Confidential</strong></td><td>Sensitive business information</td><td>Financial reports, employee records, contracts, strategic plans</td><td>Share only on a need-to-know basis; encrypt in transit and at rest</td></tr>
<tr><td><strong>Restricted</strong></td><td>Highly sensitive information</td><td>Passwords, encryption keys, protected health information, payment card data</td><td>Strict access controls; encrypted always; logged access</td></tr>
</tbody>
</table>

<h3>Your Responsibilities</h3>
<ul>
<li>Apply the correct classification when creating documents or sharing information</li>
<li>Handle information according to its classification level</li>
<li>When in doubt, classify higher rather than lower</li>
<li>Do not downgrade classification without authorization</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> ID.AM-5 (Information Classification), PR.DS-1 (Data-at-Rest Protection) | <strong>SOC2:</strong> CC6.1, CC6.7 | <strong>ITIL 4:</strong> Information Security Management</p>$body_23$,
  $plain_23$Data Classification Policy Purpose This policy defines how information is categorized and the handling requirements for each classification level. Policy Classification Description Examples Handling Public Information approved for external sharing Marketing materials, published KB articles, press releases No restrictions on sharing Internal Routine business information for employees only Meeting notes, org charts, internal procedures Share within the organization; do not post externally Confidential Sensitive business information Financial reports, employee records, contracts, strategic plans Share only on a need-to-know basis; encrypt in transit and at rest Restricted Highly sensitive information Passwords, encryption keys, protected health information, payment card data Strict access controls; encrypted always; logged access Your Responsibilities Apply the correct classification when creating documents or sharing information Handle information according to its classification level When in doubt, classify higher rather than lower Do not downgrade classification without authorization Compliance References NIST CSF 2.0: ID.AM-5 (Information Classification), PR.DS-1 (Data-at-Rest Protection) | SOC2: CC6.1, CC6.7 | ITIL 4: Information Security Management$plain_23$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-incident-response',
  'Incident Response Policy',
  'What to do when you discover or suspect a security incident.',
  $body_24$<h2>Incident Response Policy</h2>

<h3>Purpose</h3>
<p>This policy defines how security incidents are reported, assessed, and handled to minimize damage and recover quickly.</p>

<h3>Policy</h3>
<ul>
<li>A security incident is any event that threatens the confidentiality, integrity, or availability of company information or systems.</li>
<li>All suspected incidents must be reported immediately by creating a Security ticket or contacting IT directly. Do not wait to confirm whether it is real.</li>
<li>Do not attempt to fix the issue yourself. Preserve evidence by not shutting down, deleting, or modifying affected systems unless instructed.</li>
<li>IT will assess the severity, contain the incident, investigate the root cause, remediate, and document lessons learned.</li>
<li>Incidents involving regulated data (health records, payment data) may trigger notification requirements. Legal and compliance will be involved as needed.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Report suspected incidents immediately — speed matters</li>
<li>Provide as much detail as possible: what happened, when, what systems are affected</li>
<li>Follow instructions from the incident response team</li>
<li>Do not discuss ongoing incidents outside the response team</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> RS.AN (Analysis), RS.CO (Communication), RS.MI (Mitigation) | <strong>SOC2:</strong> CC7.2, CC7.3, CC7.4 | <strong>ITIL 4:</strong> Incident Management, Problem Management</p>$body_24$,
  $plain_24$Incident Response Policy Purpose This policy defines how security incidents are reported, assessed, and handled to minimize damage and recover quickly. Policy A security incident is any event that threatens the confidentiality, integrity, or availability of company information or systems. All suspected incidents must be reported immediately by creating a Security ticket or contacting IT directly. Do not wait to confirm whether it is real. Do not attempt to fix the issue yourself. Preserve evidence by not shutting down, deleting, or modifying affected systems unless instructed. IT will assess the severity, contain the incident, investigate the root cause, remediate, and document lessons learned. Incidents involving regulated data (health records, payment data) may trigger notification requirements. Legal and compliance will be involved as needed. Your Responsibilities Report suspected incidents immediately — speed matters Provide as much detail as possible: what happened, when, what systems are affected Follow instructions from the incident response team Do not discuss ongoing incidents outside the response team Compliance References NIST CSF 2.0: RS.AN (Analysis), RS.CO (Communication), RS.MI (Mitigation) | SOC2: CC7.2, CC7.3, CC7.4 | ITIL 4: Incident Management, Problem Management$plain_24$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-access-control',
  'Access Control Policy',
  'How access to systems and data is granted, reviewed, and revoked.',
  $body_25$<h2>Access Control Policy</h2>

<h3>Purpose</h3>
<p>This policy governs how access to information systems, applications, and data is granted, managed, and revoked to ensure only authorized individuals have appropriate access.</p>

<h3>Policy</h3>
<ul>
<li>All access follows the principle of <strong>least privilege</strong>: users receive only the minimum access required for their job function.</li>
<li>Access requests must go through the IT service desk. Self-provisioning of access is not permitted.</li>
<li>Manager approval is required for access to confidential or restricted systems.</li>
<li>Access is reviewed quarterly. Users who no longer need access will have it revoked.</li>
<li>When an employee changes roles, access must be adjusted to match their new responsibilities. Previous access that is no longer needed must be removed.</li>
<li>When an employee leaves, all access must be revoked within 24 hours of their last day.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Request access through proper channels (IT service desk)</li>
<li>Report any access you have that you do not need</li>
<li>Do not share access credentials or sessions</li>
<li>Notify IT when team members change roles or leave</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> PR.AC-1 (Account Management), PR.AC-4 (Access Permissions) | <strong>SOC2:</strong> CC6.1, CC6.2, CC6.3 | <strong>ITIL 4:</strong> Access Management, Information Security Management</p>$body_25$,
  $plain_25$Access Control Policy Purpose This policy governs how access to information systems, applications, and data is granted, managed, and revoked to ensure only authorized individuals have appropriate access. Policy All access follows the principle of least privilege : users receive only the minimum access required for their job function. Access requests must go through the IT service desk. Self-provisioning of access is not permitted. Manager approval is required for access to confidential or restricted systems. Access is reviewed quarterly. Users who no longer need access will have it revoked. When an employee changes roles, access must be adjusted to match their new responsibilities. Previous access that is no longer needed must be removed. When an employee leaves, all access must be revoked within 24 hours of their last day. Your Responsibilities Request access through proper channels (IT service desk) Report any access you have that you do not need Do not share access credentials or sessions Notify IT when team members change roles or leave Compliance References NIST CSF 2.0: PR.AC-1 (Account Management), PR.AC-4 (Access Permissions) | SOC2: CC6.1, CC6.2, CC6.3 | ITIL 4: Access Management, Information Security Management$plain_25$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-change-management',
  'Change Management Policy',
  'How changes to IT systems and infrastructure are planned, approved, and implemented.',
  $body_26$<h2>Change Management Policy</h2>

<h3>Purpose</h3>
<p>This policy ensures that changes to IT systems, infrastructure, and services are planned, tested, approved, and documented to minimize disruption and risk.</p>

<h3>Policy</h3>
<ul>
<li>All changes to production systems must be submitted as Change Requests through the IT service desk before implementation.</li>
<li>Each change request must include: what is being changed, why, what systems are affected, an implementation plan, a rollback plan, and a risk assessment.</li>
<li>Changes are classified by risk: <strong>Standard</strong> (pre-approved, low risk), <strong>Normal</strong> (requires review and approval), <strong>Emergency</strong> (critical fixes that bypass normal review but require post-implementation review).</li>
<li>Normal and emergency changes must be approved by the appropriate authority before implementation.</li>
<li>All changes must be tested in a non-production environment when possible.</li>
<li>Failed changes must be rolled back and a post-mortem conducted.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Submit change requests for any modification to production systems</li>
<li>Include a rollback plan with every change request</li>
<li>Test changes before deploying to production</li>
<li>Communicate planned changes to affected users in advance</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> PR.IP-3 (Configuration Change Control) | <strong>SOC2:</strong> CC8.1 | <strong>ITIL 4:</strong> Change Enablement</p>$body_26$,
  $plain_26$Change Management Policy Purpose This policy ensures that changes to IT systems, infrastructure, and services are planned, tested, approved, and documented to minimize disruption and risk. Policy All changes to production systems must be submitted as Change Requests through the IT service desk before implementation. Each change request must include: what is being changed, why, what systems are affected, an implementation plan, a rollback plan, and a risk assessment. Changes are classified by risk: Standard (pre-approved, low risk), Normal (requires review and approval), Emergency (critical fixes that bypass normal review but require post-implementation review). Normal and emergency changes must be approved by the appropriate authority before implementation. All changes must be tested in a non-production environment when possible. Failed changes must be rolled back and a post-mortem conducted. Your Responsibilities Submit change requests for any modification to production systems Include a rollback plan with every change request Test changes before deploying to production Communicate planned changes to affected users in advance Compliance References NIST CSF 2.0: PR.IP-3 (Configuration Change Control) | SOC2: CC8.1 | ITIL 4: Change Enablement$plain_26$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-backup-recovery',
  'Backup & Recovery Policy',
  'How company data is backed up and how to request a recovery.',
  $body_27$<h2>Backup &amp; Recovery Policy</h2>

<h3>Purpose</h3>
<p>This policy defines how company data is protected through regular backups and how data can be recovered when needed.</p>

<h3>Policy</h3>
<ul>
<li>All critical business data must be backed up automatically on a defined schedule.</li>
<li>Backups must be stored in a separate location from the primary data (offsite or cloud).</li>
<li>Backup integrity must be tested at least quarterly by performing a test restore.</li>
<li>Recovery time objectives (RTO) and recovery point objectives (RPO) are defined per system based on business criticality.</li>
<li>Users are responsible for storing work files in company-approved locations (file servers, cloud storage) rather than solely on local devices.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Save work files to company-approved storage locations, not just your local drive</li>
<li>If you need data recovered, submit a ticket with the file/system name and approximate date of the data you need</li>
<li>Report any data loss immediately</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> PR.IP-4 (Backups), RC.RP-1 (Recovery Planning) | <strong>SOC2:</strong> A1.2, A1.3 | <strong>ITIL 4:</strong> Service Continuity Management</p>$body_27$,
  $plain_27$Backup &amp; Recovery Policy Purpose This policy defines how company data is protected through regular backups and how data can be recovered when needed. Policy All critical business data must be backed up automatically on a defined schedule. Backups must be stored in a separate location from the primary data (offsite or cloud). Backup integrity must be tested at least quarterly by performing a test restore. Recovery time objectives (RTO) and recovery point objectives (RPO) are defined per system based on business criticality. Users are responsible for storing work files in company-approved locations (file servers, cloud storage) rather than solely on local devices. Your Responsibilities Save work files to company-approved storage locations, not just your local drive If you need data recovered, submit a ticket with the file/system name and approximate date of the data you need Report any data loss immediately Compliance References NIST CSF 2.0: PR.IP-4 (Backups), RC.RP-1 (Recovery Planning) | SOC2: A1.2, A1.3 | ITIL 4: Service Continuity Management$plain_27$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-remote-access-byod',
  'Remote Access & BYOD Policy',
  'Rules for working remotely and using personal devices for company work.',
  $body_28$<h2>Remote Access &amp; BYOD Policy</h2>

<h3>Purpose</h3>
<p>This policy defines the requirements for accessing company resources remotely and using personal devices (Bring Your Own Device) for work purposes.</p>

<h3>Policy</h3>
<ul>
<li>Remote access to company resources must use the approved VPN or zero-trust access solution.</li>
<li>Personal devices used for company work must meet minimum security requirements: current operating system, full-disk encryption, screen lock, and up-to-date antivirus.</li>
<li>Company data on personal devices must be stored in approved applications only (e.g., company cloud storage, approved email client). Local copies of sensitive data are not permitted.</li>
<li>Lost or stolen devices that had access to company data must be reported to IT immediately.</li>
<li>IT reserves the right to remotely wipe company data from personal devices if the device is lost, stolen, or the employee leaves the organization.</li>
<li>Public Wi-Fi must not be used for accessing company resources without VPN.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Use VPN when accessing company resources from outside the office</li>
<li>Keep personal devices used for work secure and up to date</li>
<li>Report lost or stolen devices immediately</li>
<li>Do not store company data locally on personal devices</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> PR.AC-3 (Remote Access), PR.PT-3 (Communications Protection) | <strong>SOC2:</strong> CC6.1, CC6.6, CC6.7</p>$body_28$,
  $plain_28$Remote Access &amp; BYOD Policy Purpose This policy defines the requirements for accessing company resources remotely and using personal devices (Bring Your Own Device) for work purposes. Policy Remote access to company resources must use the approved VPN or zero-trust access solution. Personal devices used for company work must meet minimum security requirements: current operating system, full-disk encryption, screen lock, and up-to-date antivirus. Company data on personal devices must be stored in approved applications only (e.g., company cloud storage, approved email client). Local copies of sensitive data are not permitted. Lost or stolen devices that had access to company data must be reported to IT immediately. IT reserves the right to remotely wipe company data from personal devices if the device is lost, stolen, or the employee leaves the organization. Public Wi-Fi must not be used for accessing company resources without VPN. Your Responsibilities Use VPN when accessing company resources from outside the office Keep personal devices used for work secure and up to date Report lost or stolen devices immediately Do not store company data locally on personal devices Compliance References NIST CSF 2.0: PR.AC-3 (Remote Access), PR.PT-3 (Communications Protection) | SOC2: CC6.1, CC6.6, CC6.7$plain_28$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-physical-security',
  'Physical Security Policy',
  'Protecting physical access to offices, server rooms, and equipment.',
  $body_29$<h2>Physical Security Policy</h2>

<h3>Purpose</h3>
<p>This policy establishes requirements for protecting physical access to company facilities, equipment, and sensitive areas.</p>

<h3>Policy</h3>
<ul>
<li>Access to office buildings requires a valid badge or key. Do not hold doors open for unknown individuals (tailgating).</li>
<li>Server rooms, network closets, and other sensitive areas require additional authorization. Access is logged.</li>
<li>Visitors must sign in, wear a visitor badge, and be escorted at all times in restricted areas.</li>
<li>Equipment (laptops, monitors, phones) must be secured when unattended. Lock your screen and physically secure portable devices.</li>
<li>Sensitive documents must be shredded, not placed in regular recycling.</li>
<li>Report any unauthorized access, forced entry, or suspicious persons to security and IT.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Wear your badge visibly and do not share it</li>
<li>Challenge or report unknown persons in restricted areas</li>
<li>Lock your workstation and secure equipment when leaving</li>
<li>Shred sensitive documents before disposal</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> PR.AC-2 (Physical Access), PR.PT-1 (Physical Protection) | <strong>SOC2:</strong> CC6.4, CC6.5</p>$body_29$,
  $plain_29$Physical Security Policy Purpose This policy establishes requirements for protecting physical access to company facilities, equipment, and sensitive areas. Policy Access to office buildings requires a valid badge or key. Do not hold doors open for unknown individuals (tailgating). Server rooms, network closets, and other sensitive areas require additional authorization. Access is logged. Visitors must sign in, wear a visitor badge, and be escorted at all times in restricted areas. Equipment (laptops, monitors, phones) must be secured when unattended. Lock your screen and physically secure portable devices. Sensitive documents must be shredded, not placed in regular recycling. Report any unauthorized access, forced entry, or suspicious persons to security and IT. Your Responsibilities Wear your badge visibly and do not share it Challenge or report unknown persons in restricted areas Lock your workstation and secure equipment when leaving Shred sensitive documents before disposal Compliance References NIST CSF 2.0: PR.AC-2 (Physical Access), PR.PT-1 (Physical Protection) | SOC2: CC6.4, CC6.5$plain_29$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-network-security',
  'Network Security Policy',
  'How company networks are protected and what users need to know.',
  $body_30$<h2>Network Security Policy</h2>

<h3>Purpose</h3>
<p>This policy defines the security requirements for company network infrastructure and user behavior on the network.</p>

<h3>Policy</h3>
<ul>
<li>Only authorized and company-managed devices may connect to the corporate network. Guest devices use the guest network.</li>
<li>Network traffic is monitored for security threats. Suspicious activity may be blocked automatically.</li>
<li>Users must not attempt to bypass network security controls (firewalls, web filters, proxy servers).</li>
<li>Wireless networks use enterprise-grade encryption (WPA3 or WPA2-Enterprise). Open or WEP networks are not permitted.</li>
<li>Users must not set up unauthorized access points, bridges, or VPN tunnels on the corporate network.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Connect only company-managed devices to the corporate network</li>
<li>Use the guest network for personal devices</li>
<li>Do not attempt to bypass security controls</li>
<li>Report network issues or suspicious activity to IT</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> PR.PT-4 (Network Architecture), DE.CM-1 (Network Monitoring) | <strong>SOC2:</strong> CC6.6, CC7.1, CC7.2</p>$body_30$,
  $plain_30$Network Security Policy Purpose This policy defines the security requirements for company network infrastructure and user behavior on the network. Policy Only authorized and company-managed devices may connect to the corporate network. Guest devices use the guest network. Network traffic is monitored for security threats. Suspicious activity may be blocked automatically. Users must not attempt to bypass network security controls (firewalls, web filters, proxy servers). Wireless networks use enterprise-grade encryption (WPA3 or WPA2-Enterprise). Open or WEP networks are not permitted. Users must not set up unauthorized access points, bridges, or VPN tunnels on the corporate network. Your Responsibilities Connect only company-managed devices to the corporate network Use the guest network for personal devices Do not attempt to bypass security controls Report network issues or suspicious activity to IT Compliance References NIST CSF 2.0: PR.PT-4 (Network Architecture), DE.CM-1 (Network Monitoring) | SOC2: CC6.6, CC7.1, CC7.2$plain_30$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-vendor-management',
  'Vendor & Third-Party Management Policy',
  'How we evaluate, engage, and monitor third-party vendors and service providers.',
  $body_31$<h2>Vendor &amp; Third-Party Management Policy</h2>

<h3>Purpose</h3>
<p>This policy governs how third-party vendors and service providers are selected, engaged, and monitored to protect company data and ensure service quality.</p>

<h3>Policy</h3>
<ul>
<li>All vendors that access, process, or store company data must undergo a security assessment before engagement.</li>
<li>Vendor contracts must include data protection requirements, incident notification obligations, and right-to-audit clauses.</li>
<li>Vendors are reviewed annually for continued compliance with security and service requirements.</li>
<li>Vendor access to company systems must follow the principle of least privilege and be logged.</li>
<li>When a vendor relationship ends, all access must be revoked and all company data returned or securely destroyed.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Notify IT before granting any vendor access to company systems or data</li>
<li>Ensure vendor contracts include required security provisions</li>
<li>Report any vendor security concerns to IT immediately</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> GV.SC (Supply Chain Risk Management) | <strong>SOC2:</strong> CC9.2 | <strong>ITIL 4:</strong> Supplier Management</p>$body_31$,
  $plain_31$Vendor &amp; Third-Party Management Policy Purpose This policy governs how third-party vendors and service providers are selected, engaged, and monitored to protect company data and ensure service quality. Policy All vendors that access, process, or store company data must undergo a security assessment before engagement. Vendor contracts must include data protection requirements, incident notification obligations, and right-to-audit clauses. Vendors are reviewed annually for continued compliance with security and service requirements. Vendor access to company systems must follow the principle of least privilege and be logged. When a vendor relationship ends, all access must be revoked and all company data returned or securely destroyed. Your Responsibilities Notify IT before granting any vendor access to company systems or data Ensure vendor contracts include required security provisions Report any vendor security concerns to IT immediately Compliance References NIST CSF 2.0: GV.SC (Supply Chain Risk Management) | SOC2: CC9.2 | ITIL 4: Supplier Management$plain_31$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-security-awareness',
  'Security Awareness Policy',
  'Everyone\',
  $body_32$<h2>Security Awareness Policy</h2>

<h3>Purpose</h3>
<p>This policy establishes that all employees share responsibility for information security and defines the training and awareness requirements.</p>

<h3>Policy</h3>
<ul>
<li>All employees must complete security awareness training within 30 days of hire and annually thereafter.</li>
<li>Security awareness topics include: phishing recognition, password security, data handling, physical security, social engineering, and incident reporting.</li>
<li>Employees who fail to complete required training within the specified timeframe may have system access restricted.</li>
<li>IT may conduct periodic simulated phishing exercises to measure awareness. These are educational, not punitive.</li>
<li>All employees are encouraged to report suspicious emails, links, and activities without fear of repercussion. Reporting a false alarm is always better than ignoring a real threat.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Complete all assigned security training on time</li>
<li>Stay vigilant for phishing and social engineering attempts</li>
<li>Report suspicious emails and activities</li>
<li>Apply security principles in your daily work</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> PR.AT-1 (Awareness & Training) | <strong>SOC2:</strong> CC1.4, CC2.2 | <strong>ITIL 4:</strong> Information Security Management</p>$body_32$,
  $plain_32$Security Awareness Policy Purpose This policy establishes that all employees share responsibility for information security and defines the training and awareness requirements. Policy All employees must complete security awareness training within 30 days of hire and annually thereafter. Security awareness topics include: phishing recognition, password security, data handling, physical security, social engineering, and incident reporting. Employees who fail to complete required training within the specified timeframe may have system access restricted. IT may conduct periodic simulated phishing exercises to measure awareness. These are educational, not punitive. All employees are encouraged to report suspicious emails, links, and activities without fear of repercussion. Reporting a false alarm is always better than ignoring a real threat. Your Responsibilities Complete all assigned security training on time Stay vigilant for phishing and social engineering attempts Report suspicious emails and activities Apply security principles in your daily work Compliance References NIST CSF 2.0: PR.AT-1 (Awareness & Training) | SOC2: CC1.4, CC2.2 | ITIL 4: Information Security Management$plain_32$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-asset-management',
  'IT Asset Management Policy',
  'How company IT equipment and software is tracked, maintained, and disposed of.',
  $body_33$<h2>IT Asset Management Policy</h2>

<h3>Purpose</h3>
<p>This policy governs the lifecycle of IT assets from procurement through disposal, ensuring accountability and security at every stage.</p>

<h3>Policy</h3>
<ul>
<li>All IT assets (hardware and software) must be registered in the asset management system with an assigned owner.</li>
<li>Assets must be tagged and tracked throughout their lifecycle: procurement, deployment, maintenance, and disposal.</li>
<li>Asset transfers between employees must be recorded. Never transfer equipment informally.</li>
<li>Software licenses must be tracked to ensure compliance. Do not use unlicensed software.</li>
<li>Assets reaching end of life must be securely disposed of. Hard drives must be wiped or physically destroyed before disposal.</li>
<li>Lost or stolen assets must be reported immediately.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Take care of assigned equipment and report any damage</li>
<li>Return all company equipment when leaving or changing roles</li>
<li>Report lost or stolen assets immediately</li>
<li>Do not install unauthorized software</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> ID.AM (Asset Management) | <strong>SOC2:</strong> CC6.1, CC6.4 | <strong>ITIL 4:</strong> IT Asset Management, Service Configuration Management</p>$body_33$,
  $plain_33$IT Asset Management Policy Purpose This policy governs the lifecycle of IT assets from procurement through disposal, ensuring accountability and security at every stage. Policy All IT assets (hardware and software) must be registered in the asset management system with an assigned owner. Assets must be tagged and tracked throughout their lifecycle: procurement, deployment, maintenance, and disposal. Asset transfers between employees must be recorded. Never transfer equipment informally. Software licenses must be tracked to ensure compliance. Do not use unlicensed software. Assets reaching end of life must be securely disposed of. Hard drives must be wiped or physically destroyed before disposal. Lost or stolen assets must be reported immediately. Your Responsibilities Take care of assigned equipment and report any damage Return all company equipment when leaving or changing roles Report lost or stolen assets immediately Do not install unauthorized software Compliance References NIST CSF 2.0: ID.AM (Asset Management) | SOC2: CC6.1, CC6.4 | ITIL 4: IT Asset Management, Service Configuration Management$plain_33$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-software-licensing',
  'Software Licensing & Installation Policy',
  'Rules for installing, using, and managing software on company devices.',
  $body_34$<h2>Software Licensing &amp; Installation Policy</h2>

<h3>Purpose</h3>
<p>This policy ensures that all software used on company devices is properly licensed, approved, and secure.</p>

<h3>Policy</h3>
<ul>
<li>Only IT-approved software may be installed on company devices. Submit a service request for new software needs.</li>
<li>Users must not download, install, or use pirated, cracked, or unlicensed software.</li>
<li>Open-source software must be reviewed by IT before installation to verify the license is compatible with company use.</li>
<li>Software must be kept up to date. Accept automatic updates when prompted.</li>
<li>Browser extensions and plugins must be approved by IT, as they can be a vector for malware and data exfiltration.</li>
<li>Unused software should be reported to IT for decommissioning to reduce licensing costs and attack surface.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Request software through the IT service desk</li>
<li>Keep installed software up to date</li>
<li>Report unused software licenses</li>
<li>Do not install unauthorized software or browser extensions</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> PR.IP-1 (Baseline Configuration), PR.IP-12 (Vulnerability Management) | <strong>SOC2:</strong> CC6.1, CC8.1</p>$body_34$,
  $plain_34$Software Licensing &amp; Installation Policy Purpose This policy ensures that all software used on company devices is properly licensed, approved, and secure. Policy Only IT-approved software may be installed on company devices. Submit a service request for new software needs. Users must not download, install, or use pirated, cracked, or unlicensed software. Open-source software must be reviewed by IT before installation to verify the license is compatible with company use. Software must be kept up to date. Accept automatic updates when prompted. Browser extensions and plugins must be approved by IT, as they can be a vector for malware and data exfiltration. Unused software should be reported to IT for decommissioning to reduce licensing costs and attack surface. Your Responsibilities Request software through the IT service desk Keep installed software up to date Report unused software licenses Do not install unauthorized software or browser extensions Compliance References NIST CSF 2.0: PR.IP-1 (Baseline Configuration), PR.IP-12 (Vulnerability Management) | SOC2: CC6.1, CC8.1$plain_34$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-hipaa-phi-handling',
  'Protected Health Information (PHI) Handling',
  'How to identify, handle, and protect Protected Health Information under HIPAA.',
  $body_35$<h2>Protected Health Information (PHI) Handling</h2>

<h3>Purpose</h3>
<p>This policy defines the requirements for handling Protected Health Information (PHI) in compliance with the Health Insurance Portability and Accountability Act (HIPAA).</p>

<h3>Policy</h3>
<ul>
<li>PHI includes any individually identifiable health information: names linked to medical records, diagnoses, treatment plans, insurance information, and any data that can identify a patient or health plan member.</li>
<li>PHI must be accessed only by authorized individuals with a legitimate need for the information.</li>
<li>PHI must be encrypted in transit (TLS) and at rest (AES-256 or equivalent).</li>
<li>PHI must not be transmitted via unencrypted email, personal messaging apps, or unapproved cloud services.</li>
<li>Physical documents containing PHI must be stored in locked cabinets and shredded when no longer needed.</li>
<li>All access to systems containing PHI must be logged and auditable.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Access PHI only when required for your job duties</li>
<li>Use only approved systems and channels to transmit PHI</li>
<li>Report any suspected PHI exposure immediately</li>
<li>Secure physical documents containing PHI</li>
</ul>

<h3>Compliance References</h3>
<p><strong>HIPAA:</strong> Privacy Rule (45 CFR 164.502), Security Rule (45 CFR 164.312) | <strong>NIST CSF 2.0:</strong> PR.DS-1, PR.DS-2, PR.AC-4</p>$body_35$,
  $plain_35$Protected Health Information (PHI) Handling Purpose This policy defines the requirements for handling Protected Health Information (PHI) in compliance with the Health Insurance Portability and Accountability Act (HIPAA). Policy PHI includes any individually identifiable health information: names linked to medical records, diagnoses, treatment plans, insurance information, and any data that can identify a patient or health plan member. PHI must be accessed only by authorized individuals with a legitimate need for the information. PHI must be encrypted in transit (TLS) and at rest (AES-256 or equivalent). PHI must not be transmitted via unencrypted email, personal messaging apps, or unapproved cloud services. Physical documents containing PHI must be stored in locked cabinets and shredded when no longer needed. All access to systems containing PHI must be logged and auditable. Your Responsibilities Access PHI only when required for your job duties Use only approved systems and channels to transmit PHI Report any suspected PHI exposure immediately Secure physical documents containing PHI Compliance References HIPAA: Privacy Rule (45 CFR 164.502), Security Rule (45 CFR 164.312) | NIST CSF 2.0: PR.DS-1, PR.DS-2, PR.AC-4$plain_35$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-hipaa-breach-notification',
  'HIPAA Breach Notification Procedures',
  'What happens when a breach of Protected Health Information is discovered.',
  $body_36$<h2>HIPAA Breach Notification Procedures</h2>

<h3>Purpose</h3>
<p>This policy defines the procedures for identifying, reporting, and responding to breaches of Protected Health Information as required by the HIPAA Breach Notification Rule.</p>

<h3>Policy</h3>
<ul>
<li>A breach is defined as unauthorized acquisition, access, use, or disclosure of PHI that compromises the security or privacy of the information.</li>
<li>All suspected breaches must be reported to the Privacy Officer and IT Security within 24 hours of discovery.</li>
<li>Breach assessment must determine: what PHI was involved, who was affected, whether the PHI was actually acquired or viewed, and the extent of risk mitigation.</li>
<li>If a breach affects 500 or more individuals, the Department of Health and Human Services (HHS) and local media must be notified within 60 days.</li>
<li>Affected individuals must be notified in writing within 60 days of discovery.</li>
<li>All breach incidents must be documented with root cause analysis and corrective actions.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Report any suspected PHI breach immediately</li>
<li>Cooperate fully with breach investigation</li>
<li>Preserve evidence — do not delete or modify affected systems</li>
</ul>

<h3>Compliance References</h3>
<p><strong>HIPAA:</strong> Breach Notification Rule (45 CFR 164.400-414) | <strong>NIST CSF 2.0:</strong> RS.CO-2, RS.CO-3</p>$body_36$,
  $plain_36$HIPAA Breach Notification Procedures Purpose This policy defines the procedures for identifying, reporting, and responding to breaches of Protected Health Information as required by the HIPAA Breach Notification Rule. Policy A breach is defined as unauthorized acquisition, access, use, or disclosure of PHI that compromises the security or privacy of the information. All suspected breaches must be reported to the Privacy Officer and IT Security within 24 hours of discovery. Breach assessment must determine: what PHI was involved, who was affected, whether the PHI was actually acquired or viewed, and the extent of risk mitigation. If a breach affects 500 or more individuals, the Department of Health and Human Services (HHS) and local media must be notified within 60 days. Affected individuals must be notified in writing within 60 days of discovery. All breach incidents must be documented with root cause analysis and corrective actions. Your Responsibilities Report any suspected PHI breach immediately Cooperate fully with breach investigation Preserve evidence — do not delete or modify affected systems Compliance References HIPAA: Breach Notification Rule (45 CFR 164.400-414) | NIST CSF 2.0: RS.CO-2, RS.CO-3$plain_36$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-hipaa-business-associate',
  'Business Associate Management (HIPAA)',
  'Requirements for managing vendors and partners who access health information.',
  $body_37$<h2>Business Associate Management</h2>

<h3>Purpose</h3>
<p>This policy defines requirements for managing Business Associates — third parties that create, receive, maintain, or transmit PHI on behalf of the organization.</p>

<h3>Policy</h3>
<ul>
<li>A Business Associate Agreement (BAA) must be in place before any vendor accesses, processes, or stores PHI.</li>
<li>BAAs must specify permitted uses, required safeguards, breach notification obligations, and data return/destruction requirements.</li>
<li>Business Associates must demonstrate HIPAA compliance through SOC2 reports, HITRUST certification, or equivalent documentation.</li>
<li>Business Associate compliance must be reviewed annually.</li>
<li>Subcontractors of Business Associates must also have BAAs in place (downstream protection).</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Do not share PHI with any vendor or partner without a BAA in place</li>
<li>Report any vendor compliance concerns to IT and Compliance</li>
</ul>

<h3>Compliance References</h3>
<p><strong>HIPAA:</strong> Business Associate Requirements (45 CFR 164.502, 164.504) | <strong>NIST CSF 2.0:</strong> GV.SC</p>$body_37$,
  $plain_37$Business Associate Management Purpose This policy defines requirements for managing Business Associates — third parties that create, receive, maintain, or transmit PHI on behalf of the organization. Policy A Business Associate Agreement (BAA) must be in place before any vendor accesses, processes, or stores PHI. BAAs must specify permitted uses, required safeguards, breach notification obligations, and data return/destruction requirements. Business Associates must demonstrate HIPAA compliance through SOC2 reports, HITRUST certification, or equivalent documentation. Business Associate compliance must be reviewed annually. Subcontractors of Business Associates must also have BAAs in place (downstream protection). Your Responsibilities Do not share PHI with any vendor or partner without a BAA in place Report any vendor compliance concerns to IT and Compliance Compliance References HIPAA: Business Associate Requirements (45 CFR 164.502, 164.504) | NIST CSF 2.0: GV.SC$plain_37$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-pci-cardholder-data',
  'Cardholder Data Protection Policy',
  'How to handle, process, and protect payment card data in compliance with PCI DSS.',
  $body_38$<h2>Cardholder Data Protection Policy</h2>

<h3>Purpose</h3>
<p>This policy defines the requirements for protecting cardholder data in compliance with the Payment Card Industry Data Security Standard (PCI DSS).</p>

<h3>Policy</h3>
<ul>
<li>Cardholder data (card numbers, expiration dates, CVV codes) must only be processed through PCI-compliant systems.</li>
<li>Full card numbers must never be stored in databases, logs, spreadsheets, emails, tickets, or documents.</li>
<li>If you must reference a card number, use only the last four digits.</li>
<li>Cardholder data must be encrypted in transit using TLS 1.2 or higher.</li>
<li>Access to systems that process cardholder data is restricted and requires additional authorization.</li>
<li>Point-of-sale devices and payment terminals must be inspected regularly for tampering.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Never write down, photograph, or store full card numbers</li>
<li>Use only approved payment processing systems</li>
<li>Report any suspicious activity around payment systems immediately</li>
<li>Do not send cardholder data via email, chat, or any insecure channel</li>
</ul>

<h3>Compliance References</h3>
<p><strong>PCI DSS:</strong> Requirement 3 (Protect Stored Data), Requirement 4 (Encrypt Transmissions) | <strong>NIST CSF 2.0:</strong> PR.DS-1, PR.DS-2</p>$body_38$,
  $plain_38$Cardholder Data Protection Policy Purpose This policy defines the requirements for protecting cardholder data in compliance with the Payment Card Industry Data Security Standard (PCI DSS). Policy Cardholder data (card numbers, expiration dates, CVV codes) must only be processed through PCI-compliant systems. Full card numbers must never be stored in databases, logs, spreadsheets, emails, tickets, or documents. If you must reference a card number, use only the last four digits. Cardholder data must be encrypted in transit using TLS 1.2 or higher. Access to systems that process cardholder data is restricted and requires additional authorization. Point-of-sale devices and payment terminals must be inspected regularly for tampering. Your Responsibilities Never write down, photograph, or store full card numbers Use only approved payment processing systems Report any suspicious activity around payment systems immediately Do not send cardholder data via email, chat, or any insecure channel Compliance References PCI DSS: Requirement 3 (Protect Stored Data), Requirement 4 (Encrypt Transmissions) | NIST CSF 2.0: PR.DS-1, PR.DS-2$plain_38$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-pci-cryptography',
  'Cryptography & Data Transmission Policy',
  'Encryption standards for protecting sensitive data in transit and at rest.',
  $body_39$<h2>Cryptography &amp; Data Transmission Policy</h2>

<h3>Purpose</h3>
<p>This policy defines the encryption standards for protecting sensitive data, with particular attention to cardholder data and other regulated information.</p>

<h3>Policy</h3>
<ul>
<li>All sensitive data in transit must use TLS 1.2 or higher. Older protocols (SSL, TLS 1.0, TLS 1.1) are prohibited.</li>
<li>Data at rest must be encrypted using AES-256 or equivalent approved algorithms.</li>
<li>Encryption keys must be managed through a formal key management process: generation, storage, rotation, and destruction.</li>
<li>Key rotation must occur at least annually or immediately if compromise is suspected.</li>
<li>Self-signed certificates are not permitted for production systems.</li>
<li>Wi-Fi must use WPA3 or WPA2-Enterprise with AES encryption.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Use HTTPS when accessing any web-based company resources</li>
<li>Do not disable or bypass encryption warnings in your browser</li>
<li>Report any certificate warnings or errors to IT</li>
</ul>

<h3>Compliance References</h3>
<p><strong>PCI DSS:</strong> Requirement 2.3, Requirement 4 | <strong>NIST CSF 2.0:</strong> PR.DS-1, PR.DS-2, PR.DS-5</p>$body_39$,
  $plain_39$Cryptography &amp; Data Transmission Policy Purpose This policy defines the encryption standards for protecting sensitive data, with particular attention to cardholder data and other regulated information. Policy All sensitive data in transit must use TLS 1.2 or higher. Older protocols (SSL, TLS 1.0, TLS 1.1) are prohibited. Data at rest must be encrypted using AES-256 or equivalent approved algorithms. Encryption keys must be managed through a formal key management process: generation, storage, rotation, and destruction. Key rotation must occur at least annually or immediately if compromise is suspected. Self-signed certificates are not permitted for production systems. Wi-Fi must use WPA3 or WPA2-Enterprise with AES encryption. Your Responsibilities Use HTTPS when accessing any web-based company resources Do not disable or bypass encryption warnings in your browser Report any certificate warnings or errors to IT Compliance References PCI DSS: Requirement 2.3, Requirement 4 | NIST CSF 2.0: PR.DS-1, PR.DS-2, PR.DS-5$plain_39$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-audit-trail',
  'Audit Trail & Logging Policy',
  'What activities are logged, how logs are protected, and audit requirements.',
  $body_40$<h2>Audit Trail &amp; Logging Policy</h2>

<h3>Purpose</h3>
<p>This policy defines the requirements for logging system activities, protecting log integrity, and supporting audit and compliance requirements.</p>

<h3>Policy</h3>
<ul>
<li>All access to sensitive systems must be logged, including: user authentication events, privilege escalation, data access, configuration changes, and administrative actions.</li>
<li>Logs must include: timestamp, user identity, action performed, target resource, and outcome (success/failure).</li>
<li>Logs must be retained for a minimum of 12 months (accessible) and 3 years (archived), or as required by applicable regulations.</li>
<li>Logs must be protected from tampering. Append-only storage or centralized log management is required.</li>
<li>Logs must be reviewed regularly for anomalies. Automated alerting should be used for critical events.</li>
<li>Audit logs must never be deleted, modified, or disabled.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Understand that your system activities are logged for security purposes</li>
<li>Do not attempt to circumvent logging or audit controls</li>
</ul>

<h3>Compliance References</h3>
<p><strong>NIST CSF 2.0:</strong> DE.AE (Anomalies & Events), DE.CM (Continuous Monitoring) | <strong>SOC2:</strong> CC7.1, CC7.2, CC7.3</p>$body_40$,
  $plain_40$Audit Trail &amp; Logging Policy Purpose This policy defines the requirements for logging system activities, protecting log integrity, and supporting audit and compliance requirements. Policy All access to sensitive systems must be logged, including: user authentication events, privilege escalation, data access, configuration changes, and administrative actions. Logs must include: timestamp, user identity, action performed, target resource, and outcome (success/failure). Logs must be retained for a minimum of 12 months (accessible) and 3 years (archived), or as required by applicable regulations. Logs must be protected from tampering. Append-only storage or centralized log management is required. Logs must be reviewed regularly for anomalies. Automated alerting should be used for critical events. Audit logs must never be deleted, modified, or disabled. Your Responsibilities Understand that your system activities are logged for security purposes Do not attempt to circumvent logging or audit controls Compliance References NIST CSF 2.0: DE.AE (Anomalies & Events), DE.CM (Continuous Monitoring) | SOC2: CC7.1, CC7.2, CC7.3$plain_40$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-segregation-of-duties',
  'Segregation of Duties Policy',
  'How critical functions are divided among different people to prevent fraud and errors.',
  $body_41$<h2>Segregation of Duties Policy</h2>

<h3>Purpose</h3>
<p>This policy ensures that no single individual has control over all aspects of a critical business process, reducing the risk of fraud, errors, and unauthorized actions.</p>

<h3>Policy</h3>
<ul>
<li>Critical processes must be divided so that no one person can initiate, approve, and complete a transaction alone.</li>
<li>The person who requests a change cannot be the same person who approves it.</li>
<li>Financial transactions must have separate preparer and approver roles.</li>
<li>System administrators should not have the ability to approve their own access changes.</li>
<li>When team size makes full segregation impractical, compensating controls must be in place (e.g., additional review, audit logging, management oversight).</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Respect approval workflows — do not circumvent them even if you have the technical ability</li>
<li>Report any segregation of duties concerns to your manager or compliance</li>
</ul>

<h3>Compliance References</h3>
<p><strong>SOC2:</strong> CC3.4, CC5.2 | <strong>NIST CSF 2.0:</strong> PR.AC-4</p>$body_41$,
  $plain_41$Segregation of Duties Policy Purpose This policy ensures that no single individual has control over all aspects of a critical business process, reducing the risk of fraud, errors, and unauthorized actions. Policy Critical processes must be divided so that no one person can initiate, approve, and complete a transaction alone. The person who requests a change cannot be the same person who approves it. Financial transactions must have separate preparer and approver roles. System administrators should not have the ability to approve their own access changes. When team size makes full segregation impractical, compensating controls must be in place (e.g., additional review, audit logging, management oversight). Your Responsibilities Respect approval workflows — do not circumvent them even if you have the technical ability Report any segregation of duties concerns to your manager or compliance Compliance References SOC2: CC3.4, CC5.2 | NIST CSF 2.0: PR.AC-4$plain_41$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-records-retention',
  'Records Retention Policy',
  'How long different types of business records must be kept and how they are disposed of.',
  $body_42$<h2>Records Retention Policy</h2>

<h3>Purpose</h3>
<p>This policy defines the minimum retention periods for business records and the procedures for secure disposal of records that have exceeded their retention period.</p>

<h3>Policy</h3>
<table>
<thead><tr><th>Record Type</th><th>Retention Period</th></tr></thead>
<tbody>
<tr><td>Financial records</td><td>7 years</td></tr>
<tr><td>Tax records</td><td>7 years</td></tr>
<tr><td>Employee records</td><td>Duration of employment + 7 years</td></tr>
<tr><td>Contracts and agreements</td><td>Duration of contract + 6 years</td></tr>
<tr><td>Security logs</td><td>3 years</td></tr>
<tr><td>Audit reports</td><td>7 years</td></tr>
<tr><td>General correspondence</td><td>3 years</td></tr>
</tbody>
</table>
<ul>
<li>Records must not be destroyed if they are subject to a legal hold or pending litigation.</li>
<li>Electronic records must be securely deleted (not just moved to trash).</li>
<li>Physical records must be shredded through a certified destruction service.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Store records in company-approved systems, not personal storage</li>
<li>Do not destroy records before their retention period ends</li>
<li>Contact Legal before destroying any records subject to litigation hold</li>
</ul>

<h3>Compliance References</h3>
<p><strong>SOC2:</strong> CC6.5, CC9.1 | <strong>NIST CSF 2.0:</strong> PR.IP-6 (Destruction of Data)</p>$body_42$,
  $plain_42$Records Retention Policy Purpose This policy defines the minimum retention periods for business records and the procedures for secure disposal of records that have exceeded their retention period. Policy Record Type Retention Period Financial records 7 years Tax records 7 years Employee records Duration of employment + 7 years Contracts and agreements Duration of contract + 6 years Security logs 3 years Audit reports 7 years General correspondence 3 years Records must not be destroyed if they are subject to a legal hold or pending litigation. Electronic records must be securely deleted (not just moved to trash). Physical records must be shredded through a certified destruction service. Your Responsibilities Store records in company-approved systems, not personal storage Do not destroy records before their retention period ends Contact Legal before destroying any records subject to litigation hold Compliance References SOC2: CC6.5, CC9.1 | NIST CSF 2.0: PR.IP-6 (Destruction of Data)$plain_42$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-foia-records',
  'Public Records & FOIA Compliance',
  'How public records requests are handled in compliance with freedom of information laws.',
  $body_43$<h2>Public Records &amp; FOIA Compliance</h2>

<h3>Purpose</h3>
<p>This policy defines procedures for managing public records and responding to Freedom of Information Act (FOIA) or equivalent open records requests.</p>

<h3>Policy</h3>
<ul>
<li>All official communications and records created in the course of government business are potentially subject to public records requests.</li>
<li>Records must be maintained according to the approved retention schedule. Premature destruction of public records is a violation of law.</li>
<li>FOIA requests must be forwarded to the designated Records Officer within 1 business day of receipt.</li>
<li>Response deadlines vary by jurisdiction but must be tracked and met.</li>
<li>Exempt information (personal privacy, security-sensitive, legally privileged) must be identified and redacted before disclosure.</li>
<li>All FOIA requests and responses must be logged for compliance tracking.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>If you receive a public records request, forward it to the Records Officer immediately</li>
<li>Maintain records according to the retention schedule</li>
<li>Do not use personal devices or accounts for official business to avoid records gaps</li>
</ul>

<h3>Compliance References</h3>
<p><strong>FOIA:</strong> 5 U.S.C. 552 (federal) / state equivalents | <strong>NIST CSF 2.0:</strong> GV.OC (Organizational Context)</p>$body_43$,
  $plain_43$Public Records &amp; FOIA Compliance Purpose This policy defines procedures for managing public records and responding to Freedom of Information Act (FOIA) or equivalent open records requests. Policy All official communications and records created in the course of government business are potentially subject to public records requests. Records must be maintained according to the approved retention schedule. Premature destruction of public records is a violation of law. FOIA requests must be forwarded to the designated Records Officer within 1 business day of receipt. Response deadlines vary by jurisdiction but must be tracked and met. Exempt information (personal privacy, security-sensitive, legally privileged) must be identified and redacted before disclosure. All FOIA requests and responses must be logged for compliance tracking. Your Responsibilities If you receive a public records request, forward it to the Records Officer immediately Maintain records according to the retention schedule Do not use personal devices or accounts for official business to avoid records gaps Compliance References FOIA: 5 U.S.C. 552 (federal) / state equivalents | NIST CSF 2.0: GV.OC (Organizational Context)$plain_43$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'policy-hipaa-workforce-security',
  'Workforce Security (HIPAA)',
  'Ensuring that all workforce members with access to health information are authorized and trained.',
  $body_44$<h2>Workforce Security</h2>

<h3>Purpose</h3>
<p>This policy ensures that all workforce members who access electronic Protected Health Information (ePHI) are appropriately authorized, supervised, and trained.</p>

<h3>Policy</h3>
<ul>
<li>All new workforce members must complete HIPAA training before being granted access to systems containing ePHI.</li>
<li>Access to ePHI is granted based on role and job function. The minimum necessary standard applies: provide access only to the PHI needed for the task at hand.</li>
<li>Workforce members who violate HIPAA policies are subject to disciplinary action up to and including termination.</li>
<li>Terminated workforce members must have all access to ePHI revoked immediately upon separation.</li>
<li>Annual HIPAA refresher training is required for all workforce members with ePHI access.</li>
<li>Contractors, volunteers, and temporary workers with ePHI access are subject to the same requirements as employees.</li>
</ul>

<h3>Your Responsibilities</h3>
<ul>
<li>Complete HIPAA training before accessing health information systems</li>
<li>Access only the minimum PHI necessary for your duties</li>
<li>Complete annual refresher training</li>
</ul>

<h3>Compliance References</h3>
<p><strong>HIPAA:</strong> Security Rule 45 CFR 164.308(a)(3) (Workforce Security), 45 CFR 164.308(a)(5) (Security Awareness & Training)</p>$body_44$,
  $plain_44$Workforce Security Purpose This policy ensures that all workforce members who access electronic Protected Health Information (ePHI) are appropriately authorized, supervised, and trained. Policy All new workforce members must complete HIPAA training before being granted access to systems containing ePHI. Access to ePHI is granted based on role and job function. The minimum necessary standard applies: provide access only to the PHI needed for the task at hand. Workforce members who violate HIPAA policies are subject to disciplinary action up to and including termination. Terminated workforce members must have all access to ePHI revoked immediately upon separation. Annual HIPAA refresher training is required for all workforce members with ePHI access. Contractors, volunteers, and temporary workers with ePHI access are subject to the same requirements as employees. Your Responsibilities Complete HIPAA training before accessing health information systems Access only the minimum PHI necessary for your duties Complete annual refresher training Compliance References HIPAA: Security Rule 45 CFR 164.308(a)(3) (Workforce Security), 45 CFR 164.308(a)(5) (Security Awareness & Training)$plain_44$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;


-- ============================================================================
-- Procedure Articles
-- ============================================================================

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-acceptable-use',
  'Acceptable Use Procedure',
  'Step-by-step procedures for enforcing and complying with the Acceptable Use Policy.',
  $body_45$<h2>Acceptable Use Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how employees comply with the Acceptable Use Policy and how IT enforces it.</p>

<h3>Scope</h3>
<p>All employees, contractors, and temporary staff who use company technology resources.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>All Staff:</strong> Follow acceptable use guidelines, report violations</li>
<li><strong>IT Team:</strong> Monitor usage, investigate violations, maintain blocklists</li>
<li><strong>HR:</strong> Handle disciplinary actions for confirmed violations</li>
<li><strong>Management:</strong> Approve exception requests for restricted resources</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>New Employee Onboarding</h4>
<ol>
<li>New employee reads and acknowledges the Acceptable Use Policy during onboarding</li>
<li>IT provisions access according to role-based permissions</li>
<li>Employee completes security awareness training within first 14 days</li>
</ol>

<h4>Requesting Software Installation</h4>
<ol>
<li>Employee submits a service request ticket for software installation</li>
<li>IT reviews the request against the approved software list</li>
<li>If approved, IT installs and documents the software; if denied, IT explains why</li>
</ol>

<h4>Reporting a Violation</h4>
<ol>
<li>Observer reports suspected violation to IT via ticket or direct notification</li>
<li>IT reviews logs and evidence within 24 hours</li>
<li>If confirmed, IT documents the violation and escalates to HR</li>
<li>HR determines appropriate action per the disciplinary matrix</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Policy acknowledgment: Annually and upon hiring</li>
<li>Usage monitoring review: Monthly</li>
<li>Approved software list update: Quarterly</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Signed acknowledgment forms (digital or physical)</li>
<li>Software approval tickets</li>
<li>Violation investigation records</li>
<li>Usage monitoring reports</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-acceptable-use">Acceptable Use Policy</a></p>$body_45$,
  $plain_45$Acceptable Use Procedure Purpose This procedure defines how employees comply with the Acceptable Use Policy and how IT enforces it. Scope All employees, contractors, and temporary staff who use company technology resources. Roles &amp; Responsibilities All Staff: Follow acceptable use guidelines, report violations IT Team: Monitor usage, investigate violations, maintain blocklists HR: Handle disciplinary actions for confirmed violations Management: Approve exception requests for restricted resources Step-by-Step Procedure New Employee Onboarding New employee reads and acknowledges the Acceptable Use Policy during onboarding IT provisions access according to role-based permissions Employee completes security awareness training within first 14 days Requesting Software Installation Employee submits a service request ticket for software installation IT reviews the request against the approved software list If approved, IT installs and documents the software; if denied, IT explains why Reporting a Violation Observer reports suspected violation to IT via ticket or direct notification IT reviews logs and evidence within 24 hours If confirmed, IT documents the violation and escalates to HR HR determines appropriate action per the disciplinary matrix Frequency / Schedule Policy acknowledgment: Annually and upon hiring Usage monitoring review: Monthly Approved software list update: Quarterly Records &amp; Evidence Signed acknowledgment forms (digital or physical) Software approval tickets Violation investigation records Usage monitoring reports Related Policy Acceptable Use Policy$plain_45$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-password-authentication',
  'Password & Authentication Procedure',
  'How to create, manage, and reset passwords; MFA enrollment steps.',
  $body_46$<h2>Password &amp; Authentication Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how to create strong passwords, enroll in multi-factor authentication, and handle password resets securely.</p>

<h3>Scope</h3>
<p>All users with login credentials to company systems.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>All Users:</strong> Create and manage strong passwords, enroll in MFA</li>
<li><strong>IT Team:</strong> Administer password policies, assist with resets and lockouts</li>
<li><strong>IT Security:</strong> Monitor for compromised credentials, enforce policy compliance</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Creating a Strong Password</h4>
<ol>
<li>Use a minimum of 12 characters</li>
<li>Include a mix of uppercase, lowercase, numbers, and special characters</li>
<li>Do not reuse passwords across systems</li>
<li>Consider using a passphrase (e.g., "Coffee-Mountain-River-42!")</li>
<li>Use a company-approved password manager to store credentials</li>
</ol>

<h4>Enrolling in Multi-Factor Authentication (MFA)</h4>
<ol>
<li>Navigate to your account security settings</li>
<li>Select "Enable Two-Factor Authentication"</li>
<li>Download an authenticator app (e.g., Microsoft Authenticator, Google Authenticator)</li>
<li>Scan the QR code with the authenticator app</li>
<li>Enter the verification code to confirm enrollment</li>
<li>Save the backup recovery codes in a secure location</li>
</ol>

<h4>Resetting a Forgotten Password</h4>
<ol>
<li>Click "Forgot Password" on the login screen</li>
<li>Enter your registered email address</li>
<li>Check email for reset link (valid for 1 hour)</li>
<li>Create a new password meeting complexity requirements</li>
<li>If you cannot access email, contact IT for identity verification and manual reset</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Password rotation: Not required if strong passwords and MFA are used (per NIST 800-63B)</li>
<li>Compromised password check: Monthly (automated)</li>
<li>MFA enrollment audit: Quarterly</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>MFA enrollment status reports</li>
<li>Password reset logs</li>
<li>Account lockout records</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-password-authentication">Password &amp; Authentication Policy</a></p>$body_46$,
  $plain_46$Password &amp; Authentication Procedure Purpose This procedure defines how to create strong passwords, enroll in multi-factor authentication, and handle password resets securely. Scope All users with login credentials to company systems. Roles &amp; Responsibilities All Users: Create and manage strong passwords, enroll in MFA IT Team: Administer password policies, assist with resets and lockouts IT Security: Monitor for compromised credentials, enforce policy compliance Step-by-Step Procedure Creating a Strong Password Use a minimum of 12 characters Include a mix of uppercase, lowercase, numbers, and special characters Do not reuse passwords across systems Consider using a passphrase (e.g., "Coffee-Mountain-River-42!") Use a company-approved password manager to store credentials Enrolling in Multi-Factor Authentication (MFA) Navigate to your account security settings Select "Enable Two-Factor Authentication" Download an authenticator app (e.g., Microsoft Authenticator, Google Authenticator) Scan the QR code with the authenticator app Enter the verification code to confirm enrollment Save the backup recovery codes in a secure location Resetting a Forgotten Password Click "Forgot Password" on the login screen Enter your registered email address Check email for reset link (valid for 1 hour) Create a new password meeting complexity requirements If you cannot access email, contact IT for identity verification and manual reset Frequency / Schedule Password rotation: Not required if strong passwords and MFA are used (per NIST 800-63B) Compromised password check: Monthly (automated) MFA enrollment audit: Quarterly Records &amp; Evidence MFA enrollment status reports Password reset logs Account lockout records Related Policy Password &amp; Authentication Policy$plain_46$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-information-security',
  'Information Security Procedure',
  'Operational procedures for implementing the Information Security Policy.',
  $body_47$<h2>Information Security Procedure</h2>

<h3>Purpose</h3>
<p>This procedure operationalizes the Information Security Policy by defining day-to-day security practices.</p>

<h3>Scope</h3>
<p>All departments and personnel handling company information systems and data.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>IT Security:</strong> Conduct risk assessments, monitor threats, manage security tools</li>
<li><strong>IT Team:</strong> Implement security controls, patch systems, maintain firewalls</li>
<li><strong>Department Managers:</strong> Ensure team compliance, report security concerns</li>
<li><strong>All Staff:</strong> Follow security procedures, report suspicious activity</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Annual Risk Assessment</h4>
<ol>
<li>IT Security identifies all information assets and their classification levels</li>
<li>Evaluate threats and vulnerabilities for each asset category</li>
<li>Calculate risk scores (likelihood × impact)</li>
<li>Document findings in the risk register</li>
<li>Develop mitigation plans for high-risk items</li>
<li>Present results to management for review and approval</li>
</ol>

<h4>Security Incident Reporting</h4>
<ol>
<li>Any employee who suspects a security incident immediately notifies IT</li>
<li>IT logs the incident in the ticketing system as priority "High" or "Critical"</li>
<li>Follow the Incident Response Procedure for triage and containment</li>
</ol>

<h4>Monthly Vulnerability Scanning</h4>
<ol>
<li>IT runs automated vulnerability scans on all networked systems</li>
<li>Review scan results and prioritize by severity (Critical, High, Medium, Low)</li>
<li>Remediate Critical and High findings within 30 days</li>
<li>Document remediation actions and re-scan to verify</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Risk assessment: Annually</li>
<li>Vulnerability scanning: Monthly</li>
<li>Penetration testing: Annually (external), bi-annually (internal)</li>
<li>Security policy review: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Risk assessment reports and risk register</li>
<li>Vulnerability scan results and remediation tickets</li>
<li>Penetration test reports</li>
<li>Security incident logs</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-information-security">Information Security Policy</a></p>$body_47$,
  $plain_47$Information Security Procedure Purpose This procedure operationalizes the Information Security Policy by defining day-to-day security practices. Scope All departments and personnel handling company information systems and data. Roles &amp; Responsibilities IT Security: Conduct risk assessments, monitor threats, manage security tools IT Team: Implement security controls, patch systems, maintain firewalls Department Managers: Ensure team compliance, report security concerns All Staff: Follow security procedures, report suspicious activity Step-by-Step Procedure Annual Risk Assessment IT Security identifies all information assets and their classification levels Evaluate threats and vulnerabilities for each asset category Calculate risk scores (likelihood × impact) Document findings in the risk register Develop mitigation plans for high-risk items Present results to management for review and approval Security Incident Reporting Any employee who suspects a security incident immediately notifies IT IT logs the incident in the ticketing system as priority "High" or "Critical" Follow the Incident Response Procedure for triage and containment Monthly Vulnerability Scanning IT runs automated vulnerability scans on all networked systems Review scan results and prioritize by severity (Critical, High, Medium, Low) Remediate Critical and High findings within 30 days Document remediation actions and re-scan to verify Frequency / Schedule Risk assessment: Annually Vulnerability scanning: Monthly Penetration testing: Annually (external), bi-annually (internal) Security policy review: Annually Records &amp; Evidence Risk assessment reports and risk register Vulnerability scan results and remediation tickets Penetration test reports Security incident logs Related Policy Information Security Policy$plain_47$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-data-classification',
  'Data Classification Procedure',
  'How to classify, label, and handle data at each sensitivity level.',
  $body_48$<h2>Data Classification Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how to classify data into sensitivity levels and apply appropriate handling controls.</p>

<h3>Scope</h3>
<p>All data created, received, stored, or transmitted by the organization.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Data Owners:</strong> Classify data they are responsible for, review classifications annually</li>
<li><strong>All Staff:</strong> Handle data according to its classification level</li>
<li><strong>IT Team:</strong> Implement technical controls for each classification level</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Classifying New Data</h4>
<ol>
<li>Determine the data type (customer PII, financial, internal communications, public marketing, etc.)</li>
<li>Assign a classification level:
  <ul>
  <li><strong>Public:</strong> No restrictions — marketing materials, published content</li>
  <li><strong>Internal:</strong> Company-only — internal memos, org charts, general procedures</li>
  <li><strong>Confidential:</strong> Restricted access — HR records, financial reports, contracts</li>
  <li><strong>Restricted:</strong> Highly sensitive — credentials, encryption keys, PII/PHI, payment data</li>
  </ul>
</li>
<li>Label documents with their classification (header/footer or metadata tag)</li>
<li>Record the classification in the data inventory</li>
</ol>

<h4>Handling Data by Classification</h4>
<table>
<tr><th>Level</th><th>Storage</th><th>Transmission</th><th>Disposal</th></tr>
<tr><td>Public</td><td>Any approved system</td><td>Any method</td><td>Normal deletion</td></tr>
<tr><td>Internal</td><td>Company systems only</td><td>Company email/chat</td><td>Normal deletion</td></tr>
<tr><td>Confidential</td><td>Access-controlled systems</td><td>Encrypted channels only</td><td>Secure deletion</td></tr>
<tr><td>Restricted</td><td>Encrypted storage, need-to-know</td><td>Encrypted, logged</td><td>Certified destruction</td></tr>
</table>

<h3>Frequency / Schedule</h3>
<ul>
<li>New data classification: At creation or acquisition</li>
<li>Classification review: Annually per data owner</li>
<li>Data inventory audit: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Data inventory with classification levels</li>
<li>Classification review logs</li>
<li>Secure disposal certificates</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-data-classification">Data Classification Policy</a></p>$body_48$,
  $plain_48$Data Classification Procedure Purpose This procedure defines how to classify data into sensitivity levels and apply appropriate handling controls. Scope All data created, received, stored, or transmitted by the organization. Roles &amp; Responsibilities Data Owners: Classify data they are responsible for, review classifications annually All Staff: Handle data according to its classification level IT Team: Implement technical controls for each classification level Step-by-Step Procedure Classifying New Data Determine the data type (customer PII, financial, internal communications, public marketing, etc.) Assign a classification level: Public: No restrictions — marketing materials, published content Internal: Company-only — internal memos, org charts, general procedures Confidential: Restricted access — HR records, financial reports, contracts Restricted: Highly sensitive — credentials, encryption keys, PII/PHI, payment data Label documents with their classification (header/footer or metadata tag) Record the classification in the data inventory Handling Data by Classification Level Storage Transmission Disposal Public Any approved system Any method Normal deletion Internal Company systems only Company email/chat Normal deletion Confidential Access-controlled systems Encrypted channels only Secure deletion Restricted Encrypted storage, need-to-know Encrypted, logged Certified destruction Frequency / Schedule New data classification: At creation or acquisition Classification review: Annually per data owner Data inventory audit: Annually Records &amp; Evidence Data inventory with classification levels Classification review logs Secure disposal certificates Related Policy Data Classification Policy$plain_48$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-incident-response',
  'Incident Response Procedure',
  'Step-by-step incident handling: identify, contain, eradicate, recover, lessons learned.',
  $body_49$<h2>Incident Response Procedure</h2>

<h3>Purpose</h3>
<p>This procedure provides a structured approach to handling security incidents to minimize damage and recover quickly.</p>

<h3>Scope</h3>
<p>All security events that threaten the confidentiality, integrity, or availability of company systems and data.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Incident Commander:</strong> Coordinates response, makes escalation decisions</li>
<li><strong>IT Security:</strong> Leads technical investigation and containment</li>
<li><strong>IT Team:</strong> Implements containment and recovery actions</li>
<li><strong>Communications:</strong> Handles internal and external notifications</li>
<li><strong>Management:</strong> Approves major decisions, handles regulatory notifications</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Phase 1: Identification</h4>
<ol>
<li>Receive alert from monitoring system, user report, or external notification</li>
<li>Log the event in the ticketing system as a security incident</li>
<li>Assess severity: P1 (Critical), P2 (High), P3 (Medium), P4 (Low)</li>
<li>Assign an Incident Commander for P1/P2 incidents</li>
</ol>

<h4>Phase 2: Containment</h4>
<ol>
<li>Short-term containment: Isolate affected systems (disconnect from network, disable accounts)</li>
<li>Preserve forensic evidence (disk images, log snapshots, memory dumps)</li>
<li>Long-term containment: Apply temporary fixes to allow business continuity</li>
</ol>

<h4>Phase 3: Eradication</h4>
<ol>
<li>Identify the root cause (malware, vulnerability, misconfiguration, insider threat)</li>
<li>Remove the threat (clean malware, patch vulnerability, revoke compromised credentials)</li>
<li>Verify eradication through scanning and monitoring</li>
</ol>

<h4>Phase 4: Recovery</h4>
<ol>
<li>Restore systems from clean backups if necessary</li>
<li>Bring systems back online in a controlled manner</li>
<li>Monitor closely for signs of re-infection or persistence</li>
<li>Confirm normal operations have resumed</li>
</ol>

<h4>Phase 5: Lessons Learned</h4>
<ol>
<li>Conduct a post-incident review within 5 business days of resolution</li>
<li>Document what happened, what was done, and what could be improved</li>
<li>Update procedures, controls, or training based on findings</li>
<li>File the incident report in the incident archive</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Incident response drill: Bi-annually</li>
<li>Procedure review: Annually or after a major incident</li>
<li>Contact list verification: Quarterly</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Incident tickets with full timeline</li>
<li>Forensic evidence and chain of custody logs</li>
<li>Post-incident review reports</li>
<li>Communication logs (notifications sent)</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-incident-response">Incident Response Policy</a></p>$body_49$,
  $plain_49$Incident Response Procedure Purpose This procedure provides a structured approach to handling security incidents to minimize damage and recover quickly. Scope All security events that threaten the confidentiality, integrity, or availability of company systems and data. Roles &amp; Responsibilities Incident Commander: Coordinates response, makes escalation decisions IT Security: Leads technical investigation and containment IT Team: Implements containment and recovery actions Communications: Handles internal and external notifications Management: Approves major decisions, handles regulatory notifications Step-by-Step Procedure Phase 1: Identification Receive alert from monitoring system, user report, or external notification Log the event in the ticketing system as a security incident Assess severity: P1 (Critical), P2 (High), P3 (Medium), P4 (Low) Assign an Incident Commander for P1/P2 incidents Phase 2: Containment Short-term containment: Isolate affected systems (disconnect from network, disable accounts) Preserve forensic evidence (disk images, log snapshots, memory dumps) Long-term containment: Apply temporary fixes to allow business continuity Phase 3: Eradication Identify the root cause (malware, vulnerability, misconfiguration, insider threat) Remove the threat (clean malware, patch vulnerability, revoke compromised credentials) Verify eradication through scanning and monitoring Phase 4: Recovery Restore systems from clean backups if necessary Bring systems back online in a controlled manner Monitor closely for signs of re-infection or persistence Confirm normal operations have resumed Phase 5: Lessons Learned Conduct a post-incident review within 5 business days of resolution Document what happened, what was done, and what could be improved Update procedures, controls, or training based on findings File the incident report in the incident archive Frequency / Schedule Incident response drill: Bi-annually Procedure review: Annually or after a major incident Contact list verification: Quarterly Records &amp; Evidence Incident tickets with full timeline Forensic evidence and chain of custody logs Post-incident review reports Communication logs (notifications sent) Related Policy Incident Response Policy$plain_49$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-access-control',
  'Access Control Procedure',
  'How to request, approve, provision, review, and revoke access to systems and data.',
  $body_50$<h2>Access Control Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how access to systems, applications, and data is requested, granted, reviewed, and revoked.</p>

<h3>Scope</h3>
<p>All user accounts, service accounts, and privileged access across company systems.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Requesting Manager:</strong> Submits and approves access requests for their team</li>
<li><strong>IT Team:</strong> Provisions and de-provisions access</li>
<li><strong>IT Security:</strong> Reviews privileged access, conducts access reviews</li>
<li><strong>HR:</strong> Notifies IT of terminations, transfers, and role changes</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Requesting New Access</h4>
<ol>
<li>Employee or manager submits a service request ticket specifying the system, role/permissions needed, and business justification</li>
<li>Manager approves the request (if submitted by employee directly)</li>
<li>IT verifies the request aligns with least-privilege principles</li>
<li>IT provisions access and documents in the access register</li>
<li>User confirms they can access the system</li>
</ol>

<h4>Employee Termination / Offboarding</h4>
<ol>
<li>HR notifies IT of the departure date (ideally 2+ business days in advance)</li>
<li>IT prepares an access revocation checklist for all systems</li>
<li>On the departure date: disable all accounts, revoke VPN/remote access, collect devices</li>
<li>Within 24 hours: verify all access has been revoked</li>
<li>Archive user data per the Records Retention Policy</li>
</ol>

<h4>Quarterly Access Review</h4>
<ol>
<li>IT generates access reports for all critical systems</li>
<li>Department managers review access lists for their teams</li>
<li>Managers confirm or flag inappropriate access</li>
<li>IT removes flagged access and documents changes</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Access provisioning: On request (within 1 business day)</li>
<li>Access reviews: Quarterly</li>
<li>Privileged access review: Monthly</li>
<li>Offboarding: Same day as departure</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Access request and approval tickets</li>
<li>Access review reports with manager sign-off</li>
<li>Offboarding checklists</li>
<li>Privileged access logs</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-access-control">Access Control Policy</a></p>$body_50$,
  $plain_50$Access Control Procedure Purpose This procedure defines how access to systems, applications, and data is requested, granted, reviewed, and revoked. Scope All user accounts, service accounts, and privileged access across company systems. Roles &amp; Responsibilities Requesting Manager: Submits and approves access requests for their team IT Team: Provisions and de-provisions access IT Security: Reviews privileged access, conducts access reviews HR: Notifies IT of terminations, transfers, and role changes Step-by-Step Procedure Requesting New Access Employee or manager submits a service request ticket specifying the system, role/permissions needed, and business justification Manager approves the request (if submitted by employee directly) IT verifies the request aligns with least-privilege principles IT provisions access and documents in the access register User confirms they can access the system Employee Termination / Offboarding HR notifies IT of the departure date (ideally 2+ business days in advance) IT prepares an access revocation checklist for all systems On the departure date: disable all accounts, revoke VPN/remote access, collect devices Within 24 hours: verify all access has been revoked Archive user data per the Records Retention Policy Quarterly Access Review IT generates access reports for all critical systems Department managers review access lists for their teams Managers confirm or flag inappropriate access IT removes flagged access and documents changes Frequency / Schedule Access provisioning: On request (within 1 business day) Access reviews: Quarterly Privileged access review: Monthly Offboarding: Same day as departure Records &amp; Evidence Access request and approval tickets Access review reports with manager sign-off Offboarding checklists Privileged access logs Related Policy Access Control Policy$plain_50$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-change-management',
  'Change Management Procedure',
  'How to submit, review, approve, implement, and close change requests.',
  $body_51$<h2>Change Management Procedure</h2>

<h3>Purpose</h3>
<p>This procedure ensures all changes to IT systems are planned, tested, approved, and documented to minimize disruption.</p>

<h3>Scope</h3>
<p>All changes to production systems, networks, applications, and infrastructure.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Change Requester:</strong> Submits change request with details and justification</li>
<li><strong>Change Manager:</strong> Reviews requests, schedules CAB meetings, tracks changes</li>
<li><strong>Change Advisory Board (CAB):</strong> Evaluates risk, approves or rejects changes</li>
<li><strong>Implementer:</strong> Executes the approved change</li>
<li><strong>Testing Team:</strong> Validates changes in staging before production deployment</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Submitting a Change Request</h4>
<ol>
<li>Create a change request ticket with: description, justification, affected systems, risk assessment, rollback plan, and proposed schedule</li>
<li>Classify the change: Standard (pre-approved), Normal (requires CAB), Emergency (expedited)</li>
<li>Submit for review</li>
</ol>

<h4>Review and Approval</h4>
<ol>
<li>Change Manager reviews for completeness</li>
<li>Normal changes: Presented at next CAB meeting for discussion and vote</li>
<li>Emergency changes: Approved by Change Manager + one CAB member, documented retroactively</li>
<li>Standard changes: Auto-approved if following documented procedure</li>
</ol>

<h4>Implementation</h4>
<ol>
<li>Test the change in a staging/test environment</li>
<li>Notify affected users of the maintenance window</li>
<li>Implement during the approved change window</li>
<li>Verify the change works as expected</li>
<li>If issues arise, execute the rollback plan</li>
</ol>

<h4>Post-Implementation Review</h4>
<ol>
<li>Confirm the change achieved its objective</li>
<li>Document any deviations from the plan</li>
<li>Close the change request ticket</li>
<li>For failed changes: conduct a review and update procedures</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>CAB meetings: Weekly (or as needed)</li>
<li>Standard change list review: Quarterly</li>
<li>Change management process review: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Change request tickets with full approval chain</li>
<li>CAB meeting minutes</li>
<li>Test results (staging environment)</li>
<li>Post-implementation review reports</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-change-management">Change Management Policy</a></p>$body_51$,
  $plain_51$Change Management Procedure Purpose This procedure ensures all changes to IT systems are planned, tested, approved, and documented to minimize disruption. Scope All changes to production systems, networks, applications, and infrastructure. Roles &amp; Responsibilities Change Requester: Submits change request with details and justification Change Manager: Reviews requests, schedules CAB meetings, tracks changes Change Advisory Board (CAB): Evaluates risk, approves or rejects changes Implementer: Executes the approved change Testing Team: Validates changes in staging before production deployment Step-by-Step Procedure Submitting a Change Request Create a change request ticket with: description, justification, affected systems, risk assessment, rollback plan, and proposed schedule Classify the change: Standard (pre-approved), Normal (requires CAB), Emergency (expedited) Submit for review Review and Approval Change Manager reviews for completeness Normal changes: Presented at next CAB meeting for discussion and vote Emergency changes: Approved by Change Manager + one CAB member, documented retroactively Standard changes: Auto-approved if following documented procedure Implementation Test the change in a staging/test environment Notify affected users of the maintenance window Implement during the approved change window Verify the change works as expected If issues arise, execute the rollback plan Post-Implementation Review Confirm the change achieved its objective Document any deviations from the plan Close the change request ticket For failed changes: conduct a review and update procedures Frequency / Schedule CAB meetings: Weekly (or as needed) Standard change list review: Quarterly Change management process review: Annually Records &amp; Evidence Change request tickets with full approval chain CAB meeting minutes Test results (staging environment) Post-implementation review reports Related Policy Change Management Policy$plain_51$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-backup-recovery',
  'Backup & Recovery Procedure',
  'How to perform backups, verify integrity, and restore systems from backup.',
  $body_52$<h2>Backup &amp; Recovery Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how data is backed up, stored, verified, and restored to ensure business continuity.</p>

<h3>Scope</h3>
<p>All critical systems, databases, file servers, and SaaS application data.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>IT Team:</strong> Configure and monitor backups, perform restores</li>
<li><strong>IT Manager:</strong> Approve backup policies, review test results</li>
<li><strong>System Owners:</strong> Identify critical data and RPO/RTO requirements</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Backup Schedule</h4>
<ol>
<li>Full backups: Weekly (Sundays at 02:00)</li>
<li>Incremental backups: Daily (01:00)</li>
<li>Database transaction log backups: Every 4 hours</li>
<li>Store backups in at least two locations (on-site + off-site/cloud)</li>
<li>Encrypt all backup media using AES-256</li>
</ol>

<h4>Backup Verification</h4>
<ol>
<li>Review backup job logs daily — investigate any failures immediately</li>
<li>Perform a test restore of a random system monthly</li>
<li>Document the test restore: system restored, time to restore, data integrity check</li>
<li>Report results to IT Manager</li>
</ol>

<h4>Restoring from Backup</h4>
<ol>
<li>Receive restoration request (ticket or emergency request)</li>
<li>Identify the correct backup set based on the desired recovery point</li>
<li>Restore to a staging environment first (if time permits)</li>
<li>Verify data integrity and completeness</li>
<li>Restore to production when confirmed</li>
<li>Document the restore event including time, data restored, and any data loss</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Full backups: Weekly</li>
<li>Incremental backups: Daily</li>
<li>Backup log review: Daily</li>
<li>Test restore: Monthly</li>
<li>Backup strategy review: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Backup job logs</li>
<li>Test restore reports</li>
<li>Restore request tickets</li>
<li>Backup media inventory</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-backup-recovery">Backup &amp; Recovery Policy</a></p>$body_52$,
  $plain_52$Backup &amp; Recovery Procedure Purpose This procedure defines how data is backed up, stored, verified, and restored to ensure business continuity. Scope All critical systems, databases, file servers, and SaaS application data. Roles &amp; Responsibilities IT Team: Configure and monitor backups, perform restores IT Manager: Approve backup policies, review test results System Owners: Identify critical data and RPO/RTO requirements Step-by-Step Procedure Backup Schedule Full backups: Weekly (Sundays at 02:00) Incremental backups: Daily (01:00) Database transaction log backups: Every 4 hours Store backups in at least two locations (on-site + off-site/cloud) Encrypt all backup media using AES-256 Backup Verification Review backup job logs daily — investigate any failures immediately Perform a test restore of a random system monthly Document the test restore: system restored, time to restore, data integrity check Report results to IT Manager Restoring from Backup Receive restoration request (ticket or emergency request) Identify the correct backup set based on the desired recovery point Restore to a staging environment first (if time permits) Verify data integrity and completeness Restore to production when confirmed Document the restore event including time, data restored, and any data loss Frequency / Schedule Full backups: Weekly Incremental backups: Daily Backup log review: Daily Test restore: Monthly Backup strategy review: Annually Records &amp; Evidence Backup job logs Test restore reports Restore request tickets Backup media inventory Related Policy Backup &amp; Recovery Policy$plain_52$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-remote-access-byod',
  'Remote Access & BYOD Procedure',
  'How to set up secure remote access and register personal devices for work use.',
  $body_53$<h2>Remote Access &amp; BYOD Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how employees securely access company resources remotely and register personal devices for work.</p>

<h3>Scope</h3>
<p>All employees working remotely or using personal devices (BYOD) to access company systems.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Employees:</strong> Follow remote access procedures, keep devices updated and secure</li>
<li><strong>IT Team:</strong> Configure VPN, manage device enrollment, support remote users</li>
<li><strong>IT Security:</strong> Define security requirements, audit compliance</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Setting Up VPN Access</h4>
<ol>
<li>Submit a remote access request ticket with business justification</li>
<li>Manager approves the request</li>
<li>IT provides VPN client download link and configuration instructions</li>
<li>Install VPN client and configure with company profile</li>
<li>Authenticate with your company credentials + MFA</li>
<li>Verify connectivity to required resources</li>
</ol>

<h4>Registering a Personal Device (BYOD)</h4>
<ol>
<li>Verify the device meets minimum requirements: current OS, encryption enabled, antivirus installed</li>
<li>Submit a BYOD registration request to IT</li>
<li>IT enrolls the device in the mobile device management (MDM) system</li>
<li>Accept the BYOD agreement (company can remotely wipe work data)</li>
<li>Configure work profile/container on the device</li>
</ol>

<h4>Reporting a Lost or Stolen Device</h4>
<ol>
<li>Immediately notify IT via phone or emergency contact</li>
<li>IT initiates remote wipe of company data</li>
<li>Change all passwords for accounts accessed from the device</li>
<li>IT documents the incident and disables the device's access</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>BYOD compliance check: Quarterly</li>
<li>VPN access review: Quarterly</li>
<li>Remote access policy acknowledgment: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>VPN access logs</li>
<li>BYOD registration records</li>
<li>Device compliance reports</li>
<li>Lost/stolen device reports</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-remote-access-byod">Remote Access &amp; BYOD Policy</a></p>$body_53$,
  $plain_53$Remote Access &amp; BYOD Procedure Purpose This procedure defines how employees securely access company resources remotely and register personal devices for work. Scope All employees working remotely or using personal devices (BYOD) to access company systems. Roles &amp; Responsibilities Employees: Follow remote access procedures, keep devices updated and secure IT Team: Configure VPN, manage device enrollment, support remote users IT Security: Define security requirements, audit compliance Step-by-Step Procedure Setting Up VPN Access Submit a remote access request ticket with business justification Manager approves the request IT provides VPN client download link and configuration instructions Install VPN client and configure with company profile Authenticate with your company credentials + MFA Verify connectivity to required resources Registering a Personal Device (BYOD) Verify the device meets minimum requirements: current OS, encryption enabled, antivirus installed Submit a BYOD registration request to IT IT enrolls the device in the mobile device management (MDM) system Accept the BYOD agreement (company can remotely wipe work data) Configure work profile/container on the device Reporting a Lost or Stolen Device Immediately notify IT via phone or emergency contact IT initiates remote wipe of company data Change all passwords for accounts accessed from the device IT documents the incident and disables the device's access Frequency / Schedule BYOD compliance check: Quarterly VPN access review: Quarterly Remote access policy acknowledgment: Annually Records &amp; Evidence VPN access logs BYOD registration records Device compliance reports Lost/stolen device reports Related Policy Remote Access &amp; BYOD Policy$plain_53$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-physical-security',
  'Physical Security Procedure',
  'Procedures for facility access, visitor management, and physical security monitoring.',
  $body_54$<h2>Physical Security Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how physical access to facilities and sensitive areas is controlled and monitored.</p>

<h3>Scope</h3>
<p>All company facilities, server rooms, data centers, and restricted areas.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Facilities/Security:</strong> Manage access cards, monitor cameras, escort visitors</li>
<li><strong>IT Team:</strong> Secure server rooms, manage environmental controls</li>
<li><strong>All Staff:</strong> Badge in/out, report tailgating, escort visitors</li>
<li><strong>Reception:</strong> Register visitors, issue temporary badges</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Visitor Access</h4>
<ol>
<li>Host pre-registers visitor via the visitor management system</li>
<li>Visitor presents ID at reception and signs the visitor log</li>
<li>Reception issues a temporary visitor badge (clearly marked as "VISITOR")</li>
<li>Host escorts the visitor at all times in restricted areas</li>
<li>Visitor returns badge upon departure; visit is logged</li>
</ol>

<h4>Server Room Access</h4>
<ol>
<li>Only authorized IT staff may access server rooms</li>
<li>Access requires badge + PIN or biometric authentication</li>
<li>All entries and exits are logged automatically</li>
<li>Visitors to server rooms require IT escort and a logged justification</li>
</ol>

<h4>Lost or Stolen Access Badge</h4>
<ol>
<li>Report the lost badge to Security/Facilities immediately</li>
<li>The lost badge is deactivated within 1 hour</li>
<li>A new badge is issued after identity verification</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Access card audit: Quarterly (verify all active badges belong to current employees)</li>
<li>CCTV system check: Monthly</li>
<li>Environmental monitoring review: Monthly (temperature, humidity, fire suppression)</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Visitor logs</li>
<li>Badge access logs</li>
<li>CCTV recordings (retained per retention policy)</li>
<li>Server room access logs</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-physical-security">Physical Security Policy</a></p>$body_54$,
  $plain_54$Physical Security Procedure Purpose This procedure defines how physical access to facilities and sensitive areas is controlled and monitored. Scope All company facilities, server rooms, data centers, and restricted areas. Roles &amp; Responsibilities Facilities/Security: Manage access cards, monitor cameras, escort visitors IT Team: Secure server rooms, manage environmental controls All Staff: Badge in/out, report tailgating, escort visitors Reception: Register visitors, issue temporary badges Step-by-Step Procedure Visitor Access Host pre-registers visitor via the visitor management system Visitor presents ID at reception and signs the visitor log Reception issues a temporary visitor badge (clearly marked as "VISITOR") Host escorts the visitor at all times in restricted areas Visitor returns badge upon departure; visit is logged Server Room Access Only authorized IT staff may access server rooms Access requires badge + PIN or biometric authentication All entries and exits are logged automatically Visitors to server rooms require IT escort and a logged justification Lost or Stolen Access Badge Report the lost badge to Security/Facilities immediately The lost badge is deactivated within 1 hour A new badge is issued after identity verification Frequency / Schedule Access card audit: Quarterly (verify all active badges belong to current employees) CCTV system check: Monthly Environmental monitoring review: Monthly (temperature, humidity, fire suppression) Records &amp; Evidence Visitor logs Badge access logs CCTV recordings (retained per retention policy) Server room access logs Related Policy Physical Security Policy$plain_54$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-network-security',
  'Network Security Procedure',
  'Procedures for firewall management, network monitoring, and segmentation.',
  $body_55$<h2>Network Security Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how the network is secured, monitored, and maintained to protect company systems and data.</p>

<h3>Scope</h3>
<p>All network infrastructure including firewalls, switches, routers, wireless access points, and VPN gateways.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Network Team:</strong> Configure and maintain network devices, apply patches</li>
<li><strong>IT Security:</strong> Define firewall rules, review network logs, investigate alerts</li>
<li><strong>IT Manager:</strong> Approve network architecture changes</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Firewall Rule Changes</h4>
<ol>
<li>Submit a change request specifying source, destination, port, protocol, and business justification</li>
<li>IT Security reviews the rule against the principle of least access</li>
<li>Approved rules are implemented in a staging firewall first (if available)</li>
<li>Deploy to production during a change window</li>
<li>Verify the rule works and no unintended access was created</li>
</ol>

<h4>Network Monitoring</h4>
<ol>
<li>All network traffic passes through an IDS/IPS system</li>
<li>Security alerts are triaged within 1 hour during business hours</li>
<li>Anomalous traffic patterns trigger automated alerts to IT Security</li>
<li>Weekly review of top traffic patterns and blocked threats</li>
</ol>

<h4>Wireless Network Security</h4>
<ol>
<li>Corporate WiFi uses WPA3 Enterprise with 802.1X authentication</li>
<li>Guest WiFi is isolated on a separate VLAN with no access to internal resources</li>
<li>Unauthorized access points are detected by wireless IDS and disabled</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Firewall rule review: Quarterly</li>
<li>Network device patching: Monthly</li>
<li>Network architecture review: Annually</li>
<li>Wireless security audit: Bi-annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Firewall rule change requests and approvals</li>
<li>Network monitoring dashboards and alert logs</li>
<li>Network device patch records</li>
<li>Wireless audit reports</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-network-security">Network Security Policy</a></p>$body_55$,
  $plain_55$Network Security Procedure Purpose This procedure defines how the network is secured, monitored, and maintained to protect company systems and data. Scope All network infrastructure including firewalls, switches, routers, wireless access points, and VPN gateways. Roles &amp; Responsibilities Network Team: Configure and maintain network devices, apply patches IT Security: Define firewall rules, review network logs, investigate alerts IT Manager: Approve network architecture changes Step-by-Step Procedure Firewall Rule Changes Submit a change request specifying source, destination, port, protocol, and business justification IT Security reviews the rule against the principle of least access Approved rules are implemented in a staging firewall first (if available) Deploy to production during a change window Verify the rule works and no unintended access was created Network Monitoring All network traffic passes through an IDS/IPS system Security alerts are triaged within 1 hour during business hours Anomalous traffic patterns trigger automated alerts to IT Security Weekly review of top traffic patterns and blocked threats Wireless Network Security Corporate WiFi uses WPA3 Enterprise with 802.1X authentication Guest WiFi is isolated on a separate VLAN with no access to internal resources Unauthorized access points are detected by wireless IDS and disabled Frequency / Schedule Firewall rule review: Quarterly Network device patching: Monthly Network architecture review: Annually Wireless security audit: Bi-annually Records &amp; Evidence Firewall rule change requests and approvals Network monitoring dashboards and alert logs Network device patch records Wireless audit reports Related Policy Network Security Policy$plain_55$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-vendor-management',
  'Vendor & Third-Party Management Procedure',
  'How to evaluate, onboard, monitor, and offboard vendors and third-party providers.',
  $body_56$<h2>Vendor &amp; Third-Party Management Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how vendors and third parties are evaluated, onboarded, monitored, and offboarded to manage risk.</p>

<h3>Scope</h3>
<p>All third-party vendors, contractors, and service providers with access to company data or systems.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Procurement:</strong> Lead vendor selection and contract negotiation</li>
<li><strong>IT Security:</strong> Conduct security assessments, review SOC reports</li>
<li><strong>Legal:</strong> Review contracts, data processing agreements, and liability terms</li>
<li><strong>Business Owner:</strong> Define requirements, monitor service quality</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Vendor Security Assessment</h4>
<ol>
<li>Send the vendor security questionnaire (based on data sensitivity tier)</li>
<li>Review the vendor's security certifications (SOC 2, ISO 27001, etc.)</li>
<li>Assess the vendor's data handling practices and breach history</li>
<li>Rate the vendor risk level: Low, Medium, High, Critical</li>
<li>Document findings and recommendation (approve, approve with conditions, reject)</li>
</ol>

<h4>Vendor Onboarding</h4>
<ol>
<li>Execute contract with required security clauses (data protection, breach notification, right to audit)</li>
<li>Sign data processing agreement (DPA) if vendor handles personal data</li>
<li>Provision vendor access using least-privilege principles</li>
<li>Add vendor to the vendor register with risk rating and review schedule</li>
</ol>

<h4>Ongoing Monitoring</h4>
<ol>
<li>Review vendor SOC reports annually (or upon receipt)</li>
<li>Monitor vendor security posture (news alerts, breach databases)</li>
<li>Conduct periodic access reviews for vendor accounts</li>
<li>Escalate any security concerns to IT Security</li>
</ol>

<h4>Vendor Offboarding</h4>
<ol>
<li>Revoke all vendor access immediately upon contract termination</li>
<li>Request written confirmation of data deletion/return</li>
<li>Update the vendor register</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Vendor risk assessment: Before onboarding, then annually</li>
<li>SOC report review: Annually</li>
<li>Vendor access review: Quarterly</li>
<li>Vendor register update: Quarterly</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Vendor security assessments and questionnaires</li>
<li>Contracts and DPAs</li>
<li>SOC report reviews</li>
<li>Vendor register with risk ratings</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-vendor-management">Vendor &amp; Third-Party Management Policy</a></p>$body_56$,
  $plain_56$Vendor &amp; Third-Party Management Procedure Purpose This procedure defines how vendors and third parties are evaluated, onboarded, monitored, and offboarded to manage risk. Scope All third-party vendors, contractors, and service providers with access to company data or systems. Roles &amp; Responsibilities Procurement: Lead vendor selection and contract negotiation IT Security: Conduct security assessments, review SOC reports Legal: Review contracts, data processing agreements, and liability terms Business Owner: Define requirements, monitor service quality Step-by-Step Procedure Vendor Security Assessment Send the vendor security questionnaire (based on data sensitivity tier) Review the vendor's security certifications (SOC 2, ISO 27001, etc.) Assess the vendor's data handling practices and breach history Rate the vendor risk level: Low, Medium, High, Critical Document findings and recommendation (approve, approve with conditions, reject) Vendor Onboarding Execute contract with required security clauses (data protection, breach notification, right to audit) Sign data processing agreement (DPA) if vendor handles personal data Provision vendor access using least-privilege principles Add vendor to the vendor register with risk rating and review schedule Ongoing Monitoring Review vendor SOC reports annually (or upon receipt) Monitor vendor security posture (news alerts, breach databases) Conduct periodic access reviews for vendor accounts Escalate any security concerns to IT Security Vendor Offboarding Revoke all vendor access immediately upon contract termination Request written confirmation of data deletion/return Update the vendor register Frequency / Schedule Vendor risk assessment: Before onboarding, then annually SOC report review: Annually Vendor access review: Quarterly Vendor register update: Quarterly Records &amp; Evidence Vendor security assessments and questionnaires Contracts and DPAs SOC report reviews Vendor register with risk ratings Related Policy Vendor &amp; Third-Party Management Policy$plain_56$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-security-awareness',
  'Security Awareness Procedure',
  'How to deliver, track, and measure security awareness training and phishing simulations.',
  $body_57$<h2>Security Awareness Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how security awareness training is delivered, tracked, and measured to reduce human risk.</p>

<h3>Scope</h3>
<p>All employees, contractors, and temporary staff.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>IT Security:</strong> Design training content, run phishing simulations, analyze results</li>
<li><strong>HR:</strong> Enforce training completion requirements, track compliance</li>
<li><strong>Managers:</strong> Ensure team members complete training on time</li>
<li><strong>All Staff:</strong> Complete assigned training and report suspicious activity</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Annual Security Awareness Training</h4>
<ol>
<li>IT Security selects or updates training modules covering current threats</li>
<li>Training is assigned to all staff via the learning management system</li>
<li>Employees complete training and pass the assessment (80% minimum score)</li>
<li>Non-completions are escalated to managers after 2 weeks, then HR after 4 weeks</li>
<li>Completion records are filed for compliance evidence</li>
</ol>

<h4>Phishing Simulations</h4>
<ol>
<li>IT Security designs realistic phishing scenarios (quarterly)</li>
<li>Simulated phishing emails are sent to random employee groups</li>
<li>Results are tracked: click rate, report rate, credential submission rate</li>
<li>Employees who click are enrolled in supplemental training</li>
<li>Quarterly reports show trend data and improvement metrics</li>
</ol>

<h4>New Hire Security Orientation</h4>
<ol>
<li>New hires complete basic security awareness within first 14 days</li>
<li>Topics: password hygiene, phishing recognition, data handling, reporting procedures</li>
<li>New hire acknowledges the Acceptable Use Policy and Information Security Policy</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Comprehensive training: Annually</li>
<li>Phishing simulations: Quarterly</li>
<li>New hire orientation: Within 14 days of start</li>
<li>Topical refreshers (ransomware, social engineering): As needed</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Training completion records and assessment scores</li>
<li>Phishing simulation results and trend reports</li>
<li>New hire training completion dates</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-security-awareness">Security Awareness Policy</a></p>$body_57$,
  $plain_57$Security Awareness Procedure Purpose This procedure defines how security awareness training is delivered, tracked, and measured to reduce human risk. Scope All employees, contractors, and temporary staff. Roles &amp; Responsibilities IT Security: Design training content, run phishing simulations, analyze results HR: Enforce training completion requirements, track compliance Managers: Ensure team members complete training on time All Staff: Complete assigned training and report suspicious activity Step-by-Step Procedure Annual Security Awareness Training IT Security selects or updates training modules covering current threats Training is assigned to all staff via the learning management system Employees complete training and pass the assessment (80% minimum score) Non-completions are escalated to managers after 2 weeks, then HR after 4 weeks Completion records are filed for compliance evidence Phishing Simulations IT Security designs realistic phishing scenarios (quarterly) Simulated phishing emails are sent to random employee groups Results are tracked: click rate, report rate, credential submission rate Employees who click are enrolled in supplemental training Quarterly reports show trend data and improvement metrics New Hire Security Orientation New hires complete basic security awareness within first 14 days Topics: password hygiene, phishing recognition, data handling, reporting procedures New hire acknowledges the Acceptable Use Policy and Information Security Policy Frequency / Schedule Comprehensive training: Annually Phishing simulations: Quarterly New hire orientation: Within 14 days of start Topical refreshers (ransomware, social engineering): As needed Records &amp; Evidence Training completion records and assessment scores Phishing simulation results and trend reports New hire training completion dates Related Policy Security Awareness Policy$plain_57$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-asset-management',
  'IT Asset Management Procedure',
  'How to procure, track, maintain, and dispose of IT assets throughout their lifecycle.',
  $body_58$<h2>IT Asset Management Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how IT assets are procured, tracked, maintained, and disposed of throughout their lifecycle.</p>

<h3>Scope</h3>
<p>All hardware (laptops, desktops, servers, mobile devices, peripherals) and software assets.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>IT Team:</strong> Procure, configure, deploy, maintain, and dispose of assets</li>
<li><strong>Asset Manager:</strong> Maintain the asset register, track lifecycle status</li>
<li><strong>Department Managers:</strong> Approve procurement requests, verify asset assignments</li>
<li><strong>Finance:</strong> Track asset costs, depreciation, and budget</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Asset Procurement</h4>
<ol>
<li>Department submits a procurement request with specifications and business justification</li>
<li>IT reviews for compatibility and standardization alignment</li>
<li>Manager and Finance approve based on budget</li>
<li>IT procures and receives the asset</li>
<li>Asset is tagged, entered in the asset register, and configured</li>
</ol>

<h4>Asset Assignment</h4>
<ol>
<li>IT assigns the asset to a user in the asset management system</li>
<li>User acknowledges receipt and responsibility</li>
<li>Asset status changes to "In Use"</li>
</ol>

<h4>Asset Disposal</h4>
<ol>
<li>IT determines the asset has reached end-of-life (age, condition, or replacement)</li>
<li>All data is securely wiped using NIST 800-88 guidelines</li>
<li>Obtain a certificate of data destruction</li>
<li>Dispose of hardware through certified e-waste recycling</li>
<li>Update asset register to "Disposed" with disposal date and method</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Asset inventory audit: Bi-annually</li>
<li>Software license review: Quarterly</li>
<li>End-of-life assessment: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Asset register with lifecycle status</li>
<li>Procurement approvals and receipts</li>
<li>Data destruction certificates</li>
<li>E-waste recycling records</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-asset-management">IT Asset Management Policy</a></p>$body_58$,
  $plain_58$IT Asset Management Procedure Purpose This procedure defines how IT assets are procured, tracked, maintained, and disposed of throughout their lifecycle. Scope All hardware (laptops, desktops, servers, mobile devices, peripherals) and software assets. Roles &amp; Responsibilities IT Team: Procure, configure, deploy, maintain, and dispose of assets Asset Manager: Maintain the asset register, track lifecycle status Department Managers: Approve procurement requests, verify asset assignments Finance: Track asset costs, depreciation, and budget Step-by-Step Procedure Asset Procurement Department submits a procurement request with specifications and business justification IT reviews for compatibility and standardization alignment Manager and Finance approve based on budget IT procures and receives the asset Asset is tagged, entered in the asset register, and configured Asset Assignment IT assigns the asset to a user in the asset management system User acknowledges receipt and responsibility Asset status changes to "In Use" Asset Disposal IT determines the asset has reached end-of-life (age, condition, or replacement) All data is securely wiped using NIST 800-88 guidelines Obtain a certificate of data destruction Dispose of hardware through certified e-waste recycling Update asset register to "Disposed" with disposal date and method Frequency / Schedule Asset inventory audit: Bi-annually Software license review: Quarterly End-of-life assessment: Annually Records &amp; Evidence Asset register with lifecycle status Procurement approvals and receipts Data destruction certificates E-waste recycling records Related Policy IT Asset Management Policy$plain_58$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-software-licensing',
  'Software Licensing & Installation Procedure',
  'How to request, approve, install, and audit software and licenses.',
  $body_59$<h2>Software Licensing &amp; Installation Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how software is requested, approved, installed, licensed, and audited.</p>

<h3>Scope</h3>
<p>All software installed on company-owned or managed devices, including SaaS subscriptions.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Employees:</strong> Request software through approved channels only</li>
<li><strong>IT Team:</strong> Evaluate, approve, install, and manage software</li>
<li><strong>IT Security:</strong> Assess security risks of requested software</li>
<li><strong>Finance:</strong> Approve purchases and track license costs</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Requesting New Software</h4>
<ol>
<li>Employee submits a service request specifying the software, version, and business need</li>
<li>IT checks the approved software list — if already approved, proceed to install</li>
<li>If not on the list: IT Security conducts a risk assessment</li>
<li>Finance approves the purchase (if paid software)</li>
<li>IT adds to the approved software list if accepted</li>
</ol>

<h4>Installation</h4>
<ol>
<li>IT installs the software or provides self-service installation instructions</li>
<li>License key is registered in the license management system</li>
<li>Installation is documented in the asset management system</li>
</ol>

<h4>License Compliance Audit</h4>
<ol>
<li>IT generates a software inventory report from all managed devices</li>
<li>Compare installed software against purchased licenses</li>
<li>Identify over-licensed (unused licenses to reclaim) and under-licensed (compliance risk) software</li>
<li>Take corrective action: purchase additional licenses or remove unauthorized software</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Software inventory scan: Monthly (automated)</li>
<li>License compliance audit: Quarterly</li>
<li>Approved software list review: Bi-annually</li>
<li>SaaS subscription review: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Software request and approval tickets</li>
<li>License purchase records and keys</li>
<li>Software inventory reports</li>
<li>License compliance audit results</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-software-licensing">Software Licensing &amp; Installation Policy</a></p>$body_59$,
  $plain_59$Software Licensing &amp; Installation Procedure Purpose This procedure defines how software is requested, approved, installed, licensed, and audited. Scope All software installed on company-owned or managed devices, including SaaS subscriptions. Roles &amp; Responsibilities Employees: Request software through approved channels only IT Team: Evaluate, approve, install, and manage software IT Security: Assess security risks of requested software Finance: Approve purchases and track license costs Step-by-Step Procedure Requesting New Software Employee submits a service request specifying the software, version, and business need IT checks the approved software list — if already approved, proceed to install If not on the list: IT Security conducts a risk assessment Finance approves the purchase (if paid software) IT adds to the approved software list if accepted Installation IT installs the software or provides self-service installation instructions License key is registered in the license management system Installation is documented in the asset management system License Compliance Audit IT generates a software inventory report from all managed devices Compare installed software against purchased licenses Identify over-licensed (unused licenses to reclaim) and under-licensed (compliance risk) software Take corrective action: purchase additional licenses or remove unauthorized software Frequency / Schedule Software inventory scan: Monthly (automated) License compliance audit: Quarterly Approved software list review: Bi-annually SaaS subscription review: Annually Records &amp; Evidence Software request and approval tickets License purchase records and keys Software inventory reports License compliance audit results Related Policy Software Licensing &amp; Installation Policy$plain_59$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-hipaa-phi-handling',
  'PHI Handling Procedure',
  'Step-by-step procedures for accessing, transmitting, and storing protected health information.',
  $body_60$<h2>PHI Handling Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how protected health information (PHI) is accessed, used, transmitted, and stored in compliance with HIPAA.</p>

<h3>Scope</h3>
<p>All workforce members who create, receive, maintain, or transmit PHI.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Privacy Officer:</strong> Oversees PHI handling compliance, investigates complaints</li>
<li><strong>All Workforce:</strong> Follow minimum necessary standard, report potential violations</li>
<li><strong>IT Team:</strong> Implement technical safeguards for PHI systems</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Accessing PHI</h4>
<ol>
<li>Verify you have a legitimate, job-related need to access the PHI (minimum necessary)</li>
<li>Access PHI only through approved systems with audit logging enabled</li>
<li>Never access PHI out of curiosity, for personal reasons, or for unauthorized individuals</li>
<li>Log out of PHI systems when stepping away</li>
</ol>

<h4>Transmitting PHI</h4>
<ol>
<li>Electronic PHI must be encrypted in transit (TLS 1.2+, encrypted email, or secure portal)</li>
<li>Never send PHI via unencrypted email, SMS, or consumer messaging apps</li>
<li>Faxed PHI: Verify the recipient's fax number before sending</li>
<li>Physical PHI: Use sealed envelopes marked "Confidential" and secure delivery methods</li>
</ol>

<h4>Disposing of PHI</h4>
<ol>
<li>Paper PHI: Cross-cut shred</li>
<li>Electronic PHI: Secure wipe per NIST 800-88</li>
<li>Devices containing PHI: Certified destruction with documentation</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>PHI access audit: Monthly</li>
<li>HIPAA training: Annually</li>
<li>PHI inventory review: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>PHI access logs</li>
<li>Encryption verification records</li>
<li>Disposal/destruction certificates</li>
<li>Training completion records</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-hipaa-phi-handling">Protected Health Information (PHI) Handling</a></p>$body_60$,
  $plain_60$PHI Handling Procedure Purpose This procedure defines how protected health information (PHI) is accessed, used, transmitted, and stored in compliance with HIPAA. Scope All workforce members who create, receive, maintain, or transmit PHI. Roles &amp; Responsibilities Privacy Officer: Oversees PHI handling compliance, investigates complaints All Workforce: Follow minimum necessary standard, report potential violations IT Team: Implement technical safeguards for PHI systems Step-by-Step Procedure Accessing PHI Verify you have a legitimate, job-related need to access the PHI (minimum necessary) Access PHI only through approved systems with audit logging enabled Never access PHI out of curiosity, for personal reasons, or for unauthorized individuals Log out of PHI systems when stepping away Transmitting PHI Electronic PHI must be encrypted in transit (TLS 1.2+, encrypted email, or secure portal) Never send PHI via unencrypted email, SMS, or consumer messaging apps Faxed PHI: Verify the recipient's fax number before sending Physical PHI: Use sealed envelopes marked "Confidential" and secure delivery methods Disposing of PHI Paper PHI: Cross-cut shred Electronic PHI: Secure wipe per NIST 800-88 Devices containing PHI: Certified destruction with documentation Frequency / Schedule PHI access audit: Monthly HIPAA training: Annually PHI inventory review: Annually Records &amp; Evidence PHI access logs Encryption verification records Disposal/destruction certificates Training completion records Related Policy Protected Health Information (PHI) Handling$plain_60$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-hipaa-breach-notification',
  'HIPAA Breach Notification Procedure',
  'Step-by-step breach assessment, notification timelines, and reporting requirements.',
  $body_61$<h2>HIPAA Breach Notification Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines the steps for investigating, assessing, and reporting breaches of unsecured PHI as required by the HIPAA Breach Notification Rule.</p>

<h3>Scope</h3>
<p>All incidents involving potential unauthorized access, use, or disclosure of PHI.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Privacy Officer:</strong> Leads breach investigation, determines notification requirements</li>
<li><strong>IT Security:</strong> Conducts technical investigation, preserves evidence</li>
<li><strong>Legal:</strong> Advises on notification obligations and regulatory reporting</li>
<li><strong>Communications:</strong> Drafts notification letters and manages media (if applicable)</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Breach Discovery</h4>
<ol>
<li>Any workforce member who discovers or suspects a PHI breach reports it immediately to the Privacy Officer</li>
<li>Privacy Officer logs the incident and begins investigation within 24 hours</li>
<li>The "discovery date" is when the breach is first known (or should have been known)</li>
</ol>

<h4>Breach Risk Assessment (4-Factor Test)</h4>
<ol>
<li>Evaluate the nature and extent of PHI involved (types and identifiers)</li>
<li>Identify who impermissibly used or received the PHI</li>
<li>Determine whether the PHI was actually acquired or viewed</li>
<li>Assess what mitigation steps have been taken (e.g., data returned, destroyed)</li>
<li>If the assessment shows low probability of compromise, document the rationale for no notification</li>
</ol>

<h4>Notification (if breach is confirmed)</h4>
<ol>
<li>Individual notification: Within 60 days of discovery via first-class mail (or email if preferred)</li>
<li>HHS notification: Within 60 days for breaches affecting 500+ individuals; annual log for smaller breaches</li>
<li>Media notification: Within 60 days if breach affects 500+ individuals in a single state/jurisdiction</li>
<li>Business associate notification to covered entity: Without unreasonable delay, no later than 60 days</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Breach response drill: Annually</li>
<li>Small breach log submission to HHS: Annually (within 60 days of calendar year end)</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Breach investigation reports and risk assessments</li>
<li>Notification letters and proof of delivery</li>
<li>HHS breach reports</li>
<li>Breach log (all incidents, including those determined not reportable)</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-hipaa-breach-notification">HIPAA Breach Notification Procedures</a></p>$body_61$,
  $plain_61$HIPAA Breach Notification Procedure Purpose This procedure defines the steps for investigating, assessing, and reporting breaches of unsecured PHI as required by the HIPAA Breach Notification Rule. Scope All incidents involving potential unauthorized access, use, or disclosure of PHI. Roles &amp; Responsibilities Privacy Officer: Leads breach investigation, determines notification requirements IT Security: Conducts technical investigation, preserves evidence Legal: Advises on notification obligations and regulatory reporting Communications: Drafts notification letters and manages media (if applicable) Step-by-Step Procedure Breach Discovery Any workforce member who discovers or suspects a PHI breach reports it immediately to the Privacy Officer Privacy Officer logs the incident and begins investigation within 24 hours The "discovery date" is when the breach is first known (or should have been known) Breach Risk Assessment (4-Factor Test) Evaluate the nature and extent of PHI involved (types and identifiers) Identify who impermissibly used or received the PHI Determine whether the PHI was actually acquired or viewed Assess what mitigation steps have been taken (e.g., data returned, destroyed) If the assessment shows low probability of compromise, document the rationale for no notification Notification (if breach is confirmed) Individual notification: Within 60 days of discovery via first-class mail (or email if preferred) HHS notification: Within 60 days for breaches affecting 500+ individuals; annual log for smaller breaches Media notification: Within 60 days if breach affects 500+ individuals in a single state/jurisdiction Business associate notification to covered entity: Without unreasonable delay, no later than 60 days Frequency / Schedule Breach response drill: Annually Small breach log submission to HHS: Annually (within 60 days of calendar year end) Records &amp; Evidence Breach investigation reports and risk assessments Notification letters and proof of delivery HHS breach reports Breach log (all incidents, including those determined not reportable) Related Policy HIPAA Breach Notification Procedures$plain_61$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-hipaa-business-associate',
  'Business Associate Management Procedure',
  'How to evaluate, contract with, and monitor HIPAA business associates.',
  $body_62$<h2>Business Associate Management Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how to evaluate, contract with, and monitor business associates (BAs) who handle PHI on behalf of the organization.</p>

<h3>Scope</h3>
<p>All third parties that create, receive, maintain, or transmit PHI on behalf of the organization.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Privacy Officer:</strong> Identify BAs, ensure BAA execution, monitor compliance</li>
<li><strong>Legal:</strong> Draft and review Business Associate Agreements</li>
<li><strong>IT Security:</strong> Assess BA security posture</li>
<li><strong>Department Heads:</strong> Identify vendor relationships that involve PHI</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Identifying Business Associates</h4>
<ol>
<li>Review all vendor contracts to identify those that involve PHI access or handling</li>
<li>A vendor is a BA if they perform a function involving PHI (claims processing, data hosting, IT support with PHI access, etc.)</li>
<li>Document all identified BAs in the BA register</li>
</ol>

<h4>Executing a Business Associate Agreement (BAA)</h4>
<ol>
<li>Send the BAA template to the vendor for review</li>
<li>Negotiate terms ensuring: permitted uses of PHI, safeguard requirements, breach notification obligations, return/destruction of PHI at termination</li>
<li>Both parties execute the BAA before PHI access begins</li>
<li>File the executed BAA and log it in the BA register</li>
</ol>

<h4>Monitoring Business Associates</h4>
<ol>
<li>Request annual security attestation or SOC 2 report from each BA</li>
<li>Investigate any reported incidents or breaches promptly</li>
<li>Conduct periodic reviews of BA access and data handling</li>
<li>Terminate BAA and access if a BA fails to meet obligations</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>BA identification review: Annually</li>
<li>BAA review and renewal: Annually or upon contract renewal</li>
<li>BA security assessment: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>BA register</li>
<li>Executed BAAs (retained for 6 years per HIPAA)</li>
<li>BA security assessments</li>
<li>Incident and breach reports involving BAs</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-hipaa-business-associate">Business Associate Management (HIPAA)</a></p>$body_62$,
  $plain_62$Business Associate Management Procedure Purpose This procedure defines how to evaluate, contract with, and monitor business associates (BAs) who handle PHI on behalf of the organization. Scope All third parties that create, receive, maintain, or transmit PHI on behalf of the organization. Roles &amp; Responsibilities Privacy Officer: Identify BAs, ensure BAA execution, monitor compliance Legal: Draft and review Business Associate Agreements IT Security: Assess BA security posture Department Heads: Identify vendor relationships that involve PHI Step-by-Step Procedure Identifying Business Associates Review all vendor contracts to identify those that involve PHI access or handling A vendor is a BA if they perform a function involving PHI (claims processing, data hosting, IT support with PHI access, etc.) Document all identified BAs in the BA register Executing a Business Associate Agreement (BAA) Send the BAA template to the vendor for review Negotiate terms ensuring: permitted uses of PHI, safeguard requirements, breach notification obligations, return/destruction of PHI at termination Both parties execute the BAA before PHI access begins File the executed BAA and log it in the BA register Monitoring Business Associates Request annual security attestation or SOC 2 report from each BA Investigate any reported incidents or breaches promptly Conduct periodic reviews of BA access and data handling Terminate BAA and access if a BA fails to meet obligations Frequency / Schedule BA identification review: Annually BAA review and renewal: Annually or upon contract renewal BA security assessment: Annually Records &amp; Evidence BA register Executed BAAs (retained for 6 years per HIPAA) BA security assessments Incident and breach reports involving BAs Related Policy Business Associate Management (HIPAA)$plain_62$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-pci-cardholder-data',
  'Cardholder Data Protection Procedure',
  'How to handle, store, and transmit cardholder data in compliance with PCI DSS.',
  $body_63$<h2>Cardholder Data Protection Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how cardholder data (CHD) is handled, stored, and transmitted in compliance with PCI DSS requirements.</p>

<h3>Scope</h3>
<p>All systems, processes, and personnel involved in payment card processing.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Payment Systems Team:</strong> Manage and secure payment processing systems</li>
<li><strong>IT Security:</strong> Implement and monitor PCI DSS controls</li>
<li><strong>Compliance Officer:</strong> Oversee PCI DSS compliance program and SAQ completion</li>
<li><strong>All Staff Handling Payments:</strong> Follow CHD handling procedures</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Accepting Card Payments</h4>
<ol>
<li>Use only PCI-validated point-of-sale terminals or payment processors</li>
<li>Never write down full card numbers — use masked or truncated formats (first 6/last 4 only)</li>
<li>Never store CVV/CVC, full magnetic stripe data, or PIN data after authorization</li>
<li>Process transactions over encrypted connections only</li>
</ol>

<h4>Storing Cardholder Data</h4>
<ol>
<li>Minimize CHD storage — only store what is required for business needs</li>
<li>Encrypt stored CHD using strong cryptography (AES-256)</li>
<li>Restrict access to CHD on a need-to-know basis</li>
<li>Maintain a data flow diagram showing where CHD is stored and transmitted</li>
</ol>

<h4>Quarterly CHD Discovery Scan</h4>
<ol>
<li>Run automated scans to detect unencrypted CHD in file systems, databases, and logs</li>
<li>Investigate and remediate any unauthorized CHD storage immediately</li>
<li>Document findings and remediation actions</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>PCI DSS self-assessment: Annually</li>
<li>External vulnerability scan (ASV): Quarterly</li>
<li>CHD discovery scan: Quarterly</li>
<li>PCI awareness training: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>PCI DSS Self-Assessment Questionnaire (SAQ)</li>
<li>ASV scan reports</li>
<li>CHD discovery scan results</li>
<li>Data flow diagrams</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-pci-cardholder-data">Cardholder Data Protection Policy</a></p>$body_63$,
  $plain_63$Cardholder Data Protection Procedure Purpose This procedure defines how cardholder data (CHD) is handled, stored, and transmitted in compliance with PCI DSS requirements. Scope All systems, processes, and personnel involved in payment card processing. Roles &amp; Responsibilities Payment Systems Team: Manage and secure payment processing systems IT Security: Implement and monitor PCI DSS controls Compliance Officer: Oversee PCI DSS compliance program and SAQ completion All Staff Handling Payments: Follow CHD handling procedures Step-by-Step Procedure Accepting Card Payments Use only PCI-validated point-of-sale terminals or payment processors Never write down full card numbers — use masked or truncated formats (first 6/last 4 only) Never store CVV/CVC, full magnetic stripe data, or PIN data after authorization Process transactions over encrypted connections only Storing Cardholder Data Minimize CHD storage — only store what is required for business needs Encrypt stored CHD using strong cryptography (AES-256) Restrict access to CHD on a need-to-know basis Maintain a data flow diagram showing where CHD is stored and transmitted Quarterly CHD Discovery Scan Run automated scans to detect unencrypted CHD in file systems, databases, and logs Investigate and remediate any unauthorized CHD storage immediately Document findings and remediation actions Frequency / Schedule PCI DSS self-assessment: Annually External vulnerability scan (ASV): Quarterly CHD discovery scan: Quarterly PCI awareness training: Annually Records &amp; Evidence PCI DSS Self-Assessment Questionnaire (SAQ) ASV scan reports CHD discovery scan results Data flow diagrams Related Policy Cardholder Data Protection Policy$plain_63$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-pci-cryptography',
  'Cryptography & Data Transmission Procedure',
  'How to implement encryption, manage keys, and secure data in transit.',
  $body_64$<h2>Cryptography &amp; Data Transmission Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how encryption is implemented, cryptographic keys are managed, and data is secured in transit.</p>

<h3>Scope</h3>
<p>All systems that encrypt, decrypt, or transmit sensitive data (CHD, PII, credentials, confidential data).</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>IT Security:</strong> Define encryption standards, manage key lifecycle</li>
<li><strong>IT Team:</strong> Implement encryption on systems and applications</li>
<li><strong>Key Custodians:</strong> Manage cryptographic keys with split knowledge and dual control</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Encryption Standards</h4>
<ol>
<li>Data at rest: AES-256 for databases, file systems, and backup media</li>
<li>Data in transit: TLS 1.2 or higher for all network communications</li>
<li>Disable legacy protocols: SSL, TLS 1.0, TLS 1.1</li>
<li>Certificate management: Use certificates from trusted CAs, renew before expiration</li>
</ol>

<h4>Key Management</h4>
<ol>
<li>Generate keys using cryptographically secure random number generators</li>
<li>Store keys separately from the data they encrypt (never in the same database)</li>
<li>Use split knowledge: No single person has access to the complete key</li>
<li>Rotate encryption keys annually or upon suspected compromise</li>
<li>Destroy old keys securely after rotation and re-encryption is complete</li>
</ol>

<h4>Certificate Renewal</h4>
<ol>
<li>Monitor certificate expiration dates (automated alerting 30 days before expiry)</li>
<li>Generate a new CSR and submit to the CA</li>
<li>Install the renewed certificate and verify functionality</li>
<li>Update certificate inventory</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Key rotation: Annually</li>
<li>Certificate inventory review: Monthly</li>
<li>TLS configuration audit: Quarterly</li>
<li>Encryption standards review: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Key management logs (generation, rotation, destruction)</li>
<li>Certificate inventory with expiration dates</li>
<li>TLS audit reports</li>
<li>Encryption configuration documentation</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-pci-cryptography">Cryptography &amp; Data Transmission Policy</a></p>$body_64$,
  $plain_64$Cryptography &amp; Data Transmission Procedure Purpose This procedure defines how encryption is implemented, cryptographic keys are managed, and data is secured in transit. Scope All systems that encrypt, decrypt, or transmit sensitive data (CHD, PII, credentials, confidential data). Roles &amp; Responsibilities IT Security: Define encryption standards, manage key lifecycle IT Team: Implement encryption on systems and applications Key Custodians: Manage cryptographic keys with split knowledge and dual control Step-by-Step Procedure Encryption Standards Data at rest: AES-256 for databases, file systems, and backup media Data in transit: TLS 1.2 or higher for all network communications Disable legacy protocols: SSL, TLS 1.0, TLS 1.1 Certificate management: Use certificates from trusted CAs, renew before expiration Key Management Generate keys using cryptographically secure random number generators Store keys separately from the data they encrypt (never in the same database) Use split knowledge: No single person has access to the complete key Rotate encryption keys annually or upon suspected compromise Destroy old keys securely after rotation and re-encryption is complete Certificate Renewal Monitor certificate expiration dates (automated alerting 30 days before expiry) Generate a new CSR and submit to the CA Install the renewed certificate and verify functionality Update certificate inventory Frequency / Schedule Key rotation: Annually Certificate inventory review: Monthly TLS configuration audit: Quarterly Encryption standards review: Annually Records &amp; Evidence Key management logs (generation, rotation, destruction) Certificate inventory with expiration dates TLS audit reports Encryption configuration documentation Related Policy Cryptography &amp; Data Transmission Policy$plain_64$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-audit-trail',
  'Audit Trail & Logging Procedure',
  'How to configure, monitor, protect, and review audit logs across systems.',
  $body_65$<h2>Audit Trail &amp; Logging Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how audit logs are configured, monitored, protected, and reviewed to support security and compliance.</p>

<h3>Scope</h3>
<p>All systems that generate audit logs: servers, applications, databases, network devices, and cloud services.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>IT Team:</strong> Configure logging on all systems, ensure log delivery to central SIEM</li>
<li><strong>IT Security:</strong> Monitor logs for suspicious activity, investigate alerts</li>
<li><strong>Compliance:</strong> Verify logging meets regulatory requirements</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Log Configuration</h4>
<ol>
<li>Enable audit logging on all production systems (OS, application, database, network)</li>
<li>Log at minimum: authentication events, access to sensitive data, configuration changes, admin actions, failed access attempts</li>
<li>Each log entry must include: timestamp (UTC), source, user/account, action, outcome (success/failure), and source IP</li>
<li>Forward all logs to the centralized SIEM or log management platform</li>
</ol>

<h4>Log Monitoring</h4>
<ol>
<li>Configure alerts for: multiple failed logins, privilege escalation, after-hours access, large data exports, configuration changes</li>
<li>IT Security reviews alerts daily and investigates within the defined SLA</li>
<li>Weekly review of access patterns and anomalies</li>
</ol>

<h4>Log Protection</h4>
<ol>
<li>Logs are write-once / append-only — no user can modify or delete logs</li>
<li>Log access is restricted to IT Security and authorized administrators</li>
<li>Logs are backed up and retained per the Records Retention Policy</li>
<li>Log integrity is verified using checksums or tamper-evident storage</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Alert monitoring: Continuous (automated) + daily manual review</li>
<li>Log source inventory: Quarterly</li>
<li>Logging configuration audit: Bi-annually</li>
<li>Log retention verification: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Log source inventory</li>
<li>SIEM alert reports</li>
<li>Log review sign-off records</li>
<li>Log retention verification reports</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-audit-trail">Audit Trail &amp; Logging Policy</a></p>$body_65$,
  $plain_65$Audit Trail &amp; Logging Procedure Purpose This procedure defines how audit logs are configured, monitored, protected, and reviewed to support security and compliance. Scope All systems that generate audit logs: servers, applications, databases, network devices, and cloud services. Roles &amp; Responsibilities IT Team: Configure logging on all systems, ensure log delivery to central SIEM IT Security: Monitor logs for suspicious activity, investigate alerts Compliance: Verify logging meets regulatory requirements Step-by-Step Procedure Log Configuration Enable audit logging on all production systems (OS, application, database, network) Log at minimum: authentication events, access to sensitive data, configuration changes, admin actions, failed access attempts Each log entry must include: timestamp (UTC), source, user/account, action, outcome (success/failure), and source IP Forward all logs to the centralized SIEM or log management platform Log Monitoring Configure alerts for: multiple failed logins, privilege escalation, after-hours access, large data exports, configuration changes IT Security reviews alerts daily and investigates within the defined SLA Weekly review of access patterns and anomalies Log Protection Logs are write-once / append-only — no user can modify or delete logs Log access is restricted to IT Security and authorized administrators Logs are backed up and retained per the Records Retention Policy Log integrity is verified using checksums or tamper-evident storage Frequency / Schedule Alert monitoring: Continuous (automated) + daily manual review Log source inventory: Quarterly Logging configuration audit: Bi-annually Log retention verification: Annually Records &amp; Evidence Log source inventory SIEM alert reports Log review sign-off records Log retention verification reports Related Policy Audit Trail &amp; Logging Policy$plain_65$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-segregation-of-duties',
  'Segregation of Duties Procedure',
  'How to identify, implement, and monitor separation of conflicting duties.',
  $body_66$<h2>Segregation of Duties Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how conflicting duties are identified and separated to prevent fraud, errors, and unauthorized actions.</p>

<h3>Scope</h3>
<p>All business processes involving financial transactions, system administration, and data management.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Management:</strong> Define duties matrices, approve exceptions</li>
<li><strong>IT Security:</strong> Implement role-based access controls aligned with SoD matrix</li>
<li><strong>Internal Audit:</strong> Review SoD compliance, identify conflicts</li>
<li><strong>HR:</strong> Ensure role assignments align with SoD requirements</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Defining the SoD Matrix</h4>
<ol>
<li>List all critical business processes (financial approvals, vendor payments, system changes, user provisioning)</li>
<li>Identify the key duties in each process (initiate, authorize, record, reconcile)</li>
<li>Map conflicts: duties that should not be performed by the same person</li>
<li>Document the matrix and get management approval</li>
</ol>

<h4>Implementing SoD Controls</h4>
<ol>
<li>Configure role-based access in each system to enforce the SoD matrix</li>
<li>Implement dual approval workflows for critical actions (e.g., payments over a threshold)</li>
<li>Ensure no single person can both create and approve transactions</li>
</ol>

<h4>Monitoring SoD Compliance</h4>
<ol>
<li>Run quarterly reports comparing actual role assignments to the SoD matrix</li>
<li>Investigate and resolve any SoD conflicts identified</li>
<li>If a conflict cannot be resolved (small team), implement compensating controls (management review, additional logging)</li>
<li>Document all exceptions with justification and compensating controls</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>SoD matrix review: Annually</li>
<li>SoD compliance audit: Quarterly</li>
<li>Role assignment review: Quarterly</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>SoD matrix with management approval</li>
<li>SoD compliance reports</li>
<li>Exception documentation with compensating controls</li>
<li>Dual approval workflow logs</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-segregation-of-duties">Segregation of Duties Policy</a></p>$body_66$,
  $plain_66$Segregation of Duties Procedure Purpose This procedure defines how conflicting duties are identified and separated to prevent fraud, errors, and unauthorized actions. Scope All business processes involving financial transactions, system administration, and data management. Roles &amp; Responsibilities Management: Define duties matrices, approve exceptions IT Security: Implement role-based access controls aligned with SoD matrix Internal Audit: Review SoD compliance, identify conflicts HR: Ensure role assignments align with SoD requirements Step-by-Step Procedure Defining the SoD Matrix List all critical business processes (financial approvals, vendor payments, system changes, user provisioning) Identify the key duties in each process (initiate, authorize, record, reconcile) Map conflicts: duties that should not be performed by the same person Document the matrix and get management approval Implementing SoD Controls Configure role-based access in each system to enforce the SoD matrix Implement dual approval workflows for critical actions (e.g., payments over a threshold) Ensure no single person can both create and approve transactions Monitoring SoD Compliance Run quarterly reports comparing actual role assignments to the SoD matrix Investigate and resolve any SoD conflicts identified If a conflict cannot be resolved (small team), implement compensating controls (management review, additional logging) Document all exceptions with justification and compensating controls Frequency / Schedule SoD matrix review: Annually SoD compliance audit: Quarterly Role assignment review: Quarterly Records &amp; Evidence SoD matrix with management approval SoD compliance reports Exception documentation with compensating controls Dual approval workflow logs Related Policy Segregation of Duties Policy$plain_66$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-records-retention',
  'Records Retention Procedure',
  'How to classify, retain, archive, and dispose of business records.',
  $body_67$<h2>Records Retention Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how business records are classified, retained, archived, and disposed of in compliance with legal and regulatory requirements.</p>

<h3>Scope</h3>
<p>All business records: electronic and physical, including emails, contracts, financial records, HR files, and system logs.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Records Manager:</strong> Maintain the retention schedule, oversee disposal process</li>
<li><strong>Legal:</strong> Define retention periods based on regulatory requirements</li>
<li><strong>Department Heads:</strong> Ensure their teams follow retention requirements</li>
<li><strong>IT Team:</strong> Implement automated retention and disposal for electronic records</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Retention Schedule</h4>
<table>
<tr><th>Record Type</th><th>Retention Period</th><th>Authority</th></tr>
<tr><td>Financial records</td><td>7 years</td><td>IRS, SOX</td></tr>
<tr><td>Employee records</td><td>7 years after separation</td><td>EEOC, state law</td></tr>
<tr><td>Contracts</td><td>7 years after expiration</td><td>Statute of limitations</td></tr>
<tr><td>Audit logs</td><td>1-7 years (by system)</td><td>SOC 2, PCI DSS, HIPAA</td></tr>
<tr><td>Email</td><td>3 years (general), 7 years (financial/legal)</td><td>Business policy</td></tr>
<tr><td>PHI/Medical</td><td>6 years from creation or last effective date</td><td>HIPAA</td></tr>
</table>

<h4>Records Disposal</h4>
<ol>
<li>Check for litigation holds — do NOT destroy records under legal hold</li>
<li>Verify the record has exceeded its retention period</li>
<li>Paper records: Cross-cut shred with a certificate of destruction</li>
<li>Electronic records: Secure deletion with verification</li>
<li>Log the disposal in the records disposal register</li>
</ol>

<h4>Litigation Hold</h4>
<ol>
<li>Legal issues a litigation hold notice to affected departments</li>
<li>All relevant records are preserved regardless of retention schedule</li>
<li>IT disables automated deletion for affected records</li>
<li>Hold remains until Legal releases it in writing</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Retention schedule review: Annually</li>
<li>Disposal process: Quarterly (or as records age out)</li>
<li>Litigation hold review: Monthly (for active holds)</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Records retention schedule</li>
<li>Disposal certificates and register</li>
<li>Litigation hold notices</li>
<li>Annual retention review documentation</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-records-retention">Records Retention Policy</a></p>$body_67$,
  $plain_67$Records Retention Procedure Purpose This procedure defines how business records are classified, retained, archived, and disposed of in compliance with legal and regulatory requirements. Scope All business records: electronic and physical, including emails, contracts, financial records, HR files, and system logs. Roles &amp; Responsibilities Records Manager: Maintain the retention schedule, oversee disposal process Legal: Define retention periods based on regulatory requirements Department Heads: Ensure their teams follow retention requirements IT Team: Implement automated retention and disposal for electronic records Step-by-Step Procedure Retention Schedule Record Type Retention Period Authority Financial records 7 years IRS, SOX Employee records 7 years after separation EEOC, state law Contracts 7 years after expiration Statute of limitations Audit logs 1-7 years (by system) SOC 2, PCI DSS, HIPAA Email 3 years (general), 7 years (financial/legal) Business policy PHI/Medical 6 years from creation or last effective date HIPAA Records Disposal Check for litigation holds — do NOT destroy records under legal hold Verify the record has exceeded its retention period Paper records: Cross-cut shred with a certificate of destruction Electronic records: Secure deletion with verification Log the disposal in the records disposal register Litigation Hold Legal issues a litigation hold notice to affected departments All relevant records are preserved regardless of retention schedule IT disables automated deletion for affected records Hold remains until Legal releases it in writing Frequency / Schedule Retention schedule review: Annually Disposal process: Quarterly (or as records age out) Litigation hold review: Monthly (for active holds) Records &amp; Evidence Records retention schedule Disposal certificates and register Litigation hold notices Annual retention review documentation Related Policy Records Retention Policy$plain_67$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-foia-records',
  'Public Records & FOIA Procedure',
  'How to receive, process, and respond to public records and FOIA requests.',
  $body_68$<h2>Public Records &amp; FOIA Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how public records requests and Freedom of Information Act (FOIA) requests are received, processed, and responded to within required timelines.</p>

<h3>Scope</h3>
<p>All public records requests received by the organization (applicable to government agencies and entities subject to FOIA or state open records laws).</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>FOIA Officer:</strong> Receive and track requests, coordinate response, issue decisions</li>
<li><strong>Legal:</strong> Review exemptions, redactions, and appeal responses</li>
<li><strong>Department Heads:</strong> Search for and provide responsive records from their departments</li>
<li><strong>IT Team:</strong> Assist with electronic records search and production</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Receiving a Request</h4>
<ol>
<li>Log the request in the FOIA tracking system with: date received, requester name, description of records sought</li>
<li>Acknowledge receipt within 3 business days</li>
<li>Assess the scope of the request — clarify with requester if too broad</li>
</ol>

<h4>Searching for Records</h4>
<ol>
<li>Identify departments and systems likely to contain responsive records</li>
<li>Issue search instructions to department heads with a deadline</li>
<li>Collect responsive records from all sources</li>
</ol>

<h4>Review and Redaction</h4>
<ol>
<li>Review all responsive records for applicable exemptions (privacy, law enforcement, trade secrets, etc.)</li>
<li>Apply redactions where exemptions apply — document each redaction with the legal basis</li>
<li>Legal reviews redactions for complex or sensitive requests</li>
</ol>

<h4>Response</h4>
<ol>
<li>Prepare the response letter: records provided, exemptions cited, appeal rights</li>
<li>Deliver records to requester in the requested format</li>
<li>Meet the statutory deadline (typically 20-30 business days, varies by jurisdiction)</li>
<li>If an extension is needed, notify the requester with the reason and new deadline</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>Request tracking review: Weekly</li>
<li>FOIA log summary: Annually</li>
<li>FOIA procedure review: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>FOIA request log</li>
<li>Search instructions and department responses</li>
<li>Redaction logs with legal basis</li>
<li>Response letters and delivery confirmations</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-foia-records">Public Records &amp; FOIA Compliance</a></p>$body_68$,
  $plain_68$Public Records &amp; FOIA Procedure Purpose This procedure defines how public records requests and Freedom of Information Act (FOIA) requests are received, processed, and responded to within required timelines. Scope All public records requests received by the organization (applicable to government agencies and entities subject to FOIA or state open records laws). Roles &amp; Responsibilities FOIA Officer: Receive and track requests, coordinate response, issue decisions Legal: Review exemptions, redactions, and appeal responses Department Heads: Search for and provide responsive records from their departments IT Team: Assist with electronic records search and production Step-by-Step Procedure Receiving a Request Log the request in the FOIA tracking system with: date received, requester name, description of records sought Acknowledge receipt within 3 business days Assess the scope of the request — clarify with requester if too broad Searching for Records Identify departments and systems likely to contain responsive records Issue search instructions to department heads with a deadline Collect responsive records from all sources Review and Redaction Review all responsive records for applicable exemptions (privacy, law enforcement, trade secrets, etc.) Apply redactions where exemptions apply — document each redaction with the legal basis Legal reviews redactions for complex or sensitive requests Response Prepare the response letter: records provided, exemptions cited, appeal rights Deliver records to requester in the requested format Meet the statutory deadline (typically 20-30 business days, varies by jurisdiction) If an extension is needed, notify the requester with the reason and new deadline Frequency / Schedule Request tracking review: Weekly FOIA log summary: Annually FOIA procedure review: Annually Records &amp; Evidence FOIA request log Search instructions and department responses Redaction logs with legal basis Response letters and delivery confirmations Related Policy Public Records &amp; FOIA Compliance$plain_68$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'policies-and-procedures'),
  'procedure-hipaa-workforce-security',
  'HIPAA Workforce Security Procedure',
  'How to manage workforce access to PHI systems: authorization, supervision, and termination.',
  $body_69$<h2>HIPAA Workforce Security Procedure</h2>

<h3>Purpose</h3>
<p>This procedure defines how workforce members are authorized, supervised, and terminated with respect to access to PHI and PHI systems.</p>

<h3>Scope</h3>
<p>All workforce members (employees, contractors, volunteers, trainees) who may access PHI.</p>

<h3>Roles &amp; Responsibilities</h3>
<ul>
<li><strong>Privacy Officer:</strong> Define access levels based on job function, approve PHI access</li>
<li><strong>HR:</strong> Manage onboarding/offboarding, maintain workforce records</li>
<li><strong>IT Team:</strong> Provision and de-provision access to PHI systems</li>
<li><strong>Supervisors:</strong> Monitor workforce compliance with PHI access policies</li>
</ul>

<h3>Step-by-Step Procedure</h3>
<h4>Workforce Authorization</h4>
<ol>
<li>Determine the minimum PHI access required for the role (minimum necessary standard)</li>
<li>Document authorized access levels in the role-based access matrix</li>
<li>New workforce member completes HIPAA training before PHI access is granted</li>
<li>IT provisions access based on the approved role profile</li>
<li>Workforce member signs a confidentiality agreement</li>
</ol>

<h4>Ongoing Supervision</h4>
<ol>
<li>Supervisors monitor for inappropriate PHI access patterns</li>
<li>IT Security runs monthly PHI access audit reports</li>
<li>Privacy Officer investigates any anomalous access patterns</li>
<li>Annual HIPAA training refresh is required to maintain access</li>
</ol>

<h4>Workforce Termination</h4>
<ol>
<li>HR notifies IT and Privacy Officer of the termination date</li>
<li>IT revokes all PHI system access on or before the termination date</li>
<li>Collect all devices, badges, and keys</li>
<li>Verify access revocation within 24 hours</li>
<li>Retain access logs for the required HIPAA retention period (6 years)</li>
</ol>

<h3>Frequency / Schedule</h3>
<ul>
<li>PHI access audit: Monthly</li>
<li>Role-based access matrix review: Annually</li>
<li>HIPAA training refresh: Annually</li>
<li>Confidentiality agreement renewal: Annually</li>
</ul>

<h3>Records &amp; Evidence</h3>
<ul>
<li>Role-based access matrix</li>
<li>HIPAA training records</li>
<li>Signed confidentiality agreements</li>
<li>PHI access audit reports</li>
<li>Termination access revocation checklists</li>
</ul>

<h3>Related Policy</h3>
<p><a href="/portal/kb/policy-hipaa-workforce-security">Workforce Security (HIPAA)</a></p>$body_69$,
  $plain_69$HIPAA Workforce Security Procedure Purpose This procedure defines how workforce members are authorized, supervised, and terminated with respect to access to PHI and PHI systems. Scope All workforce members (employees, contractors, volunteers, trainees) who may access PHI. Roles &amp; Responsibilities Privacy Officer: Define access levels based on job function, approve PHI access HR: Manage onboarding/offboarding, maintain workforce records IT Team: Provision and de-provision access to PHI systems Supervisors: Monitor workforce compliance with PHI access policies Step-by-Step Procedure Workforce Authorization Determine the minimum PHI access required for the role (minimum necessary standard) Document authorized access levels in the role-based access matrix New workforce member completes HIPAA training before PHI access is granted IT provisions access based on the approved role profile Workforce member signs a confidentiality agreement Ongoing Supervision Supervisors monitor for inappropriate PHI access patterns IT Security runs monthly PHI access audit reports Privacy Officer investigates any anomalous access patterns Annual HIPAA training refresh is required to maintain access Workforce Termination HR notifies IT and Privacy Officer of the termination date IT revokes all PHI system access on or before the termination date Collect all devices, badges, and keys Verify access revocation within 24 hours Retain access logs for the required HIPAA retention period (6 years) Frequency / Schedule PHI access audit: Monthly Role-based access matrix review: Annually HIPAA training refresh: Annually Confidentiality agreement renewal: Annually Records &amp; Evidence Role-based access matrix HIPAA training records Signed confidentiality agreements PHI access audit reports Termination access revocation checklists Related Policy Workforce Security (HIPAA)$plain_69$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;


-- ============================================================================
-- Training Articles
-- ============================================================================

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'training'),
  'security-awareness-basics',
  'Security Awareness Basics',
  'Essential security practices every employee should know to protect organizational data and systems.',
  $body_70$<h2>Why Security Awareness Matters</h2>
<p>Cyber threats are increasingly targeting people, not just systems. Phishing, social engineering, and credential theft account for the majority of security breaches. Your awareness and actions are the first line of defense.</p>

<h2>Key Security Practices</h2>

<h3>1. Recognize Phishing</h3>
<p>Phishing emails try to trick you into clicking malicious links or sharing sensitive information. Watch for:</p>
<ul>
<li>Urgent language ("Your account will be suspended!")</li>
<li>Suspicious sender addresses (look-alike domains)</li>
<li>Requests for passwords, payment info, or personal data</li>
<li>Unexpected attachments</li>
</ul>

<h3>2. Use Strong Passwords</h3>
<p>Create unique passwords for each account. Use a password manager. Enable multi-factor authentication (MFA) wherever available.</p>

<h3>3. Lock Your Workstation</h3>
<p>Always lock your computer when stepping away (Windows: Win+L, Mac: Ctrl+Cmd+Q). Never leave sensitive information visible on screen.</p>

<h3>4. Report Suspicious Activity</h3>
<p>If you see something suspicious — an unusual email, unexpected system behavior, or someone asking for credentials — report it to IT immediately. Early reporting prevents breaches.</p>

<h3>5. Keep Software Updated</h3>
<p>Install updates when prompted. Updates patch security vulnerabilities that attackers exploit.</p>

<h2>Complete the Knowledge Check below to confirm your understanding.</h2>$body_70$,
  $plain_70$Why Security Awareness Matters Cyber threats are increasingly targeting people, not just systems. Phishing, social engineering, and credential theft account for the majority of security breaches. Your awareness and actions are the first line of defense. Key Security Practices 1. Recognize Phishing Phishing emails try to trick you into clicking malicious links or sharing sensitive information. Watch for: Urgent language ("Your account will be suspended!") Suspicious sender addresses (look-alike domains) Requests for passwords, payment info, or personal data Unexpected attachments 2. Use Strong Passwords Create unique passwords for each account. Use a password manager. Enable multi-factor authentication (MFA) wherever available. 3. Lock Your Workstation Always lock your computer when stepping away (Windows: Win+L, Mac: Ctrl+Cmd+Q). Never leave sensitive information visible on screen. 4. Report Suspicious Activity If you see something suspicious — an unusual email, unexpected system behavior, or someone asking for credentials — report it to IT immediately. Early reporting prevents breaches. 5. Keep Software Updated Install updates when prompted. Updates patch security vulnerabilities that attackers exploit. Complete the Knowledge Check below to confirm your understanding.$plain_70$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'training'),
  'data-handling-classification',
  'Data Handling & Classification',
  'Learn how to properly classify, handle, and protect different types of organizational data.',
  $body_71$<h2>Why Data Classification Matters</h2>
<p>Not all data is equal. Some information — like customer personal data or financial records — requires stricter protection than general business documents. Proper classification ensures the right level of protection is applied.</p>

<h2>Data Classification Levels</h2>
<ul>
<li><strong>Public:</strong> Information intended for public consumption (marketing materials, published content)</li>
<li><strong>Internal:</strong> General business information not intended for external sharing (meeting notes, internal memos)</li>
<li><strong>Confidential:</strong> Sensitive business data requiring access controls (financial reports, strategies, employee records)</li>
<li><strong>Restricted:</strong> Highly sensitive data with strict access controls (PII, PHI, credentials, legal documents)</li>
</ul>

<h2>Handling Guidelines</h2>
<h3>Storage</h3>
<p>Store confidential and restricted data only on approved, encrypted systems. Never store sensitive data on personal devices or unauthorized cloud services.</p>

<h3>Sharing</h3>
<p>Only share data with authorized individuals who need it for their role. Use encrypted channels for confidential and restricted data. Never email passwords or credentials in plain text.</p>

<h3>Disposal</h3>
<p>When data is no longer needed, dispose of it securely. Shred physical documents. Use secure deletion tools for digital files.</p>

<h2>Complete the Knowledge Check below to test your understanding.</h2>$body_71$,
  $plain_71$Why Data Classification Matters Not all data is equal. Some information — like customer personal data or financial records — requires stricter protection than general business documents. Proper classification ensures the right level of protection is applied. Data Classification Levels Public: Information intended for public consumption (marketing materials, published content) Internal: General business information not intended for external sharing (meeting notes, internal memos) Confidential: Sensitive business data requiring access controls (financial reports, strategies, employee records) Restricted: Highly sensitive data with strict access controls (PII, PHI, credentials, legal documents) Handling Guidelines Storage Store confidential and restricted data only on approved, encrypted systems. Never store sensitive data on personal devices or unauthorized cloud services. Sharing Only share data with authorized individuals who need it for their role. Use encrypted channels for confidential and restricted data. Never email passwords or credentials in plain text. Disposal When data is no longer needed, dispose of it securely. Shred physical documents. Use secure deletion tools for digital files. Complete the Knowledge Check below to test your understanding.$plain_71$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, category_id, slug, title, summary, content, content_plain,
  status, visibility, author_id, content_version, is_system, published_at
) VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM kb_categories WHERE organization_id = (SELECT id FROM organizations LIMIT 1) AND slug = 'training'),
  'password-authentication-best-practices',
  'Password & Authentication Best Practices',
  'How to create strong passwords, manage credentials securely, and use multi-factor authentication.',
  $body_72$<h2>The Importance of Strong Authentication</h2>
<p>Weak passwords and poor credential management are the leading cause of security breaches. Following authentication best practices significantly reduces your risk of account compromise.</p>

<h2>Creating Strong Passwords</h2>
<ul>
<li><strong>Length matters most:</strong> Use at least 12 characters. Longer is better.</li>
<li><strong>Mix character types:</strong> Combine uppercase, lowercase, numbers, and symbols.</li>
<li><strong>Avoid the obvious:</strong> No dictionary words, names, birthdates, or "password123".</li>
<li><strong>Use passphrases:</strong> A memorable phrase like "correct-horse-battery-staple" is stronger than "P@ssw0rd!".</li>
</ul>

<h2>Password Management</h2>
<ul>
<li><strong>Use a password manager:</strong> Generate and store unique passwords for every account.</li>
<li><strong>Never reuse passwords:</strong> One compromised password shouldn't unlock everything.</li>
<li><strong>Never share passwords:</strong> Not even with IT. Legitimate IT staff will never ask for your password.</li>
</ul>

<h2>Multi-Factor Authentication (MFA)</h2>
<p>MFA adds a second layer of security beyond your password. Even if someone steals your password, they can't access your account without the second factor.</p>
<ul>
<li><strong>Authenticator apps</strong> (preferred) — Microsoft Authenticator, Google Authenticator</li>
<li><strong>Hardware keys</strong> (most secure) — YubiKey, Titan Security Key</li>
<li><strong>SMS codes</strong> (better than nothing) — less secure due to SIM swapping risks</li>
</ul>

<h2>Complete the Knowledge Check below.</h2>$body_72$,
  $plain_72$The Importance of Strong Authentication Weak passwords and poor credential management are the leading cause of security breaches. Following authentication best practices significantly reduces your risk of account compromise. Creating Strong Passwords Length matters most: Use at least 12 characters. Longer is better. Mix character types: Combine uppercase, lowercase, numbers, and symbols. Avoid the obvious: No dictionary words, names, birthdates, or "password123". Use passphrases: A memorable phrase like "correct-horse-battery-staple" is stronger than "P@ssw0rd!". Password Management Use a password manager: Generate and store unique passwords for every account. Never reuse passwords: One compromised password shouldn't unlock everything. Never share passwords: Not even with IT. Legitimate IT staff will never ask for your password. Multi-Factor Authentication (MFA) MFA adds a second layer of security beyond your password. Even if someone steals your password, they can't access your account without the second factor. Authenticator apps (preferred) — Microsoft Authenticator, Google Authenticator Hardware keys (most secure) — YubiKey, Titan Security Key SMS codes (better than nothing) — less secure due to SIM swapping risks Complete the Knowledge Check below.$plain_72$,
  'published', 'public', '7f3e5a2e-0d85-42be-9d44-dfee6694f396', 1, true, NOW()
) ON CONFLICT (organization_id, slug) DO NOTHING;

