import { pool } from '@/lib/db'

const CATEGORY_SLUG = 'aegis-admin-guide'
const CATEGORY_NAME = 'Aegis Admin Guide'
// Bump when article content (not just the article set) changes. Rows
// with an older content_version get updated on next seedSystemArticles
// call. Rows with matching content_version are left alone.
// Bumped to 10 (2026-08-16) for `msp-write-access-to-your-tickets`, added with
// the MSP write path. Existing installs pick it up via POST /api/admin/kb/reseed.
const CONTENT_VERSION = 11

interface SystemArticle {
  slug: string
  title: string
  summary: string
  content: string
  contentPlain: string
  /**
   * KB visibility. Defaults to 'internal' (staff-facing admin guide). Set to
   * 'authenticated' for help that END USERS must also see — e.g. articles that
   * explain a restriction the user just hit ("why can't I see this ticket").
   */
  visibility?: 'public' | 'authenticated' | 'internal'
}

const SYSTEM_ARTICLES: SystemArticle[] = [
  {
    slug: 'aegis-welcome',
    title: 'Welcome to Aegis',
    summary: 'Introduction to Aegis ITSM: key concepts, terminology, and how to get started.',
    content: `<h2>Welcome to Aegis</h2>
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
</ul>`,
    contentPlain: `Welcome to Aegis. Aegis is a self-hosted IT Service Management (ITSM) platform designed for organizations that want complete control over their IT operations, data, and support workflows. Key Concepts: Organization - Your company. Aegis is single-tenant: one installation serves one organization. Contacts - People records. Every person in the system is a contact. Users - Login accounts linked to contact records. Companies - External organizations you work with. Tickets - Work items including incidents, service requests, problems, and change requests. Knowledge Base - Articles that document procedures, policies, and solutions. The AI assistant uses these to answer questions. Getting Started: Follow the Recommended Setup Order to configure your instance step by step.`,
  },
  {
    slug: 'aegis-setup-order',
    title: 'Recommended Setup Order',
    summary: 'The optimal sequence for configuring Aegis after initial setup, with dependency explanations.',
    content: `<h2>Recommended Setup Order</h2>
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
</ul>`,
    contentPlain: `Recommended Setup Order. After completing the setup wizard, configure Aegis in this order: 1. General Settings - organization name, timezone, business hours. 2. Locations - physical offices and sites. 3. Departments - employee grouping for routing and visibility. 4. Job Titles - connect to entitlements for onboarding automation. 5. Companies - external organizations (customers, vendors, partners). 6. Roles and Permissions - review and customize the 6 default roles. 7. Users and Contacts - add employees, create user accounts, link customer contacts. 8. Ticket Configuration - categories and statuses. 9. Knowledge Base - create categories and articles. 10. AI Configuration - connect an AI provider. Why Order Matters: each step creates data that downstream steps reference. You cannot assign a contact to a department that does not exist yet.`,
  },
  {
    slug: 'aegis-contacts-users',
    title: 'Understanding Contacts & Users',
    summary: 'How people are modeled in Aegis: contacts, users, and the four contact types.',
    content: `<h2>Understanding Contacts &amp; Users</h2>
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
</ul>`,
    contentPlain: `Understanding Contacts and Users. Aegis separates the concept of a person (contact) from a login account (user). Not everyone who appears in your system needs to log in. Contacts: a contact is a person record with name, email, phone, contact type (employee, customer, vendor, partner), and optional links to company, department, job title, location, and manager. The Four Contact Types: Employee - works for your organization, has department and job title. Customer - at a client company, can submit tickets. Vendor - at a supplier, limited access. Partner - at a partner organization. Users: a user is a login account linked to a contact record, assigned a role that controls permissions. When to Create a User Account: Always for IT staff and admins. Usually for employees submitting tickets. Sometimes for customer contacts needing self-service. Rarely for vendor contacts.`,
  },
  {
    slug: 'aegis-companies',
    title: 'Company Management',
    summary: 'How to manage external organizations: customers, vendors, and partners.',
    content: `<h2>Company Management</h2>
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
</ul>`,
    contentPlain: `Company Management. In Aegis, a company represents an external organization you work with, including customers, vendors, and partners. Company Types: Customer - organizations you provide services to. Vendor - organizations that provide services to you. Partner - strategic alliance organizations. Prospect - potential customers. Internal - your own organization for multi-location setups. Single-Tenant Context: your Aegis installation serves one organization. Companies are external parties. Your employees are contacts, not a separate company. How Companies Connect: contacts belong to companies, assets can be associated with companies, tickets from customer contacts inherit the company association. Creating Companies: go to Companies in the main navigation or create inline when adding a contact.`,
  },
  {
    slug: 'aegis-dropdowns-philosophy',
    title: 'Controlled Vocabulary: Why Dropdowns',
    summary: 'Why Aegis uses dropdown selections instead of freetext for departments, locations, and other fields.',
    content: `<h2>Controlled Vocabulary: Why Dropdowns</h2>
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
</ul>`,
    contentPlain: `Controlled Vocabulary: Why Dropdowns. Fields like Department, Location, Job Title, and Category are dropdown selections rather than freetext. The Problem with Freetext: people type variations like IT, Information Technology, I.T., Tech - these all mean the same thing but the system treats them differently, destroying filtering, reporting, routing, and automation. The Solution: pre-defined dropdown lists that admins maintain, with a Create New option so users can add entries inline. What This Enables: accurate reporting (one canonical name per entity), AI understanding (entities not string guesses), onboarding automation (job titles match exactly), ticket routing (by ID not string), KB visibility (scoped to known entities). Managing Dropdown Lists: admins manage in Settings, most can be added inline from any form.`,
  },
  {
    slug: 'aegis-ticket-types',
    title: 'Ticket Types & Workflows',
    summary: 'The four default ticket types, status lifecycle, and SLA basics.',
    content: `<h2>Ticket Types &amp; Workflows</h2>
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
</ul>`,
    contentPlain: `Ticket Types and Workflows. Aegis ships with four ticket types: Incident (something broken, 1h response, 8h resolution), Service Request (need access/hardware/software, 2h response, 24h resolution), Problem (root cause investigation, 4h response, 7 day resolution), Change Request (planned change, 8h response, 28 day resolution). Status Lifecycle: New (just created) then Open (acknowledged) then In Progress (actively being resolved) then Pending (waiting for input, SLA pauses) then Resolved (fix applied) then Closed (confirmed). SLA Basics: response SLA is time to first response, resolution SLA is time to resolution, SLA pauses on pending statuses, SLA breach flags tickets for management. Custom Statuses: admins can create additional statuses mapped to base statuses (open, pending, closed) for SLA behavior.`,
  },
  {
    slug: 'aegis-roles-permissions',
    title: 'Roles & Permissions',
    summary: 'The six default roles and how permissions control access in Aegis.',
    content: `<h2>Roles &amp; Permissions</h2>
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
<li><strong>Capabilities</strong> &mdash; Specific actions: <code>triage</code> (manage the queue), <code>bulk_actions</code> (multi-ticket operations), <code>reports</code> (view dashboards), <code>settings</code> (system configuration), <code>user_management</code> (create/edit users and roles), <code>credentials</code> (view, reveal, and manage the credential vault).</li>
<li><strong>Admin Access</strong> &mdash; Full access to all settings and configuration. Only System Admin has this by default. Admins can always use the credential vault regardless of the <code>credentials</code> capability.</li>
</ul>

<h3>Custom Roles</h3>
<p>You can create additional roles with any combination of ticket access level and capabilities. Custom roles are useful for specialized positions like "Network Admin" (all ticket access + settings but no user management) or "Department Lead" (team access + reports).</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-contacts-users">Understanding Contacts &amp; Users</a></li>
<li><a href="/portal/kb/aegis-ticket-types">Ticket Types &amp; Workflows</a></li>
</ul>`,
    contentPlain: `Roles and Permissions. Every user in Aegis is assigned a role that controls what they can see and do. Default Roles: System Admin (all tickets, full capabilities including settings and user management), Helpdesk Admin (all tickets, triage/bulk/reports), Technician (team tickets), Manager (team tickets, reports), HR (own tickets, onboarding), End User (own tickets). Permission Components: Ticket Access (own, team, or all), Capabilities (triage, bulk_actions, reports, settings, user_management, credentials - access to the credential vault), Admin Access (full system settings; admins can always use the vault). By default the credentials capability is granted to System Admin and Technician. Custom Roles: create additional roles with any combination of access and capabilities.`,
  },
  {
    slug: 'aegis-feature-flags',
    title: 'Feature Flags Guide',
    summary: 'How to enable and manage optional features in Aegis.',
    content: `<h2>Feature Flags Guide</h2>
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
</ul>`,
    contentPlain: `Feature Flags Guide. Aegis includes optional features that can be enabled or disabled, letting you start simple and add complexity as needed. Feature Categories: Core (always enabled, tickets/contacts/KB), Standard (enabled by default, common ITSM features), Advanced (disabled by default, for mature IT operations), Enterprise (disabled by default, large-scale deployments), Experimental (disabled by default, in development). Stability Levels: Stable (production-ready), Beta (functional with rough edges), Alpha (early, may change significantly). How to Enable: go to Settings then Features, toggle switches. When to Enable: during initial setup, as you grow, after updates when new features may appear.`,
  },
  {
    slug: 'aegis-ai-setup',
    title: 'AI Assistant Setup',
    summary: 'How to configure an AI provider and enable the AI assistant in Aegis.',
    content: `<h2>AI Assistant Setup</h2>
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
</ul>`,
    contentPlain: `AI Assistant Setup. Aegis includes an AI assistant that helps users find answers and assists with ticket triage. The AI uses hybrid search to find relevant KB articles, tickets, and contacts based on access level. Supported Providers: Ollama (local, no data leaves your network), OpenAI (cloud-based GPT models), Google Gemini (cloud-based Gemini models). Configuration Steps: go to Settings then AI Configuration, select provider, enter credentials, select model, test connection, enable AI feature flag. Security Levels: end users access public articles only, technicians access public and internal, admins access everything including system documentation. How AI Uses Your KB: searches published articles and answers based on findings, says it does not have enough information rather than guessing. Best Practices: populate KB before enabling AI, write clear structured articles, mark sensitive procedures as internal.`,
  },
  {
    slug: 'aegis-kb-management',
    title: 'Knowledge Base Management',
    summary: 'Creating categories, writing articles, and managing your organization\'s knowledge base.',
    content: `<h2>Knowledge Base Management</h2>
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
</ul>`,
    contentPlain: `Knowledge Base Management. The Knowledge Base is where your organization's procedures, guides, and solutions live. Categories: organize articles into categories, can be nested, each can have visibility restrictions. Writing Articles: each has title, summary, content, category, and visibility. Visibility Levels: Public (all users), Authenticated (logged-in only), Internal (technicians and admins), Private (specific roles/departments/companies). Publishing Workflow: Draft then Review then Published. System Articles: pre-installed admin guides marked with a lock icon, cannot be deleted but can be unpublished. Tips: use descriptive titles, include step-by-step instructions, add summaries, link related articles, keep focused on one topic.`,
  },
  {
    slug: 'aegis-onboarding',
    title: 'Onboarding & Offboarding',
    summary: 'How Aegis automates employee onboarding and offboarding using job title entitlements.',
    content: `<h2>Onboarding &amp; Offboarding</h2>
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
</ul>`,
    contentPlain: `Onboarding and Offboarding. Aegis automates provisioning and deprovisioning when employees join or leave. How It Works: 1. Define entitlements per job title (software, hardware, access, groups). 2. Create a new employee contact with that job title. 3. System generates provisioning tasks assigned to service owners. 4. Track progress on the onboarding dashboard. Entitlement Types: Software (applications and licenses), Hardware (equipment), Access (system accounts, VPN), Group (distribution lists, Teams channels). Offboarding: deactivate contact, system generates deprovisioning tasks mirroring entitlements (revoke access, recover equipment, transfer knowledge). Service Owners: each entitlement has a default assignee responsible for provisioning that resource.`,
  },
  {
    slug: 'aegis-getting-help',
    title: 'Getting Help & Support',
    summary: 'Where to find help with Aegis: community resources, reporting bugs, and self-hosted responsibilities.',
    content: `<h2>Getting Help &amp; Support</h2>
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
</ul>`,
    contentPlain: `Getting Help and Support. Aegis is open-source under AGPL-3.0. Community Resources: GitHub Repository for source code and issues, documentation including admin guide articles, GitHub Discussions for questions and ideas. Reporting Bugs: check existing issues, create a new issue with steps to reproduce, expected and actual behavior, and your version. Feature Requests: open a GitHub Discussion in Ideas category, describe the problem and proposed solution. Self-Hosted Responsibilities: regular database backups and tested restore process, apply updates for security patches, keep server patched with HTTPS, monitor disk space and database performance and logs.`,
  },
  {
    slug: 'aegis-ai-search',
    title: 'How Aegis AI Search Works',
    summary: 'How hybrid search combines keyword matching and semantic understanding to find relevant content.',
    content: `<h2>How Aegis AI Search Works</h2>
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
</ul>`,
    contentPlain: `How Aegis AI Search Works. Aegis uses hybrid search combining two techniques: Full-Text Search (FTS) and Vector Search. FTS is traditional keyword matching using PostgreSQL text search, works immediately with no configuration, excellent for exact terms and error codes. Vector Search understands meaning not just keywords, finds results even when exact keywords do not match (e.g. laptop won't start finds Power Troubleshooting Guide), requires an embedding model configured in Settings AI. Hybrid Scoring uses Reciprocal Rank Fusion (RRF) to merge results from both methods, content ranking highly in both gets the highest score. What Gets Searched: KB Articles (title, summary, content) for all users, Tickets (subject, description) for technicians and admins, Contacts (name, email, notes) for admins and providers. Embedding Generation happens automatically in the background for existing and new content. Long articles are split into 500-token chunks. Graceful Degradation: without an embedding model, search uses FTS only and works out of the box. Adding an embedding model later is seamless. Results improve over time as more content is added and embedded.`,
  },
  {
    slug: 'aegis-doc-import',
    title: 'Importing Documents to Knowledge Base',
    summary: 'How to enable Docling for PDF/DOCX import and upload documents to the Knowledge Base.',
    content: `<h2>Importing Documents to Knowledge Base</h2>
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
</ul>`,
    contentPlain: `Importing Documents to Knowledge Base. Aegis can import PDF, DOCX, PPTX, and more using Docling, an optional open-source document extraction service. Enabling Docling: uncomment the docling service in docker-compose.yml, set DOCLING_URL in .env, run docker compose up. Requires approximately 2 GB of memory. Supported Formats: PDF (including scanned with OCR), DOCX, PPTX, XLSX, HTML, PNG, JPG. How to Import: go to KB Import, select a file (max 50 MB), Docling extracts text, content becomes draft KB articles, review and publish. Large Documents are automatically split into multiple articles following heading structure. After Import: articles are drafts with internal visibility, placed in Imported Documents category, embedding jobs queued if model configured. Troubleshooting: import button not visible means Docling not running, 503 error means Docling starting up or out of memory, poor text quality means try a cleaner scan.`,
  },
  {
    slug: 'aegis-ai-provider-setup',
    title: 'AI Provider Setup Guide',
    summary: 'Configuring Ollama, OpenAI, or Google Gemini as your AI provider, including embedding models.',
    content: `<h2>AI Provider Setup Guide</h2>
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
</ul>`,
    contentPlain: `AI Provider Setup Guide. Aegis supports multiple AI providers for chat and embeddings. Supported Providers: Ollama (local, models like mistral and nomic-embed-text), OpenAI (cloud, gpt-4o and text-embedding-3-small), Google Gemini (cloud, gemini-pro and text-embedding-004). Setting Up Ollama: install on same server, pull models, add provider in Settings AI Configuration with API URL. Advantages: no API costs, no data leaves network, no rate limits. Setting Up OpenAI: get API key from platform.openai.com, add provider with key. Setting Up Google Gemini: get API key from Google AI Studio, add provider. Understanding Embedding Models: convert text to vectors for semantic search, much smaller than chat models, a 274 MB local model provides excellent quality. Recommended Configurations: fully local (Ollama mistral + nomic-embed-text), best quality (OpenAI gpt-4o + text-embedding-3-small), hybrid (cloud chat + local embeddings), budget cloud (Gemini flash + text-embedding-004). Embedding Dimensions: 768 for nomic-embed-text, 1536 for text-embedding-3-small. When you configure embeddings, Aegis queues all existing content for processing in the background, new content is embedded automatically.`,
  },
  // ============================================================================
  // Policy & Compliance Admin Guides (v3)
  // ============================================================================
  {
    slug: 'aegis-policy-management',
    title: 'Policy & Procedure Management',
    summary: 'How to create, edit, publish, and manage policies and procedures in Aegis.',
    content: `<h2>Policy &amp; Procedure Management</h2>
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
</ul>`,
    contentPlain: `Policy & Procedure Management. Aegis includes a built-in policy and procedure system within the Knowledge Base. Policies are commitments (what the organization will do), Procedures are instructions (how to do it). Each policy has a paired procedure sharing the same slug pattern: policy-X pairs with procedure-X. Article types: standard, policy, procedure, training. Creating Policies: Navigate to Knowledge Base, create new article with type "Policy", add framework tags (soc2, nist-csf, itil4, hipaa, pci-dss, universal), set visibility, save as draft then publish. Aegis seeds 25 policies (published) and 25 procedures (drafts) on setup. Customize templates for your organization, then publish procedures. System-owned articles may receive content updates on Aegis upgrades. Publishing workflow: Draft, Published, Archived.`,
  },
  {
    slug: 'aegis-acknowledgment-tracking',
    title: 'Acknowledgment & Compliance Tracking',
    summary: 'How to require policy acknowledgments, target specific groups, and track compliance.',
    content: `<h2>Acknowledgment &amp; Compliance Tracking</h2>
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
</ul>`,
    contentPlain: `Acknowledgment & Compliance Tracking. Aegis lets you require employees to acknowledge policies. Enable "Requires Acknowledgment" on a policy to add it to users' pending list. Two deadline types: Fixed Date (specific date for all users) and Relative (acknowledgment_days from contact's start_date or created_at). If both are set, the earlier deadline is used. Target specific groups by setting Visible To Contact Groups and visibility to Private. Compliance metrics: Total Assigned, Acknowledged, Pending, Overdue, Compliance %. Overdue means the user's effective deadline has passed without acknowledgment. For relative deadlines, overdue is calculated per-user based on their start date.`,
  },
  {
    slug: 'aegis-soc2-guide',
    title: 'SOC 2 Compliance with Aegis',
    summary: 'How Aegis-seeded policies map to SOC 2 Trust Services Criteria and what to do next.',
    content: `<h2>SOC 2 Compliance with Aegis</h2>
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
</ul>`,
    contentPlain: `SOC 2 Compliance with Aegis. Maps Aegis-seeded policies to SOC 2 Trust Services Criteria. CC1 Control Environment: Information Security, Acceptable Use, Segregation of Duties. CC2 Communication: Data Classification, Security Awareness. CC3 Risk Assessment: Information Security, Vendor Management. CC4 Monitoring: Audit Trail, Network Security. CC5 Control Activities: Access Control, Change Management, Password Authentication. CC6 Logical & Physical Access: Access Control, Physical Security, Remote Access. CC7 System Operations: Incident Response, Backup Recovery, Network Security. CC8 Change Management: Change Management, Software Licensing. CC9 Risk Mitigation: Vendor Management, Backup Recovery. Also covers Availability, Confidentiality, Processing Integrity, and Privacy criteria. What you still need: customize policies, complete procedures, collect evidence, conduct risk assessments, train team, engage auditor. Recommended review cadence: policies annually, access reviews quarterly, vulnerability scanning monthly.`,
  },
  {
    slug: 'aegis-framework-tags',
    title: 'Compliance Framework Tags',
    summary: 'Reference guide for all compliance framework tags used in Aegis policies.',
    content: `<h2>Compliance Framework Tags</h2>
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
</ul>`,
    contentPlain: `Compliance Framework Tags. Aegis policies use framework tags to indicate which compliance standards they address. Available tags: soc2 (SOC 2 Trust Services Criteria for SaaS and service organizations), nist-csf (NIST Cybersecurity Framework for broad cybersecurity practices), itil4 (ITIL 4 IT Service Management for structured IT operations), hipaa (HIPAA for healthcare and PHI handling), pci-dss (PCI DSS for payment card security), universal (applies to all organizations). Tags are used for filtering policies, generating compliance reports, AI-assisted compliance queries, and gap analysis. Custom tags can be added (gdpr, iso27001, cmmc, fedramp).`,
  },
  {
    slug: 'aegis-first-30-minutes',
    title: 'First 30 Minutes with Aegis',
    summary: 'Quickstart walkthrough — from setup wizard to your first ticket, in 30 minutes.',
    content: `<h2>First 30 Minutes with Aegis</h2>
<p>A step-by-step quickstart so a new admin can go from freshly-installed Aegis to a working IT support portal in half an hour.</p>

<h3>Minute 0–5: Setup wizard</h3>
<p>The setup wizard runs on first boot. It asks you for four things:</p>
<ol>
<li><strong>Company profile</strong> — industry, team size, primary use case. Aegis uses this to recommend feature defaults.</li>
<li><strong>Features</strong> — which modules to enable (tickets, KB, assets, credential vault, contacts). You can change these later at <code>/portal/settings/features</code>.</li>
<li><strong>Telemetry &amp; Privacy</strong> — explicit choice: acknowledge default-on telemetry OR disable. Cannot be skipped. See the <a href="/portal/kb/aegis-telemetry-privacy">Telemetry &amp; Privacy</a> article.</li>
<li><strong>Finish</strong> — review and launch.</li>
</ol>

<h3>Minute 5–10: Configure email</h3>
<p>Password resets, notifications, and welcome emails all need SMTP. Go to <strong>Settings → Email</strong> and pick a provider:</p>
<ul>
<li><strong>Gmail Relay</strong> (recommended for Google Workspace) — see the <a href="/portal/kb/aegis-smtp-setup">SMTP / Email Setup</a> article.</li>
<li><strong>Resend, SES, SendGrid</strong> — API-key based. Fastest to set up.</li>
<li><strong>Custom SMTP</strong> — for on-prem mail relays.</li>
</ul>
<p>Click <strong>Test send</strong> after saving to verify. If it fails, check the <a href="/portal/kb/aegis-login-troubleshooting">troubleshooting guide</a>.</p>

<h3>Minute 10–15: Invite your first users</h3>
<p>Go to <strong>Settings → Users</strong> and click <strong>Invite user</strong>. Enter their email and pick a role. They receive an email OTP link; on click they set a password and land in the portal.</p>

<h3>Minute 15–20: Set up ticket statuses</h3>
<p>Aegis ships with 15 default statuses across three states (open / pending / closed). Go to <strong>Settings → Statuses</strong> to rename, add, or remove. See <a href="/portal/kb/aegis-ticket-types">Ticket Types &amp; Workflows</a>.</p>

<h3>Minute 20–25: Create your first ticket</h3>
<p>Have one of the invited users go to <code>/portal/new</code> and submit a test ticket. It should appear in your queue at <code>/portal/queue</code>. Reply to it, change its status, close it — verify the loop works.</p>

<h3>Minute 25–30: Explore the KB and AI chat</h3>
<p>Ask the AI chat something like <em>"how do I add a new ticket status?"</em> or <em>"what does the telemetry consent step do?"</em> — the AI should answer from the seeded KB articles (this one, and others). If it says <em>"I don't have that information"</em>, either the KB search index isn't warm or the article is missing — check <code>/portal/settings/ai</code>.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-setup-order">Recommended Setup Order</a></li>
<li><a href="/portal/kb/aegis-smtp-setup">SMTP / Email Setup</a></li>
<li><a href="/portal/kb/aegis-telemetry-privacy">Telemetry &amp; Privacy</a></li>
<li><a href="/portal/kb/aegis-login-troubleshooting">Login &amp; Access Troubleshooting</a></li>
</ul>`,
    contentPlain: `First 30 Minutes with Aegis. Step-by-step quickstart. Minute 0-5: complete the setup wizard (company profile, features, telemetry choice, finish). Minute 5-10: configure email at Settings → Email — pick Gmail Relay for Google Workspace, or Resend/SES/SendGrid for API-key providers, or custom SMTP. Test send after saving. Minute 10-15: invite first users at Settings → Users → Invite user. They get an email OTP link. Minute 15-20: set up ticket statuses at Settings → Statuses. Minute 20-25: create your first ticket at /portal/new to verify the workflow loop. Minute 25-30: explore KB and AI chat by asking a question. The AI answers from the seeded KB articles.`,
  },
  {
    slug: 'aegis-smtp-setup',
    title: 'SMTP / Email Setup',
    summary: 'Configure outbound email so password resets, notifications, and welcome messages actually send.',
    content: `<h2>SMTP / Email Setup</h2>
<p>Aegis sends outbound email for password resets, user invitations, ticket notifications, and admin alerts. Configure this at <strong>Settings → Email</strong> (admin-only).</p>

<h3>Choose a Provider</h3>
<p>Aegis ships with six built-in providers:</p>
<ul>
<li><strong>Gmail Relay</strong> — Google Workspace SMTP relay. Uses your own domain. Free. <em>Recommended for organizations already on Workspace.</em></li>
<li><strong>Gmail SMTP</strong> — Standard Gmail with app password. Sends from a personal Gmail account.</li>
<li><strong>Resend</strong> — Modern transactional email. Free tier covers small installs. API-key based.</li>
<li><strong>Amazon SES</strong> — AWS Simple Email Service. Cheapest at scale. Requires an AWS account.</li>
<li><strong>SendGrid</strong> — Twilio SendGrid. Enterprise deliverability. API-key based.</li>
<li><strong>Custom SMTP</strong> — Connect to any SMTP server (on-prem relay, Postfix, etc.).</li>
</ul>

<h3>Gmail Relay Setup (Recommended for Workspace)</h3>
<p>Gmail Relay has two auth modes:</p>
<ol>
<li><strong>Username + app password</strong> — Portable across container restarts. Use your Workspace email and a 16-character app password from Google Account → Security → App passwords.</li>
<li><strong>IP whitelist</strong> — No credentials. Allowlist this install's egress IP in your Workspace admin. See <a href="/portal/kb/aegis-egress-ip-whitelist">Egress IP &amp; IP Whitelist</a>.</li>
</ol>

<h3>Sender Identity</h3>
<p>Every provider needs a valid <strong>From address</strong>. This must be authorized by your sending domain (via SPF/DKIM records). Optional fields:</p>
<ul>
<li><strong>From name</strong> — Display name shown next to the from address (e.g., "Acme IT Support").</li>
<li><strong>Reply-To</strong> — Where replies go if different from the from address.</li>
</ul>

<h3>Test the Configuration</h3>
<p>After saving, click <strong>Test send</strong> at the top of the page. Aegis sends a test message to your logged-in admin email. Check your inbox. If the send fails:</p>
<ul>
<li>Confirm your credentials or IP whitelist entry.</li>
<li>Confirm your sending domain has valid SPF/DKIM records.</li>
<li>Check the container logs — see the <a href="/portal/kb/aegis-login-troubleshooting">troubleshooting guide</a>.</li>
</ul>

<h3>Encryption</h3>
<p>Provider credentials (app passwords, API keys) are encrypted at rest using AES-256-GCM with a key from the <code>AEGIS_SECRETS_KEY</code> environment variable. If you see "Failed to save email settings" without a clear reason, verify <code>AEGIS_SECRETS_KEY</code> is set — see <a href="/portal/kb/aegis-login-troubleshooting">troubleshooting</a>.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-egress-ip-whitelist">Egress IP &amp; IP Whitelist</a></li>
<li><a href="/portal/kb/aegis-login-troubleshooting">Login &amp; Access Troubleshooting</a></li>
<li><a href="/portal/kb/aegis-first-30-minutes">First 30 Minutes with Aegis</a></li>
</ul>`,
    contentPlain: `SMTP / Email Setup. Configure outbound email at Settings → Email (admin-only). Aegis sends email for password resets, user invitations, ticket notifications, and admin alerts. Six providers available: Gmail Relay (recommended for Google Workspace), Gmail SMTP (personal Gmail with app password), Resend (API key, modern transactional), Amazon SES (AWS, cheapest at scale), SendGrid (Twilio, enterprise deliverability), Custom SMTP (any SMTP server). Gmail Relay has two auth modes: username + app password (portable), or IP whitelist (no credentials, allowlist install's egress IP). Sender identity requires a valid From address authorized by SPF/DKIM. Test send verifies the configuration. Credentials are encrypted using AEGIS_SECRETS_KEY.`,
  },
  {
    slug: 'aegis-telemetry-privacy',
    title: 'Telemetry & Privacy',
    summary: 'How Aegis handles telemetry, what data is collected, and how to disable it — the consent-first policy per PRINCIPLES.md #2.',
    content: `<h2>Telemetry &amp; Privacy</h2>
<p>Aegis follows a <strong>consent-first telemetry policy</strong> (Principle 2 in <code>PRINCIPLES.md</code>). Every outbound phone-home is:</p>
<ul>
<li>Explicitly disclosed at install time (setup wizard, non-bypassable)</li>
<li>Disable-able from <strong>Settings → Telemetry &amp; Privacy</strong> (admin-only)</li>
<li>Override-able via a <code>TELEMETRY_ENABLED=false</code> environment variable</li>
<li>Recorded in an append-only consent log so every state change is traceable</li>
</ul>

<h3>What Aegis Sends</h3>
<p>When telemetry is enabled, Aegis sends periodic heartbeats to the ObiLabs control plane (default <code>https://api.obilabs.dev</code>). Three tiers exist:</p>
<ul>
<li><strong>Tier 0</strong> — Install ping. Instance ID, version, license key (if any). Sent once on setup.</li>
<li><strong>Tier 1</strong> — Setup snapshot. Industry, team size, primary use case, enabled features. One-time, opt-in.</li>
<li><strong>Tier 2</strong> — Usage heartbeat. Ranges (not exact counts) of user count, ticket volume, uptime, module adoption. Daily, opt-in.</li>
</ul>

<h3>What Aegis Does NOT Send</h3>
<ul>
<li>Ticket contents, KB article contents, credential vault contents.</li>
<li>User email addresses, names, phone numbers, IP addresses.</li>
<li>Company names, contact details, asset data.</li>
<li>Any personally identifying information.</li>
</ul>

<h3>The Consent Log</h3>
<p>At <strong>Settings → Telemetry &amp; Privacy</strong> you see:</p>
<ul>
<li>Current master state (on / off / env-overridden).</li>
<li>Consent Log — append-only history of every change (who, when, from where, previous → new state).</li>
<li>Payload viewer — literal next-send JSON with license key redacted. Confirms exactly what would leave the container if a heartbeat fired right now.</li>
</ul>

<h3>Disabling Telemetry</h3>
<p>Two ways:</p>
<ol>
<li><strong>In-app toggle</strong> — flip <strong>Send any telemetry</strong> to Off at <code>/portal/settings/telemetry</code>. Takes effect immediately.</li>
<li><strong>Environment variable</strong> — set <code>TELEMETRY_ENABLED=false</code> in <code>.env</code> and restart. This overrides the in-app setting; the UI shows an "Env override" badge and the toggle is disabled.</li>
</ol>

<p>Disabling telemetry doesn't affect anything else. Your license continues to work locally; the KB, tickets, and AI chat all keep functioning. The only difference is that the install stops phoning home.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-first-30-minutes">First 30 Minutes with Aegis</a></li>
<li>See also <a href="https://github.com/obilabs/aegis/blob/main/PRINCIPLES.md" target="_blank">PRINCIPLES.md #2</a> for the design rationale.</li>
</ul>`,
    contentPlain: `Telemetry and Privacy. Aegis follows a consent-first telemetry policy (Principle 2). Every outbound phone-home is explicitly disclosed at install time, disable-able from Settings → Telemetry & Privacy (admin-only), override-able via TELEMETRY_ENABLED=false environment variable, and recorded in an append-only consent log. Three tiers: Tier 0 install ping (instance ID, version, license key), Tier 1 setup snapshot (opt-in), Tier 2 usage heartbeat (daily, opt-in). Aegis does NOT send ticket contents, KB article contents, credential vault contents, user emails/names/phones/IPs, company names, contact details, asset data, or PII. To disable: toggle in Settings → Telemetry & Privacy, or set TELEMETRY_ENABLED=false in .env. Env var overrides UI setting.`,
  },
  {
    slug: 'aegis-egress-ip-whitelist',
    title: 'Egress IP & IP Whitelist',
    summary: 'How to find your install\'s public egress IP for allowlisting in Gmail Workspace or other services that require IP-based auth.',
    content: `<h2>Egress IP &amp; IP Whitelist</h2>
<p>Some outbound integrations — most commonly the Gmail SMTP relay — require IP-based authorization instead of a password. This article covers how to find your Aegis install's public egress IP and use it.</p>

<h3>When You Need Egress IP</h3>
<ul>
<li><strong>Gmail Workspace SMTP relay</strong> in IP whitelist mode (avoids storing an app password).</li>
<li><strong>Enterprise mail relays</strong> that filter by source IP.</li>
<li><strong>Third-party APIs</strong> that require an IP allowlist for machine-to-machine auth.</li>
</ul>

<h3>Finding Your Egress IP in Aegis</h3>
<p>Aegis has a built-in egress IP detector:</p>
<ol>
<li>Go to <strong>Settings → Email</strong>.</li>
<li>Pick <strong>Gmail Relay</strong> as the provider.</li>
<li>Click <strong>IP whitelist</strong> as the auth mode.</li>
<li>The panel auto-detects and displays the install's public IP via <code>api.ipify.org</code>. Click <strong>Copy</strong> to grab it.</li>
</ol>

<h3>Adding the IP to Google Workspace</h3>
<ol>
<li>In your Google Workspace admin console, go to <strong>Apps → Google Workspace → Gmail → Routing → SMTP relay</strong>.</li>
<li>Click <strong>Add another rule</strong> (or edit an existing one).</li>
<li>Under <strong>Allowed senders</strong>, choose <em>Only addresses in my domains</em>.</li>
<li>Under <strong>Authentication</strong>, check <strong>Only accept mail from the specified IP addresses</strong>.</li>
<li>Add a new IP range containing your Aegis egress IP.</li>
<li>Save. Wait a few minutes for propagation.</li>
</ol>

<h3>If the IP Changes</h3>
<p>Your egress IP is your Docker host's public IP. If your host moves (VPS migration, ISP change, DHCP renew), you'll need to re-detect and re-allowlist. Use the <strong>Refresh</strong> button in the same UI panel.</p>

<h3>Behind NAT / Load Balancer / VPN</h3>
<p>The panel calls <code>api.ipify.org</code> which returns the IP that Google (and everyone else) will see this install from. If your traffic goes through a NAT, proxy, or VPN, the IP shown here is the one Google sees — it's the correct value to paste.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-smtp-setup">SMTP / Email Setup</a></li>
<li><a href="/portal/kb/aegis-first-30-minutes">First 30 Minutes with Aegis</a></li>
</ul>`,
    contentPlain: `Egress IP & IP Whitelist. Some outbound integrations require IP-based authorization instead of a password. Common cases: Gmail Workspace SMTP relay in IP whitelist mode, enterprise mail relays that filter by source IP, third-party APIs requiring IP allowlist. To find your egress IP in Aegis: go to Settings → Email, pick Gmail Relay, click IP whitelist as the auth mode. The panel auto-detects and displays the install's public IP via api.ipify.org. Click Copy to grab it. To add to Google Workspace: Apps → Google Workspace → Gmail → Routing → SMTP relay, add rule with your egress IP under Allowed senders. If the IP changes (host moves), use the Refresh button. Behind NAT/VPN: the panel shows the IP Google will see, which is the correct value.`,
  },
  {
    slug: 'aegis-login-troubleshooting',
    title: 'Login & Access Troubleshooting',
    summary: 'Common login problems and how to fix them — password resets, stuck on "Signing in", 2FA recovery, admin bootstrap.',
    content: `<h2>Login &amp; Access Troubleshooting</h2>
<p>Common access problems and how to resolve them.</p>

<h3>"Signing in..." Stuck Button</h3>
<p>The login button shows <strong>"Signing in..."</strong> forever with no error message.</p>
<ul>
<li><strong>Cause</strong> — Better Auth rate limit hit (too many login attempts). The API returns 429 which the form doesn't surface.</li>
<li><strong>Fix</strong> — Wait 60–90 seconds. Try again. If it persists, reload the page and clear the form.</li>
</ul>

<h3>"Failed to save email settings"</h3>
<p>Saving the email provider config returns a generic error.</p>
<ul>
<li><strong>Cause</strong> — <code>AEGIS_SECRETS_KEY</code> environment variable not set or missing from the container. Credentials are encrypted at rest using this key.</li>
<li><strong>Fix</strong> — Generate a 32-byte hex key: <code>openssl rand -hex 32</code>. Add to <code>.env</code>: <code>AEGIS_SECRETS_KEY=&lt;the-64-char-hex-string&gt;</code>. Restart the client container: <code>docker compose up -d --force-recreate client</code>.</li>
</ul>

<h3>Password Reset — SMTP Not Configured</h3>
<p>User clicks "Forgot password" and nothing happens. No email arrives.</p>
<ul>
<li><strong>Cause</strong> — SMTP hasn't been configured yet. Password reset emails need a working sender.</li>
<li><strong>Fix</strong> — Configure SMTP at <strong>Settings → Email</strong>. See <a href="/portal/kb/aegis-smtp-setup">SMTP / Email Setup</a>.</li>
</ul>

<h3>Locked Out of Admin Account</h3>
<p>The only admin account has lost its password AND no SMTP was configured to reset it.</p>
<ul>
<li><strong>Fix</strong> — On the host, set <code>ADMIN_PASSWORD</code> in <code>.env</code> to a new value, then restart the client container. The seed script will re-hash the password for the existing admin user. Verify sign-in works, then unset <code>ADMIN_PASSWORD</code> from <code>.env</code> to return to setup-wizard mode.</li>
</ul>

<h3>Fresh Install: /portal/dashboard Serves Cached Content</h3>
<p>After completing the setup wizard, the dashboard shows the pre-setup state.</p>
<ul>
<li><strong>Cause</strong> — Next.js middleware cache serving stale prerendered content.</li>
<li><strong>Fix</strong> — Restart the client container: <code>docker compose restart client</code>. If the issue persists, force-recreate: <code>docker compose up -d --force-recreate client</code>.</li>
</ul>

<h3>2FA Recovery</h3>
<p>User can't log in because they lost their 2FA device.</p>
<ul>
<li><strong>Fix</strong> — An admin can disable 2FA for the user at <strong>Settings → Users → [User] → Reset 2FA</strong>. The user will be prompted to re-enroll on next login.</li>
</ul>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-smtp-setup">SMTP / Email Setup</a></li>
<li><a href="/portal/kb/aegis-first-30-minutes">First 30 Minutes with Aegis</a></li>
</ul>`,
    contentPlain: `Login & Access Troubleshooting. "Signing in..." stuck button: Better Auth rate limit hit, wait 60-90 seconds. "Failed to save email settings": AEGIS_SECRETS_KEY environment variable not set, generate with openssl rand -hex 32 and restart client container. Password reset with no email arriving: SMTP not configured, set up at Settings → Email. Locked out of admin account: set ADMIN_PASSWORD in .env, restart container, seed script re-hashes password. Fresh install dashboard shows pre-setup state: Next.js cache, restart client container. 2FA recovery: admin can reset 2FA at Settings → Users → [User] → Reset 2FA, user re-enrolls on next login.`,
  },
  {
    slug: 'aegis-msp-pairing-visibility',
    title: 'What Your Paired MSPs Can See',
    summary: 'Exactly what a paired managed service provider (MSP) can and cannot see about your tickets — the polling model, what a full ticket-open reveals, and why internal notes stay private by default.',
    content: `<h2>What Your Paired MSPs Can See</h2>
<p>When you pair an external managed service provider (MSP) with your Aegis install, you hand them a scoped <strong>pairing key</strong> so their tooling (Aegis MTP) can help work your tickets. This article explains — in plain terms you can show an auditor — exactly what that pairing key exposes, and what it does not.</p>

<h3>Two levels of visibility</h3>
<p>An MSP sees your tickets through two different channels, and it is worth understanding the difference:</p>
<ul>
<li><strong>Headline polling (the list view).</strong> Every few minutes the MSP's tooling asks your install for a summary of recent tickets. That summary is <em>headlines only</em>: the subject, ticket number, status, priority, who it's assigned to, the SLA countdown, a triage score, the queue it sits in, and a short <strong>redacted preview</strong> of the body. The preview is capped at 200 characters and automatically strips out email addresses and phone numbers before it ever leaves your server. Full ticket bodies are <strong>never</strong> sent in the poll, and the MSP's side is contractually forbidden from storing anything beyond these headlines.</li>
<li><strong>Just-in-time detail (opening a ticket).</strong> When an MSP technician actually <em>opens</em> one of your tickets, their tool fetches the full detail on demand — the complete body, the activity thread, and a read-only preview of linked assets. This is fetched fresh each time and is <strong>not</strong> cached on the MSP's side. Crucially, opening a ticket this way requires the technician's identity to be asserted on every request, so your audit log records <em>which</em> MSP tech looked at <em>which</em> ticket and <em>when</em>.</li>
</ul>

<h3>Internal notes stay with the MSP that wrote them</h3>
<p>If you work with more than one MSP, the boundary between them matters. Aegis enforces a <strong>default-closed</strong> rule (internally we call it D8): an internal note written by one MSP is <strong>not</strong> visible to a different MSP, even if a ticket is later handed off between them. Only public replies and structural events (a status change, an assignment, a queue move) cross that boundary automatically. Private, tech-to-tech commentary does not.</p>
<p>You can choose to open that boundary — per pair of MSPs — if you want two providers to collaborate with full transparency. But you have to turn that on deliberately; the safe default is that each MSP's internal notes remain their own.</p>

<h3>What an MSP can never see</h3>
<ul>
<li>Tickets outside the queues their pairing key is scoped to (once queue scoping is enabled on your install).</li>
<li>Full ticket bodies in the routine poll — only the redacted 200-character preview travels in the summary.</li>
<li>Another MSP's private internal notes, unless you explicitly enable cross-MSP sharing for that pair.</li>
<li>Anything at all, the moment you revoke their pairing key — revocation is immediate and cascades to every credential their firm holds.</li>
</ul>

<h3>Reviewing and controlling pairing scope</h3>
<p>You stay in control of every pairing. To review what a given MSP is scoped to, go to <strong>Settings → Queues</strong> (<code>/portal/settings/queues</code>), where you can see each pairing, the queues it can reach, and whether it holds read-only or write access. From your pairing management screen you can extend, narrow, or revoke a key at any time. Because every detail-open is attributed to a named technician, you can also produce, on demand, a record proving that an MSP only ever saw what you granted — which is exactly the evidence a compliance reviewer asks for.</p>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-roles-permissions">Roles &amp; Permissions</a></li>
<li><a href="/portal/kb/aegis-soc2-guide">SOC 2 Evidence in Aegis</a></li>
</ul>`,
    contentPlain: `What Your Paired MSPs Can See. When you pair an external MSP with your Aegis install you give them a scoped pairing key so their tooling (Aegis MTP) can help work your tickets. Two levels of visibility: 1) Headline polling (list view) - every few minutes the MSP tool asks for a summary of recent tickets. That summary is headlines only: subject, ticket number, status, priority, assignee, SLA countdown, triage score, queue, and a redacted 200-character body preview that strips email addresses and phone numbers before leaving your server. Full bodies are never in the poll and the MSP cannot store more than headlines. 2) Just-in-time detail (opening a ticket) - when a technician opens a ticket their tool fetches the full body, activity thread, and read-only linked-asset preview on demand, fresh each time, not cached. Opening a ticket requires the technician identity to be asserted so your audit log records which MSP tech saw which ticket and when. Internal notes stay with the MSP that wrote them: Aegis enforces a default-closed rule (D8) - an internal note written by one MSP is not visible to a different MSP even after a hand-off. Only public replies and structural events (status change, assignment, queue move) cross that boundary. You can enable cross-MSP sharing per pair deliberately. What an MSP can never see: tickets outside their scoped queues, full bodies in the routine poll, another MSP's private internal notes unless you enable sharing, or anything after you revoke their key (revocation is immediate and cascades). Reviewing scope: go to Settings -> Queues (/portal/settings/queues) to see each pairing, the queues it can reach, and read-only vs write access. You can extend, narrow, or revoke a key any time. Because every detail-open is attributed to a named technician you can produce proof that an MSP only saw what you granted - the evidence a compliance reviewer asks for.`,
  },
  {
    slug: 'aegis-ticket-visibility',
    title: 'Who Can See Which Tickets',
    summary: 'Why you might not see a ticket, how ticket visibility is scoped by your role, and how to request access.',
    // authenticated: end users must be able to read this when they hit a "not
    // found" on a ticket they can't access — it explains the restriction.
    visibility: 'authenticated',
    content: `<h2>Who Can See Which Tickets</h2>
<p>Aegis scopes tickets to your role, so you only see the tickets you are meant to work with. If a ticket you expected is missing from a list, a search, or the AI assistant &mdash; or a link returns &ldquo;not found&rdquo; &mdash; it is almost always because it falls outside your access level, not because it was deleted.</p>

<h3>The three access levels</h3>
<ul>
<li><strong>Own</strong> &mdash; You see tickets you created or that are assigned to you. This is the default for end users.</li>
<li><strong>Team</strong> &mdash; You see your own tickets plus tickets assigned to a team you belong to. This is the default for technicians.</li>
<li><strong>All</strong> &mdash; You see every ticket in the organization. This is for admins and managers.</li>
</ul>
<p>Your access level comes from your role. An administrator sets it under <strong>Settings &rarr; Roles &amp; Permissions</strong> (the <em>ticket access</em> setting on each role).</p>

<h3>The AI assistant follows the same rules</h3>
<p>The AI chat can only surface tickets you are already allowed to see. Asking the assistant about a ticket outside your access level will not reveal it &mdash; the assistant is bound by exactly the same scoping as the ticket list and the ticket page. This is deliberate: the AI is never a way around ticket permissions.</p>

<h3>How to request access</h3>
<ol>
<li>If you need a specific ticket, ask the assignee or your team lead to add you as a collaborator, assign it to you, or reply with the information you need.</li>
<li>If you regularly need broader access (for example, you have joined the help desk), ask an administrator to review your role's <em>ticket access</em> level under Settings &rarr; Roles &amp; Permissions.</li>
<li>If you believe you should already have access and do not, contact an administrator &mdash; your role or team membership may need to be corrected.</li>
</ol>

<h3>Related Articles</h3>
<ul>
<li><a href="/portal/kb/aegis-roles-permissions">Roles &amp; Permissions</a></li>
<li><a href="/portal/kb/aegis-ticket-types">Ticket Types &amp; Workflows</a></li>
</ul>`,
    contentPlain: `Who Can See Which Tickets. Aegis scopes tickets to your role, so you only see the tickets you are meant to work with. If a ticket you expected is missing from a list, a search, or the AI assistant - or a link returns "not found" - it is almost always because it falls outside your access level, not because it was deleted. The three access levels: Own - you see tickets you created or that are assigned to you (default for end users). Team - you see your own tickets plus tickets assigned to a team you belong to (default for technicians). All - you see every ticket in the organization (admins and managers). Your access level comes from your role, set by an administrator under Settings > Roles & Permissions (the ticket access setting on each role). The AI assistant follows the same rules: the AI chat can only surface tickets you are already allowed to see. Asking the assistant about a ticket outside your access level will not reveal it - the assistant is bound by exactly the same scoping as the ticket list and the ticket page. The AI is never a way around ticket permissions. How to request access: 1) If you need a specific ticket, ask the assignee or your team lead to add you as a collaborator, assign it to you, or reply with the information you need. 2) If you regularly need broader access, ask an administrator to review your role's ticket access level under Settings > Roles & Permissions. 3) If you believe you should already have access and do not, contact an administrator - your role or team membership may need to be corrected.`,
  },
  {
    slug: 'aegis-deploy-secrets',
    title: 'Deploying Without Hand-Crafting Secrets',
    summary: 'How Aegis auto-generates and persists its master crypto keys — what to put in .env, and what you MUST back up.',
    // Operator/admin-facing — keep it internal (staff only).
    visibility: 'internal',
    content: `<h2>Deploying Without Hand-Crafting Secrets</h2>
<p>Aegis is designed to deploy with a minimal <code>.env</code>. You do <strong>not</strong> need to hand-craft cryptographic keys. On first boot, any master key you leave out of the environment is generated as a strong random value and saved to a key file, then reused on every subsequent boot.</p>

<h3>What goes in .env</h3>
<ul>
<li><strong>URLs</strong> &mdash; <code>NEXT_PUBLIC_APP_URL</code> and <code>BETTER_AUTH_URL</code> (how users reach the instance). These you set.</li>
<li><strong>Master crypto keys</strong> &mdash; <code>BETTER_AUTH_SECRET</code>, <code>CREDENTIAL_ENCRYPTION_KEY</code>, <code>AEGIS_SECRETS_KEY</code>. Leave them blank and they are auto-generated. Set them only if you want to pin, rotate, or inject them from a secret manager &mdash; an explicit value always wins.</li>
<li><strong>Admin login</strong> &mdash; not in <code>.env</code>. You create the first admin (and its password) in the browser via the setup wizard.</li>
<li><strong>Integrations</strong> (SMTP, AI provider keys) &mdash; set in <strong>Settings</strong>, encrypted at rest.</li>
</ul>

<h3>The one thing you MUST back up</h3>
<p>Auto-generated keys live in <code>./data/secrets/</code> (bind-mounted into the container at <code>AEGIS_SECRETS_DIR</code>). <strong>Back this directory up together with the rest of <code>./data</code>.</strong> Losing <code>CREDENTIAL_ENCRYPTION_KEY</code> makes every stored credential permanently unreadable; losing <code>BETTER_AUTH_SECRET</code> logs everyone out. These are not stored in the database (a master key can't live inside the data it encrypts), so a database backup alone does not capture them.</p>

<h3>File-permissions note</h3>
<p>If the startup log warns that the secrets directory is not writable, the keys can't persist and would be regenerated on each restart (logging everyone out repeatedly). Fix it on the host by pre-creating the directory owned by the app user: <code>mkdir -p ./data/secrets &amp;&amp; chown 1001:1001 ./data/secrets</code>, then restart.</p>

<h3>Rotating a key</h3>
<p>Set the corresponding environment variable to the new value (it overrides the file), or replace the file in <code>./data/secrets/</code>. Rotating <code>CREDENTIAL_ENCRYPTION_KEY</code> after credentials have been stored requires re-encrypting them &mdash; plan for it.</p>`,
    contentPlain: `Deploying Without Hand-Crafting Secrets. Aegis deploys with a minimal .env; you do not hand-craft crypto keys. On first boot any master key left out of the environment is generated as a strong random value, saved to a key file, and reused on every subsequent boot. What goes in .env: URLs (NEXT_PUBLIC_APP_URL, BETTER_AUTH_URL) you set. Master crypto keys (BETTER_AUTH_SECRET, CREDENTIAL_ENCRYPTION_KEY, AEGIS_SECRETS_KEY) leave blank to auto-generate; set only to pin/rotate/inject (explicit value always wins). Admin login is not in .env - create the first admin and password in the setup wizard. Integrations (SMTP, AI keys) are set in Settings, encrypted at rest. MUST back up: auto-generated keys live in ./data/secrets/ (AEGIS_SECRETS_DIR). Back this directory up with the rest of ./data. Losing CREDENTIAL_ENCRYPTION_KEY makes stored credentials permanently unreadable; losing BETTER_AUTH_SECRET logs everyone out. They are not in the database, so a DB backup alone does not capture them. Permissions: if startup warns the secrets dir is not writable, keys cannot persist and regenerate each restart; fix on the host with mkdir -p ./data/secrets && chown 1001:1001 ./data/secrets then restart. Rotating: set the env var to the new value or replace the file; rotating CREDENTIAL_ENCRYPTION_KEY after credentials exist requires re-encrypting them.`,
  },
  {
    slug: 'msp-write-access-to-your-tickets',
    title: 'Letting your MSP reply to tickets (and how to see what they did)',
    // 'authenticated' rather than 'internal': this explains a change your own
    // staff and end users will SEE in ticket threads — replies authored by
    // someone who is not in your user list. An article that explains a
    // surprise belongs where the surprised person can read it.
    visibility: 'authenticated',
    summary:
      'How an external MSP gets permission to comment on and update your tickets, what they can and cannot do, and where every one of their actions is recorded.',
    content: `<h2>Letting your MSP reply to tickets</h2>
<p>If you have paired this installation with an external IT provider (an MSP), you can let their technicians work on your tickets directly &mdash; replying, changing status, and assigning &mdash; without giving anyone a shared login.</p>

<h3>You grant it, and you can take it back</h3>
<p>Write access is a <strong>scope on the pairing key</strong>, called <code>tickets:write</code>. When you issue a pairing key in <em>Settings &rarr; API Keys</em> (choose the MTP pairing key type), you choose whether to include it.</p>
<ul>
<li><strong>Without it</strong>, the MSP can read tickets and nothing else. Every write is refused by the server, not merely hidden in their interface.</li>
<li><strong>With it</strong>, their technicians can comment, change status, and assign.</li>
<li>You can remove just the write scope and leave the pairing in place &mdash; you do not have to disconnect the MSP to stop them writing.</li>
</ul>

<h3>Every action names a specific human</h3>
<p>The pairing key identifies the <em>firm</em>. It is never enough on its own to write. Each individual write must also carry the email address of the specific technician performing it, which their portal supplies from that person's own signed-in session &mdash; it cannot be typed in or forged by hand. A write that arrives without it is rejected.</p>
<p>This is why "the MSP updated your ticket" never appears in your history. You see which person did it.</p>

<h3>Public replies vs internal notes</h3>
<p>MSP technicians can write two different things, and the difference matters:</p>
<ul>
<li>A <strong>public reply</strong> is part of the conversation. The requester sees it.</li>
<li>An <strong>internal note</strong> is staff-only working commentary. The requester never sees it.</li>
</ul>
<p>Which one it is must be stated explicitly on every write &mdash; there is no default. A note from one MSP is also hidden from any <em>other</em> MSP you have paired, unless you have deliberately opted them into sharing.</p>

<h3>Where to look afterwards</h3>
<p>Nothing an MSP does is invisible:</p>
<ul>
<li>Their replies appear in the ticket thread, attributed to the technician who wrote them.</li>
<li>Status and assignment changes appear in the ticket's history with the acting technician recorded.</li>
<li>Every write is recorded in the audit log, including the API call that carried it.</li>
</ul>
<p>All of this is written in the same database transaction as the change itself, so a change can never exist without its audit trail.</p>

<h3>What an MSP still cannot do</h3>
<ul>
<li>Reassign a ticket to anyone outside your organization.</li>
<li>Delete tickets or replies.</li>
<li>Change ticket routing directly &mdash; that goes through an escalation request, not a field edit.</li>
<li>Act at all after you revoke the pairing, which also disables the accounts they provisioned here.</li>
</ul>

<h3>Turning it off</h3>
<p>Remove the <code>tickets:write</code> scope from the pairing key to stop writes while keeping reporting. Revoke the key entirely to end the relationship &mdash; that cascade also removes the credentials and accounts issued underneath it.</p>`,
    contentPlain: `Letting your MSP reply to tickets. If you paired this installation with an external IT provider (MSP), you can let their technicians reply to, re-status, and assign your tickets without sharing a login. You grant it and can take it back: write access is a scope on the pairing key called tickets:write, chosen when you issue the key in Settings > API Keys (MTP pairing key type). Without it the MSP can read only, and every write is refused server-side, not just hidden in their UI. With it they can comment, change status, and assign. You can remove just the write scope and leave the pairing in place. Every action names a specific human: the pairing key identifies the firm and is never sufficient alone; each write must carry the email of the specific technician, supplied by their portal from that person's signed-in session, so it cannot be typed or forged. Writes without it are rejected. Public replies vs internal notes: a public reply is part of the conversation and the requester sees it; an internal note is staff-only and the requester never sees it. Which one must be stated explicitly on every write - there is no default. One MSP's internal notes are hidden from any other paired MSP unless you opt them into sharing. Where to look afterwards: replies appear in the ticket thread attributed to the technician; status and assignment changes appear in ticket history with the acting technician; every write is recorded in the audit log. All written in the same transaction as the change, so a change cannot exist without its audit trail. What an MSP still cannot do: reassign outside your organization, delete tickets or replies, change routing directly (escalation only), or act at all after you revoke the pairing, which also disables accounts they provisioned. Turning it off: remove tickets:write to stop writes while keeping reporting; revoke the key to end the relationship, cascading to credentials and accounts issued underneath it.`,
  },
]

