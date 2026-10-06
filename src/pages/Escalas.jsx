import { useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, Empty, EscalaFiltro } from '../components/ui'
import { addDays, baseLabel, brl, fmtDate, startOfWeek, todayISO } from '../lib/utils'
import { findSetor, resumoPeriodo } from '../lib/escala'
import { can } from '../lib/perms'

export default function Escalas({ go }) {
  const { db, user } = useStore()
  const ini = startOfWeek(todayISO())
  const fim = addDays(ini, 6)
  const ehMedico = user?.perfil === 'medico'
  const podeCriar = can(user, 'escalas.editar')
  const verValores = can(user, 'financeiro.ver')
  const [escalaIds, setEscalaIds] = useState([])
  const disponiveis = db.escalas.filter((e) =>
    ehMedico ? e.status === 'publicada' && e.alocacoes.some((a) => a.medicoId === user.medicoId) : podeCriar || !e.incompleta,
  )
  const escalas = disponiveis.filter((e) => escalaIds.length === 0 || escalaIds.includes(e.id))

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Módulo Escalas</p>
          <h1>{ehMedico ? 'Minhas escalas' : 'Escalas'}</h1>
          <p className="muted">
            {ehMedico ? 'Escalas em que você está inserido. ' : ''}Ocupação{verValores ? ' e valores planejados' : ''} da semana {fmtDate(ini)} a {fmtDate(fim)}.
          </p>
        </div>
        {podeCriar && (
          <button className="btn primary" onClick={() => go({ page: 'nova' })}>
            + Criar escala
          </button>
        )}
      </header>

      {disponiveis.length > 1 && (
        <div className="card filtro-card">
          <EscalaFiltro escalas={disponiveis} value={escalaIds} onChange={setEscalaIds} label="Escalas" />
        </div>
      )}

      {escalas.length === 0 && (
        <Empty
          title="Nenhuma escala"
          action={
            podeCriar && (
              <button className="btn primary" onClick={() => go({ page: 'nova' })}>
                Criar a primeira
              </button>
            )
          }
        />
      )}

      <div className="cards">
        {escalas.map((e) => {
          const { cr, unidade, setor } = findSetor(db, e.crId, e.unidadeId, e.setorId)
          const r = resumoPeriodo(e, setor?.valores, ini, fim)
          const pct = r.slots ? Math.round((r.preenchidos / r.slots) * 100) : 0
          return (
            <button key={e.id} className="card escala-card" onClick={() => go(e.incompleta ? { page: 'nova', id: e.id } : { page: 'escala', id: e.id })}>
              <div className="escala-card-top">
                <Badge tone={e.incompleta ? 'warn' : e.status === 'publicada' ? 'ok' : 'neutral'}>
                  {e.incompleta
                    ? `Em criação · passo ${(e.passo || 0) + 1} de 4`
                    : e.status === 'publicada'
                      ? `Publicada até ${fmtDate(e.publicadaAte)}`
                      : 'Rascunho'}
                </Badge>
                <span className="muted small">v{e.versao}</span>
              </div>
              <h3>{e.nome || 'Escala sem nome'}</h3>
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
              {verValores && (
                <div className="escala-card-stats muted small">
                  <span>Fatura {brl(r.fat)}</span>
                  <span>Paga {brl(r.pag)}</span>
                </div>
              )}
              <div className="tags">
                <span>Fat.: {baseLabel(e.faturamento)}</span>
                <span>Pag.: {baseLabel(e.pagamento)}</span>
                <span>{e.presenca.map((p) => (p === 'facial' ? 'Facial' : 'Geo')).join(' + ')}</span>
                {e.anunciarVaga && <span>Anúncio auto</span>}
                {e.travada && <span>Travada</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
