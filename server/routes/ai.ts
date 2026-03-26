import { Router, Request, Response } from 'express'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
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

// ── Anthropic client (lazy — only fails when actually called) ─────────────────

let anthropic: Anthropic | null = null

function getAnthropic(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables')
    }
    anthropic = new Anthropic({ apiKey })
  }
  return anthropic
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

  if (!model || typeof model !== 'string') {
    return res.status(400).json({ error: 'model is required' })
  }

  if (model !== 'gpt4o_mini' && model !== 'haiku') {
    return res.status(400).json({ error: `Unsupported model: ${model}. Supported models: "gpt4o_mini", "haiku".` })
  }

  // Validate API key before switching to SSE mode
  let openaiClient: OpenAI | null = null
  let anthropicClient: Anthropic | null = null
  try {
    if (model === 'gpt4o_mini') {
      openaiClient = getOpenAI()
    } else {
      anthropicClient = getAnthropic()
    }
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

    if (model === 'gpt4o_mini') {
      const stream = await openaiClient!.chat.completions.create({
        model: 'gpt-4o-mini',
        stream: true,
        stream_options: { include_usage: true },
        messages,
      })

      // Abort the OpenAI stream if client disconnects
      let aborted = false
      req.on('close', () => {
        aborted = true
        stream.controller.abort()
      })

      let totalTokens = 0
      for await (const chunk of stream) {
        if (aborted) break
        const delta = chunk.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          res.write(`data: ${JSON.stringify({ delta })}\n\n`)
        }
        if (chunk.usage) {
          totalTokens = chunk.usage.total_tokens
        }
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ done: true, tokens_used: totalTokens })}\n\n`)
        res.end()
      }
    } else if (model === 'haiku') {
      const stream = anthropicClient!.messages.stream({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      })

      // Abort the Anthropic stream if client disconnects
      let aborted = false
      res.on('close', () => {
        aborted = true
        stream.abort()
      })

      for await (const event of stream) {
        if (aborted) break
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const delta = event.delta.text ?? ''
          if (delta) {
            res.write(`data: ${JSON.stringify({ delta })}\n\n`)
          }
        }
      }

      if (!aborted) {
        const finalMessage = await stream.finalMessage()
        const tokens = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens
        res.write(`data: ${JSON.stringify({ done: true, tokens_used: tokens })}\n\n`)
        res.end()
      }
    }
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

// ── POST /api/ai/compare — both models streaming via single SSE connection ───

interface CompareRequestBody {
  message: string
  conversationId?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

router.post('/compare', async (req: Request, res: Response) => {
  const { message, history } = req.body as CompareRequestBody

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' })
  }

  // Validate both API keys before switching to SSE mode
  let openaiClient: OpenAI
  let anthropicClient: Anthropic
  try {
    openaiClient = getOpenAI()
    anthropicClient = getAnthropic()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let aborted = false

  try {
    const context = buildBudgetContext()
    const systemPrompt = buildSystemPrompt(context)

    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]
    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    // Append conversation history if provided
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          openaiMessages.push({ role: h.role, content: h.content })
          anthropicMessages.push({ role: h.role, content: h.content })
        }
      }
    }

    openaiMessages.push({ role: 'user', content: message })
    anthropicMessages.push({ role: 'user', content: message })

    // ── GPT-4o Mini stream ──────────────────────────────────────────────────
    const streamGPT = async () => {
      const stream = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        stream: true,
        stream_options: { include_usage: true },
        messages: openaiMessages,
      })

      req.on('close', () => {
        aborted = true
        stream.controller.abort()
      })

      let totalTokens = 0
      for await (const chunk of stream) {
        if (aborted) break
        const delta = chunk.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          res.write(`data: ${JSON.stringify({ source: 'gpt4o_mini', delta })}\n\n`)
        }
        if (chunk.usage) {
          totalTokens = chunk.usage.total_tokens
        }
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ source: 'gpt4o_mini', done: true, tokens_used: totalTokens })}\n\n`)
      }
    }

    // ── Claude Haiku stream ─────────────────────────────────────────────────
    const streamHaiku = async () => {
      const stream = anthropicClient.messages.stream({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
      })

      res.on('close', () => {
        aborted = true
        stream.abort()
      })

      for await (const event of stream) {
        if (aborted) break
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const delta = event.delta.text ?? ''
          if (delta) {
            res.write(`data: ${JSON.stringify({ source: 'haiku', delta })}\n\n`)
          }
        }
      }

      if (!aborted) {
        const finalMessage = await stream.finalMessage()
        const tokens = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens
        res.write(`data: ${JSON.stringify({ source: 'haiku', done: true, tokens_used: tokens })}\n\n`)
      }
    }

    // Run both streams in parallel
    await Promise.all([streamGPT(), streamHaiku()])

    if (!aborted) {
      res.end()
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
      res.end()
    } else {
      res.status(500).json({ error: errorMessage })
    }
  }
})

export default router
