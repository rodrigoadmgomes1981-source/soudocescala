import { useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, Empty, EscalaFiltro, Modal } from '../components/ui'
import { brl } from '../lib/utils'
import { descPlantao } from '../lib/solicitacoes'

const ST = { pendente: ['Em validação', 'warn'], aprovada: ['Aprovada', 'ok'], recusada: ['Recusada', 'danger'] }

export default function Antecipacoes() {
  const { db, update, notify, user } = useStore()
  const [filtro, setFiltro] = useState('pendente')
  const [ver, setVer] = useState(null)
  const [recusar, setRecusar] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [escalaIds, setEscalaIds] = useState([])
  const escalas = db.escalas.filter((e) => e.status === 'publicada')
  const daEscala = (a) => escalaIds.length === 0 || a.itens.some((k) => escalaIds.includes(k.split('|')[0]))
  const lista = [...(db.antecipacoes || [])].reverse().filter((a) => (filtro === 'todas' || a.status === filtro) && daEscala(a))
  const nome = (id) => db.medicos.find((m) => m.id === id)?.nome
  const pend = (db.antecipacoes || []).filter((a) => a.status === 'pendente' && daEscala(a))

  const decidir = (a, status, mot) => {
    update((d) => {
      const x = d.antecipacoes.find((y) => y.id === a.id)
      x.status = status
      x.decididoPor = user.nome
      x.decididoEm = new Date().toISOString()
      if (mot) x.motivoRecusa = mot
    })
    notify(status === 'aprovada' ? `Antecipação de ${nome(a.medicoId)} aprovada` : 'Antecipação recusada', status === 'aprovada' ? 'ok' : 'warn')
  }

  const item = (k) => {
    const [eid, tid, vaga, ...rest] = k.split(/[|-]/)
    const data = rest.join('-')
    const e = db.escalas.find((x) => x.id === eid)
    const ap = db.apuracoes?.[k]
    return { e, desc: e ? descPlantao(e, tid, data) : k, vaga: Number(vaga) + 1, ap, data }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Faturamento</p>
          <h1>Antecipações</h1>
          <p className="muted">Pedidos dos médicos para receber antes do ciclo normal plantões já apurados.</p>
        </div>
      </header>

      <div className="card filtro-card">
        <EscalaFiltro escalas={escalas} value={escalaIds} onChange={setEscalaIds} label="Escalas" />
      </div>

      <div className="kpi-row">
        <div className="kpi warn">
          <span className="muted small">Pedidos em validação</span>
          <b>{pend.length}</b>
        </div>
        <div className="kpi">
          <span className="muted small">Valor bruto pendente</span>
          <b>{brl(pend.reduce((t, a) => t + a.bruto, 0))}</b>
        </div>
        <div className="kpi">
          <span className="muted small">Valor líquido pendente</span>
          <b>{brl(pend.reduce((t, a) => t + a.liquido, 0))}</b>
        </div>
        <div className="kpi">
          <span className="muted small">Receita de taxa</span>
          <b>{brl(pend.reduce((t, a) => t + a.bruto - a.liquido, 0))}</b>
        </div>
      </div>

      <div className="chips-filter">
        {[
          ['pendente', 'Em validação'],
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
        <Empty title="Nenhum pedido neste filtro" />
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Médico</th>
                  <th>Pedido em</th>
                  <th className="num">Plantões</th>
                  <th className="num">Bruto</th>
                  <th className="num">Taxa</th>
                  <th className="num">Líquido</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <b>{nome(a.medicoId)}</b>
                    </td>
                    <td>{new Date(a.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="num">{a.itens.length}</td>
                    <td className="num">{brl(a.bruto)}</td>
                    <td className="num">{a.taxa}%</td>
                    <td className="num">
                      <b>{brl(a.liquido)}</b>
                    </td>
                    <td>
                      <Badge tone={ST[a.status][1]}>{ST[a.status][0]}</Badge>
                      {a.decididoPor && <div className="muted small">por {a.decididoPor}</div>}
                    </td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sm ghost" onClick={() => setVer(a)}>
                        Ver plantões
                      </button>
                      {a.status === 'pendente' && (
                        <>
                          {' '}
                          <button className="btn sm primary" onClick={() => decidir(a, 'aprovada')}>
                            Aprovar
                          </button>{' '}
                          <button className="btn sm ghost danger" onClick={() => setRecusar(a)}>
                            Recusar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ver && (
        <Modal title={`Plantões · ${nome(ver.medicoId)}`} onClose={() => setVer(null)} width={600}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Plantão</th>
                <th>Escala</th>
                <th className="num">Horas</th>
                <th className="num">Apurado</th>
              </tr>
            </thead>
            <tbody>
              {ver.itens.map((k) => {
                const it = item(k)
                return (
                  <tr key={k}>
                    <td>
                      {it.desc} · vaga {it.vaga}
                    </td>
                    <td>{it.e?.nome}</td>
                    <td className="num">{it.ap?.horas ?? '—'}h</td>
                    <td className="num">{brl(it.ap?.pag)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Modal>
      )}

      {recusar && (
        <Modal
          title="Recusar antecipação"
          onClose={() => setRecusar(null)}
          footer={
            <>
              <div className="spacer" />
              <button className="btn ghost" onClick={() => setRecusar(null)}>
                Cancelar
              </button>
              <button
                className="btn primary"
                disabled={!motivo.trim()}
                onClick={() => {
                  decidir(recusar, 'recusada', motivo.trim())
                  setRecusar(null)
                  setMotivo('')
                }}
              >
                Recusar pedido
              </button>
            </>
          }
        >
          <label className="field">
            <span className="field-label">Motivo (o médico verá esta mensagem)</span>
            <input id="ant-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
          </label>
        </Modal>
      )}
    </div>
  )
}
