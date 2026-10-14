import { useEffect, useRef } from 'react'

type TurnstileAPI = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileAPI }
}
let loading: Promise<TurnstileAPI> | undefined
function loadWidget() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  loading = new Promise<TurnstileAPI>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    const timeout = window.setTimeout(fail, 15000)
    function fail() {
      window.clearTimeout(timeout)
      script.remove()
      loading = undefined
      reject(new Error('Verification could not load'))
    }
    script.onerror = fail
    script.onload = () => {
      window.clearTimeout(timeout)
      if (window.turnstile) resolve(window.turnstile)
      else fail()
    }
    document.head.appendChild(script)
  })
  return loading
}

export function Turnstile({ siteKey, onToken, onError }: {
  siteKey: string
  onToken: (token: string) => void
  onError: () => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onToken, onError })
  callbacks.current = { onToken, onError }
  useEffect(() => {
    let active = true
    let widgetId: string | undefined
    let api: TurnstileAPI | undefined
    loadWidget().then(loaded => {
      if (!active || !container.current) return
      api = loaded
      widgetId = api.render(container.current, {
        sitekey: siteKey, action: 'contact', theme: 'dark', size: container.current.clientWidth < 300 ? 'compact' : 'flexible',
        'response-field': false,
        callback: (token: string) => { if (active) callbacks.current.onToken(token) },
        'expired-callback': () => { if (active) callbacks.current.onToken('') },
        'error-callback': () => { if (active) { callbacks.current.onToken(''); callbacks.current.onError() } },
      })
    }).catch(() => { if (active) callbacks.current.onError() })
    return () => {
      active = false
      if (widgetId !== undefined) api?.remove(widgetId)
    }
  }, [siteKey])
  return <div ref={container} className="contact-verification" aria-label="Spam protection" />
}
