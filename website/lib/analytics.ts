export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-HMT2XD4KZL'

export type AnalyticsValue = string | number | boolean | undefined

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * Queue a GA4 event. The dataLayer fallback means events fired during early
 * hydration are retained until gtag.js has finished loading.
 */
export function trackEvent(name: string, params: Record<string, AnalyticsValue> = {}) {
  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) return

  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args)
    }

  window.gtag('event', name, {
    ...params,
    send_to: GA_MEASUREMENT_ID
  })
}
