/**
 * Seed Training Articles
 *
 * Creates starter training articles with inline assessments
 * in a "Training" KB category during setup.
 */

import { pool } from '@/lib/db'

export const TRAINING_CONTENT_VERSION = 1

interface TrainingArticle {
  slug: string
  title: string
  summary: string
  content: string
  assessment_dsl: string
  assessment: object
  passing_score: number
  tags: string[]
}

const TRAINING_ARTICLES: TrainingArticle[] = [
  {
    slug: 'security-awareness-basics',
    title: 'Security Awareness Basics',
    summary: 'Essential security practices every employee should know to protect organizational data and systems.',
    content: `<h2>Why Security Awareness Matters</h2>
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

<h2>Complete the Knowledge Check below to confirm your understanding.</h2>`,
    assessment_dsl: `---
type: SINGLE_CHOICE
difficulty: EASY
explanation: |
  Phishing emails use urgency and suspicious links to trick users into revealing sensitive information or clicking malicious links. Always report suspicious emails to IT.
---
# Question
You receive an email claiming to be from your bank asking you to "verify your account immediately" by clicking a link. What should you do?

## Choices
A. Click the link and enter your credentials
B. Forward the email to coworkers for their opinion
C. Report it to IT security and delete the email *[CORRECT]*
D. Reply to the sender asking if it is legitimate
---
---
type: TRUE_FALSE
difficulty: EASY
explanation: |
  Using the same password across multiple accounts means that if one account is compromised, all accounts using that password are also at risk.
---
# Question
It is safe to use the same password for your email, banking, and work accounts as long as the password is complex.

## Choices
A. True
B. False *[CORRECT]*
---
---
type: SINGLE_CHOICE
difficulty: MEDIUM
explanation: |
  Multi-factor authentication adds a second verification step beyond just a password, significantly reducing the risk of unauthorized access even if your password is compromised.
---
# Question
What is the primary benefit of multi-factor authentication (MFA)?

## Choices
A. It makes your password longer
B. It provides a second verification step beyond your password *[CORRECT]*
C. It encrypts your email
D. It blocks all phishing emails
---
---
type: SINGLE_CHOICE
difficulty: EASY
explanation: |
  Locking your workstation prevents unauthorized access to your computer and the sensitive data it contains. This is a simple but critical security practice.
---
# Question
When should you lock your workstation?

## Choices
A. Only at the end of the work day
B. Only when leaving the building
C. Any time you step away from your desk, even briefly *[CORRECT]*
D. Only when working with sensitive data
---
---
type: MULTIPLE_SELECT
difficulty: MEDIUM
explanation: |
  Phishing indicators include urgency, misspelled domains, and requests for credentials. A company logo and professional formatting can be easily faked and are NOT reliable indicators of legitimacy.
---
# Question
Which of the following are common indicators of a phishing email? (Select all that apply)

## Choices
A. Urgent language demanding immediate action *[CORRECT]*
B. A professional-looking company logo
C. A sender address with misspelled domain name *[CORRECT]*
D. Requests to share your password or credentials *[CORRECT]*`,
    assessment: {
      questions: [
        {
          type: 'SINGLE_CHOICE', question_text: 'You receive an email claiming to be from your bank asking you to "verify your account immediately" by clicking a link. What should you do?',
          difficulty: 'EASY', explanation: 'Phishing emails use urgency and suspicious links to trick users into revealing sensitive information or clicking malicious links. Always report suspicious emails to IT.',
          choices: [{ letter: 'A', text: 'Click the link and enter your credentials', is_correct: false }, { letter: 'B', text: 'Forward the email to coworkers for their opinion', is_correct: false }, { letter: 'C', text: 'Report it to IT security and delete the email', is_correct: true }, { letter: 'D', text: 'Reply to the sender asking if it is legitimate', is_correct: false }], correct_count: 1,
        },
        {
          type: 'TRUE_FALSE', question_text: 'It is safe to use the same password for your email, banking, and work accounts as long as the password is complex.',
          difficulty: 'EASY', explanation: 'Using the same password across multiple accounts means that if one account is compromised, all accounts using that password are also at risk.',
          choices: [{ letter: 'A', text: 'True', is_correct: false }, { letter: 'B', text: 'False', is_correct: true }], correct_count: 1,
        },
        {
          type: 'SINGLE_CHOICE', question_text: 'What is the primary benefit of multi-factor authentication (MFA)?',
          difficulty: 'MEDIUM', explanation: 'Multi-factor authentication adds a second verification step beyond just a password, significantly reducing the risk of unauthorized access even if your password is compromised.',
          choices: [{ letter: 'A', text: 'It makes your password longer', is_correct: false }, { letter: 'B', text: 'It provides a second verification step beyond your password', is_correct: true }, { letter: 'C', text: 'It encrypts your email', is_correct: false }, { letter: 'D', text: 'It blocks all phishing emails', is_correct: false }], correct_count: 1,
        },
        {
          type: 'SINGLE_CHOICE', question_text: 'When should you lock your workstation?',
          difficulty: 'EASY', explanation: 'Locking your workstation prevents unauthorized access to your computer and the sensitive data it contains. This is a simple but critical security practice.',
          choices: [{ letter: 'A', text: 'Only at the end of the work day', is_correct: false }, { letter: 'B', text: 'Only when leaving the building', is_correct: false }, { letter: 'C', text: 'Any time you step away from your desk, even briefly', is_correct: true }, { letter: 'D', text: 'Only when working with sensitive data', is_correct: false }], correct_count: 1,
        },
        {
          type: 'MULTIPLE_SELECT', question_text: 'Which of the following are common indicators of a phishing email? (Select all that apply)',
          difficulty: 'MEDIUM', explanation: 'Phishing indicators include urgency, misspelled domains, and requests for credentials. A company logo and professional formatting can be easily faked and are NOT reliable indicators of legitimacy.',
          choices: [{ letter: 'A', text: 'Urgent language demanding immediate action', is_correct: true }, { letter: 'B', text: 'A professional-looking company logo', is_correct: false }, { letter: 'C', text: 'A sender address with misspelled domain name', is_correct: true }, { letter: 'D', text: 'Requests to share your password or credentials', is_correct: true }], correct_count: 3,
        },
      ],
      passing_score: 80,
    },
    passing_score: 80,
    tags: ['security', 'nist-csf', 'soc2'],
  },
  {
    slug: 'data-handling-classification',
    title: 'Data Handling & Classification',
    summary: 'Learn how to properly classify, handle, and protect different types of organizational data.',
    content: `<h2>Why Data Classification Matters</h2>
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

<h2>Complete the Knowledge Check below to test your understanding.</h2>`,
    assessment_dsl: `---
type: SINGLE_CHOICE
difficulty: EASY
explanation: |
  Employee salary information is confidential business data that requires access controls. It should not be shared publicly or treated as general internal information.
---
# Question
How should employee salary data be classified?

## Choices
A. Public
B. Internal
C. Confidential *[CORRECT]*
D. It depends on the employee's role
---
---
type: SINGLE_CHOICE
difficulty: MEDIUM
explanation: |
  Personal cloud storage services are not approved for storing sensitive business data. Always use organizational-approved, encrypted storage systems.
---
# Question
Where is it appropriate to store confidential business documents?

## Choices
A. On your personal Google Drive
B. On approved, encrypted organizational systems *[CORRECT]*
C. On a USB drive kept in your desk
D. In your personal email drafts
---
---
type: TRUE_FALSE
difficulty: EASY
explanation: |
  Data classification is everyone's responsibility, not just IT's. Every employee handles data and must understand how to classify and protect it appropriately.
---
# Question
Data classification is only the IT department's responsibility.

## Choices
A. True
B. False *[CORRECT]*
---
---
type: SINGLE_CHOICE
difficulty: MEDIUM
explanation: |
  Secure deletion tools overwrite data to prevent recovery. Simply deleting a file or emptying the recycle bin does not permanently remove the data from the storage device.
---
# Question
What is the correct way to dispose of digital confidential documents?

## Choices
A. Delete the file and empty the recycle bin
B. Move the file to a different folder
C. Use a secure deletion tool that overwrites the data *[CORRECT]*
D. Rename the file to something unrelated
---
---
type: MULTIPLE_SELECT
difficulty: MEDIUM
explanation: |
  Protected Health Information (PHI), Social Security numbers, and credit card numbers are all classified as Restricted data requiring the highest level of protection. Company holiday schedules are typically Internal or Public information.
---
# Question
Which of the following should be classified as "Restricted" data? (Select all that apply)

## Choices
A. Protected Health Information (PHI) *[CORRECT]*
B. Company holiday schedule
C. Social Security numbers *[CORRECT]*
D. Credit card numbers *[CORRECT]*`,
    assessment: {
      questions: [
        {
          type: 'SINGLE_CHOICE', question_text: 'How should employee salary data be classified?',
          difficulty: 'EASY', explanation: 'Employee salary information is confidential business data that requires access controls.',
          choices: [{ letter: 'A', text: 'Public', is_correct: false }, { letter: 'B', text: 'Internal', is_correct: false }, { letter: 'C', text: 'Confidential', is_correct: true }, { letter: 'D', text: 'It depends on the employee\'s role', is_correct: false }], correct_count: 1,
        },
        {
          type: 'SINGLE_CHOICE', question_text: 'Where is it appropriate to store confidential business documents?',
          difficulty: 'MEDIUM', explanation: 'Personal cloud storage services are not approved for storing sensitive business data.',
          choices: [{ letter: 'A', text: 'On your personal Google Drive', is_correct: false }, { letter: 'B', text: 'On approved, encrypted organizational systems', is_correct: true }, { letter: 'C', text: 'On a USB drive kept in your desk', is_correct: false }, { letter: 'D', text: 'In your personal email drafts', is_correct: false }], correct_count: 1,
        },
        {
          type: 'TRUE_FALSE', question_text: 'Data classification is only the IT department\'s responsibility.',
          difficulty: 'EASY', explanation: 'Data classification is everyone\'s responsibility.',
          choices: [{ letter: 'A', text: 'True', is_correct: false }, { letter: 'B', text: 'False', is_correct: true }], correct_count: 1,
        },
        {
          type: 'SINGLE_CHOICE', question_text: 'What is the correct way to dispose of digital confidential documents?',
          difficulty: 'MEDIUM', explanation: 'Secure deletion tools overwrite data to prevent recovery.',
          choices: [{ letter: 'A', text: 'Delete the file and empty the recycle bin', is_correct: false }, { letter: 'B', text: 'Move the file to a different folder', is_correct: false }, { letter: 'C', text: 'Use a secure deletion tool that overwrites the data', is_correct: true }, { letter: 'D', text: 'Rename the file to something unrelated', is_correct: false }], correct_count: 1,
        },
        {
          type: 'MULTIPLE_SELECT', question_text: 'Which of the following should be classified as "Restricted" data? (Select all that apply)',
          difficulty: 'MEDIUM', explanation: 'PHI, Social Security numbers, and credit card numbers are all Restricted data.',
          choices: [{ letter: 'A', text: 'Protected Health Information (PHI)', is_correct: true }, { letter: 'B', text: 'Company holiday schedule', is_correct: false }, { letter: 'C', text: 'Social Security numbers', is_correct: true }, { letter: 'D', text: 'Credit card numbers', is_correct: true }], correct_count: 3,
        },
      ],
      passing_score: 80,
    },
    passing_score: 80,
    tags: ['security', 'nist-csf', 'soc2'],
  },
  {
    slug: 'password-authentication-best-practices',
    title: 'Password & Authentication Best Practices',
    summary: 'How to create strong passwords, manage credentials securely, and use multi-factor authentication.',
    content: `<h2>The Importance of Strong Authentication</h2>
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

<h2>Complete the Knowledge Check below.</h2>`,
    assessment_dsl: `---
type: SINGLE_CHOICE
difficulty: EASY
explanation: |
  A passphrase with 20+ characters like "correct-horse-battery-staple" is much stronger than a short complex password. Length is the most important factor in password strength.
---
# Question
Which password is generally the strongest?

## Choices
A. P@ssw0rd!
B. correct-horse-battery-staple *[CORRECT]*
C. John1985!
D. qwerty123456
---
---
type: TRUE_FALSE
difficulty: EASY
explanation: |
  Legitimate IT staff will never ask for your password. If someone claims to be from IT and asks for your password, it is likely a social engineering attack. Report it immediately.
---
# Question
IT support staff may sometimes need to ask for your password to fix an issue.

## Choices
A. True
B. False *[CORRECT]*
---
---
type: SINGLE_CHOICE
difficulty: MEDIUM
explanation: |
  Authenticator apps generate time-based codes locally on your device, making them resistant to SIM swapping and interception attacks. SMS codes can be intercepted through SIM swapping.
---
# Question
Which MFA method is generally considered most secure for everyday use?

## Choices
A. SMS text message codes
B. Email verification codes
C. An authenticator app on your phone *[CORRECT]*
D. Security questions
---
---
type: SINGLE_CHOICE
difficulty: EASY
explanation: |
  Password managers securely generate and store unique passwords for each account. This is the most practical way to maintain strong, unique passwords across all your accounts.
---
# Question
What is the recommended way to manage passwords for dozens of different accounts?

## Choices
A. Write them down in a notebook
B. Use the same strong password everywhere
C. Use a password manager *[CORRECT]*
D. Store them in a spreadsheet
---
---
type: MULTIPLE_SELECT
difficulty: MEDIUM
explanation: |
  Using passphrases (length), enabling MFA (second factor), and using unique passwords per account all significantly improve authentication security. Changing passwords every 30 days without other improvements often leads to weaker passwords.
---
# Question
Which of the following improve your authentication security? (Select all that apply)

## Choices
A. Using passphrases instead of short complex passwords *[CORRECT]*
B. Changing your password every 30 days
C. Enabling multi-factor authentication *[CORRECT]*
D. Using unique passwords for each account *[CORRECT]*`,
    assessment: {
      questions: [
        {
          type: 'SINGLE_CHOICE', question_text: 'Which password is generally the strongest?',
          difficulty: 'EASY', explanation: 'A passphrase with 20+ characters is much stronger than a short complex password.',
          choices: [{ letter: 'A', text: 'P@ssw0rd!', is_correct: false }, { letter: 'B', text: 'correct-horse-battery-staple', is_correct: true }, { letter: 'C', text: 'John1985!', is_correct: false }, { letter: 'D', text: 'qwerty123456', is_correct: false }], correct_count: 1,
        },
        {
          type: 'TRUE_FALSE', question_text: 'IT support staff may sometimes need to ask for your password to fix an issue.',
          difficulty: 'EASY', explanation: 'Legitimate IT staff will never ask for your password.',
          choices: [{ letter: 'A', text: 'True', is_correct: false }, { letter: 'B', text: 'False', is_correct: true }], correct_count: 1,
        },
        {
          type: 'SINGLE_CHOICE', question_text: 'Which MFA method is generally considered most secure for everyday use?',
          difficulty: 'MEDIUM', explanation: 'Authenticator apps generate time-based codes locally on your device.',
          choices: [{ letter: 'A', text: 'SMS text message codes', is_correct: false }, { letter: 'B', text: 'Email verification codes', is_correct: false }, { letter: 'C', text: 'An authenticator app on your phone', is_correct: true }, { letter: 'D', text: 'Security questions', is_correct: false }], correct_count: 1,
        },
        {
          type: 'SINGLE_CHOICE', question_text: 'What is the recommended way to manage passwords for dozens of different accounts?',
          difficulty: 'EASY', explanation: 'Password managers securely generate and store unique passwords for each account.',
          choices: [{ letter: 'A', text: 'Write them down in a notebook', is_correct: false }, { letter: 'B', text: 'Use the same strong password everywhere', is_correct: false }, { letter: 'C', text: 'Use a password manager', is_correct: true }, { letter: 'D', text: 'Store them in a spreadsheet', is_correct: false }], correct_count: 1,
        },
        {
          type: 'MULTIPLE_SELECT', question_text: 'Which of the following improve your authentication security? (Select all that apply)',
          difficulty: 'MEDIUM', explanation: 'Using passphrases, enabling MFA, and using unique passwords all significantly improve security.',
          choices: [{ letter: 'A', text: 'Using passphrases instead of short complex passwords', is_correct: true }, { letter: 'B', text: 'Changing your password every 30 days', is_correct: false }, { letter: 'C', text: 'Enabling multi-factor authentication', is_correct: true }, { letter: 'D', text: 'Using unique passwords for each account', is_correct: true }], correct_count: 3,
        },
      ],
      passing_score: 80,
    },
    passing_score: 80,
    tags: ['security', 'nist-csf', 'soc2'],
  },
]

