/**
 * AI Draft Reply Prompts
 *
 * Per-intent prompt templates for generating ticket reply drafts.
 * Used by /api/ai/draft-reply to produce context-aware HTML drafts.
 */

import { getStrictnessPrompt } from './support-prompt'

export type DraftIntent =
  | 'suggest_resolution'
  | 'acknowledge'
  | 'request_info'
  | 'follow_up'
  | 'confirm_close'

export const DRAFT_INTENTS: DraftIntent[] = [
  'suggest_resolution',
  'acknowledge',
  'request_info',
  'follow_up',
  'confirm_close',
]

export interface TicketDraftContext {
  ticketNumber: string
  subject: string
  description: string
  priority: string
  status: string
  category: string | null
  typeName: string | null
  contactName: string | null
  contactEmail: string | null
  companyName: string | null
  assignedName: string | null
  scheduledFor: string | null
  actionDateType: string | null
  isActionable: boolean
  replies: { role: string; content: string; createdAt: string }[]
}

const BASE_PROMPT = `You are a professional IT support technician drafting a reply to a support ticket. Write in a warm but professional tone. Be concise and actionable.

Rules:
- Output valid HTML suitable for a rich text editor (use <p>, <ol>, <li>, <strong>, <em> tags)
- Do NOT include a subject line or greeting with the ticket number — just the reply body
- Start with a brief, natural greeting using the requester's first name if available
- Be specific to the ticket context — never use generic filler
- If citing a KB article, reference it by title
- Do NOT fabricate URLs, steps, or article titles not provided in your context
- Keep replies under 300 words unless resolution steps require more detail`

const INTENT_PROMPTS: Record<DraftIntent, string> = {
  suggest_resolution: `Draft a reply suggesting resolution steps for this ticket.

- If KB articles are provided, base your resolution on them and cite by title
- Provide numbered steps the user can follow
- If the KB doesn't cover this, provide general guidance but clearly note: "Note: This guidance is general and not from our Knowledge Base."
- End with an offer to help further if the steps don't resolve the issue`,

  acknowledge: `Draft an acknowledgment reply for this ticket.

- Confirm you've received and reviewed the request
- Briefly restate what they're asking for (shows you read it)
- If the ticket is scheduled for a future date, mention when work will begin
- Set expectations: what happens next, who will handle it, approximate timeline if known
- Keep it brief — 2-3 short paragraphs max`,

  request_info: `Draft a reply requesting additional information from the requester.

- Identify specific gaps in the ticket — what's missing that you need to proceed
- Ask targeted questions (not vague "please provide more details")
- Explain briefly WHY you need each piece of information
- Use a numbered list for multiple questions
- Be polite but direct — the goal is to unblock the ticket`,

  follow_up: `Draft a follow-up reply for this ticket that's been waiting for a response.

- Reference what was last discussed or asked
- Gently check if the requester still needs help or if the issue resolved itself
- Offer to close the ticket if no response is needed
- Keep it brief and friendly — one short paragraph is often enough`,

  confirm_close: `Draft a reply asking the requester to confirm the issue is resolved.

- Briefly summarize what was done to resolve the issue
- Ask if they can confirm everything is working
- Mention the ticket will be closed after confirmation (or after N days with no response)
- Thank them for their patience`,
}

// Map triage action states to suggested draft intents
const ACTION_STATE_INTENT_MAP: Record<string, DraftIntent> = {
  new_unreviewed: 'acknowledge',
  needs_agent_action: 'suggest_resolution',
  needs_more_info: 'request_info',
  escalation_needed: 'acknowledge',
  waiting_on_user: 'follow_up',
  user_will_follow_up: 'follow_up',
  waiting_on_vendor: 'follow_up',
  waiting_on_internal: 'follow_up',
  waiting_on_approval: 'acknowledge',
  waiting_on_parts: 'follow_up',
  scheduled: 'acknowledge',
  on_hold: 'follow_up',
  resolution_candidate: 'confirm_close',
}

export function suggestIntent(actionState: string | null): DraftIntent {
  if (!actionState) return 'suggest_resolution'
  return ACTION_STATE_INTENT_MAP[actionState] || 'suggest_resolution'
}

export function getDraftReplyPrompt(
  intent: DraftIntent,
  context: TicketDraftContext,
  responseMode: 'strict' | 'balanced' | 'open',
  kbContextBlock: string,
): string {
  // Draft replies are written by staff (technicians/admins), so the fallback
  // guidance should be staff-appropriate (don't suggest "submit a support
  // ticket" to the person responding to the ticket).
  const strictnessPrompt = getStrictnessPrompt(responseMode, { depth: 'technician', crossOrg: false })

  const schedulingContext = context.scheduledFor
    ? `\nScheduling: This ticket is ${context.actionDateType === 'scheduled_for' ? 'scheduled for' : 'due by'} ${context.scheduledFor}. ${context.isActionable ? 'It is currently actionable.' : 'It is NOT yet actionable — work should not begin yet.'}`
    : ''

  const conversationBlock = context.replies.length > 0
    ? '\n\n## Conversation History (newest first)\n\n' +
      context.replies
        .slice(0, 10)
        .map(r => `**${r.role}** (${r.createdAt}):\n${r.content.slice(0, 500)}`)
        .join('\n\n---\n\n')
    : '\n\n## Conversation History\n\n(No replies yet — this is the first response)'

  const ticketBlock = `
## Ticket Context

- **Ticket**: ${context.ticketNumber}
- **Subject**: ${context.subject}
- **Priority**: ${context.priority}
- **Status**: ${context.status}
- **Category**: ${context.category || 'Uncategorized'}
- **Type**: ${context.typeName || 'General'}
- **Requester**: ${context.contactName || 'Unknown'}${context.contactEmail ? ` (${context.contactEmail})` : ''}
- **Company**: ${context.companyName || 'N/A'}
- **Assigned To**: ${context.assignedName || 'Unassigned'}${schedulingContext}

### Description
${context.description?.slice(0, 1000) || '(no description)'}`

  return [
    BASE_PROMPT,
    strictnessPrompt,
    INTENT_PROMPTS[intent],
    kbContextBlock,
    ticketBlock,
    conversationBlock,
    `\nGenerate the reply draft now for intent: ${intent}`,
  ].join('\n\n')
}
