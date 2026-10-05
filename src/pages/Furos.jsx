import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, Empty, EscalaFiltro, Field } from '../components/ui'
import { AlocarModal } from './EscalaDetalhe'
import { DIAS, addDays, brl, fimTurno, fmtDate, fmtDateShort, inicioPlantao, logEscala, todayISO, weekday } from '../lib/utils'
import { slotsGlobais } from '../lib/escala'
import { presencaDe } from '../lib/presenca'

const H = 3600e3
const CRIT = {
  ocorrido: { label: 'Furo ocorrido', tone: 'danger', ordem: 0 },
  ausencia: { label: 'Ausência (sem check-in)', tone: 'danger', ordem: 1 },
  critico: { label: 'Risco crítico (< 24h)', tone: 'danger', ordem: 2 },
  alto: { label: 'Risco alto (< 72h)', tone: 'warn', ordem: 3 },
  moderado: { label: 'Risco moderado', tone: 'neutral', ordem: 4 },
}

export default function Furos({ go }) {
  const { db, update, notify } = useStore()
  const hoje = todayISO()
  const [de, setDe] = useState(addDays(hoje, -7))
  const [ate, setAte] = useState(addDays(hoje, 7))
  const [escalaIds, setEscalaIds] = useState([])
  const [simular, setSimular] = useState(true)
  const [sel, setSel] = useState(null)
  const agora = Date.now()

  const { itens, passados } = useMemo(() => {
    const todos = slotsGlobais(db, de, ate, (e) => e.status === 'publicada' && (escalaIds.length === 0 || escalaIds.includes(e.id))).filter(
      (s) => s.data <= s.escala.publicadaAte,
    )
    const out = []
    let passados = 0
    for (const s of todos) {
      const ini = inicioPlantao(s.data, s.turno.inicio).getTime()
      const passou = ini <= agora
      if (passou) passados++
      let tipo = null
      if (!s.medicoId) {
        if (passou) tipo = 'ocorrido'
        else if (ini - agora < 24 * H) tipo = 'critico'
        else if (ini - agora < 72 * H) tipo = 'alto'
        else tipo = 'moderado'
      } else if (passou && simular) {
        const pr = presencaDe(s.escala, s, s.unidade, '')
        if (pr && (pr.estado === 'ausente' || pr.estado === 'sem-checkin')) tipo = 'ausencia'
      }
      if (tipo) out.push({ ...s, tipo, ini })
    }
    out.sort((a, b) => CRIT[a.tipo].ordem - CRIT[b.tipo].ordem || a.ini - b.ini)
    return { itens: out, passados }
  }, [db, de, ate, escalaIds, simular, agora])

  const ocorridos = itens.filter((i) => i.tipo === 'ocorrido' || i.tipo === 'ausencia')
  const criticos = itens.filter((i) => i.tipo === 'critico')
  const risco = itens.filter((i) => ['critico', 'alto', 'moderado'].includes(i.tipo))
  const taxa = passados ? (ocorridos.length / passados) * 100 : 0
  const fatRisco = itens.reduce((t, i) => t + i.fat, 0)

  // por escala
  const porEscala = Object.values(
    itens.reduce((acc, i) => {
      const k = i.escala.id
      acc[k] = acc[k] || { nome: i.escala.nome, ocorridos: 0, risco: 0 }
      acc[k][i.tipo === 'ocorrido' || i.tipo === 'ausencia' ? 'ocorridos' : 'risco']++
      return acc
    }, {}),
  ).sort((a, b) => b.ocorridos + b.risco - (a.ocorridos + a.risco))
  const maxEsc = Math.max(1, ...porEscala.map((e) => e.ocorridos + e.risco))

  // por dia
  const diasPeriodo = []
  for (let d = de, g = 0; d <= ate && g < 62; d = addDays(d, 1), g++) diasPeriodo.push(d)
  const porDia = diasPeriodo.map((d) => ({ d, n: itens.filter((i) => i.data === d).length, futuro: d > hoje }))
  const maxDia = Math.max(1, ...porDia.map((x) => x.n))

  const publicadas = db.escalas.filter((e) => e.status === 'publicada' && !e.incompleta)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Painel</p>
          <h1>Furos de escala</h1>
          <p className="muted">Plantões que ficaram sem médico (ocorridos) e vagas ainda abertas com risco de virar furo.</p>
        </div>
        <div className="filters">
          <Field label="De">
            <input id="fu-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </Field>
          <Field label="Até">
            <input id="fu-ate" type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
          </Field>
        </div>
      </header>

      <div className="card filtro-card">
        <EscalaFiltro escalas={publicadas} value={escalaIds} onChange={setEscalaIds} label="Filtrar por escala" />
      </div>

      <div className="kpi-row">
        <div className="kpi danger">
          <span className="muted small">Furos ocorridos</span>
          <b>{ocorridos.length}</b>
          <small className="muted">{passados} plantões já iniciados no período</small>
        </div>
        <div className="kpi danger">
          <span className="muted small">Risco crítico</span>
          <b>{criticos.length}</b>
          <small className="muted">vagas abertas que começam em menos de 24h</small>
        </div>
        <div className="kpi warn">
          <span className="muted small">Taxa de furo</span>
          <b>{taxa.toFixed(1)}%</b>
          <small className="muted">ocorridos ÷ plantões iniciados</small>
        </div>
        <div className="kpi">
          <span className="muted small">Faturamento afetado</span>
          <b>{brl(fatRisco)}</b>
          <small className="muted">ocorridos + em risco</small>
        </div>
      </div>

      <label className="check small muted">
        <input id="fu-simular" type="checkbox" checked={simular} onChange={(e) => setSimular(e.target.checked)} />
        Incluir ausências: médico escalado sem nenhum registro de check-in/check-out
      </label>

      {itens.length === 0 ? (
        <Empty title="Nenhum furo no período">Nenhuma vaga aberta ou plantão descoberto nas escalas publicadas.</Empty>
      ) : (
        <>
          <div className="dash-grid">
            <div className="card">
              <h2>Por escala</h2>
              <div className="bars">
                {porEscala.map((e) => (
                  <div className="bar-row" key={e.nome}>
                    <span title={e.nome}>{e.nome}</span>
                    <div className="bar-track" style={{ width: `${((e.ocorridos + e.risco) / maxEsc) * 100}%` }}>
                      <i className="danger" style={{ flex: e.ocorridos }} title={`${e.ocorridos} ocorridos`} />
                      <i className="warn" style={{ flex: e.risco }} title={`${e.risco} em risco`} />
                    </div>
                    <b className="num">{e.ocorridos + e.risco}</b>
                  </div>
                ))}
              </div>
              <div className="legend" style={{ padding: '12px 0 0' }}>
                <span>
                  <i className="sw furo" /> Ocorridos
                </span>
                <span>
                  <i className="sw anunciada" /> Em risco
                </span>
              </div>
            </div>
            <div className="card">
              <h2>Por dia</h2>
              <div className="cols">
                {porDia.map((x) => (
                  <div className="col" key={x.d} title={`${fmtDate(x.d)}: ${x.n}`}>
                    {x.n > 0 && <span>{x.n}</span>}
                    <i className={x.futuro ? 'futuro' : ''} style={{ height: `${(x.n / maxDia) * 100}%`, minHeight: x.n ? 3 : 0 }} />
                  </div>
                ))}
              </div>
              <div className="col-labels">
                {porDia.map((x, i) => (
                  <span key={x.d} style={{ fontWeight: x.d === hoje ? 700 : 400 }}>
                    {porDia.length <= 16 || i % 2 === 0 ? fmtDateShort(x.d) : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h2>
              {itens.length} ocorrências · {risco.length} ainda podem ser cobertas
            </h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Situação</th>
                    <th>Plantão</th>
                    <th>Escala</th>
                    <th>Médico</th>
                    <th className="num">Fatura</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i) => (
                    <tr key={i.key + i.escala.id}>
                      <td>
                        <Badge tone={CRIT[i.tipo].tone}>{CRIT[i.tipo].label}</Badge>
                      </td>
                      <td>
                        <b>
                          {DIAS[weekday(i.data)]} {fmtDate(i.data)}
                        </b>
                        <div className="muted small">
                          {i.turno.inicio}–{fimTurno(i.turno.inicio, i.turno.duracao)} · vaga {i.vagaIdx + 1}
                        </div>
                      </td>
                      <td>
                        {i.escala.nome}
                        <div className="muted small">
                          {i.cr?.codigo} · {i.unidade?.nome}
                        </div>
                      </td>
                      <td>{i.medicoId ? db.medicos.find((m) => m.id === i.medicoId)?.nome : <span className="muted">—</span>}</td>
                      <td className="num">{brl(i.fat)}</td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        {['critico', 'alto', 'moderado'].includes(i.tipo) && (
                          <button className="btn sm primary" onClick={() => setSel(i)}>
                            Cobrir
                          </button>
                        )}{' '}
                        <button className="btn sm ghost" onClick={() => go({ page: 'escala', id: i.escala.id, semana: i.data })}>
                          Ver grade
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {sel && (
        <AlocarModal
          db={db}
          escala={sel.escala}
          slot={sel}
          onClose={() => setSel(null)}
          onSave={(fn, log) => {
            update((d) => {
              const e = d.escalas.find((x) => x.id === sel.escala.id)
              fn(e)
              logEscala(e, 'medico', `${log} (cobertura de furo)`)
            })
            setSel(null)
            notify(log)
          }}
        />
      )}
    </div>
  )
}
