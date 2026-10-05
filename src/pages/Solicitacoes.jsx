import { useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, Empty } from '../components/ui'
import { TIPOS_SOL, aplicarSolicitacao, descPlantao } from '../lib/solicitacoes'
import { logEscala } from '../lib/utils'

const ST = { pendente: ['Pendente', 'warn'], aprovada: ['Aprovada', 'ok'], recusada: ['Recusada', 'danger'], cancelada: ['Cancelada', 'neutral'] }

export default function Solicitacoes() {
  const { db, update, notify, user } = useStore()
  const [filtro, setFiltro] = useState('pendente')
  const nome = (id) => db.medicos.find((m) => m.id === id)?.nome || '—'
  const lista = [...(db.solicitacoes || [])].reverse().filter((s) => filtro === 'todas' || s.status === filtro)

  const decidir = (sol, aprovar) => {
    const esc = db.escalas.find((e) => e.id === sol.escalaId)
    if (esc?.travada) {
      notify('A escala está travada. Destrave para aprovar.', 'warn')
      return
    }
    update((d) => {
      const s = d.solicitacoes.find((x) => x.id === sol.id)
      s.status = aprovar ? 'aprovada' : 'recusada'
      s.decididoPor = user.nome
      s.decididoEm = new Date().toISOString()
      const e = d.escalas.find((x) => x.id === sol.escalaId)
      if (aprovar) aplicarSolicitacao(e, s, nome)
      else logEscala(e, 'solicitacao', `${TIPOS_SOL[s.tipo]} de ${nome(s.medicoId)} recusada`)
    })
    notify(aprovar ? `${TIPOS_SOL[sol.tipo]} aprovada e aplicada na escala` : 'Solicitação recusada', aprovar ? 'ok' : 'warn')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Escalas</p>
          <h1>Solicitações dos médicos</h1>
          <p className="muted">Passagens e trocas em escalas configuradas com aprovação. As automáticas aparecem como aprovadas.</p>
        </div>
      </header>
      <div className="chips-filter">
        {[
          ['pendente', 'Pendentes'],
          ['aprovada', 'Aprovadas'],
          ['recusada', 'Recusadas'],
          ['todas', 'Todas'],
        ].map(([k, l]) => (
          <button key={k} className={filtro === k ? 'on' : ''} onClick={() => setFiltro(k)}>
            {l}
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <Empty title="Nenhuma solicitação neste filtro" />
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Médico</th>
                  <th>Plantão</th>
                  <th>Detalhe</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => {
                  const e = db.escalas.find((x) => x.id === s.escalaId)
                  return (
                    <tr key={s.id}>
                      <td>
                        <b>{TIPOS_SOL[s.tipo]}</b>
                        <div className="muted small">{new Date(s.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                      </td>
                      <td>{nome(s.medicoId)}</td>
                      <td>
                        {e ? descPlantao(e, s.turnoId, s.data) : '—'}
                        <div className="muted small">
                          {e?.nome} · vaga {s.vagaIdx + 1}
                        </div>
                      </td>
                      <td className="small">
                        {s.tipo === 'passagem' && <>Para {nome(s.destinoId)}</>}
                        {s.tipo === 'troca' && s.troca && (
                          <>
                            Com {nome(s.troca.medicoId)} · {e ? descPlantao(e, s.troca.turnoId, s.troca.data) : ''}
                          </>
                        )}
                        {s.tipo === 'anuncio' && <>Plantão no mural de vagas</>}
                        {s.motivo && <div className="muted">Motivo: {s.motivo}</div>}
                      </td>
                      <td>
                        <Badge tone={ST[s.status][1]}>{ST[s.status][0]}</Badge>
                        {s.automatica && <div className="muted small">automática</div>}
                        {s.decididoPor && <div className="muted small">por {s.decididoPor}</div>}
                      </td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        {s.status === 'pendente' && (
                          <>
                            <button className="btn sm primary" onClick={() => decidir(s, true)}>
                              Aprovar
                            </button>{' '}
                            <button className="btn sm ghost danger" onClick={() => decidir(s, false)}>
                              Recusar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
