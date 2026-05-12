type AbortListener = () => void

class MiniappAbortSignal {
  aborted = false
  reason: unknown = undefined
  onabort: AbortListener | null = null
  private listeners = new Set<AbortListener>()

  addEventListener(type: string, listener: AbortListener) {
    if (type === 'abort') this.listeners.add(listener)
  }

  removeEventListener(type: string, listener: AbortListener) {
    if (type === 'abort') this.listeners.delete(listener)
  }

  dispatchEvent(event: { type: string }) {
    if (event.type !== 'abort') return false
    this.listeners.forEach((listener) => listener())
    this.onabort?.()
    return true
  }

  throwIfAborted() {
    if (this.aborted) throw this.reason || new Error('AbortError')
  }

  abort(reason?: unknown) {
    if (this.aborted) return
    this.aborted = true
    this.reason = reason
    this.dispatchEvent({ type: 'abort' })
  }
}

class MiniappAbortController {
  signal = new MiniappAbortSignal()

  abort(reason?: unknown) {
    this.signal.abort(reason)
  }
}

const globalObject = globalThis as unknown as { AbortController?: unknown }

if (typeof globalObject.AbortController === 'undefined') {
  globalObject.AbortController = MiniappAbortController
}
