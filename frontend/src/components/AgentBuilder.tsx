import { useState } from 'react'
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { buildAgent, type AgentRecord } from '../api/client'

interface Props {
  onAgentCreated: (agent: AgentRecord) => void
}

const EXAMPLES = [
  'An assistant that helps me organize files in my workspace',
  'A research helper that searches the web and writes summaries to files',
  'A coding assistant that can read, write, and run files in my workspace',
  'A math tutor that explains calculations step by step',
]

export default function AgentBuilder({ onAgentCreated }: Props) {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCreated, setLastCreated] = useState<AgentRecord | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  async function handleBuild() {
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    setLastCreated(null)
    try {
      const agent = await buildAgent(description.trim())
      setLastCreated(agent)
      onAgentCreated(agent)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Build an Agent</h2>
        <p className="text-sm text-gray-400">
          Describe what you want the agent to do — it will be configured with the right tools automatically.
        </p>
      </div>

      <textarea
        className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
        placeholder="e.g. An assistant that searches the web for news and saves summaries to files..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleBuild()
        }}
      />

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setDescription(ex)}
            className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            {ex.length > 48 ? ex.slice(0, 48) + '…' : ex}
          </button>
        ))}
      </div>

      <button
        onClick={handleBuild}
        disabled={loading || !description.trim()}
        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Building agent…
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Build Agent
          </>
        )}
      </button>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {lastCreated && (
        <div className="bg-gray-900 border border-indigo-800 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-indigo-300">{lastCreated.config.name}</p>
              <p className="text-sm text-gray-400 mt-0.5">{lastCreated.config.description}</p>
            </div>
            <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full shrink-0">
              Created
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {lastCreated.config.tools.map((t) => (
              <span
                key={t}
                className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full"
              >
                {t}
              </span>
            ))}
          </div>

          <button
            onClick={() => setShowPrompt((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors self-start"
          >
            {showPrompt ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showPrompt ? 'Hide' : 'Show'} system prompt
          </button>

          {showPrompt && (
            <pre className="text-xs text-gray-400 bg-gray-950 rounded p-3 whitespace-pre-wrap leading-relaxed">
              {lastCreated.config.system_prompt}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
