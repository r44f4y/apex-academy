import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import HomePage from './HomePage.tsx'
import App from './App'
import './index.css'

function Website() {
  const [page, setPage] = useState<'home' | 'level1'>('home')

  return page === 'home' ? (
    <HomePage onEnter={() => {
      window.scrollTo(0, 0)
      setPage('level1')
    }} />
  ) : (
    <App />
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Website />
  </React.StrictMode>
)