/**
 * Seed training articles into the "Training" KB category.
 * Idempotent — uses ON CONFLICT DO NOTHING.
 */
export async function seedTrainingArticles(orgId: string): Promise<void> {
  // Create Training category
  const catResult = await pool.query(
    `INSERT INTO kb_categories (organization_id, name, slug, description, icon, display_order)
     VALUES ($1, 'Training', 'training', 'Training courses and assessments', '🎓', 50)
     ON CONFLICT (organization_id, slug) DO NOTHING
     RETURNING id`,
    [orgId]
  )

  let categoryId: string
  if (catResult.rows.length > 0) {
    categoryId = catResult.rows[0].id
  } else {
    const existing = await pool.query(
      'SELECT id FROM kb_categories WHERE organization_id = $1 AND slug = $2',
      [orgId, 'training']
    )
    if (existing.rows.length === 0) return
    categoryId = existing.rows[0].id
  }

  for (const article of TRAINING_ARTICLES) {
    await pool.query(
      `INSERT INTO kb_articles (
        organization_id, title, slug, summary, content,
        content_plain, category_id, visibility, status,
        article_type, tags, assessment, assessment_dsl, passing_score,
        is_system, content_version, is_assigned, published_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, 'authenticated', 'published',
        'training', $8, $9, $10, $11,
        true, $12, true, NOW()
      )
      ON CONFLICT (organization_id, slug) DO NOTHING`,
      [
        orgId,
        article.title,
        article.slug,
        article.summary,
        article.content,
        article.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        categoryId,
        article.tags,
        JSON.stringify(article.assessment),
        article.assessment_dsl,
        article.passing_score,
        TRAINING_CONTENT_VERSION,
      ]
    )
  }
}

/**
 * Upgrade training articles to a newer content version.
 */
export async function upgradeTrainingArticles(orgId: string): Promise<number> {
  let upgraded = 0
  for (const article of TRAINING_ARTICLES) {
    const result = await pool.query(
      `UPDATE kb_articles
       SET content = $1, content_plain = $2, summary = $3,
           assessment = $4, assessment_dsl = $5, passing_score = $6,
           tags = $7, content_version = $8, updated_at = NOW()
       WHERE organization_id = $9 AND slug = $10 AND is_system = true
         AND content_version < $8`,
      [
        article.content,
        article.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        article.summary,
        JSON.stringify(article.assessment),
        article.assessment_dsl,
        article.passing_score,
        article.tags,
        TRAINING_CONTENT_VERSION,
        orgId,
        article.slug,
      ]
    )
    upgraded += result.rowCount || 0
  }
  return upgraded
}
