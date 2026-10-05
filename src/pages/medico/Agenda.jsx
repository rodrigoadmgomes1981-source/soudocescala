import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { Badge, Empty } from '../../components/ui'
import MedicoAcoesModal from '../../components/MedicoAcoes'
import { DIAS, addDays, brl, fimTurno, todayISO, weekday, parseISO } from '../../lib/utils'
import { enderecoTxt, ESTADO_PRES } from '../../lib/presenca'
import { plantoesDoMedico } from '../../lib/medico'
import { TIPOS_SOL } from '../../lib/solicitacoes'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export default function Agenda() {
  const { db, user } = useStore()
  const me = user.medicoId
  const hoje = todayISO()
  const [dias, setDias] = useState(15)
  const [sel, setSel] = useState(null)
  const agora = Date.now()

  const proximos = useMemo(() => plantoesDoMedico(db, me, hoje, addDays(hoje, dias)).filter((p) => p.fim > agora), [db, me, hoje, dias, agora])
  const recentes = useMemo(
    () =>
      plantoesDoMedico(db, me, addDays(hoje, -7), hoje)
        .filter((p) => p.fim <= agora)
        .reverse(),
    [db, me, hoje, agora],
  )
  const pendSol = (db.solicitacoes || []).filter((s) => s.medicoId === me && s.status === 'pendente')
  const horas = proximos.reduce((t, p) => t + p.turno.duracao, 0)
  const valor = proximos.reduce((t, p) => t + p.pag, 0)
  const prox = proximos[0]

  const solDo = (p) => pendSol.find((s) => s.escalaId === p.escala.id && s.turnoId === p.turno.id && s.vagaIdx === p.vagaIdx && s.data === p.data)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Minha agenda</p>
          <h1>Olá, Dr(a). {user.nome.split(' ')[0]}</h1>
          <p className="muted">Seus plantões confirmados nas escalas publicadas.</p>
        </div>
        <div className="chips-filter">
          {[7, 15, 30].map((d) => (
            <button key={d} className={dias === d ? 'on' : ''} onClick={() => setDias(d)}>
              Próximos {d} dias
            </button>
          ))}
        </div>
      </header>

      <div className="kpi-row">
        <div className="kpi">
          <span className="muted small">Próximo plantão</span>
          <b style={{ fontSize: 18 }}>{prox ? `${DIAS[weekday(prox.data)]} ${prox.data.slice(8)}/${prox.data.slice(5, 7)} · ${prox.turno.inicio}` : '—'}</b>
          <small className="muted">{prox ? prox.escala.nome : 'Nenhum plantão agendado'}</small>
        </div>
        <div className="kpi">
          <span className="muted small">Plantões no período</span>
          <b>{proximos.length}</b>
          <small className="muted">próximos {dias} dias</small>
        </div>
        <div className="kpi">
          <span className="muted small">Horas planejadas</span>
          <b>{horas}h</b>
          <small className="muted">próximos {dias} dias</small>
        </div>
        <div className="kpi">
          <span className="muted small">Valor previsto</span>
          <b>{brl(valor)}</b>
          <small className="muted">{pendSol.length ? `${pendSol.length} solicitação(ões) pendente(s)` : 'sem solicitações pendentes'}</small>
        </div>
      </div>

      <div className="card">
        <h2>Próximos plantões</h2>
        {proximos.length === 0 ? (
          <Empty title="Nenhum plantão no período" />
        ) : (
          <div className="agenda-list">
            {proximos.map((p) => {
              const d = parseISO(p.data)
              const sol = solDo(p)
              return (
                <div className="agenda-item" key={p.k}>
                  <div className="agenda-date">
                    <span>{DIAS[weekday(p.data)]}</span>
                    <b>{d.getDate()}</b>
                    <span>{MESES[d.getMonth()]}</span>
                  </div>
                  <div className="agenda-info">
                    <b>
                      {p.turno.inicio} – {fimTurno(p.turno.inicio, p.turno.duracao)} · {p.turno.duracao}h
                    </b>
                    <span>
                      {p.escala.nome} · {p.unidade?.nome}
                    </span>
                    <span className="muted small">{enderecoTxt(p.unidade)}</span>
                    <span className="row-actions">
                      <Badge tone={p.aloc?.fixo ? 'ok' : 'neutral'}>{p.aloc?.fixo ? 'Fixo' : 'Avulso'}</Badge>
                      {p.aloc?.ofertado && <Badge tone="warn">Anunciado por você</Badge>}
                      {p.diferenciado && <Badge tone="warn">Pagamento diferenciado</Badge>}
                      {sol && <Badge tone="info">{TIPOS_SOL[sol.tipo]} pendente</Badge>}
                      {p.fin.status === 'andamento' && <Badge tone="info">Em andamento</Badge>}
                    </span>
                  </div>
                  <div className="agenda-acts">
                    <span className="small" style={{ alignSelf: 'center' }}>
                      {brl(p.pag)}
                    </span>
                    <button className="btn sm" onClick={() => setSel(p)}>
                      Trocar · passar · anunciar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Últimos 7 dias</h2>
        {recentes.length === 0 ? (
          <p className="muted">Nenhum plantão realizado na última semana.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Plantão</th>
                  <th>Local</th>
                  <th>Entrada / saída</th>
                  <th>Presença</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((p) => (
                  <tr key={p.k}>
                    <td>
                      <b>
                        {DIAS[weekday(p.data)]} {p.data.slice(8)}/{p.data.slice(5, 7)}
                      </b>{' '}
                      {p.turno.inicio}
                    </td>
                    <td>{p.escala.nome}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {p.pres?.checkin?.hora || '—'} / {p.pres?.checkout?.hora || '—'}
                    </td>
                    <td className="small">
                      <i className={`dot ${p.pres?.cor || ''}`} />
                      {ESTADO_PRES[p.pres?.estado]?.label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sel && <MedicoAcoesModal escala={db.escalas.find((e) => e.id === sel.escala.id)} slot={sel} onClose={() => setSel(null)} />}
    </div>
  )
}
