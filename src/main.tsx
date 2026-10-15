import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import HomePage from './HomePage'
import AcademyHub from './AcademyHub'
import App from './App'
import './index.css'

type Page = 'home' | 'academy' | 'level1'

function Website() {
  const [page, setPage] = useState<Page>('home')

  const navigate = (destination: Page) => {
    window.scrollTo(0, 0)
    setPage(destination)
  }

  if (page === 'home') {
    return <HomePage onEnter={() => navigate('academy')} />
  }

  if (page === 'academy') {
    return <AcademyHub onStartLevel1={() => navigate('level1')} onBack={() => navigate('home')} />
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Website />
  </React.StrictMode>
)
