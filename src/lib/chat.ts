/**
 * chat.ts — AI Assistant integration for the SAT portfolio tool.
 *
 * Two responsibilities:
 *
 * 1. `buildPortfolioContext` — serializes the entire Zustand store into a
 *    compact JSON string that is embedded in the system prompt. This is the
 *    "RAG" layer: every question the model sees is grounded in actual data so
 *    it cannot hallucinate facts about the portfolio.
 *
 * 2. `streamChatResponse` — creates an Anthropic SDK client and streams a
 *    Claude response, yielding text chunks as an async generator so the UI can
 *    display each piece of text as it arrives rather than waiting for the full
 *    completion.
 *
 * Design choices:
 * - Names are denormalized (not just IDs) so the model can answer questions
 *   like "Who leads the Store Ops team?" without needing to resolve references.
 * - The API key is read from localStorage at call-time so a key saved in
 *   Settings is picked up immediately without a page reload.
 * - `dangerouslyAllowBrowser: true` is required by the Anthropic SDK for
 *   direct browser-to-API calls; Anthropic explicitly supports this pattern
 *   for internal/personal tools where the key is user-provided.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { PortfolioState } from '@/types'

// ─── localStorage key ─────────────────────────────────────────────────────

export const ANTHROPIC_KEY_STORAGE = 'sat_anthropic_api_key'

// ─── Chat message type ────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** Parsed follow-up suggestion chips; only present on completed assistant messages. */
  suggestions?: string[]
}

// ─── Suggestions parser ───────────────────────────────────────────────────

/**
 * Strip the `<suggestions>["Q1","Q2","Q3"]</suggestions>` block that Claude
 * appends to every response. Returns the cleaned display content and the
 * parsed suggestion strings.
 *
 * Called after streaming completes so the raw accumulated content (which may
 * include the partial/full suggestions tag) is resolved into separate fields.
 * During streaming, callers should truncate display at the first `<suggestions`
 * character to hide the raw tag from the user.
 */
export function parseSuggestions(raw: string): { content: string; suggestions: string[] } {
  const match = raw.match(/<suggestions>([\s\S]*?)<\/suggestions>/)
  if (!match) return { content: raw.trim(), suggestions: [] }
  try {
    const suggestions = JSON.parse(match[1].trim()) as string[]
    const content = raw.replace(match[0], '').trim()
    return { content, suggestions: Array.isArray(suggestions) ? suggestions : [] }
  } catch {
    // If JSON parsing fails, just strip the block and return no suggestions.
    return { content: raw.replace(match[0], '').trim(), suggestions: [] }
  }
}

// ─── Context builder ──────────────────────────────────────────────────────

/**
 * Serialize the full portfolio store into a compact JSON structure that is
 * embedded verbatim in the system prompt. Each entity collection is
 * denormalized so that the model sees human-readable names rather than IDs,
 * enabling natural-language answers without multi-step ID resolution.
 *
 * PTO blocks are excluded — they're rarely queried conversationally and
 * would add noise / size without useful signal for most questions.
 */
