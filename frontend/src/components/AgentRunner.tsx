import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Wrench, ChevronDown, ChevronUp } from 'lucide-react'
import { streamAgentRun, type AgentRecord, type StreamEvent } from '../api/client'
import { v4 as uuidv4 } from '../utils/uuid'

interface ToolCall {
  tool: string
  input: Record<string, unknown>
  output?: string
  open: boolean
}

type Role = 'user' | 'assistant'

interface Message {
  id: string
  role: Role
  content: string
  toolCalls: ToolCall[]
  streaming: boolean
}

interface Props {
  agent: AgentRecord
}

export default function AgentRunner({ agent }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [threadId] = useState(() => uuidv4())
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const toggleTool = useCallback((msgId: string, toolIdx: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              toolCalls: m.toolCalls.map((tc, i) =>
                i === toolIdx ? { ...tc, open: !tc.open } : tc,
              ),
            }
          : m,
      ),
    )
  }, [])

  async function handleSend() {
    const text = input.trim()
    if (!text || running) return

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: text,
      toolCalls: [],
      streaming: false,
    }
    const assistantMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      toolCalls: [],
      streaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setRunning(true)

    try {
      for await (const event of streamAgentRun(agent.id, text, threadId)) {
        handleStreamEvent(assistantMsg.id, event)
        if (event.type === 'done') break
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: m.content || 'Error: ' + String(e), streaming: false }
            : m,
        ),
      )
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, streaming: false } : m)),
      )
      setRunning(false)
      textareaRef.current?.focus()
    }
  }

  function handleStreamEvent(msgId: string, event: StreamEvent) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m
        switch (event.type) {
          case 'token':
            return { ...m, content: m.content + event.content }
          case 'tool_start':
            return {
              ...m,
              toolCalls: [...m.toolCalls, { tool: event.tool, input: event.input, open: true }],
            }
          case 'tool_end': {
            const calls = [...m.toolCalls]
            const idx = [...calls].reverse().findIndex((tc: ToolCall) => tc.tool === event.tool && !tc.output)
            const realIdx = idx >= 0 ? calls.length - 1 - idx : -1
            if (realIdx >= 0) calls[realIdx] = { ...calls[realIdx], output: event.output }
            return { ...m, toolCalls: calls }
          }
          default:
            return m
        }
      }),
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
        <Bot size={20} className="text-indigo-400" />
        <div>
          <h2 className="font-semibold text-white">{agent.config.name}</h2>
          <p className="text-xs text-gray-500">{agent.config.description}</p>
        </div>
        <div className="ml-auto flex gap-1.5">
          {agent.config.tools.map((t) => (
            <span key={t} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-600">
              <Bot size={40} className="mx-auto mb-3 text-gray-700" />
              <p className="text-sm">Send a message to start chatting with this agent.</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-900 flex items-center justify-center mt-0.5">
                <Bot size={14} className="text-indigo-300" />
              </div>
            )}

            <div className={`flex flex-col gap-2 max-w-[75%] ${msg.role === 'user' ? 'items-end' : ''}`}>
              {/* Tool calls */}
              {msg.toolCalls.map((tc, i) => (
                <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg text-xs w-full">
                  <button
                    onClick={() => toggleTool(msg.id, i)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <Wrench size={11} className="text-amber-400 shrink-0" />
                    <span className="font-mono text-amber-300">{tc.tool}</span>
                    {tc.output && (
                      <span className="ml-auto text-green-500 text-[10px]">✓</span>
                    )}
                    {tc.open ? <ChevronUp size={11} className="ml-auto" /> : <ChevronDown size={11} className="ml-auto" />}
                  </button>
                  {tc.open && (
                    <div className="border-t border-gray-700 px-3 py-2 space-y-2">
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Input</p>
                        <pre className="text-gray-400 whitespace-pre-wrap">{JSON.stringify(tc.input, null, 2)}</pre>
                      </div>
                      {tc.output && (
                        <div>
                          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Output</p>
                          <pre className="text-gray-400 whitespace-pre-wrap">{tc.output}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Message bubble */}
              {(msg.content || msg.streaming) && (
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-gray-800 text-gray-100 rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                  {msg.streaming && !msg.content && (
                    <span className="inline-flex gap-1 items-center text-gray-500">
                      <span className="animate-bounce [animation-delay:0ms]">·</span>
                      <span className="animate-bounce [animation-delay:150ms]">·</span>
                      <span className="animate-bounce [animation-delay:300ms]">·</span>
                    </span>
                  )}
                  {msg.streaming && msg.content && (
                    <span className="inline-block w-0.5 h-3.5 bg-gray-400 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="shrink-0 w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center mt-0.5">
                <User size={14} className="text-gray-300" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-800">
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            placeholder="Message the agent… (Ctrl+Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleSend()
              }
            }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || running}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white p-2.5 rounded-xl transition-colors shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-gray-700 mt-2">
          Thread ID: {threadId.slice(0, 8)}… — messages are remembered within this session.
        </p>
      </div>
    </div>
  )
}
