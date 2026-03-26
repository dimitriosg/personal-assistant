import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { buildBudgetContext, buildSystemPrompt } from '../lib/budgetContext'
import db from '../db'

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

// ── Helper: save a message row to ai_conversations ────────────────────────────

const insertMessage = db.prepare(`
  INSERT INTO ai_conversations (conversation_id, role, content, model, tokens_used)
  VALUES (?, ?, ?, ?, ?)
`)

function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  model: string,
  tokensUsed: number = 0,
): void {
  try {
    insertMessage.run(conversationId, role, content, model, tokensUsed)
  } catch (err) {
    console.warn('Failed to save ai_conversation message:', err instanceof Error ? err.message : err)
  }
}

// ── POST /api/ai/chat — GPT-4o Mini streaming via SSE ────────────────────────

interface ChatRequestBody {
  message: string
  model: string
  conversationId?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

router.post('/chat', async (req: Request, res: Response) => {
  const { message, model, history, conversationId: clientConvId } = req.body as ChatRequestBody
  const conversationId = clientConvId || crypto.randomUUID()

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
      let fullResponse = ''
      for await (const chunk of stream) {
        if (aborted) break
        const delta = chunk.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          fullResponse += delta
          res.write(`data: ${JSON.stringify({ delta })}\n\n`)
        }
        if (chunk.usage) {
          totalTokens = chunk.usage.total_tokens
        }
      }

      if (!aborted) {
        saveMessage(conversationId, 'user', message, 'gpt-4o-mini', 0)
        saveMessage(conversationId, 'gpt4o_mini', fullResponse, 'gpt-4o-mini', totalTokens)
        res.write(`data: ${JSON.stringify({ done: true, tokens_used: totalTokens, conversation_id: conversationId })}\n\n`)
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

      let fullResponse = ''
      for await (const event of stream) {
        if (aborted) break
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const delta = event.delta.text ?? ''
          if (delta) {
            fullResponse += delta
            res.write(`data: ${JSON.stringify({ delta })}\n\n`)
          }
        }
      }

      if (!aborted) {
        const finalMessage = await stream.finalMessage()
        const tokens = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens
        saveMessage(conversationId, 'user', message, 'claude-haiku-3-5', 0)
        saveMessage(conversationId, 'haiku', fullResponse, 'claude-haiku-3-5', tokens)
        res.write(`data: ${JSON.stringify({ done: true, tokens_used: tokens, conversation_id: conversationId })}\n\n`)
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
  const { message, history, conversationId: clientConvId } = req.body as CompareRequestBody
  const conversationId = clientConvId || crypto.randomUUID()

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
    let gptResponse = ''
    let gptTokens = 0
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

      for await (const chunk of stream) {
        if (aborted) break
        const delta = chunk.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          gptResponse += delta
          res.write(`data: ${JSON.stringify({ source: 'gpt4o_mini', delta })}\n\n`)
        }
        if (chunk.usage) {
          gptTokens = chunk.usage.total_tokens
        }
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ source: 'gpt4o_mini', done: true, tokens_used: gptTokens })}\n\n`)
      }
    }

    // ── Claude Haiku stream ─────────────────────────────────────────────────
    let haikuResponse = ''
    let haikuTokens = 0
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
            haikuResponse += delta
            res.write(`data: ${JSON.stringify({ source: 'haiku', delta })}\n\n`)
          }
        }
      }

      if (!aborted) {
        const finalMessage = await stream.finalMessage()
        haikuTokens = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens
        res.write(`data: ${JSON.stringify({ source: 'haiku', done: true, tokens_used: haikuTokens })}\n\n`)
      }
    }

    // Run both streams in parallel
    await Promise.all([streamGPT(), streamHaiku()])

    if (!aborted) {
      saveMessage(conversationId, 'user', message, 'compare', 0)
      saveMessage(conversationId, 'gpt4o_mini', gptResponse, 'compare', gptTokens)
      saveMessage(conversationId, 'haiku', haikuResponse, 'compare', haikuTokens)
      res.write(`data: ${JSON.stringify({ conversation_id: conversationId })}\n\n`)
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

// ── GET /api/ai/context — temporary debug endpoint to view budget context ─────
// TODO: Remove this endpoint once the AI Assistant frontend is complete (Phase 7 Step 6+)

router.get('/context', (_req: Request, res: Response) => {
  try {
    const context = buildBudgetContext()
    res.setHeader('Content-Type', 'text/plain')
    res.send(context)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: msg })
  }
})

// ── GET /api/ai/token-usage — aggregate token usage for a date range ──────────

const tokenUsageQuery = db.prepare(`
  SELECT COALESCE(SUM(COALESCE(tokens_used, 0)), 0) AS total_tokens
  FROM ai_conversations
  WHERE created_at >= :from AND created_at < :to
`)

router.get('/token-usage', (req: Request, res: Response) => {
  try {
    const { from, to } = req.query
    if (typeof from !== 'string' || typeof to !== 'string') {
      return res.status(400).json({ error: 'from and to query params are required (YYYY-MM-DD)' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: 'from and to must be in YYYY-MM-DD format' })
    }
    const row = tokenUsageQuery.get({ from, to }) as { total_tokens: number }
    res.json({ total_tokens: row.total_tokens })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: msg })
  }
})

// ── GET /api/ai/conversations — list past conversations ───────────────────────

const listConversations = db.prepare(`
  SELECT
    conversation_id,
    MIN(CASE WHEN role = 'user' THEN content END) AS preview,
    model,
    MIN(created_at) AS created_at,
    COUNT(*) AS message_count,
    SUM(tokens_used) AS total_tokens
  FROM ai_conversations
  GROUP BY conversation_id
  ORDER BY MIN(created_at) DESC
`)

router.get('/conversations', (_req: Request, res: Response) => {
  try {
    const rows = listConversations.all() as Array<Record<string, unknown>>
    res.json(rows)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: msg })
  }
})

// ── GET /api/ai/conversations/:conversationId — get messages in a conversation

const getConversation = db.prepare(`
  SELECT role, content, tokens_used, created_at
  FROM ai_conversations
  WHERE conversation_id = ?
  ORDER BY created_at ASC, id ASC
`)

router.get('/conversations/:conversationId', (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params
    const rows = getConversation.all(conversationId) as Array<Record<string, unknown>>
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    res.json(rows)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: msg })
  }
})

// ── DELETE /api/ai/conversations — delete ALL conversations ───────────────────

router.delete('/conversations', (_req: Request, res: Response) => {
  try {
    db.exec('DELETE FROM ai_conversations')
    res.json({ deleted: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: msg })
  }
})

// ── DELETE /api/ai/conversations/:conversationId — delete a conversation ──────

const deleteConversation = db.prepare(`
  DELETE FROM ai_conversations WHERE conversation_id = ?
`)

router.delete('/conversations/:conversationId', (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params
    deleteConversation.run(conversationId)
    res.json({ deleted: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: msg })
  }
})

export default router
