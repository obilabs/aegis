import { pool } from '@/lib/db'

const CATEGORY_SLUG = 'policies-and-procedures'
const CATEGORY_NAME = 'Policies & Procedures'
const CONTENT_VERSION = 1

interface PolicyArticle {
  slug: string
  title: string
  summary: string
  content: string
  contentPlain: string
  tags: string[]
}

// ============================================================================
// Universal Policies (~15 articles)
// These apply to all organizations regardless of industry.
// ============================================================================

const UNIVERSAL_POLICIES: PolicyArticle[] = [
  {
    slug: 'policy-acceptable-use',
    title: 'Acceptable Use Policy',
    summary: 'Rules for using company technology, internet, and email responsibly.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Acceptable Use Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> PR.AC (Access Control), PR.AT (Awareness & Training) | <strong>SOC2:</strong> CC6.1, CC6.8 | <strong>ITIL 4:</strong> Information Security Management</p>`,
    contentPlain: `Acceptable Use Policy. Purpose: defines acceptable and unacceptable use of company technology resources. Policy: resources are for business purposes, reasonable personal use is permitted. Do not use for illegal activities, harassment, or unauthorized access. Only install approved software. Never share login credentials. Communications may be monitored. Your Responsibilities: use technology professionally, report misuse to IT, lock your workstation, keep software updated. Compliance References: NIST CSF 2.0 PR.AC, PR.AT. SOC2 CC6.1, CC6.8. ITIL 4 Information Security Management.`,
  },
  {
    slug: 'policy-password-authentication',
    title: 'Password & Authentication Policy',
    summary: 'Requirements for creating strong passwords and protecting your account access.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Password &amp; Authentication Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> PR.AC-1 (Identities & Credentials), PR.AC-7 (Authentication) | <strong>SOC2:</strong> CC6.1, CC6.2, CC6.3 | <strong>ITIL 4:</strong> Information Security Management</p>`,
    contentPlain: `Password & Authentication Policy. Purpose: establishes requirements for password strength and account protection. Policy: passwords must be at least 12 characters with mix of letters, numbers, symbols. Passphrases encouraged. Do not reuse passwords. Enable MFA on all accounts that support it. Do not share passwords or store in unencrypted files. Use the approved password manager. Service accounts follow same requirements. Your Responsibilities: create strong unique passwords, enable MFA, use password manager, report compromised credentials immediately. Compliance References: NIST CSF 2.0 PR.AC-1, PR.AC-7. SOC2 CC6.1, CC6.2, CC6.3. ITIL 4 Information Security Management.`,
  },
  {
    slug: 'policy-information-security',
    title: 'Information Security Policy',
    summary: 'How we protect company information and the role everyone plays in keeping data safe.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Information Security Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> GV.OC (Organizational Context), PR.DS (Data Security) | <strong>SOC2:</strong> CC3.1, CC6.1 | <strong>ITIL 4:</strong> Information Security Management, Risk Management</p>`,
    contentPlain: `Information Security Policy. Purpose: outlines approach to protecting company information assets. Policy: handle information according to classification level. Access follows least privilege principle. Report security incidents immediately. All devices must have antivirus and full-disk encryption. Do not transfer data to personal devices or unapproved services. Your Responsibilities: protect information based on sensitivity, report incidents, keep devices secure, use only approved tools. Compliance References: NIST CSF 2.0 GV.OC, PR.DS. SOC2 CC3.1, CC6.1. ITIL 4 Information Security Management, Risk Management.`,
  },
  {
    slug: 'policy-data-classification',
    title: 'Data Classification Policy',
    summary: 'How to identify and handle different types of company information.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Data Classification Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> ID.AM-5 (Information Classification), PR.DS-1 (Data-at-Rest Protection) | <strong>SOC2:</strong> CC6.1, CC6.7 | <strong>ITIL 4:</strong> Information Security Management</p>`,
    contentPlain: `Data Classification Policy. Purpose: defines how information is categorized and handled. Classifications: Public (no restrictions), Internal (employees only, do not post externally), Confidential (need-to-know basis, encrypt in transit and at rest), Restricted (strict access controls, always encrypted, logged access). Your Responsibilities: apply correct classification, handle according to level, classify higher when in doubt. Compliance References: NIST CSF 2.0 ID.AM-5, PR.DS-1. SOC2 CC6.1, CC6.7.`,
  },
  {
    slug: 'policy-incident-response',
    title: 'Incident Response Policy',
    summary: 'What to do when you discover or suspect a security incident.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Incident Response Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> RS.AN (Analysis), RS.CO (Communication), RS.MI (Mitigation) | <strong>SOC2:</strong> CC7.2, CC7.3, CC7.4 | <strong>ITIL 4:</strong> Incident Management, Problem Management</p>`,
    contentPlain: `Incident Response Policy. Purpose: defines how security incidents are reported, assessed, and handled. Policy: a security incident threatens confidentiality, integrity, or availability. Report all suspected incidents immediately. Do not attempt to fix yourself. Preserve evidence. IT will assess severity, contain, investigate, remediate, and document. Incidents with regulated data may trigger notification requirements. Your Responsibilities: report immediately, provide detail, follow instructions, do not discuss outside response team. Compliance References: NIST CSF 2.0 RS.AN, RS.CO, RS.MI. SOC2 CC7.2, CC7.3, CC7.4. ITIL 4 Incident Management, Problem Management.`,
  },
  {
    slug: 'policy-access-control',
    title: 'Access Control Policy',
    summary: 'How access to systems and data is granted, reviewed, and revoked.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Access Control Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> PR.AC-1 (Account Management), PR.AC-4 (Access Permissions) | <strong>SOC2:</strong> CC6.1, CC6.2, CC6.3 | <strong>ITIL 4:</strong> Access Management, Information Security Management</p>`,
    contentPlain: `Access Control Policy. Purpose: governs how access is granted, managed, and revoked. Policy: least privilege principle. Access requests through IT service desk. Manager approval for confidential systems. Quarterly access reviews. Role changes require access adjustment. Departing employees lose access within 24 hours. Your Responsibilities: request access through proper channels, report unneeded access, do not share credentials, notify IT of role changes. Compliance References: NIST CSF 2.0 PR.AC-1, PR.AC-4. SOC2 CC6.1, CC6.2, CC6.3. ITIL 4 Access Management.`,
  },
  {
    slug: 'policy-change-management',
    title: 'Change Management Policy',
    summary: 'How changes to IT systems and infrastructure are planned, approved, and implemented.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Change Management Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> PR.IP-3 (Configuration Change Control) | <strong>SOC2:</strong> CC8.1 | <strong>ITIL 4:</strong> Change Enablement</p>`,
    contentPlain: `Change Management Policy. Purpose: ensures changes are planned, tested, approved, and documented. Policy: all production changes via Change Requests. Include what, why, affected systems, implementation plan, rollback plan, risk assessment. Classifications: Standard (pre-approved), Normal (requires review), Emergency (bypasses review, requires post-mortem). Test in non-production when possible. Failed changes must be rolled back. Your Responsibilities: submit change requests, include rollback plans, test before production, communicate to affected users. Compliance References: NIST CSF 2.0 PR.IP-3. SOC2 CC8.1. ITIL 4 Change Enablement.`,
  },
  {
    slug: 'policy-backup-recovery',
    title: 'Backup & Recovery Policy',
    summary: 'How company data is backed up and how to request a recovery.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Backup &amp; Recovery Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> PR.IP-4 (Backups), RC.RP-1 (Recovery Planning) | <strong>SOC2:</strong> A1.2, A1.3 | <strong>ITIL 4:</strong> Service Continuity Management</p>`,
    contentPlain: `Backup & Recovery Policy. Purpose: defines how data is backed up and recovered. Policy: critical data backed up automatically. Backups stored offsite or in cloud. Backup integrity tested quarterly via test restore. RTO and RPO defined per system. Users must save files to approved storage locations. Your Responsibilities: use company-approved storage, submit ticket for recovery with file name and date, report data loss immediately. Compliance References: NIST CSF 2.0 PR.IP-4, RC.RP-1. SOC2 A1.2, A1.3. ITIL 4 Service Continuity Management.`,
  },
  {
    slug: 'policy-remote-access-byod',
    title: 'Remote Access & BYOD Policy',
    summary: 'Rules for working remotely and using personal devices for company work.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Remote Access &amp; BYOD Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> PR.AC-3 (Remote Access), PR.PT-3 (Communications Protection) | <strong>SOC2:</strong> CC6.1, CC6.6, CC6.7</p>`,
    contentPlain: `Remote Access & BYOD Policy. Purpose: defines requirements for remote access and personal device use. Policy: use approved VPN for remote access. Personal devices must have current OS, encryption, screen lock, antivirus. Company data only in approved applications. Report lost/stolen devices immediately. IT may remotely wipe company data from personal devices. No public Wi-Fi without VPN. Your Responsibilities: use VPN, keep devices secure, report lost devices, no local storage of company data. Compliance References: NIST CSF 2.0 PR.AC-3, PR.PT-3. SOC2 CC6.1, CC6.6, CC6.7.`,
  },
  {
    slug: 'policy-physical-security',
    title: 'Physical Security Policy',
    summary: 'Protecting physical access to offices, server rooms, and equipment.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Physical Security Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> PR.AC-2 (Physical Access), PR.PT-1 (Physical Protection) | <strong>SOC2:</strong> CC6.4, CC6.5</p>`,
    contentPlain: `Physical Security Policy. Purpose: protects physical access to facilities and equipment. Policy: valid badge required for office access, no tailgating. Server rooms require additional authorization. Visitors must sign in and be escorted. Equipment must be secured when unattended. Sensitive documents must be shredded. Report unauthorized access or suspicious persons. Your Responsibilities: wear badge visibly, challenge unknown persons, lock workstation and secure equipment, shred sensitive documents. Compliance References: NIST CSF 2.0 PR.AC-2, PR.PT-1. SOC2 CC6.4, CC6.5.`,
  },
  {
    slug: 'policy-network-security',
    title: 'Network Security Policy',
    summary: 'How company networks are protected and what users need to know.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Network Security Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> PR.PT-4 (Network Architecture), DE.CM-1 (Network Monitoring) | <strong>SOC2:</strong> CC6.6, CC7.1, CC7.2</p>`,
    contentPlain: `Network Security Policy. Purpose: defines security for company network infrastructure. Policy: only authorized devices on corporate network. Network traffic monitored. Do not bypass security controls. Enterprise encryption required. No unauthorized access points or VPN tunnels. Your Responsibilities: connect only company devices, use guest network for personal, do not bypass controls, report issues. Compliance References: NIST CSF 2.0 PR.PT-4, DE.CM-1. SOC2 CC6.6, CC7.1, CC7.2.`,
  },
  {
    slug: 'policy-vendor-management',
    title: 'Vendor & Third-Party Management Policy',
    summary: 'How we evaluate, engage, and monitor third-party vendors and service providers.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Vendor &amp; Third-Party Management Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> GV.SC (Supply Chain Risk Management) | <strong>SOC2:</strong> CC9.2 | <strong>ITIL 4:</strong> Supplier Management</p>`,
    contentPlain: `Vendor & Third-Party Management Policy. Purpose: governs vendor selection, engagement, and monitoring. Policy: vendors accessing company data must undergo security assessment. Contracts must include data protection, incident notification, audit rights. Annual vendor reviews. Vendor access follows least privilege and is logged. Access revoked and data returned/destroyed at end of relationship. Your Responsibilities: notify IT before granting vendor access, ensure contracts include security provisions, report vendor security concerns. Compliance References: NIST CSF 2.0 GV.SC. SOC2 CC9.2. ITIL 4 Supplier Management.`,
  },
  {
    slug: 'policy-security-awareness',
    title: 'Security Awareness Policy',
    summary: 'Everyone\'s role in keeping our organization secure, including training requirements.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Security Awareness Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> PR.AT-1 (Awareness & Training) | <strong>SOC2:</strong> CC1.4, CC2.2 | <strong>ITIL 4:</strong> Information Security Management</p>`,
    contentPlain: `Security Awareness Policy. Purpose: establishes that all employees share security responsibility. Policy: complete training within 30 days of hire and annually. Topics include phishing, passwords, data handling, social engineering, incident reporting. Failure to complete may restrict access. IT may conduct simulated phishing exercises. Report suspicious activity without fear of repercussion. Your Responsibilities: complete training on time, stay vigilant, report suspicious activity, apply security principles daily. Compliance References: NIST CSF 2.0 PR.AT-1. SOC2 CC1.4, CC2.2.`,
  },
  {
    slug: 'policy-asset-management',
    title: 'IT Asset Management Policy',
    summary: 'How company IT equipment and software is tracked, maintained, and disposed of.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>IT Asset Management Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> ID.AM (Asset Management) | <strong>SOC2:</strong> CC6.1, CC6.4 | <strong>ITIL 4:</strong> IT Asset Management, Service Configuration Management</p>`,
    contentPlain: `IT Asset Management Policy. Purpose: governs IT asset lifecycle from procurement to disposal. Policy: all assets registered with assigned owner. Assets tagged and tracked. Transfers must be recorded. Software licenses tracked for compliance. End-of-life assets securely disposed. Report lost/stolen immediately. Your Responsibilities: care for equipment, return when leaving, report loss/theft, no unauthorized software. Compliance References: NIST CSF 2.0 ID.AM. SOC2 CC6.1, CC6.4. ITIL 4 IT Asset Management.`,
  },
  {
    slug: 'policy-software-licensing',
    title: 'Software Licensing & Installation Policy',
    summary: 'Rules for installing, using, and managing software on company devices.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Software Licensing &amp; Installation Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> PR.IP-1 (Baseline Configuration), PR.IP-12 (Vulnerability Management) | <strong>SOC2:</strong> CC6.1, CC8.1</p>`,
    contentPlain: `Software Licensing & Installation Policy. Purpose: ensures all software is properly licensed, approved, and secure. Policy: only IT-approved software. No pirated or unlicensed software. Open-source reviewed before installation. Keep software up to date. Browser extensions must be approved. Report unused software. Your Responsibilities: request software through IT, keep updated, report unused licenses, no unauthorized installs. Compliance References: NIST CSF 2.0 PR.IP-1, PR.IP-12. SOC2 CC6.1, CC8.1.`,
  },
]

