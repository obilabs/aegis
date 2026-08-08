-- Seed KB Articles for Public Knowledge Base

-- Insert sample public KB articles
INSERT INTO kb_articles (
  organization_id, title, slug, summary, content, content_plain, 
  category_id, status, visibility, is_published, published_at, view_count, helpful_count
)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  'How to Reset Your Password',
  'how-to-reset-password',
  'Step-by-step guide to reset your account password',
  '<h2>Resetting Your Password</h2>
<p>If you have forgotten your password, follow these steps:</p>
<ol>
<li>Go to the login page</li>
<li>Click "Forgot Password"</li>
<li>Enter your email address</li>
<li>Check your email for a reset link</li>
<li>Click the link and create a new password</li>
</ol>
<p><strong>Password Requirements:</strong></p>
<ul>
<li>At least 8 characters</li>
<li>One uppercase letter</li>
<li>One number</li>
<li>One special character</li>
</ul>',
  'Resetting Your Password. If you have forgotten your password, follow these steps: Go to the login page, Click Forgot Password, Enter your email address, Check your email for a reset link, Click the link and create a new password.',
  (SELECT id FROM kb_categories WHERE slug = 'getting-started' LIMIT 1),
  'published', 'public', true, NOW(), 150, 45
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, title, slug, summary, content, content_plain, 
  category_id, status, visibility, is_published, published_at, view_count, helpful_count
)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  'Submitting a Support Ticket',
  'submitting-support-ticket',
  'Learn how to submit a support ticket for IT assistance',
  '<h2>How to Submit a Support Ticket</h2>
<p>Need help from IT? Here is how to submit a ticket:</p>
<ol>
<li>Log in to the IT portal</li>
<li>Click "New Ticket" in the top navigation</li>
<li>Select a category that best describes your issue</li>
<li>Fill in the subject and description</li>
<li>Attach any relevant screenshots</li>
<li>Click "Submit"</li>
</ol>
<p><strong>Tips for faster resolution:</strong></p>
<ul>
<li>Be specific about the issue</li>
<li>Include error messages if any</li>
<li>Mention when the issue started</li>
</ul>',
  'How to Submit a Support Ticket. Need help from IT? Log in to the IT portal, Click New Ticket, Select a category, Fill in details, Attach screenshots, Click Submit.',
  (SELECT id FROM kb_categories WHERE slug = 'how-to' LIMIT 1),
  'published', 'public', true, NOW(), 230, 78
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, title, slug, summary, content, content_plain, 
  category_id, status, visibility, is_published, published_at, view_count, helpful_count
)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  'VPN Connection Troubleshooting',
  'vpn-troubleshooting',
  'Common VPN issues and how to resolve them',
  '<h2>VPN Troubleshooting Guide</h2>
<p>Having trouble connecting to the VPN? Try these solutions:</p>
<h3>1. Check Your Internet Connection</h3>
<p>Make sure you have a stable internet connection before connecting to VPN.</p>
<h3>2. Restart the VPN Client</h3>
<p>Close the VPN application completely and reopen it.</p>
<h3>3. Clear VPN Cache</h3>
<p>Go to Settings then Clear Cache in your VPN client.</p>
<h3>4. Update VPN Client</h3>
<p>Ensure you have the latest version installed.</p>
<h3>5. Contact IT Support</h3>
<p>If none of the above works, submit a ticket with the error message you are seeing.</p>',
  'VPN Troubleshooting Guide. Having trouble connecting to the VPN? Try these solutions: Check Your Internet Connection, Restart the VPN Client, Clear VPN Cache, Update VPN Client, Contact IT Support.',
  (SELECT id FROM kb_categories WHERE slug = 'troubleshooting' LIMIT 1),
  'published', 'public', true, NOW(), 420, 156
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, title, slug, summary, content, content_plain, 
  category_id, status, visibility, is_published, published_at, view_count, helpful_count
)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  'Setting Up Email on Mobile',
  'email-mobile-setup',
  'Configure your work email on iOS and Android devices',
  '<h2>Mobile Email Setup</h2>
