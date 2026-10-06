import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { Badge, Empty, EscalaFiltro } from '../../components/ui'
import { DIAS, addDays, brl, fmtDate, todayISO, uid, weekday } from '../../lib/utils'
import { FIN_LABEL, plantoesDoMedico } from '../../lib/medico'

const ANT = { pendente: ['Em validação', 'warn'], aprovada: ['Aprovada', 'ok'], recusada: ['Recusada', 'danger'] }

export default function FinanceiroMedico() {
  const { db, update, notify, user } = useStore()
  const me = user.medicoId
  const hoje = todayISO()
  const [sel, setSel] = useState(() => new Set())
  const [extratoTodo, setExtratoTodo] = useState(false)
  const minhasEscalas = db.escalas.filter((e) => e.status === 'publicada' && e.alocacoes.some((a) => a.medicoId === user.medicoId))
  const [escalaIds, setEscalaIds] = useState([])
  const filtroEsc = (p) => escalaIds.length === 0 || escalaIds.includes(p.escala.id)
  // histórico desde o início das vigências + 60 dias à frente
  const ps = useMemo(
    () => plantoesDoMedico(db, me, '2026-08-01', addDays(hoje, 60)).filter(filtroEsc),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, me, hoje, escalaIds],
  )

  const passados = ps.filter((p) => ['apurado', 'aguardando', 'glosado'].includes(p.fin.status))
  const apurado = passados.filter((p) => p.fin.status === 'apurado').reduce((t, p) => t + p.fin.valor, 0)
  const aguardando = passados.filter((p) => p.fin.status === 'aguardando').reduce((t, p) => t + p.fin.valor, 0)
  const acumulado = apurado + aguardando
  const futuros = ps.filter((p) => p.fin.status === 'previsto' || p.fin.status === 'andamento')
  const aReceber = futuros.reduce((t, p) => t + p.fin.valor, 0)
  const minhasAnt = (db.antecipacoes || []).filter((a) => a.medicoId === me)
  const antecipado = minhasAnt.filter((a) => a.status === 'aprovada').reduce((t, a) => t + a.liquido, 0)

  const elegiveis = passados.filter((p) => p.fin.status === 'apurado' && p.escala.pagAntecipado?.ativo && !p.antecipacao)
  const escolhidos = elegiveis.filter((p) => sel.has(p.k))
  const bruto = escolhidos.reduce((t, p) => t + p.fin.valor, 0)
  const desconto = escolhidos.reduce((t, p) => t + (p.fin.valor * (p.escala.pagAntecipado.taxa || 0)) / 100, 0)
  const liquido = bruto - desconto
  const taxaMedia = bruto ? (desconto / bruto) * 100 : 0
  const prazo = escolhidos.length ? Math.max(...escolhidos.map((p) => p.escala.pagAntecipado.prazoDias)) : 0

  const toggle = (k) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const solicitar = () => {
    update((d) => {
      if (!d.antecipacoes) d.antecipacoes = []
      d.antecipacoes.push({
        id: uid('ant'),
        medicoId: me,
        itens: escolhidos.map((p) => p.k),
        bruto: Math.round(bruto * 100) / 100,
        taxa: Math.round(taxaMedia * 100) / 100,
        liquido: Math.round(liquido * 100) / 100,
        status: 'pendente',
        criadoEm: new Date().toISOString(),
      })
    })
    setSel(new Set())
    notify('Antecipação enviada para validação do faturamento')
  }

  // linha do tempo mensal
  const porMes = Object.entries(
    ps.reduce((a, p) => {
      const m = p.data.slice(0, 7)
      a[m] = a[m] || { apurado: 0, aguardando: 0, previsto: 0 }
      const k = p.fin.status === 'andamento' ? 'previsto' : p.fin.status === 'glosado' ? null : p.fin.status
      if (k) a[m][k] += p.fin.valor
      return a
    }, {}),
  ).sort()
  const maxMes = Math.max(1, ...porMes.map(([, v]) => v.apurado + v.aguardando + v.previsto))

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Meu financeiro</p>
          <h1>Valores a receber</h1>
          <p className="muted">Posição em {fmtDate(hoje)}. Valores de plantões ainda não apurados são estimados pela presença registrada.</p>
        </div>
      </header>

      <div className="card filtro-card">
        <EscalaFiltro escalas={minhasEscalas} value={escalaIds} onChange={setEscalaIds} label="Escalas" />
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <span className="muted small">Acumulado até hoje</span>
          <b>{brl(acumulado)}</b>
          <small className="muted">
            {brl(apurado)} apurado · {brl(aguardando)} aguardando apuração
          </small>
        </div>
        <div className="kpi">
          <span className="muted small">A receber (plantões futuros)</span>
          <b>{brl(aReceber)}</b>
          <small className="muted">{futuros.length} plantões nos próximos 60 dias</small>
        </div>
        <div className="kpi">
          <span className="muted small">Total previsto</span>
          <b>{brl(acumulado + aReceber)}</b>
          <small className="muted">acumulado + a receber</small>
        </div>
        <div className="kpi">
          <span className="muted small">Antecipado (aprovado)</span>
          <b>{brl(antecipado)}</b>
          <small className="muted">{minhasAnt.filter((a) => a.status === 'pendente').length} pedido(s) em validação</small>
        </div>
      </div>

      <div className="card">
        <h2>Por mês</h2>
        <div className="hbars">
          {porMes.map(([m, v]) => (
            <div className="hbar" key={m}>
              <span className="muted small">
                {m.slice(5, 7)}/{m.slice(0, 4)}
              </span>
              <div className="bar-track" style={{ height: 16, width: `${((v.apurado + v.aguardando + v.previsto) / maxMes) * 100}%` }}>
                <i className="ok" style={{ flex: v.apurado }} title={`Apurado ${brl(v.apurado)}`} />
                <i className="warn" style={{ flex: v.aguardando }} title={`Aguardando ${brl(v.aguardando)}`} />
                <i style={{ flex: v.previsto, background: '#cfd7de' }} title={`Previsto ${brl(v.previsto)}`} />
              </div>
              <span className="num small">{brl(v.apurado + v.aguardando + v.previsto)}</span>
            </div>
          ))}
        </div>
        <div className="legend" style={{ padding: '12px 0 0' }}>
          <span>
            <i className="sw" style={{ background: 'var(--brand)', borderColor: 'var(--brand)' }} /> Apurado
          </span>
          <span>
            <i className="sw" style={{ background: '#e0a93b', borderColor: '#e0a93b' }} /> Aguardando apuração
          </span>
          <span>
            <i className="sw" style={{ background: '#cfd7de', borderColor: '#cfd7de' }} /> Previsto
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Antecipar plantões apurados</h2>
            <p className="muted small">Selecione plantões já apurados em escalas que permitem antecipação. O pedido vai para validação do faturamento.</p>
          </div>
        </div>
        {elegiveis.length === 0 ? (
          <Empty title="Nenhum plantão disponível para antecipação">Plantões aparecem aqui depois de apurados pelo faturamento.</Empty>
        ) : (
          <>
            <div className="sel-bar" style={{ marginBottom: 12 }}>
              <b>{escolhidos.length} selecionado(s)</b>
              {escolhidos.length > 0 && (
                <span className="small">
                  Bruto {brl(bruto)} · taxa {taxaMedia.toFixed(1)}% (−{brl(desconto)}) · <b>líquido {brl(liquido)}</b> · pagamento em até D+{prazo}
                </span>
              )}
              <div className="spacer" />
              <button className="btn sm ghost" onClick={() => setSel(new Set(elegiveis.map((p) => p.k)))}>
                Selecionar todos
              </button>
              <button className="btn sm primary" disabled={!escolhidos.length} onClick={solicitar}>
                Enviar para validação
              </button>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="chk" />
                    <th>Plantão</th>
                    <th>Escala</th>
                    <th className="num">Horas</th>
                    <th className="num">Valor apurado</th>
                    <th className="num">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {elegiveis.map((p) => (
                    <tr key={p.k} className={sel.has(p.k) ? 'sel' : ''}>
                      <td className="chk">
                        <input type="checkbox" aria-label={`Selecionar ${p.data}`} checked={sel.has(p.k)} onChange={() => toggle(p.k)} />
                      </td>
                      <td>
                        <b>
                          {DIAS[weekday(p.data)]} {fmtDate(p.data)}
                        </b>{' '}
                        {p.turno.inicio}
                      </td>
                      <td>{p.escala.nome}</td>
                      <td className="num">{p.ap.horas}h</td>
                      <td className="num">{brl(p.fin.valor)}</td>
                      <td className="num">{p.escala.pagAntecipado.taxa}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {minhasAnt.length > 0 && (
        <div className="card">
          <h2>Meus pedidos de antecipação</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Pedido</th>
                <th className="num">Plantões</th>
                <th className="num">Bruto</th>
                <th className="num">Líquido</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...minhasAnt].reverse().map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="num">{a.itens.length}</td>
                  <td className="num">{brl(a.bruto)}</td>
                  <td className="num">{brl(a.liquido)}</td>
                  <td>
                    <Badge tone={ANT[a.status][1]}>{ANT[a.status][0]}</Badge>
                    {a.motivoRecusa && <div className="muted small">{a.motivoRecusa}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Extrato de plantões</h2>
          <div className="chips-filter">
            <button className={!extratoTodo ? 'on' : ''} onClick={() => setExtratoTodo(false)}>
              Últimos 30 e próximos 15 dias
            </button>
            <button className={extratoTodo ? 'on' : ''} onClick={() => setExtratoTodo(true)}>
              Tudo
            </button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Plantão</th>
                <th>Escala</th>
                <th>Situação</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {[...ps]
                .filter((p) => extratoTodo || (p.data >= addDays(hoje, -30) && p.data <= addDays(hoje, 15)))
                .reverse()
                .map((p) => (
                  <tr key={p.k}>
                    <td>
                      {DIAS[weekday(p.data)]} {fmtDate(p.data)} {p.turno.inicio}
                    </td>
                    <td>{p.escala.nome}</td>
                    <td>
                      <Badge tone={FIN_LABEL[p.fin.status].tone}>{FIN_LABEL[p.fin.status].label}</Badge>
                      {p.antecipacao && <span className="muted small"> · antecipação {ANT[p.antecipacao.status][0].toLowerCase()}</span>}
                    </td>
                    <td className="num">{brl(p.fin.valor)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