// ============================================================================
// Industry-Specific Policies (~10 articles)
// Tagged with industry identifiers for filtering.
// ============================================================================

const INDUSTRY_POLICIES: PolicyArticle[] = [
  {
    slug: 'policy-hipaa-phi-handling',
    title: 'Protected Health Information (PHI) Handling',
    summary: 'How to identify, handle, and protect Protected Health Information under HIPAA.',
    tags: ['hipaa', 'healthcare', 'nist-csf'],
    content: `<h2>Protected Health Information (PHI) Handling</h2>

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
<p><strong>HIPAA:</strong> Privacy Rule (45 CFR 164.502), Security Rule (45 CFR 164.312) | <strong>NIST CSF 2.0:</strong> PR.DS-1, PR.DS-2, PR.AC-4</p>`,
    contentPlain: `Protected Health Information Handling. Purpose: requirements for handling PHI under HIPAA. PHI includes names linked to medical records, diagnoses, treatment plans, insurance information. Must be accessed only by authorized individuals. Must be encrypted in transit and at rest. No unencrypted email or unapproved services. Physical documents in locked cabinets, shredded when done. All access logged and auditable. Your Responsibilities: access only when required, use approved systems, report exposure, secure physical documents. Compliance: HIPAA Privacy Rule 45 CFR 164.502, Security Rule 45 CFR 164.312.`,
  },
  {
    slug: 'policy-hipaa-breach-notification',
    title: 'HIPAA Breach Notification Procedures',
    summary: 'What happens when a breach of Protected Health Information is discovered.',
    tags: ['hipaa', 'healthcare', 'nist-csf'],
    content: `<h2>HIPAA Breach Notification Procedures</h2>

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
<p><strong>HIPAA:</strong> Breach Notification Rule (45 CFR 164.400-414) | <strong>NIST CSF 2.0:</strong> RS.CO-2, RS.CO-3</p>`,
    contentPlain: `HIPAA Breach Notification Procedures. Purpose: defines procedures for PHI breach identification and response. A breach is unauthorized access, use, or disclosure of PHI. Report to Privacy Officer and IT Security within 24 hours. Assessment determines what PHI, who affected, actual access, risk mitigation. 500+ individuals: notify HHS and media within 60 days. Notify affected individuals in writing within 60 days. Document all breaches with root cause and corrective actions. Your Responsibilities: report immediately, cooperate with investigation, preserve evidence. Compliance: HIPAA Breach Notification Rule 45 CFR 164.400-414.`,
  },
  {
    slug: 'policy-hipaa-business-associate',
    title: 'Business Associate Management (HIPAA)',
    summary: 'Requirements for managing vendors and partners who access health information.',
    tags: ['hipaa', 'healthcare'],
    content: `<h2>Business Associate Management</h2>

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
<p><strong>HIPAA:</strong> Business Associate Requirements (45 CFR 164.502, 164.504) | <strong>NIST CSF 2.0:</strong> GV.SC</p>`,
    contentPlain: `Business Associate Management. Purpose: managing third parties that access PHI. BAA required before any vendor accesses PHI. BAAs specify uses, safeguards, breach notification, data handling. Business Associates must demonstrate compliance via SOC2 or HITRUST. Annual review. Subcontractors must also have BAAs. Your Responsibilities: no PHI sharing without BAA, report compliance concerns. Compliance: HIPAA 45 CFR 164.502, 164.504.`,
  },
  {
    slug: 'policy-pci-cardholder-data',
    title: 'Cardholder Data Protection Policy',
    summary: 'How to handle, process, and protect payment card data in compliance with PCI DSS.',
    tags: ['pci-dss', 'finance', 'retail'],
    content: `<h2>Cardholder Data Protection Policy</h2>

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
<p><strong>PCI DSS:</strong> Requirement 3 (Protect Stored Data), Requirement 4 (Encrypt Transmissions) | <strong>NIST CSF 2.0:</strong> PR.DS-1, PR.DS-2</p>`,
    contentPlain: `Cardholder Data Protection Policy. Purpose: protect payment card data per PCI DSS. Only process through PCI-compliant systems. Never store full card numbers anywhere. Use last four digits only. Encrypt in transit with TLS 1.2+. Restricted access to payment systems. Inspect POS devices for tampering. Your Responsibilities: never record full card numbers, use approved systems only, report suspicious activity, no cardholder data via insecure channels. Compliance: PCI DSS Requirements 3, 4.`,
  },
  {
    slug: 'policy-pci-cryptography',
    title: 'Cryptography & Data Transmission Policy',
    summary: 'Encryption standards for protecting sensitive data in transit and at rest.',
    tags: ['pci-dss', 'finance', 'nist-csf'],
    content: `<h2>Cryptography &amp; Data Transmission Policy</h2>

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
<p><strong>PCI DSS:</strong> Requirement 2.3, Requirement 4 | <strong>NIST CSF 2.0:</strong> PR.DS-1, PR.DS-2, PR.DS-5</p>`,
    contentPlain: `Cryptography & Data Transmission Policy. Purpose: encryption standards for sensitive data. All data in transit must use TLS 1.2+. Data at rest encrypted with AES-256. Formal key management process. Annual key rotation. No self-signed certificates in production. Wi-Fi must use WPA3 or WPA2-Enterprise. Your Responsibilities: use HTTPS, do not bypass encryption warnings, report certificate errors. Compliance: PCI DSS Requirements 2.3, 4. NIST CSF 2.0 PR.DS-1, PR.DS-2, PR.DS-5.`,
  },
  {
    slug: 'policy-audit-trail',
    title: 'Audit Trail & Logging Policy',
    summary: 'What activities are logged, how logs are protected, and audit requirements.',
    tags: ['soc2', 'finance', 'nist-csf'],
    content: `<h2>Audit Trail &amp; Logging Policy</h2>

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
<p><strong>NIST CSF 2.0:</strong> DE.AE (Anomalies & Events), DE.CM (Continuous Monitoring) | <strong>SOC2:</strong> CC7.1, CC7.2, CC7.3</p>`,
    contentPlain: `Audit Trail & Logging Policy. Purpose: requirements for logging, log protection, and audit compliance. All sensitive system access logged including authentication, privilege escalation, data access, configuration changes. Logs include timestamp, user, action, target, outcome. Retention: 12 months accessible, 3 years archived. Logs protected from tampering with append-only storage. Regular review and automated alerting. Audit logs must never be deleted or modified. Your Responsibilities: understand activities are logged, do not circumvent logging. Compliance: NIST CSF 2.0 DE.AE, DE.CM. SOC2 CC7.1, CC7.2, CC7.3.`,
  },
  {
    slug: 'policy-segregation-of-duties',
    title: 'Segregation of Duties Policy',
    summary: 'How critical functions are divided among different people to prevent fraud and errors.',
    tags: ['soc2', 'finance'],
    content: `<h2>Segregation of Duties Policy</h2>

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
<p><strong>SOC2:</strong> CC3.4, CC5.2 | <strong>NIST CSF 2.0:</strong> PR.AC-4</p>`,
    contentPlain: `Segregation of Duties Policy. Purpose: no single individual controls all aspects of critical processes. Critical processes divided among multiple people. Requester cannot approve their own request. Financial transactions need separate preparer and approver. System admins cannot approve own access changes. Small teams use compensating controls. Your Responsibilities: respect approval workflows, report concerns. Compliance: SOC2 CC3.4, CC5.2. NIST CSF 2.0 PR.AC-4.`,
  },
  {
    slug: 'policy-records-retention',
    title: 'Records Retention Policy',
    summary: 'How long different types of business records must be kept and how they are disposed of.',
    tags: ['soc2', 'finance', 'government'],
    content: `<h2>Records Retention Policy</h2>

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
<p><strong>SOC2:</strong> CC6.5, CC9.1 | <strong>NIST CSF 2.0:</strong> PR.IP-6 (Destruction of Data)</p>`,
    contentPlain: `Records Retention Policy. Purpose: minimum retention periods and disposal procedures. Financial and tax records: 7 years. Employee records: employment duration + 7 years. Contracts: contract duration + 6 years. Security logs: 3 years. Audit reports: 7 years. Do not destroy records under legal hold. Electronic records securely deleted. Physical records shredded. Your Responsibilities: use company storage, do not destroy early, contact Legal for litigation holds. Compliance: SOC2 CC6.5, CC9.1.`,
  },
  {
    slug: 'policy-foia-records',
    title: 'Public Records & FOIA Compliance',
    summary: 'How public records requests are handled in compliance with freedom of information laws.',
    tags: ['government'],
    content: `<h2>Public Records &amp; FOIA Compliance</h2>

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
<p><strong>FOIA:</strong> 5 U.S.C. 552 (federal) / state equivalents | <strong>NIST CSF 2.0:</strong> GV.OC (Organizational Context)</p>`,
    contentPlain: `Public Records & FOIA Compliance. Purpose: managing public records and FOIA requests. All official communications are potentially subject to records requests. Records maintained per retention schedule. FOIA requests forwarded to Records Officer within 1 business day. Track response deadlines. Redact exempt information before disclosure. Log all requests and responses. Your Responsibilities: forward requests to Records Officer, maintain records, use official accounts for business. Compliance: FOIA 5 U.S.C. 552.`,
  },
  {
    slug: 'policy-hipaa-workforce-security',
    title: 'Workforce Security (HIPAA)',
    summary: 'Ensuring that all workforce members with access to health information are authorized and trained.',
    tags: ['hipaa', 'healthcare'],
    content: `<h2>Workforce Security</h2>

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
<p><strong>HIPAA:</strong> Security Rule 45 CFR 164.308(a)(3) (Workforce Security), 45 CFR 164.308(a)(5) (Security Awareness & Training)</p>`,
    contentPlain: `Workforce Security (HIPAA). Purpose: ensure all workforce members with ePHI access are authorized and trained. HIPAA training required before ePHI access. Access based on role with minimum necessary standard. Violations subject to disciplinary action. Terminated members lose access immediately. Annual refresher training required. Contractors and temps subject to same requirements. Your Responsibilities: complete training, access minimum necessary, complete annual refresher. Compliance: HIPAA Security Rule 45 CFR 164.308(a)(3), 164.308(a)(5).`,
  },
]

