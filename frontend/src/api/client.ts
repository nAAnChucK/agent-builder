export interface AgentConfig {
  name: string
  description: string
  system_prompt: string
  tools: string[]
  model: string
}

export interface AgentRecord {
  id: string
  config: AgentConfig
  created_at: string
}

export interface ToolMeta {
  id: string
  description: string
  category: string
  type: string
}

export type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_start'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_end'; tool: string; output: string }
  | { type: 'done' }

const BASE = '/api'

export async function buildAgent(description: string): Promise<AgentRecord> {
  const res = await fetch(`${BASE}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Build failed')
  }
  return res.json()
}

export async function listAgents(): Promise<AgentRecord[]> {
  const res = await fetch(`${BASE}/agents`)
  if (!res.ok) throw new Error('Failed to load agents')
  return res.json()
}

export async function deleteAgent(id: string): Promise<void> {
  await fetch(`${BASE}/agents/${id}`, { method: 'DELETE' })
}

export async function listTools(): Promise<ToolMeta[]> {
  const res = await fetch(`${BASE}/tools`)
  if (!res.ok) throw new Error('Failed to load tools')
  return res.json()
}

export async function* streamAgentRun(
  agentId: string,
  message: string,
  threadId: string,
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${BASE}/agents/${agentId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, thread_id: threadId }),
  })
  if (!res.ok) throw new Error('Run failed')

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6)) as StreamEvent
        } catch {
          // malformed chunk — skip
        }
      }
    }
  }
}
