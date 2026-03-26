import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * React Error Boundary – catches rendering errors in child components and
 * displays a friendly fallback UI instead of crashing the whole page.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="bg-red-950/40 border border-red-900 rounded-xl p-5 max-w-md w-full text-center">
            <p className="text-red-400 text-sm font-medium mb-2">Something went wrong</p>
            <p className="text-red-600 text-xs mb-4">{this.state.error?.message ?? 'Unknown error'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-1.5 text-sm font-medium bg-gray-800 hover:bg-gray-700
                text-gray-200 rounded-lg transition-colors border border-gray-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
