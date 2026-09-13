'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useReportWebVitals } from 'next/web-vitals'
import { GA_MEASUREMENT_ID, trackEvent } from '@/lib/analytics'

const SCROLL_MILESTONES = [25, 50, 75, 90, 100]

function cleanLabel(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim().slice(0, 100) || 'unknown'
}

function interactionLabel(element: HTMLElement) {
  return cleanLabel(
    element.dataset.analyticsLabel ||
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.textContent
  )
}

function interactionLocation(element: HTMLElement) {
  const region = element.closest<HTMLElement>('[data-analytics-section], section, header, footer')
  return cleanLabel(
    region?.dataset.analyticsSection ||
      region?.id ||
      region?.getAttribute('aria-label') ||
      region?.tagName.toLowerCase()
  )
}

function ClientAnalytics() {
  const pathname = usePathname()
  const viewedSections = useRef(new Set<string>())
  const scrollMilestones = useRef(new Set<number>())

  useEffect(() => {
    trackEvent('page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: pathname
    })

    viewedSections.current.clear()
    scrollMilestones.current.clear()
  }, [pathname])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const element = event.target.closest<HTMLElement>(
        'a, button, input, select, [data-analytics-event]'
      )
      if (!element) return

      const label = interactionLabel(element)
      const location = interactionLocation(element)
      const override = element.dataset.analyticsEvent
      const link = element instanceof HTMLAnchorElement ? element : null

      if (override) {
        const linkUrl = link ? new URL(link.href, window.location.href).href : undefined
        trackEvent(override, {
          interaction_label: label,
          interaction_location: location,
          interaction_value: element.dataset.analyticsValue,
          platform: element.dataset.analyticsPlatform,
          link_url: linkUrl
        })
        return
      }

      if (link) {
        const url = new URL(link.href, window.location.href)
        if (url.pathname === '/download') {
          trackEvent('download_click', {
            platform: url.searchParams.get('platform') || 'unknown',
            link_text: label,
            interaction_location: location
          })
        } else if (url.origin !== window.location.origin) {
          trackEvent('outbound_link_click', {
            link_domain: url.hostname,
            link_url: url.href,
            link_text: label,
            interaction_location: location
          })
        } else {
          trackEvent('navigation_click', {
            link_path: `${url.pathname}${url.hash}`,
            link_text: label,
            interaction_location: location
          })
        }
        return
      }

      trackEvent('ui_interaction', {
        interaction_label: label,
        interaction_location: location
      })
    }

    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('[data-analytics-section]')
    if (!sections.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const section = (entry.target as HTMLElement).dataset.analyticsSection
          if (!section || viewedSections.current.has(section)) continue
          viewedSections.current.add(section)
          trackEvent('section_view', { section_name: section, page_path: window.location.pathname })
        }
      },
      { threshold: 0.35 }
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [pathname])

  useEffect(() => {
    const onScroll = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight
      const percentage =
        available <= 0 ? 100 : Math.min(100, Math.round((window.scrollY / available) * 100))

      for (const milestone of SCROLL_MILESTONES) {
        if (percentage < milestone || scrollMilestones.current.has(milestone)) continue
        scrollMilestones.current.add(milestone)
        trackEvent('scroll_depth', {
          percent_scrolled: milestone,
          page_path: window.location.pathname
        })
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  useEffect(() => {
    let activeSeconds = 0
    const milestones = new Set<number>()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      activeSeconds += 1
      for (const seconds of [30, 60, 180]) {
        if (activeSeconds < seconds || milestones.has(seconds)) continue
        milestones.add(seconds)
        trackEvent('engagement_milestone', { seconds, page_path: window.location.pathname })
      }
    }, 1_000)

    return () => window.clearInterval(timer)
  }, [pathname])

  useReportWebVitals((metric) => {
    trackEvent('web_vital', {
      metric_name: metric.name,
      metric_value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      metric_delta: Math.round(metric.name === 'CLS' ? metric.delta * 1000 : metric.delta),
      metric_id: metric.id
    })
  })

  return null
}

export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            send_page_view: false,
            transport_type: 'beacon'
          });
        `}
      </Script>
      <ClientAnalytics />
    </>
  )
}