const ALL_POLICIES = [...UNIVERSAL_POLICIES, ...INDUSTRY_POLICIES]

/**
 * Seeds policy articles for a new organization.
 * Idempotent: uses ON CONFLICT (organization_id, slug) DO NOTHING.
 */
export async function seedPolicyArticles(orgId: string): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Create the Policies & Procedures category
    const categoryResult = await client.query(
      `INSERT INTO kb_categories (organization_id, name, slug, description, is_system, icon)
       VALUES ($1, $2, $3, $4, true, '🛡️')
       ON CONFLICT (organization_id, slug) DO NOTHING
       RETURNING id`,
      [orgId, CATEGORY_NAME, CATEGORY_SLUG, 'Company policies covering security, compliance, and operational procedures.']
    )

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

    // Insert all policy articles
    for (const article of ALL_POLICIES) {
      await client.query(
        `INSERT INTO kb_articles (
          organization_id, title, slug, summary, content, content_plain,
          category_id, status, visibility, is_published, published_at,
          is_system, content_version, article_type, tags,
          requires_acknowledgment, view_count, helpful_count, not_helpful_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', 'authenticated', true, NOW(),
          true, $8, 'policy', $9::varchar[],
          true, 0, 0, 0)
        ON CONFLICT (organization_id, slug) DO NOTHING`,
        [orgId, article.title, article.slug, article.summary, article.content, article.contentPlain,
         categoryId, CONTENT_VERSION, article.tags]
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
 * Upgrades policy articles to a new content version.
 * Only updates articles where content_version < CONTENT_VERSION.
 */
export async function upgradePolicyArticles(orgId: string): Promise<number> {
  const client = await pool.connect()
  let updated = 0
  try {
    await client.query('BEGIN')

    const categoryResult = await client.query(
      'SELECT id FROM kb_categories WHERE organization_id = $1 AND slug = $2',
      [orgId, CATEGORY_SLUG]
    )
    if (categoryResult.rows.length === 0) {
      await client.query('ROLLBACK')
      client.release()
      await seedPolicyArticles(orgId)
      return ALL_POLICIES.length
    }

    const categoryId = categoryResult.rows[0].id

    for (const article of ALL_POLICIES) {
      const result = await client.query(
        `UPDATE kb_articles
         SET title = $3, summary = $4, content = $5, content_plain = $6,
             category_id = $7, content_version = $8, tags = $9::varchar[],
             updated_at = NOW()
         WHERE organization_id = $1 AND slug = $2
           AND is_system = true AND content_version < $8
         RETURNING id`,
        [orgId, article.slug, article.title, article.summary, article.content, article.contentPlain,
         categoryId, CONTENT_VERSION, article.tags]
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
