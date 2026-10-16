import './SeasonsChampionship.css'
import './ChampionshipStandings.css'

export type RaceResult = { name: string; position: number; time: number }
export type Round = 'summer' | 'autumn' | 'winter' | 'spring'
export type ChampionshipResults = Partial<Record<Round, RaceResult[]>>

const ROUNDS: {id: Round; name: string}[] = [
  {id:'summer',name:'SUMMER'}, {id:'autumn',name:'AUTUMN'},
  {id:'winter',name:'WINTER'}, {id:'spring',name:'SPRING'}
]
const POINTS = [25,18,15,12,10,8,6,4,2,1]
export const pointsFor = (position: number) => POINTS[position-1] ?? 0

export default function ChampionshipStandings({
  results, onBack, onRestart
}: {results: ChampionshipResults; onBack: () => void; onRestart: () => void}) {
  const completed = ROUNDS.filter(r => results[r.id]?.length === 15)
  const names = [...new Set(ROUNDS.flatMap(r => results[r.id]?.map(d => d.name) ?? []))]
  const standings = names.map(name => {
    const finishes = ROUNDS.map(r => results[r.id]?.find(d => d.name === name))
    return {
      name,
      finishes,
      points: finishes.reduce((total, result) => total + (result ? pointsFor(result.position) : 0), 0),
      wins: finishes.filter(result => result?.position === 1).length,
      podiums: finishes.filter(result => result && result.position <= 3).length
    }
  }).sort((a,b) => b.points-a.points || b.wins-a.wins || b.podiums-a.podiums ||
    a.finishes.reduce((n,r)=>n+(r?.position??16),0)-b.finishes.reduce((n,r)=>n+(r?.position??16),0))
  const champion = standings[0]
  const playerIndex = standings.findIndex(d=>d.name==='YOU')
  return (
    <main className="championship-page">
      <header className="championship-top">
        <button onClick={onBack}>← BACK TO ACADEMY</button>
        <strong>APEX <span>ACADEMY</span></strong>
        <small>SEASONS OF SPEED / 2026</small>
      </header>
      <section className="championship-content">
        <p className="championship-eyebrow">FOUR ROUNDS / FIFTEEN DRIVERS / ONE CHAMPION</p>
        <h1>THE FINAL <em>STANDINGS.</em></h1>
        <p className="championship-description">
          {completed.length===4
            ? `CHAMPIONSHIP COMPLETE — ${champion?.name==='YOU'?'YOU ARE THE CHAMPION!':`${champion?.name ?? 'THE LEADER'} WINS THE TITLE.`}`
            : `${completed.length} OF 4 RACES COMPLETE`}
        </p>
        {playerIndex>=0 && <div className="championship-player">
          <div><small>YOUR CHAMPIONSHIP POSITION</small><strong>P{playerIndex+1}<span> / 15</span></strong></div>
          <div><small>YOUR TOTAL POINTS</small><strong>{standings[playerIndex].points}</strong></div>
          <div><small>CHAMPIONSHIP LEADER</small><strong className="championship-leader">{champion?.name}</strong></div>
        </div>}
        <p className="championship-scoring">POINTS: P1 25 · P2 18 · P3 15 · P4 12 · P5 10 · P6 8 · P7 6 · P8 4 · P9 2 · P10 1</p>
        <div className="championship-table-wrap">
          <table className="championship-table">
            <thead><tr><th>POS</th><th>DRIVER</th>{ROUNDS.map(r=><th key={r.id}>{r.name}</th>)}<th>POINTS</th></tr></thead>
            <tbody>{standings.map((d,i)=><tr key={d.name} className={d.name==='YOU'?'championship-you':''}>
              <td>P{i+1}</td><td>{d.name}</td>
              {d.finishes.map((r,j)=><td key={ROUNDS[j].id}>{r ? `P${r.position} · +${pointsFor(r.position)}` : '—'}</td>)}
              <td><strong>{d.points}</strong></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="championship-actions">
          <button onClick={onRestart}>↻ START A NEW CHAMPIONSHIP</button>
          <button onClick={onBack}>BACK TO ACADEMY</button>
        </div>
      </section>
    </main>
  )
}
