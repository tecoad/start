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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type mismatch between @mastra/ai-sdk bundled types and ai package
        return createUIMessageStreamResponse({ stream: stream as any })
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
