import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, Empty, EscalaFiltro, JanelaTempo, resolverJanela } from '../components/ui'
import { AlocarModal } from './EscalaDetalhe'
import { DIAS, addDays, brl, fimTurno, fmtDate, inicioPlantao, logEscala, todayISO, valorDiferenciado, weekday } from '../lib/utils'
import { momentoAnuncio, slotsGlobais, statusSlot } from '../lib/escala'

const fmtHoras = (ms) => {
  const h = Math.round(ms / 3600e3)
  if (h < 0) return 'iniciado'
  if (h < 48) return `${h}h`
  return `${Math.round(h / 24)} dias`
}
const fmtQuando = (d) => d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const EXTRAS = [
  { key: '7d', h: 168, label: '7 dias' },
  { key: '15d', h: 360, label: '15 dias' },
]

export default function VagasAnunciadas({ go }) {
  const { db, update, notify } = useStore()
  const [escalaIds, setEscalaIds] = useState([])
  const [sel, setSel] = useState(null)
  const hoje = todayISO()
  const [janela, setJanela] = useState({ modo: '72', de: hoje, ate: addDays(hoje, 15) })
  const agora = Date.now()
  const jan = resolverJanela(janela, EXTRAS)

  const itens = useMemo(() => {
    return slotsGlobais(db, jan.de, jan.ate, (e) => e.status === 'publicada' && (escalaIds.length === 0 || escalaIds.includes(e.id)))
      .filter((s) => (!s.medicoId || s.aloc?.ofertado) && s.data <= s.escala.publicadaAte && inicioPlantao(s.data, s.turno.inicio).getTime() > agora && inicioPlantao(s.data, s.turno.inicio).getTime() >= jan.ini && inicioPlantao(s.data, s.turno.inicio).getTime() <= jan.fim)
      .map((s) => {
        const st = statusSlot(s.escala, s)
        const anuncio = momentoAnuncio(s.escala, s)
        const pd = s.escala.pagDiferenciado
        return {
          ...s,
          st: st === 'ofertada' || st === 'anunciada' ? 'anunciada' : s.escala.anunciarVaga ? 'aguardando' : 'sem-anuncio',
          ofertadoPor: st === 'ofertada' ? s.medicoId : null,
          anuncio,
          ate: inicioPlantao(s.data, s.turno.inicio).getTime() - agora,
          pagOfertado: pd?.ativo ? valorDiferenciado(s.pagBase, pd) : s.pagBase,
        }
      })
      .sort((a, b) => a.ate - b.ate)
  }, [db, jan.de, jan.ate, jan.ini, jan.fim, escalaIds, agora])

  const anunciadas = itens.filter((i) => i.st === 'anunciada')
  const aguardando = itens.filter((i) => i.st === 'aguardando')
  const semAnuncio = itens.filter((i) => i.st === 'sem-anuncio')
  const valorOfertado = anunciadas.reduce((t, i) => t + i.pagOfertado, 0)

  const porEscala = Object.values(
    itens.reduce((acc, i) => {
      const k = i.escala.id
      acc[k] = acc[k] || { nome: i.escala.nome, anunciada: 0, aguardando: 0, sem: 0 }
      acc[k][i.st === 'anunciada' ? 'anunciada' : i.st === 'aguardando' ? 'aguardando' : 'sem']++
      return acc
    }, {}),
  )
  const maxEsc = Math.max(1, ...porEscala.map((e) => e.anunciada + e.aguardando + e.sem))
  const publicadas = db.escalas.filter((e) => e.status === 'publicada' && !e.incompleta)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Painel</p>
          <h1>Vagas anunciadas</h1>
          <p className="muted">Vagas sem médico em escalas publicadas, do momento do anúncio automático até o início do plantão.</p>
        </div>
      </header>

      <div className="card filtro-card filter-bar">
        <JanelaTempo value={janela} onChange={setJanela} extras={EXTRAS} />
        <EscalaFiltro escalas={publicadas} value={escalaIds} onChange={setEscalaIds} label="Escalas" />
      </div>

      <div className="kpi-row">
        <div className="kpi warn">
          <span className="muted small">Anunciadas agora</span>
          <b>{anunciadas.length}</b>
          <small className="muted">no mural de vagas</small>
        </div>
        <div className="kpi">
          <span className="muted small">Serão anunciadas</span>
          <b>{aguardando.length}</b>
          <small className="muted">abertas, antes do prazo de anúncio</small>
        </div>
        <div className="kpi">
          <span className="muted small">Abertas sem anúncio</span>
          <b>{semAnuncio.length}</b>
          <small className="muted">escalas com anúncio automático desligado</small>
        </div>
        <div className="kpi">
          <span className="muted small">Valor ofertado (anunciadas)</span>
          <b>{brl(valorOfertado)}</b>
          <small className="muted">inclui pagamento diferenciado quando ativo</small>
        </div>
      </div>

      {itens.length === 0 ? (
        <Empty title="Nenhuma vaga aberta neste cenário">Nenhuma vaga sem médico começa dentro da janela escolhida. Amplie o cenário ou o filtro de escalas.</Empty>
      ) : (
        <>
          <div className="card">
            <h2>Vagas abertas por escala</h2>
            <div className="bars">
              {porEscala.map((e) => (
                <div className="bar-row" key={e.nome}>
                  <span title={e.nome}>{e.nome}</span>
                  <div className="bar-track" style={{ width: `${((e.anunciada + e.aguardando + e.sem) / maxEsc) * 100}%` }}>
                    <i className="warn" style={{ flex: e.anunciada }} title={`${e.anunciada} anunciadas`} />
                    <i className="ok" style={{ flex: e.aguardando }} title={`${e.aguardando} a anunciar`} />
                    <i style={{ flex: e.sem, background: 'var(--border-strong)' }} title={`${e.sem} sem anúncio`} />
                  </div>
                  <b className="num">{e.anunciada + e.aguardando + e.sem}</b>
                </div>
              ))}
            </div>
            <div className="legend" style={{ padding: '12px 0 0' }}>
              <span>
                <i className="sw anunciada" /> Anunciada
              </span>
              <span>
                <i className="sw fixo" /> A anunciar
              </span>
              <span>
                <i className="sw vazia" /> Sem anúncio automático
              </span>
            </div>
          </div>

          <div className="card">
            <h2>Lista de vagas</h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Situação</th>
                    <th>Plantão</th>
                    <th>Escala</th>
                    <th>Anúncio</th>
                    <th className="num">Começa em</th>
                    <th className="num">Paga</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i) => (
                    <tr key={i.key + i.escala.id}>
                      <td>
                        {i.st === 'anunciada' && <Badge tone="warn">{i.ofertadoPor ? 'Oferecida pelo médico' : 'Anunciada'}</Badge>}
                        {i.ofertadoPor && <div className="muted small">{db.medicos.find((m) => m.id === i.ofertadoPor)?.nome}</div>}
                        {i.st === 'aguardando' && <Badge>A anunciar</Badge>}
                        {i.st === 'sem-anuncio' && <Badge tone="neutral">Sem anúncio</Badge>}
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
                      <td className="small">
                        {i.ofertadoPor ? 'pelo médico' : i.st === 'sem-anuncio' ? '—' : i.st === 'anunciada' ? `desde ${fmtQuando(i.anuncio)}` : `em ${fmtQuando(i.anuncio)}`}
                      </td>
                      <td className={`num ${i.ate < 24 * 3600e3 ? 'warn-text' : ''}`}>{fmtHoras(i.ate)}</td>
                      <td className="num">
                        {brl(i.pagOfertado)}
                        {i.pagOfertado !== i.pagBase && <div className="muted small">base {brl(i.pagBase)}</div>}
                      </td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn sm primary" onClick={() => setSel(i)}>
                          Preencher
                        </button>{' '}
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
              logEscala(e, 'medico', log)
            })
            setSel(null)
            notify(log)
          }}
        />
      )}
    </div>
  )
}
