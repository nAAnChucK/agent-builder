import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import AgentBuilder from './components/AgentBuilder'
import AgentRunner from './components/AgentRunner'
import { listAgents, type AgentRecord } from './api/client'

type View = 'builder' | 'runner'

export default function App() {
  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<View>('builder')

  useEffect(() => {
    listAgents()
      .then(setAgents)
      .catch(console.error)
  }, [])

  function handleAgentCreated(agent: AgentRecord) {
    setAgents((prev) => [agent, ...prev])
    setSelectedId(agent.id)
    setView('runner')
  }

  function handleSelect(id: string | null) {
    setSelectedId(id)
    setView(id ? 'runner' : 'builder')
  }

  function handleNew() {
    setSelectedId(null)
    setView('builder')
  }

  function handleDeleted(id: string) {
    setAgents((prev) => prev.filter((a) => a.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
      setView('builder')
    }
  }

  const selectedAgent = agents.find((a) => a.id === selectedId) ?? null

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        agents={agents}
        selected={selectedId}
        onSelect={handleSelect}
        onNew={handleNew}
        onDeleted={handleDeleted}
      />

      <main className="flex-1 overflow-hidden">
        {view === 'builder' || !selectedAgent ? (
          <div className="h-full overflow-y-auto px-8 py-8 max-w-2xl mx-auto">
            <AgentBuilder onAgentCreated={handleAgentCreated} />
          </div>
        ) : (
          <AgentRunner agent={selectedAgent} />
        )}
      </main>
    </div>
  )
}
