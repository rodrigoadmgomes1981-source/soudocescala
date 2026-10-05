import { useStore } from '../lib/store'
import { Badge, Empty } from '../components/ui'
import { addDays, baseLabel, brl, fmtDate, startOfWeek, todayISO } from '../lib/utils'
import { findSetor, resumoPeriodo } from '../lib/escala'

export default function Escalas({ go }) {
  const { db } = useStore()
  const ini = startOfWeek(todayISO())
  const fim = addDays(ini, 6)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Módulo Escalas</p>
          <h1>Escalas</h1>
          <p className="muted">
            Ocupação e valores planejados da semana {fmtDate(ini)} a {fmtDate(fim)}.
          </p>
        </div>
        <button className="btn primary" onClick={() => go({ page: 'nova' })}>
          + Criar escala
        </button>
      </header>

      {db.escalas.length === 0 && (
        <Empty
          title="Nenhuma escala"
          action={
            <button className="btn primary" onClick={() => go({ page: 'nova' })}>
              Criar a primeira
            </button>
          }
        />
      )}

      <div className="cards">
        {db.escalas.map((e) => {
          const { cr, unidade, setor } = findSetor(db, e.crId, e.unidadeId, e.setorId)
          const r = resumoPeriodo(e, setor?.valores, ini, fim)
          const pct = r.slots ? Math.round((r.preenchidos / r.slots) * 100) : 0
          return (
            <button key={e.id} className="card escala-card" onClick={() => go({ page: 'escala', id: e.id })}>
              <div className="escala-card-top">
                <Badge tone={e.status === 'publicada' ? 'ok' : 'neutral'}>
                  {e.status === 'publicada' ? `Publicada até ${fmtDate(e.publicadaAte)}` : 'Rascunho'}
                </Badge>
                <span className="muted small">v{e.versao}</span>
              </div>
              <h3>{e.nome}</h3>
              <p className="muted small">
                {cr?.codigo} · {unidade?.nome} · {setor?.nome}
              </p>
              <div className="meter" aria-label={`Ocupação ${pct}%`}>
                <span style={{ width: `${pct}%` }} className={pct < 80 ? 'low' : ''} />
              </div>
              <div className="escala-card-stats">
                <span>
                  <b>{pct}%</b> ocupada na semana
                </span>
                <span>
                  <b>{r.vazios}</b> vagas abertas
                </span>
              </div>
              <div className="escala-card-stats muted small">
                <span>Fatura {brl(r.fat)}</span>
                <span>Paga {brl(r.pag)}</span>
              </div>
              <div className="tags">
                <span>Fat.: {baseLabel(e.faturamento)}</span>
                <span>Pag.: {baseLabel(e.pagamento)}</span>
                <span>{e.presenca.map((p) => (p === 'facial' ? 'Facial' : 'Geo')).join(' + ')}</span>
                {e.anunciarVaga && <span>Anúncio auto</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
