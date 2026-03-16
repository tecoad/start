# Mastra AI Chat Integration in TanStack Start

## Goal

Replicate the [Next.js Mastra chat guide](https://mastra.ai/guides/getting-started/next-js) in TanStack Start: a `/chat` route with the weather agent, streaming responses, tool call display, message history persistence, and concurrent Mastra Studio in dev mode.

## Context

The project is a TanStack Start app with Mastra already initialized (`src/mastra/` with weather agent, tools, workflows, and LibSQL storage). The Next.js guide uses App Router API routes (`app/api/chat/route.ts`) and AI SDK React hooks. TanStack Start uses file-based routing with `createFileRoute` and supports API routes via `server.handlers`.

## Approach

**TanStack Start API Routes** -- the most direct translation of the Next.js pattern. TanStack Start's `createAPIFileRoute` provides `GET`/`POST` handlers that return standard `Response` objects, which is exactly what `@ai-sdk/react`'s `useChat` hook expects.

## Architecture

### Translation Map

| Next.js                        | TanStack Start                                       |
| ------------------------------ | ---------------------------------------------------- |
| `app/api/chat/route.ts`        | `src/routes/api/chat.ts` (API route, `server.handlers`) |
| `app/chat/page.tsx`            | `src/routes/chat.tsx` (file route with component)    |
| `@/mastra` path alias          | `#/mastra` (configured via `imports` in package.json) |
| `ai-elements` components       | Inline Tailwind components (no external dependency)  |

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

TanStack Start API route using `createAPIFileRoute('/api/chat')` with no component export.

**POST handler:**
- Parses request body via `request.json()`
- Injects hardcoded `thread` (`'example-user-id'`) and `resource` (`'weather-chat'`) IDs into memory params
- Calls `handleChatStream` from `@mastra/ai-sdk` with `mastra` instance and `agentId: 'weather-agent'`
- Returns `createUIMessageStreamResponse({ stream })` from the `ai` package

**GET handler:**
- Gets weather agent's memory via `mastra.getAgentById('weather-agent').getMemory()`
- Recalls messages with `memory.recall({ threadId: 'example-user-id', resourceId: 'weather-chat' })`
- Converts to UI format via `toAISdkV5Messages` from `@mastra/ai-sdk/ui`
- Returns `new Response(JSON.stringify(uiMessages))` with `application/json` content type

### 2. Chat Page (`src/routes/chat.tsx`)

Client-side component using `createFileRoute('/chat')`.

**State and hooks:**
- `useChat` from `@ai-sdk/react` with `DefaultChatTransport({ api: '/api/chat' })`
- Local `input` state for the textarea
- `useEffect` on mount to fetch history via GET `/api/chat` and hydrate with `setMessages`

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
  "dev": "concurrently -n app,mastra -c blue,magenta \"vite dev --port 3000\" \"mastra dev\"",
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
            → Agent processes with memory (thread + resource IDs)
            → Agent may invoke weatherTool (geocoding + weather API)
        → createUIMessageStreamResponse streams back SSE chunks
    → useChat updates messages state
    → UI renders text parts + tool invocations

Page reload
    → useEffect fetches GET /api/chat
        → memory.recall(threadId, resourceId)
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
