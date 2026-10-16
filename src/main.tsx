import React, { useCallback, useState } from 'react'
import ReactDOM from 'react-dom/client'
import HomePage from './HomePage'
import AcademyHub from './AcademyHub'
import App from './App'
import Level02 from './Level02'
import SeasonsChampionship from './SeasonsChampionship'
import AutumnChampionship from './AutumnChampionship'
import WinterChampionship from './WinterChampionship'
import SpringChampionship from './SpringChampionship'
import ChampionshipStandings, { type ChampionshipResults, type RaceResult, type Round } from './ChampionshipStandings'
import './index.css'

type Page = 'home' | 'academy' | 'level1' | 'level2' | 'seasons' | 'autumn' | 'winter' | 'spring' | 'standings'

function Website() {
  const [page, setPage] = useState<Page>('home')
  const [results, setResults] = useState<ChampionshipResults>({})
  const navigate = (destination: Page) => {
    window.scrollTo(0, 0)
    setPage(destination)
  }
  const saveResult = useCallback((round: Round, classification: RaceResult[]) => {
    setResults(previous => ({ ...previous, [round]: classification }))
  }, [])
  const restart = () => {
    setResults({})
    navigate('seasons')
  }
  if (page === 'home') return <HomePage onEnter={() => navigate('academy')} />
  if (page === 'academy') return <AcademyHub
    onStartLevel1={() => navigate('level1')}
    onStartLevel2={() => navigate('level2')}
    onStartSeasons={restart}
    onBack={() => navigate('home')}
  />
  if (page === 'level2') return <Level02 onBack={() => navigate('academy')} />
  if (page === 'seasons') return <SeasonsChampionship
    onBack={() => navigate('academy')}
    onNextSeason={() => navigate('autumn')}
    onRaceComplete={classification => saveResult('summer', classification)}
  />
  if (page === 'autumn') return <AutumnChampionship
    onBack={() => navigate('academy')}
    onNextSeason={() => navigate('winter')}
    onRaceComplete={classification => saveResult('autumn', classification)}
  />
  if (page === 'winter') return <WinterChampionship
    onBack={() => navigate('academy')}
    onNextSeason={() => navigate('spring')}
    onRaceComplete={classification => saveResult('winter', classification)}
  />
  if (page === 'spring') return <SpringChampionship
    onBack={() => navigate('academy')}
    onNextSeason={() => navigate('standings')}
    onRaceComplete={classification => saveResult('spring', classification)}
  />
  if (page === 'standings') return <ChampionshipStandings
    results={results}
    onBack={() => navigate('academy')}
    onRestart={restart}
  />
  return <App
    onLevelSelect={() => navigate('academy')}
    onQualifying={() => navigate('level2')}
  />
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Website /></React.StrictMode>
)
