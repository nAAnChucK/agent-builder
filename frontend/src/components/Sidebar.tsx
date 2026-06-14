import { Trash2, Bot, PlusCircle } from 'lucide-react'
import { deleteAgent, type AgentRecord } from '../api/client'

interface Props {
  agents: AgentRecord[]
  selected: string | null
  onSelect: (id: string | null) => void
  onNew: () => void
  onDeleted: (id: string) => void
}


export default function Sidebar({ agents, selected, onSelect, onNew, onDeleted }: Props) {
  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await deleteAgent(id)
    onDeleted(id)
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 h-screen">
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={18} className="text-indigo-400" />
          <span className="font-semibold text-white text-sm">Agent Builder</span>
        </div>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          <PlusCircle size={14} />
          New Agent
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {agents.length === 0 && (
          <p className="text-xs text-gray-600 text-center mt-8 px-4">
            No agents yet. Build your first one!
          </p>
        )}
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className={`w-full text-left px-4 py-3 flex items-start gap-2 group transition-colors ${
              selected === agent.id
                ? 'bg-indigo-900/40 border-r-2 border-indigo-500'
                : 'hover:bg-gray-800'
            }`}
          >
            <Bot
              size={14}
              className={`mt-0.5 shrink-0 ${selected === agent.id ? 'text-indigo-400' : 'text-gray-500'}`}
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  selected === agent.id ? 'text-indigo-200' : 'text-gray-200'
                }`}
              >
                {agent.config.name}
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{agent.config.description}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {agent.config.tools.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500"
                  >
                    {t}
                  </span>
                ))}
                {agent.config.tools.length > 3 && (
                  <span className="text-[10px] text-gray-600">+{agent.config.tools.length - 3}</span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => handleDelete(e, agent.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </button>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800">
        <p className="text-[10px] text-gray-600">Powered by Claude + LangGraph</p>
      </div>
    </aside>
  )
}
