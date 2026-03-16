import { createFileRoute } from '@tanstack/react-router'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useMemo, useState } from 'react'

export const Route = createFileRoute('/chat')({
  component: ChatPage,
})

function ChatPage() {
  const [input, setInput] = useState('')
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), [])

  const { messages, setMessages, sendMessage, status } = useChat({
    transport,
  })

  useEffect(() => {
    const fetchMessages = async () => {
      const res = await fetch('/api/chat')
      const data = await res.json()
      setMessages([...data])
    }
    fetchMessages()
  }, [setMessages])

  const handleSubmit = () => {
    if (!input.trim()) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col p-4">
      <h1 className="mb-4 text-2xl font-bold text-[var(--sea-ink)]">Weather Chat</h1>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-[rgba(23,58,64,0.1)] bg-white/50 p-4">
        {messages.map((message) => (
          <div key={message.id}>
            {message.parts?.map((part, i) => {
              if (part.type === 'text') {
                return (
                  <div
                    key={`${message.id}-${i}`}
                    className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'ml-auto max-w-[80%] bg-[rgba(79,184,178,0.14)] text-[var(--sea-ink)]'
                        : 'mr-auto max-w-[80%] bg-[rgba(23,58,64,0.05)] text-[var(--sea-ink)]'
                    }`}
                  >
                    <p className="mb-1 text-xs font-semibold opacity-60">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{part.text}</p>
                  </div>
                )
              }

              if (part.type?.startsWith('tool-')) {
                const toolPart = part as Record<string, unknown>
                return (
                  <div
                    key={`${message.id}-${i}`}
                    className="my-2 rounded-lg border border-[rgba(79,184,178,0.3)] bg-[rgba(79,184,178,0.06)] p-3 text-xs"
                  >
                    <p className="font-semibold text-[var(--lagoon-deep)]">
                      Tool: {(toolPart.toolName as string) || 'unknown'}
                    </p>
                    {toolPart.input != null && (
                      <pre className="mt-1 overflow-x-auto text-[var(--sea-ink-soft)]">
                        {String(JSON.stringify(toolPart.input, null, 2))}
                      </pre>
                    )}
                    {toolPart.output != null && (
                      <pre className="mt-1 overflow-x-auto text-[var(--sea-ink-soft)]">
                        {String(JSON.stringify(toolPart.output, null, 2))}
                      </pre>
                    )}
                    {toolPart.errorText != null && (
                      <p className="mt-1 text-red-600">{String(toolPart.errorText)}</p>
                    )}
                  </div>
                )
              }

              return null
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="Ask about the weather..."
          disabled={status !== 'ready'}
          className="flex-1 rounded-full border border-[rgba(23,58,64,0.2)] bg-white/80 px-5 py-2.5 text-sm outline-none transition focus:border-[rgba(79,184,178,0.5)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)] disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={status !== 'ready' || !input.trim()}
          className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)] disabled:opacity-50 disabled:hover:translate-y-0"
        >
          Send
        </button>
      </div>
    </main>
  )
}
