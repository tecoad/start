# Mastra AI Chat Integration in TanStack Start

## Goal

Replicate the [Next.js Mastra chat guide](https://mastra.ai/guides/getting-started/next-js) in TanStack Start: a `/chat` route with the weather agent, streaming responses, tool call display, message history persistence, and concurrent Mastra Studio in dev mode.

## Context

The project is a TanStack Start app (`@tanstack/react-start@1.166.x`) with Mastra already initialized (`src/mastra/` with weather agent, tools, workflows, and LibSQL storage). The Next.js guide uses App Router API routes (`app/api/chat/route.ts`) and AI SDK React hooks.

TanStack Start does not have a `createAPIFileRoute` function. Instead, it supports server-side HTTP handlers via `createFileRoute` with `server.handlers`, where each handler method (`GET`, `POST`, etc.) receives a context object with `request`, `params`, and `pathname`, and returns a standard `Response` object.

## Approach

**TanStack Start `server.handlers`** -- the most direct translation of the Next.js pattern. The `server.handlers` option on `createFileRoute` provides `GET`/`POST` handlers that return standard `Response` objects, which is exactly what `@ai-sdk/react`'s `useChat` hook expects.

## Architecture

### Translation Map

| Next.js                        | TanStack Start                                                             |
| ------------------------------ | -------------------------------------------------------------------------- |
| `app/api/chat/route.ts`        | `src/routes/api/chat.ts` (`createFileRoute('/api/chat')` + `server.handlers`) |
| `app/chat/page.tsx`            | `src/routes/chat.tsx` (`createFileRoute('/chat')` + `component`)           |
| `@/mastra` path alias          | `#/mastra` (configured via `imports` in package.json)                      |
| `ai-elements` components       | Inline Tailwind components (no external dependency)                        |

### File Changes

```
src/
├── routes/
│   ├── api/
│   │   └── chat.ts          <- NEW: API route (POST stream + GET history)
│   └── chat.tsx              <- NEW: Chat page UI
├── mastra/
│   └── index.ts              <- MODIFY: absolute DB path
package.json                  <- MODIFY: concurrently dev scripts
```

## Components

### 1. API Route (`src/routes/api/chat.ts`)

Uses `createFileRoute('/api/chat')` with `server.handlers` (no `component` export). Each handler receives `ctx: { request, params, pathname }` and returns a `Response`.

**Imports:**

```ts
import { createFileRoute } from '@tanstack/react-router'
import { handleChatStream } from '@mastra/ai-sdk'
import { toAISdkV5Messages } from '@mastra/ai-sdk/ui'
import { createUIMessageStreamResponse } from 'ai'
import { mastra } from '#/mastra'
```

**Constants:**

```ts
const THREAD_ID = 'example-user-id'
const RESOURCE_ID = 'weather-chat'
```

**POST handler:**
- Parses request body via `ctx.request.json()`
- Injects `memory: { thread: THREAD_ID, resource: RESOURCE_ID }` into params (note: the `AgentExecutionOptions.memory` API uses `thread` and `resource` field names)
- Calls `handleChatStream({ mastra, agentId: 'weather-agent', params })` which returns a `ReadableStream`
- Returns `createUIMessageStreamResponse({ stream })`

**GET handler:**
- Gets weather agent's memory via `await mastra.getAgentById('weather-agent').getMemory()`
- Recalls messages with `memory.recall({ threadId: THREAD_ID, resourceId: RESOURCE_ID })` (note: the `Memory.recall` API uses `threadId` and `resourceId` field names -- different from the execution API above)
- Wraps in try/catch, returns empty array if no history exists
- Converts to UI format via `toAISdkV5Messages(response?.messages || [])`
- Returns `new Response(JSON.stringify(uiMessages), { headers: { 'Content-Type': 'application/json' } })`

### 2. Chat Page (`src/routes/chat.tsx`)

Uses `createFileRoute('/chat')` with a `component` export.

**Imports:**

```ts
import { createFileRoute } from '@tanstack/react-router'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
```

**State and hooks:**
- `useChat` from `@ai-sdk/react` configured with `transport: new DefaultChatTransport({ api: '/api/chat' })`
- Returns `{ messages, setMessages, sendMessage, status }` (AI SDK v5 API -- no `handleSubmit` or `input` binding)
- Local `input` state managed via `useState` for the textarea
- Submit calls `sendMessage({ text: input })` then clears the input
- `useEffect` on mount fetches GET `/api/chat` and hydrates history with `setMessages`

**Rendering:**
- Message list iterating `messages`, rendering each `part`:
  - `type === 'text'`: styled message bubble with role indicator (user/assistant)
  - `type` starting with `'tool-'`: tool invocation display showing tool name, input JSON, output/error
- Input area: textarea + submit button, disabled when `status !== 'ready'`
- Styled with Tailwind, no external UI library dependency

### 3. Mastra Config Update (`src/mastra/index.ts`)

Change storage URL from relative to absolute path:

```ts
// Before
url: "file:./mastra.db"

// After
url: `file:${process.cwd()}/mastra.db`
```

This ensures both the Vite dev server and Mastra Studio share the same SQLite database file regardless of which working directory each process starts from.

### 4. Dev Scripts (`package.json`)

Install `concurrently` as devDependency. Update scripts:

```json
{
  "dev": "concurrently -n app,mastra -c blue,magenta \"bun run dev:app\" \"bun run dev:mastra\"",
  "dev:app": "vite dev --port 3000",
  "dev:mastra": "mastra dev"
}
```

`bun run dev` starts both servers. Individual scripts available for running them separately.

### 5. Dependencies

| Package | Status | Type |
| --- | --- | --- |
| `@mastra/ai-sdk` | Already installed | runtime |
| `@ai-sdk/react` | Already installed | runtime |
| `ai` | Already installed | runtime |
| `concurrently` | To install | devDependency |

## Data Flow

```
User types message
    → useChat sends POST /api/chat
        → handleChatStream(mastra, 'weather-agent', params)
            → Agent processes with memory (thread: THREAD_ID, resource: RESOURCE_ID)
            → Agent may invoke weatherTool (geocoding + weather API)
        → createUIMessageStreamResponse streams back SSE chunks
    → useChat updates messages state
    → UI renders text parts + tool invocations

Page reload
    → useEffect fetches GET /api/chat
        → memory.recall({ threadId: THREAD_ID, resourceId: RESOURCE_ID })
        → toAISdkV5Messages converts to UI format
    → setMessages hydrates chat history
```

## Error Handling

- GET `/api/chat`: wraps `memory.recall` in try/catch, returns empty array if no history exists
- POST `/api/chat`: relies on `handleChatStream`'s built-in error handling (streams error events to client)
- Weather tool: existing error handling for unknown locations (`throw new Error`)

## Testing

- Manual: start dev server, navigate to `/chat`, ask weather questions, verify streaming, tool display, and history persistence across page reloads
- Mastra Studio: verify agent and tool appear at `localhost:4111`, test agent directly
