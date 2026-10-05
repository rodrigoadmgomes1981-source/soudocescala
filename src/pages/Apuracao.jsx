import { useState } from 'react'
import { useStore } from '../lib/store'
import { EscalaFiltro, Field } from '../components/ui'
import ApuracaoTabela from '../components/Apuracao'
import { addDays, todayISO } from '../lib/utils'

export default function Apuracao() {
  const { db } = useStore()
  const [escalaIds, setEscalaIds] = useState([])
  const [de, setDe] = useState(addDays(todayISO(), -14))
  const [ate, setAte] = useState(todayISO())
  const publicadas = db.escalas.filter((e) => e.status === 'publicada' && !e.incompleta)
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Faturamento</p>
          <h1>Apuração de plantões</h1>
          <p className="muted">Selecione vários plantões encerrados e apure, glose ou reabra em lote. As cores seguem os registros de check-in e check-out.</p>
        </div>
        <div className="filters">
          <Field label="De">
            <input id="apg-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </Field>
          <Field label="Até">
            <input id="apg-ate" type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
          </Field>
        </div>
      </header>
      <div className="card filtro-card">
        <EscalaFiltro escalas={publicadas} value={escalaIds} onChange={setEscalaIds} label="Filtrar por escala" />
      </div>
      <div className="card">
        <ApuracaoTabela escalaIds={escalaIds} de={de} ate={ate} />
      </div>
    </div>
  )
}
