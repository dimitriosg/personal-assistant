import { useState, useCallback, useRef } from 'react'

interface CompareState {
  gptContent: string
  haikuContent: string
  gptDone: boolean
  haikuDone: boolean
  gptStarted: boolean
  haikuStarted: boolean
  isStreaming: boolean
  error: string | null
}

const INITIAL: CompareState = {
  gptContent: '',
  haikuContent: '',
  gptDone: false,
  haikuDone: false,
  gptStarted: false,
  haikuStarted: false,
  isStreaming: false,
  error: null,
}

export function useCompareStream() {
  const [state, setState] = useState<CompareState>(INITIAL)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async (body: object) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ ...INITIAL, isStreaming: true })

    try {
      const res = await fetch('/api/ai/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      if (!res.body) throw new Error('Response body is empty')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.error) {
              setState(prev => ({ ...prev, error: data.error, isStreaming: false }))
              return
            }
            if (data.source === 'gpt4o_mini') {
              if (data.done) {
                setState(prev => ({ ...prev, gptDone: true }))
              } else if (data.delta) {
                setState(prev => ({ ...prev, gptContent: prev.gptContent + data.delta, gptStarted: true }))
              }
            } else if (data.source === 'haiku') {
              if (data.done) {
                setState(prev => ({ ...prev, haikuDone: true }))
              } else if (data.delta) {
                setState(prev => ({ ...prev, haikuContent: prev.haikuContent + data.delta, haikuStarted: true }))
              }
            }
            // Final event (no source) with conversation_id means both done
            if (data.conversation_id && !data.source) {
              setState(prev => ({ ...prev, isStreaming: false }))
              return
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // Stream ended without explicit done — mark as finished
      setState(prev => ({ ...prev, isStreaming: false }))
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setState(prev => ({
        ...prev,
        error: e instanceof Error ? e.message : 'Connection error. Please try again.',
        isStreaming: false,
      }))
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(INITIAL)
  }, [])

  return { ...state, send, reset }
}
