import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { LangProvider } from './lib/i18n.jsx'
import './styles/global.css'

// Support static hosting under a sub-path (GitHub Pages: /F1/).
// Locally / on Express the base is './' or '/', so basename stays undefined.
const base = import.meta.env.BASE_URL
const basename = base && base !== './' && base !== '/' ? base.replace(/\/$/, '') : undefined

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <LangProvider>
        <App />
      </LangProvider>
    </BrowserRouter>
  </React.StrictMode>
)
