# Mastra Chat Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a streaming chat UI at `/chat` powered by the existing Mastra weather agent, with message history persistence and concurrent Mastra Studio dev mode.

**Architecture:** TanStack Start API route (`createFileRoute` + `server.handlers`) handles POST (streaming) and GET (history recall). A React page component at `/chat` uses AI SDK v5's `useChat` hook with `DefaultChatTransport` to connect to the API. Dev scripts run both Vite and Mastra Studio concurrently.

**Tech Stack:** TanStack Start, Mastra (`@mastra/ai-sdk`, `@mastra/core`), AI SDK v5 (`ai`, `@ai-sdk/react`), Tailwind CSS, concurrently

**Spec:** `docs/superpowers/specs/2026-03-15-mastra-chat-integration-design.md`

---

## Chunk 1: Infrastructure

### Task 1: Install concurrently and update dev scripts

**Files:**
- Modify: `package.json:8-15` (scripts section)

- [ ] **Step 1: Install dependencies**

Run: `bun add @mastra/ai-sdk@latest @ai-sdk/react ai && bun add -d concurrently`
Expected: `@mastra/ai-sdk`, `@ai-sdk/react`, and `ai` added to dependencies; `concurrently` added to devDependencies. These packages may already exist in `node_modules` as transitive deps, but must be declared explicitly.

- [ ] **Step 2: Update dev scripts in package.json**

Replace the `scripts` section:

```json
"scripts": {
  "dev": "concurrently -n app,mastra -c blue,magenta \"bun run dev:app\" \"bun run dev:mastra\"",
  "dev:app": "vite dev --port 3000",
  "dev:mastra": "mastra dev",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "format": "biome format",
  "lint": "biome lint",
  "check": "biome check"
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "feat: add concurrently for parallel dev servers"
```

### Task 2: Update Mastra storage to absolute path

**Files:**
- Modify: `src/mastra/index.ts:16`

- [ ] **Step 1: Change the storage URL**

In `src/mastra/index.ts`, change:

```ts
url: "file:./mastra.db",
```

to:

```ts
url: `file:${process.cwd()}/mastra.db`,
```

- [ ] **Step 2: Verify the app still starts**

Run: `bun run dev:app`
Expected: Vite dev server starts on port 3000 without errors. Stop it after confirming.

- [ ] **Step 3: Commit**

```bash
git add src/mastra/index.ts
git commit -m "fix: use absolute path for mastra DB storage"
```

---

## Chunk 2: API Route

### Task 3: Create the chat API route

**Files:**
- Create: `src/routes/api/chat.ts`

**Docs to check:**
- `node_modules/@mastra/ai-sdk/dist/chat-route.d.ts` -- `handleChatStream` signature
- `node_modules/@mastra/ai-sdk/dist/convert-messages.d.ts` -- `toAISdkV5Messages` signature
- `node_modules/ai/dist/index.d.ts` -- `createUIMessageStreamResponse` export

- [ ] **Step 1: Create the API route file**

Create `src/routes/api/chat.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { handleChatStream } from '@mastra/ai-sdk'
import { toAISdkV5Messages } from '@mastra/ai-sdk/ui'
import { createUIMessageStreamResponse } from 'ai'
import { mastra } from '#/mastra'

const THREAD_ID = 'example-user-id'
const RESOURCE_ID = 'weather-chat'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const params = await request.json()
        const stream = await handleChatStream({
          mastra,
          agentId: 'weather-agent',
          params: {
            ...params,
            memory: {
              ...params.memory,
              thread: THREAD_ID,
              resource: RESOURCE_ID,
            },
          },
        })
        return createUIMessageStreamResponse({ stream })
      },

      GET: async () => {
        const memory = await mastra.getAgentById('weather-agent').getMemory()
        let response = null

        try {
          response = await memory?.recall({
            threadId: THREAD_ID,
            resourceId: RESOURCE_ID,
          })
        } catch {
          console.log('No previous messages found.')
        }

        const uiMessages = toAISdkV5Messages(response?.messages || [])

        return new Response(JSON.stringify(uiMessages), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `bunx tsc --noEmit`
Expected: No type errors related to `src/routes/api/chat.ts`. If TanStack router types complain about route tree generation, that's expected -- the route tree hasn't been regenerated yet.

- [ ] **Step 3: Regenerate the route tree**

Run: `bun run dev:app` briefly (TanStack Start auto-generates the route tree on dev start). Stop after route tree is generated.

Check that `src/routeTree.gen.ts` now includes the `/api/chat` route.

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/chat.ts src/routeTree.gen.ts
git commit -m "feat: add chat API route with streaming and history"
```

---

## Chunk 3: Chat Page UI

### Task 4: Create the chat page component

**Files:**
- Create: `src/routes/chat.tsx`

- [ ] **Step 1: Create the chat page**

Create `src/routes/chat.tsx`:

```tsx
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
                    {toolPart.input && (
                      <pre className="mt-1 overflow-x-auto text-[var(--sea-ink-soft)]">
                        {JSON.stringify(toolPart.input, null, 2)}
                      </pre>
                    )}
                    {toolPart.output && (
                      <pre className="mt-1 overflow-x-auto text-[var(--sea-ink-soft)]">
                        {JSON.stringify(toolPart.output, null, 2)}
                      </pre>
                    )}
                    {toolPart.errorText && (
                      <p className="mt-1 text-red-600">{toolPart.errorText as string}</p>
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
```

- [ ] **Step 2: Regenerate route tree and verify TypeScript**

Run: `bun run dev:app` briefly to regenerate route tree (adds `/chat` route). Stop after it starts.

Then: `bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/chat.tsx src/routeTree.gen.ts
git commit -m "feat: add chat page with streaming AI responses"
```

---

## Chunk 4: Manual Verification

### Task 5: End-to-end manual test

- [ ] **Step 1: Start both servers**

Run: `bun run dev`
Expected: Both `[app]` (port 3000) and `[mastra]` (port 4111) start without errors.

- [ ] **Step 2: Test the chat page**

Open `http://localhost:3000/chat` in browser.

Verify:
1. Page loads with "Weather Chat" heading, input field, and Send button
2. Type "What's the weather in Tokyo?" and press Enter
3. User message appears on the right
4. Assistant response streams in on the left
5. Tool invocation card appears showing the weather tool call with input/output
6. Response includes temperature, humidity, wind info

- [ ] **Step 3: Test message persistence**

1. Refresh the page
2. Previous messages should reload from memory

- [ ] **Step 4: Test Mastra Studio**

Open `http://localhost:4111` in browser.

Verify:
1. Studio loads
2. Weather agent is listed
3. Weather tool is visible

- [ ] **Step 5: Final commit if any adjustments were needed**

Only if changes were made during testing:

```bash
git add -A
git commit -m "fix: adjustments from manual testing"
```
