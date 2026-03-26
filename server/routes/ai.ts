import { Router, Request, Response } from 'express'
import OpenAI from 'openai'
import { buildBudgetContext, buildSystemPrompt } from '../lib/budgetContext'

const router = Router()

// ── OpenAI client (lazy — only fails when actually called) ────────────────────

let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables')
    }
    openai = new OpenAI({ apiKey })
  }
  return openai
}

// ── POST /api/ai/chat — GPT-4o Mini streaming via SSE ────────────────────────

interface ChatRequestBody {
  message: string
  model: string
  conversationId?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

router.post('/chat', async (req: Request, res: Response) => {
  const { message, model, history } = req.body as ChatRequestBody

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' })
  }

  if (model !== 'gpt4o_mini') {
    return res.status(400).json({ error: `Unsupported model: ${model}. Only "gpt4o_mini" is currently supported.` })
  }

  // Validate API key before switching to SSE mode
  let client: OpenAI
  try {
    client = getOpenAI()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const context = buildBudgetContext()
    const systemPrompt = buildSystemPrompt(context)

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    // Append conversation history if provided
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content })
        }
      }
    }

    messages.push({ role: 'user', content: message })

    const stream = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      stream_options: { include_usage: true },
      messages,
    })

    let totalTokens = 0
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? ''
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`)
      }
      if (chunk.usage) {
        totalTokens = chunk.usage.total_tokens
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, tokens_used: totalTokens })}\n\n`)
    res.end()
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    // If headers already sent (SSE started), send error as SSE event
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
      res.end()
    } else {
      res.status(500).json({ error: errorMessage })
    }
  }
})

export default router
