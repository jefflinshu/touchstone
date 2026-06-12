const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID
const GTM_ID = import.meta.env.VITE_GTM_ID || 'GTM-PXCXDHT5'
const GA_ENABLED = import.meta.env.VITE_GA_ENABLED !== 'false'
const GA_DEBUG = import.meta.env.VITE_GA_DEBUG === 'true'

let initialized = false

function canTrack() {
  return Boolean(GA_ENABLED && typeof window !== 'undefined')
}

function pushDataLayer(event, params = {}) {
  if (!canTrack()) return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, ...params })
}

function loadGtmScript() {
  if (!GTM_ID || document.querySelector(`script[data-gtm-id="${GTM_ID}"]`)) return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
  const firstScript = document.getElementsByTagName('script')[0]
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`
  script.dataset.gtmId = GTM_ID
  firstScript.parentNode.insertBefore(script, firstScript)
}

function loadGtagScript() {
  if (!GA_MEASUREMENT_ID) return
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
  loadGtmScript()

  if (GA_MEASUREMENT_ID) {
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
  }

  return true
}

export function trackPageView({ path, title }) {
  if (!canTrack()) return
  const params = {
    page_title: title,
    page_path: path,
    page_location: new URL(path, window.location.origin).href,
    debug_mode: GA_DEBUG,
  }
  pushDataLayer('page_view', params)
  if (typeof window.gtag === 'function') window.gtag('event', 'page_view', params)
}

export function trackEvent(name, params = {}) {
  if (!canTrack()) return
  const nextParams = {
    ...params,
    debug_mode: GA_DEBUG,
  }
  pushDataLayer(name, nextParams)
  if (typeof window.gtag === 'function') window.gtag('event', name, nextParams)
}
