const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID
const GA_ENABLED = import.meta.env.VITE_GA_ENABLED !== 'false'
const GA_DEBUG = import.meta.env.VITE_GA_DEBUG === 'true'

let initialized = false

function canTrack() {
  return Boolean(GA_ENABLED && GA_MEASUREMENT_ID && typeof window !== 'undefined')
}

function loadGtagScript() {
  if (document.querySelector(`script[data-ga4-id="${GA_MEASUREMENT_ID}"]`)) return
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`
  script.dataset.ga4Id = GA_MEASUREMENT_ID
  document.head.appendChild(script)
}

export function initAnalytics() {
  if (!canTrack() || initialized) return false
  initialized = true

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }

  loadGtagScript()
  window.gtag('js', new Date())
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    debug_mode: GA_DEBUG,
  })

  return true
}

export function trackPageView({ path, title }) {
  if (!canTrack() || typeof window.gtag !== 'function') return
  window.gtag('event', 'page_view', {
    page_title: title,
    page_path: path,
    page_location: new URL(path, window.location.origin).href,
    debug_mode: GA_DEBUG,
  })
}

export function trackEvent(name, params = {}) {
  if (!canTrack() || typeof window.gtag !== 'function') return
  window.gtag('event', name, {
    ...params,
    debug_mode: GA_DEBUG,
  })
}

