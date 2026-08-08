import { pool } from '@/lib/db'

const CATEGORY_SLUG = 'policies-and-procedures'
const CATEGORY_NAME = 'Policies & Procedures'
const CONTENT_VERSION = 1

interface ProcedureArticle {
  slug: string
  title: string
  summary: string
  content: string
  contentPlain: string
  tags: string[]
}

// ============================================================================
// Universal Procedures (~15 articles)
// Each pairs with a universal policy by slug convention:
//   policy-X → procedure-X
// ============================================================================

const UNIVERSAL_PROCEDURES: ProcedureArticle[] = [
  {
    slug: 'procedure-acceptable-use',
    title: 'Acceptable Use Procedure',
    summary: 'Step-by-step procedures for enforcing and complying with the Acceptable Use Policy.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Acceptable Use Procedure</h2>

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
<p><a href="/portal/kb/policy-acceptable-use">Acceptable Use Policy</a></p>`,
    contentPlain: 'Acceptable Use Procedure. Step-by-step procedures for enforcing and complying with the Acceptable Use Policy. Covers new employee onboarding acknowledgment, software installation requests, and violation reporting procedures. Includes roles, frequency, and records requirements.',
  },
  {
    slug: 'procedure-password-authentication',
    title: 'Password & Authentication Procedure',
    summary: 'How to create, manage, and reset passwords; MFA enrollment steps.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Password &amp; Authentication Procedure</h2>

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
<p><a href="/portal/kb/policy-password-authentication">Password &amp; Authentication Policy</a></p>`,
    contentPlain: 'Password & Authentication Procedure. How to create strong passwords, enroll in MFA, and handle password resets. Covers password complexity, authenticator app setup, reset procedures, and compliance with NIST 800-63B guidelines.',
  },
  {
    slug: 'procedure-information-security',
    title: 'Information Security Procedure',
    summary: 'Operational procedures for implementing the Information Security Policy.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Information Security Procedure</h2>

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
<p><a href="/portal/kb/policy-information-security">Information Security Policy</a></p>`,
    contentPlain: 'Information Security Procedure. Operational procedures for risk assessments, vulnerability scanning, security incident reporting, and penetration testing. Defines roles, schedules, and evidence requirements for information security management.',
  },
  {
    slug: 'procedure-data-classification',
    title: 'Data Classification Procedure',
    summary: 'How to classify, label, and handle data at each sensitivity level.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Data Classification Procedure</h2>

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
<p><a href="/portal/kb/policy-data-classification">Data Classification Policy</a></p>`,
    contentPlain: 'Data Classification Procedure. How to classify data into Public, Internal, Confidential, and Restricted levels. Defines labeling, handling controls for storage, transmission, and disposal at each level. Includes data inventory and review requirements.',
  },
  {
    slug: 'procedure-incident-response',
    title: 'Incident Response Procedure',
    summary: 'Step-by-step incident handling: identify, contain, eradicate, recover, lessons learned.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Incident Response Procedure</h2>

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
<p><a href="/portal/kb/policy-incident-response">Incident Response Policy</a></p>`,
    contentPlain: 'Incident Response Procedure. Five-phase approach: Identification (severity assessment), Containment (isolate and preserve evidence), Eradication (root cause removal), Recovery (restore from backups), Lessons Learned (post-incident review). Includes roles, drill schedule, and evidence requirements.',
  },
  {
    slug: 'procedure-access-control',
    title: 'Access Control Procedure',
    summary: 'How to request, approve, provision, review, and revoke access to systems and data.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Access Control Procedure</h2>

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
<p><a href="/portal/kb/policy-access-control">Access Control Policy</a></p>`,
    contentPlain: 'Access Control Procedure. How to request, approve, provision, review, and revoke access. Covers new access requests, employee offboarding, and quarterly access reviews. Follows least-privilege principles with manager approval and IT provisioning.',
  },
  {
    slug: 'procedure-change-management',
    title: 'Change Management Procedure',
    summary: 'How to submit, review, approve, implement, and close change requests.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Change Management Procedure</h2>

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
<p><a href="/portal/kb/policy-change-management">Change Management Policy</a></p>`,
    contentPlain: 'Change Management Procedure. How to submit, classify, review, approve, implement, and close change requests. Covers Standard, Normal, and Emergency change types. Includes CAB review, staging testing, rollback plans, and post-implementation reviews.',
  },
  {
    slug: 'procedure-backup-recovery',
    title: 'Backup & Recovery Procedure',
    summary: 'How to perform backups, verify integrity, and restore systems from backup.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Backup &amp; Recovery Procedure</h2>

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
<p><a href="/portal/kb/policy-backup-recovery">Backup &amp; Recovery Policy</a></p>`,
    contentPlain: 'Backup & Recovery Procedure. How to perform full, incremental, and transaction log backups. Covers backup schedule, verification via test restores, and step-by-step restoration process. Includes encryption requirements and off-site storage.',
  },
  {
    slug: 'procedure-remote-access-byod',
    title: 'Remote Access & BYOD Procedure',
    summary: 'How to set up secure remote access and register personal devices for work use.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Remote Access &amp; BYOD Procedure</h2>

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
<p><a href="/portal/kb/policy-remote-access-byod">Remote Access &amp; BYOD Policy</a></p>`,
    contentPlain: 'Remote Access & BYOD Procedure. How to set up VPN access, register personal devices for work, and report lost or stolen devices. Includes MDM enrollment, device requirements, and remote wipe procedures.',
  },
  {
    slug: 'procedure-physical-security',
    title: 'Physical Security Procedure',
    summary: 'Procedures for facility access, visitor management, and physical security monitoring.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Physical Security Procedure</h2>

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
<p><a href="/portal/kb/policy-physical-security">Physical Security Policy</a></p>`,
    contentPlain: 'Physical Security Procedure. Procedures for visitor management, server room access, and lost badge handling. Covers badge + PIN authentication, visitor escort requirements, and CCTV monitoring schedules.',
  },
  {
    slug: 'procedure-network-security',
    title: 'Network Security Procedure',
    summary: 'Procedures for firewall management, network monitoring, and segmentation.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Network Security Procedure</h2>

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
<p><a href="/portal/kb/policy-network-security">Network Security Policy</a></p>`,
    contentPlain: 'Network Security Procedure. Procedures for firewall rule management, network monitoring with IDS/IPS, and wireless security. Covers least-access firewall rules, traffic analysis, WPA3 Enterprise configuration, and guest WiFi isolation.',
  },
  {
    slug: 'procedure-vendor-management',
    title: 'Vendor & Third-Party Management Procedure',
    summary: 'How to evaluate, onboard, monitor, and offboard vendors and third-party providers.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>Vendor &amp; Third-Party Management Procedure</h2>

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
<p><a href="/portal/kb/policy-vendor-management">Vendor &amp; Third-Party Management Policy</a></p>`,
    contentPlain: 'Vendor & Third-Party Management Procedure. How to assess, onboard, monitor, and offboard vendors. Covers security questionnaires, SOC report reviews, DPAs, risk ratings, and vendor access revocation.',
  },
  {
    slug: 'procedure-security-awareness',
    title: 'Security Awareness Procedure',
    summary: 'How to deliver, track, and measure security awareness training and phishing simulations.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Security Awareness Procedure</h2>

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
<p><a href="/portal/kb/policy-security-awareness">Security Awareness Policy</a></p>`,
    contentPlain: 'Security Awareness Procedure. How to deliver annual training, run phishing simulations, and onboard new hires. Covers LMS-based training with 80% pass rate, quarterly phishing campaigns with trend reporting, and supplemental training for failures.',
  },
  {
    slug: 'procedure-asset-management',
    title: 'IT Asset Management Procedure',
    summary: 'How to procure, track, maintain, and dispose of IT assets throughout their lifecycle.',
    tags: ['nist-csf', 'soc2', 'itil4', 'universal'],
    content: `<h2>IT Asset Management Procedure</h2>

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
<p><a href="/portal/kb/policy-asset-management">IT Asset Management Policy</a></p>`,
    contentPlain: 'IT Asset Management Procedure. How to procure, tag, assign, maintain, and dispose of IT assets. Covers procurement approval, asset register management, NIST 800-88 data wiping, and certified e-waste disposal.',
  },
  {
    slug: 'procedure-software-licensing',
    title: 'Software Licensing & Installation Procedure',
    summary: 'How to request, approve, install, and audit software and licenses.',
    tags: ['nist-csf', 'soc2', 'universal'],
    content: `<h2>Software Licensing &amp; Installation Procedure</h2>

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
<p><a href="/portal/kb/policy-software-licensing">Software Licensing &amp; Installation Policy</a></p>`,
    contentPlain: 'Software Licensing & Installation Procedure. How to request, approve, install, and audit software. Covers the approved software list, security risk assessments, license management, and quarterly compliance audits.',
  },
]

// ============================================================================
// Industry-Specific Procedures (~10 articles)
// Each pairs with an industry-specific policy by slug convention.
// ============================================================================

const INDUSTRY_PROCEDURES: ProcedureArticle[] = [
  {
    slug: 'procedure-hipaa-phi-handling',
    title: 'PHI Handling Procedure',
    summary: 'Step-by-step procedures for accessing, transmitting, and storing protected health information.',
    tags: ['hipaa', 'healthcare', 'nist-csf'],
    content: `<h2>PHI Handling Procedure</h2>

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
<p><a href="/portal/kb/policy-hipaa-phi-handling">Protected Health Information (PHI) Handling</a></p>`,
    contentPlain: 'PHI Handling Procedure. How to access, transmit, and dispose of protected health information under HIPAA. Covers minimum necessary standard, encryption in transit, cross-cut shredding for paper, and NIST 800-88 for electronic PHI.',
  },
  {
    slug: 'procedure-hipaa-breach-notification',
    title: 'HIPAA Breach Notification Procedure',
    summary: 'Step-by-step breach assessment, notification timelines, and reporting requirements.',
    tags: ['hipaa', 'healthcare', 'nist-csf'],
    content: `<h2>HIPAA Breach Notification Procedure</h2>

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
<p><a href="/portal/kb/policy-hipaa-breach-notification">HIPAA Breach Notification Procedures</a></p>`,
    contentPlain: 'HIPAA Breach Notification Procedure. Step-by-step breach investigation using the 4-factor risk assessment, notification timelines (60 days for individuals, HHS, and media), and documentation requirements.',
  },
  {
    slug: 'procedure-hipaa-business-associate',
    title: 'Business Associate Management Procedure',
    summary: 'How to evaluate, contract with, and monitor HIPAA business associates.',
    tags: ['hipaa', 'healthcare'],
    content: `<h2>Business Associate Management Procedure</h2>

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
<p><a href="/portal/kb/policy-hipaa-business-associate">Business Associate Management (HIPAA)</a></p>`,
    contentPlain: 'Business Associate Management Procedure. How to identify, contract with, and monitor HIPAA business associates. Covers BA identification, BAA negotiation and execution, annual security assessments, and 6-year retention of BAAs.',
  },
  {
    slug: 'procedure-pci-cardholder-data',
    title: 'Cardholder Data Protection Procedure',
    summary: 'How to handle, store, and transmit cardholder data in compliance with PCI DSS.',
    tags: ['pci-dss', 'finance', 'retail'],
    content: `<h2>Cardholder Data Protection Procedure</h2>

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
<p><a href="/portal/kb/policy-pci-cardholder-data">Cardholder Data Protection Policy</a></p>`,
    contentPlain: 'Cardholder Data Protection Procedure. How to accept, store, and protect cardholder data under PCI DSS. Covers validated terminals, encryption, data minimization, quarterly ASV and CHD discovery scans, and SAQ completion.',
  },
  {
    slug: 'procedure-pci-cryptography',
    title: 'Cryptography & Data Transmission Procedure',
    summary: 'How to implement encryption, manage keys, and secure data in transit.',
    tags: ['pci-dss', 'finance', 'nist-csf'],
    content: `<h2>Cryptography &amp; Data Transmission Procedure</h2>

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
<p><a href="/portal/kb/policy-pci-cryptography">Cryptography &amp; Data Transmission Policy</a></p>`,
    contentPlain: 'Cryptography & Data Transmission Procedure. How to implement AES-256 and TLS 1.2+ encryption, manage cryptographic keys with split knowledge, and handle certificate lifecycle. Covers key rotation, certificate renewal, and TLS auditing.',
  },
  {
    slug: 'procedure-audit-trail',
    title: 'Audit Trail & Logging Procedure',
    summary: 'How to configure, monitor, protect, and review audit logs across systems.',
    tags: ['soc2', 'finance', 'nist-csf'],
    content: `<h2>Audit Trail &amp; Logging Procedure</h2>

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
<p><a href="/portal/kb/policy-audit-trail">Audit Trail &amp; Logging Policy</a></p>`,
    contentPlain: 'Audit Trail & Logging Procedure. How to configure centralized logging, monitor via SIEM alerts, and protect logs from tampering. Covers required log fields, alert thresholds, append-only storage, and retention verification.',
  },
  {
    slug: 'procedure-segregation-of-duties',
    title: 'Segregation of Duties Procedure',
    summary: 'How to identify, implement, and monitor separation of conflicting duties.',
    tags: ['soc2', 'finance'],
    content: `<h2>Segregation of Duties Procedure</h2>

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
<p><a href="/portal/kb/policy-segregation-of-duties">Segregation of Duties Policy</a></p>`,
    contentPlain: 'Segregation of Duties Procedure. How to define a SoD matrix, implement role-based controls with dual approvals, and monitor compliance. Covers conflict identification, compensating controls for small teams, and quarterly auditing.',
  },
  {
    slug: 'procedure-records-retention',
    title: 'Records Retention Procedure',
    summary: 'How to classify, retain, archive, and dispose of business records.',
    tags: ['soc2', 'finance', 'government'],
    content: `<h2>Records Retention Procedure</h2>

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
<p><a href="/portal/kb/policy-records-retention">Records Retention Policy</a></p>`,
    contentPlain: 'Records Retention Procedure. How to classify, retain, and dispose of business records. Includes retention schedule (financial 7yr, employee 7yr, contracts 7yr, PHI 6yr), secure disposal steps, and litigation hold procedures.',
  },
  {
    slug: 'procedure-foia-records',
    title: 'Public Records & FOIA Procedure',
    summary: 'How to receive, process, and respond to public records and FOIA requests.',
    tags: ['government'],
    content: `<h2>Public Records &amp; FOIA Procedure</h2>

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
<p><a href="/portal/kb/policy-foia-records">Public Records &amp; FOIA Compliance</a></p>`,
    contentPlain: 'Public Records & FOIA Procedure. How to receive, search, review, redact, and respond to public records requests. Covers 3-day acknowledgment, department search coordination, exemption-based redactions, and statutory deadline compliance.',
  },
  {
    slug: 'procedure-hipaa-workforce-security',
    title: 'HIPAA Workforce Security Procedure',
    summary: 'How to manage workforce access to PHI systems: authorization, supervision, and termination.',
    tags: ['hipaa', 'healthcare'],
    content: `<h2>HIPAA Workforce Security Procedure</h2>

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
<p><a href="/portal/kb/policy-hipaa-workforce-security">Workforce Security (HIPAA)</a></p>`,
    contentPlain: 'HIPAA Workforce Security Procedure. How to authorize, supervise, and terminate workforce access to PHI. Covers minimum necessary standard, role-based access, HIPAA training prerequisites, monthly access audits, and 6-year log retention.',
  },
]

// ============================================================================
// Combined list
// ============================================================================

const ALL_PROCEDURES = [...UNIVERSAL_PROCEDURES, ...INDUSTRY_PROCEDURES]

// ============================================================================
// Seed and upgrade functions
// ============================================================================

/**
 * Seeds procedure articles for an organization.
 * Procedures are seeded as drafts so admins can review and customize before publishing.
 * Uses the same "Policies & Procedures" category as policies.
 */
export async function seedProcedureArticles(orgId: string): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get or create the category (should already exist from policy seeding)
    const categoryResult = await client.query(
      `INSERT INTO kb_categories (organization_id, name, slug, description, icon, sort_order)
       VALUES ($1, $2, $3, 'Organizational policies, procedures, and compliance documents', 'shield', 1)
       ON CONFLICT (organization_id, slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [orgId, CATEGORY_NAME, CATEGORY_SLUG]
    )

    const categoryId = categoryResult.rows[0].id

    // Insert all procedure articles as drafts
    for (const article of ALL_PROCEDURES) {
      await client.query(
        `INSERT INTO kb_articles (
          organization_id, title, slug, summary, content, content_plain,
          category_id, status, visibility, is_published,
          is_system, content_version, article_type, tags,
          requires_acknowledgment, view_count, helpful_count, not_helpful_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', 'authenticated', false,
          true, $8, 'procedure', $9::varchar[],
          false, 0, 0, 0)
        ON CONFLICT (organization_id, slug) DO NOTHING`,
        [orgId, article.title, article.slug, article.summary, article.content, article.contentPlain,
         categoryId, CONTENT_VERSION, article.tags]
      )
    }

    // Update category article count (only published articles)
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
 * Upgrades procedure articles to a new content version.
 * Only updates articles where content_version < CONTENT_VERSION.
 */
export async function upgradeProcedureArticles(orgId: string): Promise<number> {
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
      await seedProcedureArticles(orgId)
      return ALL_PROCEDURES.length
    }

    const categoryId = categoryResult.rows[0].id

    for (const article of ALL_PROCEDURES) {
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
