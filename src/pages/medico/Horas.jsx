import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { addDays, fmtDateShort, todayISO } from '../../lib/utils'
import { plantoesDoMedico } from '../../lib/medico'

const fimDoMes = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${ym}-${String(d.getDate()).padStart(2, '0')}`
}
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const nomeMes = (ym) => `${MESES[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`
const mesAnt = (ym, n) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Horas() {
  const { db, user } = useStore()
  const [mes, setMes] = useState(todayISO().slice(0, 7))
  const de = `${mes}-01`
  const ate = fimDoMes(mes)
  const ps = useMemo(() => plantoesDoMedico(db, user.medicoId, de, ate), [db, user.medicoId, de, ate])

  const plan = ps.reduce((t, p) => t + p.turno.duracao, 0)
  const exec = ps.reduce((t, p) => t + (p.horasExec || 0), 0)
  const planAteHoje = ps.filter((p) => p.horasExec != null).reduce((t, p) => t + p.turno.duracao, 0)
  const restantes = ps.filter((p) => p.horasExec == null).reduce((t, p) => t + p.turno.duracao, 0)
  const aderencia = planAteHoje ? Math.round((exec / planAteHoje) * 100) : null

  // por semana (seg a dom)
  const semanas = []
  for (let d = de; d <= ate; ) {
    const w = new Date(d + 'T12:00').getDay()
    const fimSem = addDays(d, (7 - w) % 7)
    const f = fimSem > ate ? ate : fimSem
    const sel = ps.filter((p) => p.data >= d && p.data <= f)
    semanas.push({
      de: d,
      ate: f,
      plan: sel.reduce((t, p) => t + p.turno.duracao, 0),
      exec: sel.reduce((t, p) => t + (p.horasExec || 0), 0),
      futuro: sel.every((p) => p.horasExec == null) && sel.length > 0,
    })
    d = addDays(f, 1)
  }
  const max = Math.max(1, ...semanas.map((s) => s.plan))

  const porEscala = Object.values(
    ps.reduce((a, p) => {
      a[p.escala.id] = a[p.escala.id] || { nome: p.escala.nome, n: 0, plan: 0, exec: 0 }
      a[p.escala.id].n++
      a[p.escala.id].plan += p.turno.duracao
      a[p.escala.id].exec += p.horasExec || 0
      return a
    }, {}),
  )

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Minhas horas</p>
          <h1>Planejadas × executadas</h1>
          <p className="muted">Executadas = horas entre check-in e check-out, ou as horas apuradas pelo faturamento.</p>
        </div>
        <div className="week-nav">
          <button className="icon-btn" aria-label="Mês anterior" onClick={() => setMes(mesAnt(mes, -1))}>
            ‹
          </button>
          <strong style={{ minWidth: 150, textAlign: 'center' }}>{nomeMes(mes)}</strong>
          <button className="icon-btn" aria-label="Próximo mês" onClick={() => setMes(mesAnt(mes, 1))}>
            ›
          </button>
        </div>
      </header>

      <div className="kpi-row">
        <div className="kpi">
          <span className="muted small">Horas planejadas no mês</span>
          <b>{plan}h</b>
          <small className="muted">{ps.length} plantões</small>
        </div>
        <div className="kpi">
          <span className="muted small">Horas executadas</span>
          <b>{exec}h</b>
          <small className="muted">de {planAteHoje}h previstas até hoje</small>
        </div>
        <div className={`kpi ${aderencia != null && aderencia < 95 ? 'warn' : ''}`}>
          <span className="muted small">Cumprimento</span>
          <b>{aderencia == null ? '—' : `${aderencia}%`}</b>
          <small className="muted">executadas ÷ planejadas até hoje</small>
        </div>
        <div className="kpi">
          <span className="muted small">Horas a cumprir</span>
          <b>{restantes}h</b>
          <small className="muted">plantões futuros do mês</small>
        </div>
      </div>

      <div className="card">
        <h2>Por semana</h2>
        <div className="hbars">
          {semanas.map((s) => (
            <div className="hbar" key={s.de}>
              <span className="muted small">
                {fmtDateShort(s.de)} – {fmtDateShort(s.ate)}
              </span>
              <div className="hbar-track" title={`${s.exec}h executadas de ${s.plan}h planejadas`}>
                <i className="plan" style={{ width: `${(s.plan / max) * 100}%` }} />
                <i className="exec" style={{ width: `${(s.exec / max) * 100}%` }} />
              </div>
              <span className="num small">
                <b>{s.exec}h</b> / {s.plan}h
              </span>
            </div>
          ))}
        </div>
        <div className="legend" style={{ padding: '12px 0 0' }}>
          <span>
            <i className="sw" style={{ background: '#cfe6e4', borderColor: '#cfe6e4' }} /> Planejadas
          </span>
          <span>
            <i className="sw" style={{ background: 'var(--brand)', borderColor: 'var(--brand)' }} /> Executadas
          </span>
        </div>
      </div>

      <div className="card">
        <h2>Por escala</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>Escala</th>
              <th className="num">Plantões</th>
              <th className="num">Planejadas</th>
              <th className="num">Executadas</th>
            </tr>
          </thead>
          <tbody>
            {porEscala.map((e) => (
              <tr key={e.nome}>
                <td>{e.nome}</td>
                <td className="num">{e.n}</td>
                <td className="num">{e.plan}h</td>
                <td className="num">{e.exec}h</td>
              </tr>
            ))}
            {porEscala.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Nenhum plantão neste mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