<h3>For iPhone/iPad (iOS)</h3>
<ol>
<li>Go to Settings, then Mail, then Accounts</li>
<li>Tap "Add Account"</li>
<li>Select "Microsoft Exchange" or "Other"</li>
<li>Enter your work email and password</li>
<li>Follow the prompts to complete setup</li>
</ol>
<h3>For Android</h3>
<ol>
<li>Open the Gmail app or your email app</li>
<li>Tap the menu icon, then Settings, then Add account</li>
<li>Select "Exchange" or "Office 365"</li>
<li>Enter your work email and password</li>
<li>Accept any security prompts</li>
</ol>',
  'Mobile Email Setup. For iPhone/iPad: Go to Settings, Mail, Accounts, Add Account, Select Microsoft Exchange, Enter credentials. For Android: Open Gmail, Settings, Add account, Select Exchange, Enter credentials.',
  (SELECT id FROM kb_categories WHERE slug = 'how-to' LIMIT 1),
  'published', 'public', true, NOW(), 180, 62
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO kb_articles (
  organization_id, title, slug, summary, content, content_plain, 
  category_id, status, visibility, is_published, published_at, view_count, helpful_count
)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  'Frequently Asked Questions',
  'faq',
  'Answers to the most common IT questions',
  '<h2>IT Support FAQ</h2>
<h3>How do I request new software?</h3>
<p>Submit a service request ticket with the software name and business justification.</p>
<h3>How long does it take to get a response?</h3>
<p>We aim to respond to all tickets within 4 business hours. Critical issues are prioritized.</p>
<h3>Can I request a new laptop?</h3>
<p>Hardware requests require manager approval. Submit a request through the Hardware Request portal.</p>
<h3>How do I connect to the printer?</h3>
<p>Printers are automatically available when connected to the office network. For remote printing, use the Print Anywhere feature.</p>
<h3>Who do I contact for urgent issues?</h3>
<p>For critical issues affecting multiple users, call the IT hotline at extension 5555.</p>',
  'IT Support FAQ. How do I request new software? Submit a service request. How long for response? Within 4 business hours. Can I request a laptop? Requires manager approval. How to connect to printer? Automatic on office network.',
  (SELECT id FROM kb_categories WHERE slug = 'faqs' LIMIT 1),
  'published', 'public', true, NOW(), 890, 312
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- unified-auth-bootstrap: explain the account-registration model to admins.
INSERT INTO kb_articles (
  organization_id, title, slug, summary, content, content_plain,
  category_id, status, visibility, is_published, published_at, view_count, helpful_count
)
SELECT
  (SELECT id FROM organizations LIMIT 1),
  'How account registration works',
  'how-account-registration-works',
  'Who can create accounts, and how to let more people in.',
  '<h2>How account registration works</h2>
<p>To keep your workspace private, self-registration is closed by default.</p>
<h3>The first account</h3>
<p>The very first person to sign up on a new install becomes the <strong>owner (administrator)</strong>. After that, public self-registration closes automatically.</p>
<h3>Adding more people</h3>
<p>Once the workspace is claimed, there are two ways to add users:</p>
<ol>
<li><strong>Invite them.</strong> An admin creates the user in <em>Settings → Users</em>; the new person receives a one-time link to set their own password. Admins never see or set anyone''s password.</li>
<li><strong>Open specific email domains.</strong> In <em>Settings → Domains</em>, add a domain and tick <em>Allow self-registration</em>. People whose email address ends in that domain can then create their own account from the login page. Leave this off to stay invite-only.</li>
</ol>
<p>These controls apply to every Aegis platform, so the same rules govern who can get in wherever you deploy.</p>',
  'How account registration works. Self-registration is closed by default. The first person to sign up becomes the owner/administrator, then public signup closes. To add more people: invite them from Settings > Users (they get a one-time set-password link, admins never see passwords), or open specific email domains in Settings > Domains by ticking Allow self-registration. Leave domains off to stay invite-only.',
  (SELECT id FROM kb_categories WHERE slug = 'getting-started' LIMIT 1),
  'published', 'internal', true, NOW(), 0, 0
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Update category article counts
UPDATE kb_categories c SET article_count = (
  SELECT COUNT(*) FROM kb_articles a 
  WHERE a.category_id = c.id AND a.status = 'published'
);

SELECT 'KB articles seeded successfully' AS status;
SELECT COUNT(*) AS article_count FROM kb_articles WHERE visibility = 'public';
