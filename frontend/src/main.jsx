import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { getCachedTheme, applyTheme } from './utils/theme'

const cached = getCachedTheme()
if (cached) {
  applyTheme(cached)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
