import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { initAnalytics } from './lib/analytics.js'
import { I18nProvider } from './i18n.jsx'

initAnalytics()

const rootElement = document.getElementById('root')
// The server places a semantic, crawlable preview in #root. The interactive SPA
// renders the same page content after JavaScript loads, so clear the preview first.
rootElement.replaceChildren()

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
)
