# Mastra Chat Boilerplate

TanStack Start + Mastra AI chat boilerplate with a streaming weather agent.

## Quick Start

```bash
bun install
cp .env.example .env  # add your OPENAI_API_KEY
bun run dev
```

- App: http://localhost:3000/chat
- Mastra Studio: http://localhost:4111

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start app + Mastra Studio concurrently |
| `bun run dev:app` | Start only the Vite dev server (port 3000) |
| `bun run dev:mastra` | Start only Mastra Studio (port 4111) |
| `bun run build` | Build for production |

## Project Structure

```
src/
├── mastra/
│   ├── index.ts                 # Mastra config (storage, logging, observability)
│   ├── agents/weather-agent.ts  # Weather agent with memory
│   └── tools/weather-tool.ts    # Weather data tool (Open-Meteo API)
├── routes/
│   ├── api/chat.ts              # Chat API (POST streaming + GET history)
│   ├── chat.tsx                 # Chat page UI
│   └── __root.tsx               # Root layout
└── components/                  # Header, Footer, ThemeToggle
```

## Tech Stack

- **TanStack Start** -- React meta-framework with file-based routing
- **Mastra** -- AI agent framework with tools, memory, and workflows
- **AI SDK v5** -- Streaming chat via `useChat` + `DefaultChatTransport`
- **Tailwind CSS v4** -- Styling
- **LibSQL** -- SQLite storage for conversation history