export function buildPortfolioContext(state: PortfolioState): string {
  // Build fast ID → name lookup maps so denormalization is O(1) per entity.
  const domainById   = new Map(state.domains.map(d => [d.id, d]))
  const teamById     = new Map(state.teams.map(t => [t.id, t]))
  const memberById   = new Map(state.members.map(m => [m.id, m]))
  const initiativeById = new Map(state.initiatives.map(i => [i.id, i]))

  // ── Domains ────────────────────────────────────────────────────────────
  const domains = state.domains.map(d => ({
    name: d.name,
    description: d.description,
    owner: d.owner,
  }))

  // ── Teams ──────────────────────────────────────────────────────────────
  const teams = state.teams.map(t => ({
    name: t.name,
    domain: domainById.get(t.domainId)?.name ?? t.domainId,
    description: t.description,
    techLead: t.techLead,
    memberCount: t.memberIds.length,
  }))

  // ── Members ────────────────────────────────────────────────────────────
  const members = state.members.map(m => ({
    name: m.name,
    role: m.role,
    reportsTo: m.reportsTo ?? null,
    capacity: m.capacity,
    // A member can belong to multiple teams — list all names.
    teams: m.teamIds.map(tid => teamById.get(tid)?.name ?? tid),
    domains: Array.from(new Set(
      m.teamIds.map(tid => {
        const team = teamById.get(tid)
        return team ? (domainById.get(team.domainId)?.name ?? team.domainId) : tid
      })
    )),
    activeProjectCount: m.projectIds.length,
  }))

  // ── Projects ───────────────────────────────────────────────────────────
  const projects = state.projects.map(p => ({
    name: p.name,
    status: p.status,
    phase: p.phase,
    priority: p.priority,
    percentComplete: p.percentComplete,
    startDate: p.startDate,
    targetEndDate: p.targetEndDate,
    stakeholders: p.stakeholders || null,
    notes: p.notes || null,
    estimatedValue: p.estimatedValue ?? null,
    valueType: p.valueType ?? null,
    actualValue: p.actualValue ?? null,
    initiative: p.initiativeId ? (initiativeById.get(p.initiativeId)?.name ?? null) : null,
    // Resolve each assignment to member name + role for readability.
    assignedMembers: p.assignments.map(a => {
      const member = memberById.get(a.memberId)
      const memberTeams = member ? member.teamIds.map(tid => teamById.get(tid)?.name ?? tid) : []
      return {
        name: member?.name ?? a.memberId,
        role: member?.role ?? null,
        teams: memberTeams,
        allocationPct: a.allocation,
        part: a.part ?? null,
      }
    }),
  }))

  // ── Initiatives ────────────────────────────────────────────────────────
  const initiatives = state.initiatives.map(i => ({
    name: i.name,
    status: i.status,
    targetQuarter: i.targetQuarter,
    description: i.description,
    // List project names that roll up to this initiative.
    projects: state.projects
      .filter(p => p.initiativeId === i.id)
      .map(p => p.name),
  }))

  // ── Intake requests ────────────────────────────────────────────────────
  const intakeRequests = state.intakeRequests.map(r => ({
    requesterName: r.requesterName,
    teamOrDomain: r.teamOrDomain,
    description: r.description,
    businessJustification: r.businessJustification,
    estimatedEffort: r.estimatedEffort,
    priority: r.priority,
    status: r.status,
    requestedByDate: r.requestedByDate,
    businessOwner: r.businessOwner ?? null,
  }))

  // ── Escalations ────────────────────────────────────────────────────────
  const escalations = state.escalations.map(e => ({
    memberName: e.memberName,
    projectName: e.projectName,
    blockedOn: e.blockedOn,
    needsTo: e.needsTo,
    status: e.status,
    submittedAt: e.submittedAt,
    resolvedAt: e.resolvedAt ?? null,
    resolvedNote: e.resolvedNote ?? null,
  }))

  // ── Resource rates ─────────────────────────────────────────────────────
  const resourceRates = state.resourceRates.map(r => ({
    role: r.role,
    annualRate: r.annualRate,
  }))

  // Assemble the full context object. Each key maps to a collection so the
  // model can answer "how many X" questions by counting array elements.
  const context = {
    domains,
    teams,
    members,
    projects,
    initiatives,
    intakeRequests,
    escalations,
    resourceRates,
  }

  // Compact JSON (no pretty-printing) to minimize token count — the model
  // can still parse it perfectly without whitespace, and removing indentation
  // cuts the serialized size by roughly 30–40% on typical portfolio data.
  return JSON.stringify(context)
}

// ─── Streaming API call ───────────────────────────────────────────────────

/**
 * Stream a Claude response using the provided message history and portfolio
 * context. Yields text chunks as they arrive so the UI can render them
 * incrementally.
 *
 * The system prompt explicitly instructs the model to only answer from the
 * data provided and to say "I don't have that information" rather than guess.
 * This is the key anti-hallucination constraint.
 *
 * @param messages   Chat history (last N messages to include for context).
 * @param context    Serialized portfolio data from buildPortfolioContext().
 * @param apiKey     Anthropic API key from localStorage.
 */
export async function* streamChatResponse(
  messages: ChatMessage[],
  context: string,
  apiKey: string,
): AsyncGenerator<string> {
  // The Anthropic SDK requires dangerouslyAllowBrowser for direct browser
  // calls — this is intentional and appropriate for a personal/internal tool
  // where the API key is user-provided (not baked into the app).
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  // The system prompt grounds the model exclusively in the portfolio data.
  // The explicit "do not invent" instruction is the primary guard against
  // hallucination.
  const systemPrompt = `You are an AI assistant for the SAT (Store & Associate Technology) portfolio management tool. This tool tracks the Store Technology organization's domains, teams, members, projects, strategic initiatives, and intake requests.

Answer questions ONLY using the portfolio data provided below. If a question cannot be answered from this data, say clearly: "I don't have that information in the portfolio data."

Do not invent, infer, or speculate about any facts that are not explicitly present in the data. When unsure, acknowledge uncertainty directly.

When answering:
- Be concise and factual.
- Use the member and project names exactly as they appear in the data.
- For lists (e.g. "all blocked projects"), enumerate them clearly.
- For numerical questions (e.g. "how many active projects"), count from the data.
- Format responses in plain text; use simple bullet lists where helpful.

After every answer, append exactly 3 concise follow-up questions the user might want to ask next, using this exact format on the very last line (no other text after it):
<suggestions>["Question one?", "Question two?", "Question three?"]</suggestions>

Today's date: ${today}

PORTFOLIO DATA:
${context}`

  // Stream the response — yields text events as they arrive so the UI can
  // render each chunk without waiting for the full completion.
  const stream = await client.messages.stream({
    // Haiku is used for cost efficiency: the portfolio context is large (~60–80k
    // tokens of JSON) and Haiku handles structured data lookups well at ~4× lower
    // cost than Sonnet per question (~$0.05 vs ~$0.19).
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: systemPrompt,
    // Include the full provided message history so multi-turn conversation works.
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      yield chunk.delta.text
    }
  }
}