/**
 * Seeds system articles for a new organization.
 * Idempotent: uses ON CONFLICT (organization_id, slug) DO NOTHING.
 */
export async function seedSystemArticles(orgId: string): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Create the system category if it does not exist
    const categoryResult = await client.query(
      `INSERT INTO kb_categories (organization_id, name, slug, description, is_internal, is_system, icon)
       VALUES ($1, $2, $3, $4, true, true, '📖')
       ON CONFLICT (organization_id, slug) DO NOTHING
       RETURNING id`,
      [orgId, CATEGORY_NAME, CATEGORY_SLUG, 'Pre-installed admin documentation for setting up and managing Aegis.']
    )

    // Get category ID (either just inserted or existing)
    let categoryId: string
    if (categoryResult.rows.length > 0) {
      categoryId = categoryResult.rows[0].id
    } else {
      const existing = await client.query(
        'SELECT id FROM kb_categories WHERE organization_id = $1 AND slug = $2',
        [orgId, CATEGORY_SLUG]
      )
      categoryId = existing.rows[0].id
    }

    // Insert all system articles. ON CONFLICT DO UPDATE lets us update
    // article content when CONTENT_VERSION bumps — critical for fixing
    // documentation errors on already-seeded installs (e.g., the
    // "Portal → Users" → "Settings → Users" fix from 2026-07-05).
    // Non-system articles (is_system=false, user-authored) are never
    // touched — the WHERE clause prevents overwrite of custom content.
    for (const article of SYSTEM_ARTICLES) {
      await client.query(
        `INSERT INTO kb_articles (
          organization_id, title, slug, summary, content, content_plain,
          category_id, status, visibility, is_published, published_at,
          is_system, content_version, view_count, helpful_count, not_helpful_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', $8, true, NOW(), true, $9, 0, 0, 0)
        ON CONFLICT (organization_id, slug) DO UPDATE SET
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          content = EXCLUDED.content,
          content_plain = EXCLUDED.content_plain,
          content_version = EXCLUDED.content_version,
          updated_at = NOW()
        WHERE kb_articles.is_system = true
          AND kb_articles.content_version < EXCLUDED.content_version`,
        [orgId, article.title, article.slug, article.summary, article.content, article.contentPlain, categoryId, article.visibility || 'internal', CONTENT_VERSION]
      )
    }

    // Update category article count
    await client.query(
      `UPDATE kb_categories SET article_count = (
        SELECT COUNT(*) FROM kb_articles WHERE category_id = $1 AND status = 'published'
      ) WHERE id = $1`,
      [categoryId]
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Upgrades system articles to a new content version.
 * Only updates articles where content_version < CONTENT_VERSION.
 * Call this from future migrations when article content changes.
 */
export async function upgradeSystemArticles(orgId: string): Promise<number> {
  const client = await pool.connect()
  let updated = 0
  try {
    await client.query('BEGIN')

    const categoryResult = await client.query(
      'SELECT id FROM kb_categories WHERE organization_id = $1 AND slug = $2',
      [orgId, CATEGORY_SLUG]
    )
    if (categoryResult.rows.length === 0) {
      // Category does not exist yet — run full seed instead
      await client.query('ROLLBACK')
      client.release()
      await seedSystemArticles(orgId)
      return SYSTEM_ARTICLES.length
    }

    const categoryId = categoryResult.rows[0].id

    for (const article of SYSTEM_ARTICLES) {
      const result = await client.query(
        `UPDATE kb_articles
         SET title = $3, summary = $4, content = $5, content_plain = $6,
             category_id = $7, content_version = $8, updated_at = NOW()
         WHERE organization_id = $1 AND slug = $2
           AND is_system = true AND content_version < $8
         RETURNING id`,
        [orgId, article.slug, article.title, article.summary, article.content, article.contentPlain, categoryId, CONTENT_VERSION]
      )
      if (result.rows.length > 0) updated++
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  return updated
}
