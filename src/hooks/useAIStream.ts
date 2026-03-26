import { useState, useCallback } from 'react'

export function useAIStream(endpoint: string) {
  const [content, setContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(async (body: object) => {
    setContent('')
    setIsStreaming(true)
    setError(null)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = JSON.parse(line.slice(6))
          if (data.error) {
            setError(data.error)
            setIsStreaming(false)
            return
          }
          if (data.done) {
            setIsStreaming(false)
            return
          }
          if (data.delta) setContent(prev => prev + data.delta)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection error. Please try again.')
      setIsStreaming(false)
    }
  }, [endpoint])

  const reset = useCallback(() => {
    setContent('')
    setIsStreaming(false)
    setError(null)
  }, [])

  return { content, isStreaming, error, send, reset }
}
