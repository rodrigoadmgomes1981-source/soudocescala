import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, Field, Modal, Segmented } from '../components/ui'
import { RegrasForm, TurnosEditor, descTurno } from '../components/EscalaForms'
import {
  BASES,
  DIAS,
  FERIADOS,
  TIPOS_LOG,
  TIPOS_VALOR,
  addDays,
  baseLabel,
  brl,
  fimTurno,
  fmtDate,
  fmtDateShort,
  logEscala,
  parseISO,
  startOfWeek,
  todayISO,
  toMin,
  uid,
  weekday,
} from '../lib/utils'
import { checarMedico, findSetor, naVigencia, resumoPeriodo, slotsDoDia, statusSlot } from '../lib/escala'

const TABS = [
  { key: 'grade', label: 'Grade e médicos' },
  { key: 'config', label: 'Configuração' },
  { key: 'fin', label: 'Financeiro planejado' },
  { key: 'hist', label: 'Log de alterações' },
]

const STATUS_LABEL = { fixo: 'Fixo', avulso: 'Avulso', anunciada: 'Vaga anunciada', vazia: 'Vaga aberta', furo: 'Furo (plantão sem médico)' }

const aprov = (v) => (v === 'automatica' ? 'Automática' : 'Com aprovação')
const presencaTxt = (p) => p.map((x) => (x === 'facial' ? 'Facial' : 'Geolocalização')).join(' + ') || '—'
/** Campos de regra comparados para o log de alterações */
const CAMPOS = [
  ['Nome', (e) => e.nome],
  ['Presença', (e) => presencaTxt(e.presenca)],
  ['Raio da geolocalização', (e) => (e.presenca.includes('geo') ? `${e.raioGeo} m` : '—')],
  ['Tolerância de atraso', (e) => `${e.toleranciaMin} min`],
  ['Base de faturamento', (e) => BASES.find((b) => b.key === e.faturamento)?.label],
  ['Base de pagamento', (e) => BASES.find((b) => b.key === e.pagamento)?.label],
  ['Passagem de plantão', (e) => aprov(e.passagem)],
  ['Troca de plantão', (e) => aprov(e.troca)],
  ['Antecedência mínima', (e) => `${e.antecedenciaHoras} h`],
  ['Anúncio automático', (e) => (e.anunciarVaga ? `Sim, ${e.anuncioHorasAntes}h antes` : 'Não')],
  ['Pagamento antecipado', (e) => (e.pagAntecipado?.ativo ? `Sim, D+${e.pagAntecipado.prazoDias}, taxa ${e.pagAntecipado.taxa}%` : 'Não')],
  [
    'Pag. diferenciado antecipado',
    (e) =>
      e.pagDiferenciado?.ativo
        ? `Sim, +${e.pagDiferenciado.tipo === 'percentual' ? e.pagDiferenciado.valor + '%' : brl(e.pagDiferenciado.valor)} em D+${e.pagDiferenciado.prazoDias}`
        : 'Não',
  ],
  ['Início da vigência', (e) => fmtDate(e.vigenciaInicio)],
  ['Fim da vigência', (e) => (e.vigenciaFim ? fmtDate(e.vigenciaFim) : 'Indeterminada')],
]
const diffRegras = (a, b) =>
  CAMPOS.map(([campo, f]) => ({ campo, de: f(a), para: f(b) })).filter((x) => x.de !== x.para)

export default function EscalaDetalhe({ id, semanaInicial, go }) {
  const { db, update, notify } = useStore()
  const escala = db.escalas.find((e) => e.id === id)
  const [tab, setTab] = useState('grade')
  const [semana, setSemana] = useState(() => {
    if (semanaInicial) return startOfWeek(semanaInicial)
    const hoje = todayISO()
    const base = escala && hoje < escala.vigenciaInicio ? escala.vigenciaInicio : hoje
    return startOfWeek(base)
  })
  const [slotSel, setSlotSel] = useState(null)
  const [publicar, setPublicar] = useState(false)
  const [draft, setDraft] = useState(null) // cópia local das regras em edição

  if (!escala)
    return (
      <div className="page">
        <p>Escala não encontrada.</p>
        <button className="btn" onClick={() => go({ page: 'escalas' })}>
          Voltar
        </button>
      </div>
    )

  const { cr, unidade, setor } = findSetor(db, escala.crId, escala.unidadeId, escala.setorId)
  const valores = setor?.valores

  /** Edita a escala no banco, registra no log e marca pendência se já publicada */
  const setE = (fn, log) =>
    update((d) => {
      const e = d.escalas.find((x) => x.id === id)
      fn(e)
      if (e.status === 'publicada') e.pendente = true
      if (log) logEscala(e, log.tipo, log.acao, log.detalhes)
    })

  const regras = draft || escala
  const mudancas = draft ? diffRegras(escala, draft) : []
  const editarRegras = (fn) =>
    setDraft((prev) => {
      const n = structuredClone(prev || escala)
      fn(n)
      return n
    })
  const salvarRegras = () => {
    const det = diffRegras(escala, draft)
    setE(
      (e) => {
        CAMPOS_CHAVE.forEach((k) => (e[k] = structuredClone(draft[k])))
      },
      { tipo: 'regra', acao: `Regras alteradas (${det.length} ${det.length > 1 ? 'campos' : 'campo'})`, detalhes: det },
    )
    setDraft(null)
    notify('Alterações salvas e registradas no log')
  }

  const dias = Array.from({ length: 7 }, (_, i) => addDays(semana, i))
  const temAloc = (t) => escala.alocacoes.some((a) => a.turnoId === t.id && a.medicoId)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <button className="link" onClick={() => go({ page: 'escalas' })}>
            ← Escalas
          </button>
          <h1>{escala.nome}</h1>
          <p className="muted">
            {cr?.codigo} · {unidade?.nome} · {setor?.nome} · vigência {fmtDate(escala.vigenciaInicio)} →{' '}
            {escala.vigenciaFim ? fmtDate(escala.vigenciaFim) : 'indeterminada'}
          </p>
        </div>
        <div className="head-actions">
          <Badge tone={escala.status === 'publicada' ? 'ok' : 'neutral'}>
            {escala.status === 'publicada' ? `Publicada até ${fmtDate(escala.publicadaAte)} · v${escala.versao}` : `Rascunho · v${escala.versao}`}
          </Badge>
          <button className="btn primary" onClick={() => setPublicar(true)}>
            {escala.status === 'publicada' ? 'Atualizar publicação' : 'Publicar escala'}
          </button>
        </div>
      </header>

      {escala.pendente && (
        <div className="alert warn row">
          <span>Há alterações feitas depois da publicação. Os médicos ainda veem a versão v{escala.versao}.</span>
          <button className="btn sm" onClick={() => setPublicar(true)}>
            Republicar como v{escala.versao + 1}
          </button>
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'hist' && <span className="muted small"> ({escala.historico.length})</span>}
          </button>
        ))}
      </nav>

      {tab === 'grade' && <Grade escala={escala} valores={valores} dias={dias} semana={semana} setSemana={setSemana} onSlot={setSlotSel} />}

      {tab === 'config' && (
        <div className="stack">
          <div className="card">
            <h2>Dias e períodos</h2>
            <p className="muted small" style={{ marginBottom: 12 }}>
              Cada período é salvo individualmente e registrado no log.
            </p>
            <TurnosEditor
              turnos={escala.turnos}
              valores={valores}
              podeRemover={(t) => !temAloc(t)}
              onSave={(t, anterior) => {
                setE(
                  (e) => {
                    const i = e.turnos.findIndex((x) => x.id === t.id)
                    if (i >= 0) e.turnos[i] = t
                    else e.turnos.push(t)
                    // se reduziu vagas, remove alocações das vagas que deixaram de existir
                    e.alocacoes = e.alocacoes.filter((a) => a.turnoId !== t.id || a.vagaIdx < t.vagas)
                  },
                  anterior
                    ? { tipo: 'periodo', acao: 'Período alterado', detalhes: [{ campo: 'Período', de: descTurno(anterior), para: descTurno(t) }] }
                    : { tipo: 'periodo', acao: `Período adicionado: ${descTurno(t)}` },
                )
                notify(anterior ? 'Período alterado e salvo' : 'Período salvo')
              }}
              onRemove={(t) => {
                setE(
                  (e) => {
                    e.turnos = e.turnos.filter((x) => x.id !== t.id)
                    e.alocacoes = e.alocacoes.filter((a) => a.turnoId !== t.id)
                  },
                  { tipo: 'periodo', acao: `Período removido: ${descTurno(t)}` },
                )
                notify('Período removido', 'warn')
              }}
            />
          </div>
          <div className="card">
            <h2>Regras</h2>
            <RegrasForm e={regras} set={editarRegras} />
          </div>
          <div className="card">
            <h2>Vigência</h2>
            <div className="grid-form">
              <Field label="Início da vigência">
                <input id="cfg-vig-ini" type="date" value={regras.vigenciaInicio} onChange={(ev) => editarRegras((x) => (x.vigenciaInicio = ev.target.value))} />
              </Field>
              <Field label="Fim da vigência (opcional)">
                <input id="cfg-vig-fim" type="date" value={regras.vigenciaFim} min={regras.vigenciaInicio} onChange={(ev) => editarRegras((x) => (x.vigenciaFim = ev.target.value))} />
              </Field>
            </div>
          </div>
          {mudancas.length > 0 && (
            <div className="save-bar">
              <span className="muted">
                {mudancas.length} {mudancas.length > 1 ? 'alterações não salvas' : 'alteração não salva'}
              </span>
              <button className="btn ghost" onClick={() => setDraft(null)}>
                Descartar
              </button>
              <button className="btn primary" onClick={salvarRegras}>
                Salvar alterações
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'fin' && <Financeiro escala={escala} valores={valores} />}

      {tab === 'hist' && <LogAlteracoes escala={escala} />}

      {slotSel && (
        <AlocarModal
          db={db}
          escala={escala}
          slot={slotSel}
          onClose={() => setSlotSel(null)}
          onSave={(fn, log) => {
            setE(fn, { tipo: 'medico', acao: log })
            setSlotSel(null)
            notify(log)
          }}
        />
      )}

      {publicar && (
        <PublicarModal
          escala={escala}
          valores={valores}
          onClose={() => setPublicar(false)}
          onPublish={(ate, notificar) => {
            update((d) => {
              const e = d.escalas.find((x) => x.id === id)
              const republicando = e.status === 'publicada'
              const antes = e.publicadaAte
              if (republicando) e.versao += 1
              e.status = 'publicada'
              e.publicadaAte = ate
              e.pendente = false
              logEscala(
                e,
                'publicacao',
                `${republicando ? 'Republicada' : 'Publicada'} até ${fmtDate(ate)} (v${e.versao})${notificar ? ' · médicos notificados' : ''}`,
                republicando && antes !== ate ? [{ campo: 'Publicada até', de: fmtDate(antes), para: fmtDate(ate) }] : null,
              )
            })
            setPublicar(false)
            notify(`Escala publicada até ${fmtDate(ate)}`)
          }}
          onRascunho={() => {
            update((d) => {
              const e = d.escalas.find((x) => x.id === id)
              e.status = 'rascunho'
              e.pendente = false
              logEscala(e, 'publicacao', 'Publicação suspensa · voltou para rascunho')
            })
            setPublicar(false)
            notify('Escala voltou para rascunho', 'warn')
          }}
        />
      )}
    </div>
  )
}

const CAMPOS_CHAVE = [
  'nome',
  'presenca',
  'raioGeo',
  'toleranciaMin',
  'faturamento',
  'pagamento',
  'passagem',
  'troca',
  'antecedenciaHoras',
  'anunciarVaga',
  'anuncioHorasAntes',
  'pagAntecipado',
  'pagDiferenciado',
  'vigenciaInicio',
  'vigenciaFim',
]

/* ------------------------------------------------------------------ */

function LogAlteracoes({ escala }) {
  const [filtro, setFiltro] = useState('todos')
  const tipoLabel = (k) => TIPOS_LOG.find((t) => t.key === k)?.label || 'Geral'
  const tone = { regra: 'info', periodo: 'moon', medico: 'ok', publicacao: 'warn' }
  const itens = [...escala.historico].reverse().filter((h) => filtro === 'todos' || h.tipo === filtro)
  return (
    <div className="card">
      <div className="card-head">
        <h2>Log de alterações</h2>
        <div className="chips-filter">
          {[{ key: 'todos', label: 'Todos' }, ...TIPOS_LOG].map((t) => (
            <button key={t.key} className={filtro === t.key ? 'on' : ''} onClick={() => setFiltro(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {itens.length === 0 && <p className="muted">Nenhum registro neste filtro.</p>}
      <ul className="log-list">
        {itens.map((h, i) => (
          <li key={i}>
            <div className="log-meta">
              <span>{new Date(h.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <b style={{ color: 'var(--text)' }}>{h.usuario || 'Sistema'}</b>
              <span>
                <Badge tone={tone[h.tipo] || 'neutral'}>{tipoLabel(h.tipo)}</Badge>
              </span>
            </div>
            <div className="log-body">
              <span>{h.acao}</span>
              {h.detalhes?.length > 0 && (
                <div className="log-diff">
                  {h.detalhes.map((d, j) => (
                    <FragmentDiff key={j} d={d} />
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FragmentDiff({ d }) {
  return (
    <>
      <span className="muted">{d.campo}</span>
      <span>
        <del>{d.de}</del> → <ins>{d.para}</ins>
      </span>
    </>
  )
}

/* ------------------------------------------------------------------ */

function Grade({ escala, valores, dias, semana, setSemana, onSlot }) {
  const { db } = useStore()
  const nomeMed = (mid) => db.medicos.find((m) => m.id === mid)?.nome || '—'
  const turnos = [...escala.turnos].sort((a, b) => toMin(a.inicio) - toMin(b.inicio))
  const r = resumoPeriodo(escala, valores, dias[0], dias[6])
  const anunciadas = dias.flatMap((d) => slotsDoDia(escala, valores, d)).filter((s) => statusSlot(escala, s) === 'anunciada').length
  const hoje = todayISO()
  const mes = parseISO(semana).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="card grade-card">
      <div className="grade-toolbar">
        <div className="week-nav">
          <button className="icon-btn" onClick={() => setSemana(addDays(semana, -7))} aria-label="Semana anterior">
            ‹
          </button>
          <button className="btn sm ghost" onClick={() => setSemana(startOfWeek(todayISO()))}>
            Hoje
          </button>
          <button className="icon-btn" onClick={() => setSemana(addDays(semana, 7))} aria-label="Próxima semana">
            ›
          </button>
          <strong className="cap">{mes}</strong>
          <span className="muted small">
            {fmtDate(dias[0])} – {fmtDate(dias[6])}
          </span>
        </div>
        <div className="kpis">
          <span>
            <b>{r.preenchidos}</b>/{r.slots} preenchidas
          </span>
          <span>
            <b>{r.vazios}</b> abertas
          </span>
          {escala.anunciarVaga && (
            <span>
              <b>{anunciadas}</b> anunciadas
            </span>
          )}
          <span>
            Fatura <b>{brl(r.fat)}</b>
          </span>
          <span>
            Paga <b>{brl(r.pag)}</b>
          </span>
        </div>
      </div>

      <div className="grade-scroll">
        <table className="grade">
          <thead>
            <tr>
              <th className="corner">Período</th>
              {dias.map((d) => (
                <th
                  key={d}
                  className={`${d === hoje ? 'today' : ''} ${FERIADOS[d] || weekday(d) === 0 || weekday(d) === 6 ? 'fds' : ''} ${
                    escala.status === 'publicada' && escala.publicadaAte && d > escala.publicadaAte ? 'nao-pub' : ''
                  }`}
                >
                  <span>{DIAS[weekday(d)]}</span>
                  <b>{fmtDateShort(d)}</b>
                  {FERIADOS[d] && <small title={FERIADOS[d]}>Feriado</small>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turnos.map((t) => (
              <tr key={t.id}>
                <th className="row-head">
                  <b>
                    {t.inicio} – {fimTurno(t.inicio, t.duracao)}
                  </b>
                  <span className="muted small">
                    {t.duracao}h · {t.vagas} {t.vagas > 1 ? 'médicos' : 'médico'}
                  </span>
                </th>
                {dias.map((d) => {
                  if (!naVigencia(escala, d) || !t.dias.includes(weekday(d)))
                    return <td key={d} className="off" aria-label="Sem plantão" />
                  const slots = slotsDoDia(escala, valores, d).filter((s) => s.turno.id === t.id)
                  return (
                    <td key={d}>
                      <div className="slots">
                        {slots.map((s) => {
                          const st = statusSlot(escala, s)
                          return (
                            <button key={s.key} className={`slot ${st}`} onClick={() => onSlot(s)} title={`${STATUS_LABEL[st]} · fatura ${brl(s.fat)} · paga ${brl(s.pag)}`}>
                              {s.medicoId ? (
                                <>
                                  <span className="slot-name">{nomeMed(s.medicoId).split(' ').slice(0, 2).join(' ')}</span>
                                  <span className="slot-tag">
                                    {st === 'fixo' ? 'Fixo' : 'Avulso'}
                                    {s.diferenciado && <span className="dif">Dif.</span>}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="slot-name">{st === 'furo' ? 'Sem médico' : '+ Inserir médico'}</span>
                                  {st === 'anunciada' && <span className="slot-tag">Anunciada</span>}
                                  {st === 'furo' && <span className="slot-tag">Furo</span>}
                                </>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <span>
          <i className="sw fixo" /> Fixo
        </span>
        <span>
          <i className="sw avulso" /> Avulso
        </span>
        <span>
          <i className="sw vazia" /> Vaga aberta
        </span>
        {escala.anunciarVaga && (
          <span>
            <i className="sw anunciada" /> Anunciada no mural ({escala.anuncioHorasAntes}h antes)
          </span>
        )}
        <span>
          <i className="sw furo" /> Furo (horário passou sem médico)
        </span>
        <span>
          <i className="sw fds" /> Fim de semana/feriado
        </span>
        {escala.pagDiferenciado?.ativo && (
          <span>
            <span className="dif" style={{ marginLeft: 0 }}>Dif.</span> Pagamento diferenciado antecipado
          </span>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function AlocarModal({ db, escala, slot, onClose, onSave }) {
  const ocupado = !!slot.medicoId
  const [modo, setModo] = useState(ocupado ? 'ver' : 'inserir')
  const [medicoId, setMedicoId] = useState('')
  const stInicial = statusSlot(escala, slot)
  const urgente = stInicial === 'anunciada' || stInicial === 'furo'
  const [fixo, setFixo] = useState(urgente ? 'avulso' : 'fixo')
  const [dif, setDif] = useState(urgente && !!escala.pagDiferenciado?.ativo)
  const [q, setQ] = useState('')
  const med = db.medicos.find((m) => m.id === slot.medicoId)
  const { turno, data } = slot
  const diasTurno = turno.dias.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DIAS[d]).join(', ')

  // checagem de conflito: avulso só na data; fixo nas próximas 8 ocorrências
  const checagem = useMemo(() => {
    if (!medicoId) return null
    const datas = [data]
    if (fixo === 'fixo') {
      let d = addDays(data, 1)
      let guard = 0
      while (datas.length < 8 && guard++ < 60) {
        if (turno.dias.includes(weekday(d)) && naVigencia(escala, d)) datas.push(d)
        d = addDays(d, 1)
      }
    }
    const conflitos = []
    let maxH = 0
    for (const d of datas) {
      const r = checarMedico(db, medicoId, d, turno, d === data ? slot.key : `${turno.id}-${slot.vagaIdx}-${d}`)
      conflitos.push(...r.conflitos)
      maxH = Math.max(maxH, r.horasContinuas)
    }
    return { conflitos: [...new Set(conflitos)], maxH, datas: datas.length }
  }, [medicoId, fixo, data, turno, db, escala, slot])

  const lista = db.medicos.filter((m) => `${m.nome} ${m.especialidade} ${m.crm}`.toLowerCase().includes(q.toLowerCase()))
  const nome = (id) => db.medicos.find((m) => m.id === id)?.nome

  const usaDif = dif && fixo === 'avulso' && !!escala.pagDiferenciado?.ativo
  const pd = escala.pagDiferenciado
  const pagComDif = pd?.ativo ? (pd.tipo === 'percentual' ? slot.pagBase * (1 + pd.valor / 100) : slot.pagBase + pd.valor) : slot.pagBase
  const salvar = () => {
    const mNome = nome(medicoId)
    if (fixo === 'fixo') {
      onSave((e) => {
        // encerra fixo anterior desse slot e remove avulsas futuras vazias/de liberação
        e.alocacoes.forEach((a) => {
          if (a.fixo && a.turnoId === turno.id && a.vagaIdx === slot.vagaIdx && a.desde <= data && (!a.ate || a.ate >= data)) {
            if (a.desde === data) a._del = true
            else a.ate = addDays(data, -1)
          }
          if (!a.fixo && a.turnoId === turno.id && a.vagaIdx === slot.vagaIdx && a.data === data) a._del = true
        })
        e.alocacoes = e.alocacoes.filter((a) => !a._del)
        e.alocacoes.push({ id: uid('a'), turnoId: turno.id, vagaIdx: slot.vagaIdx, medicoId, fixo: true, desde: data })
      }, `${mNome} inserido(a) como FIXO em ${diasTurno} ${turno.inicio}, a partir de ${fmtDate(data)}`)
    } else {
      onSave((e) => {
        e.alocacoes = e.alocacoes.filter((a) => !(!a.fixo && a.turnoId === turno.id && a.vagaIdx === slot.vagaIdx && a.data === data))
        e.alocacoes.push({ id: uid('a'), turnoId: turno.id, vagaIdx: slot.vagaIdx, medicoId, fixo: false, data, ...(usaDif ? { diferenciado: true } : {}) })
      }, `${mNome} inserido(a) como AVULSO em ${fmtDate(data)} ${turno.inicio}${usaDif ? ' com pagamento diferenciado antecipado' : ''}`)
    }
  }

  const liberarData = () =>
    onSave((e) => {
      e.alocacoes = e.alocacoes.filter((a) => !(!a.fixo && a.turnoId === turno.id && a.vagaIdx === slot.vagaIdx && a.data === data))
      if (slot.aloc?.fixo) e.alocacoes.push({ id: uid('a'), turnoId: turno.id, vagaIdx: slot.vagaIdx, medicoId: null, fixo: false, data })
    }, `${med?.nome} retirado(a) de ${fmtDate(data)} ${turno.inicio} — vaga aberta`)

  const encerrarFixo = () =>
    onSave((e) => {
      const a = e.alocacoes.find((x) => x.id === slot.aloc.id)
      if (a.desde >= data) e.alocacoes = e.alocacoes.filter((x) => x.id !== a.id)
      else a.ate = addDays(data, -1)
    }, `Fixo de ${med?.nome} encerrado a partir de ${fmtDate(data)}`)

  const fixoAtual = escala.alocacoes.find(
    (a) => a.fixo && a.medicoId && a.turnoId === turno.id && a.vagaIdx === slot.vagaIdx && a.desde <= data && (!a.ate || a.ate >= data),
  )
  const bloqueado = !medicoId || (checagem && checagem.conflitos.length > 0)

  return (
    <Modal
      title={`${DIAS[weekday(data)]}, ${fmtDate(data)} · ${turno.inicio}–${fimTurno(turno.inicio, turno.duracao)}`}
      onClose={onClose}
      width={560}
      footer={
        modo === 'ver' ? (
          <>
            <button className="btn ghost danger" onClick={liberarData}>
              Retirar só nesta data
            </button>
            {slot.aloc?.fixo && (
              <button className="btn ghost danger" onClick={encerrarFixo}>
                Encerrar fixo a partir daqui
              </button>
            )}
            <div className="spacer" />
            <button className="btn primary" onClick={() => setModo('inserir')}>
              Substituir médico
            </button>
          </>
        ) : (
          <>
            <button className="btn ghost" onClick={ocupado ? () => setModo('ver') : onClose}>
              Cancelar
            </button>
            <div className="spacer" />
            <button className="btn primary" disabled={bloqueado} onClick={salvar}>
              Inserir médico
            </button>
          </>
        )
      }
    >
      <div className="slot-info">
        <div>
          <span className="muted small">Vaga</span>
          <b>
            {slot.vagaIdx + 1} de {turno.vagas}
          </b>
        </div>
        <div>
          <span className="muted small">Tipo</span>
          <b>{TIPOS_VALOR.find((t) => t.key === slot.tipo)?.label}</b>
        </div>
        <div>
          <span className="muted small">Fatura</span>
          <b>{brl(slot.fat)}</b>
        </div>
        <div>
          <span className="muted small">Paga</span>
          <b>{brl(slot.pag)}</b>
        </div>
      </div>

      {modo === 'ver' && med && (
        <div className="med-atual">
          <div className="avatar">{med.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')}</div>
          <div>
            <b>{med.nome}</b>
            <span className="muted small">
              {med.crm} · {med.especialidade}
            </span>
            <span className="small">
              {slot.aloc?.fixo
                ? `Fixo desde ${fmtDate(slot.aloc.desde)}${slot.aloc.ate ? ` até ${fmtDate(slot.aloc.ate)}` : ''} · ${diasTurno}`
                : 'Avulso — somente nesta data'}
            </span>
          </div>
        </div>
      )}

      {modo === 'inserir' && (
        <div className="stack">
          <input className="search full" placeholder="Buscar médico por nome, CRM ou especialidade…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="med-list" role="listbox">
            {lista.map((m) => (
              <button key={m.id} role="option" aria-selected={medicoId === m.id} className={medicoId === m.id ? 'on' : ''} onClick={() => setMedicoId(m.id)}>
                <b>{m.nome}</b>
                <span className="muted small">
                  {m.crm} · {m.especialidade}
                </span>
              </button>
            ))}
          </div>

          <div>
            <p className="field-label">Este médico será fixo?</p>
            <Segmented
              name="Tipo de alocação"
              value={fixo}
              onChange={setFixo}
              options={[
                { key: 'fixo', label: 'Sim, fixo' },
                { key: 'avulso', label: 'Não, só nesta data' },
              ]}
            />
            <p className="muted small" style={{ marginTop: 6 }}>
              {fixo === 'fixo'
                ? `Repete em toda ${diasTurno} às ${turno.inicio}, a partir de ${fmtDate(data)}${escala.vigenciaFim ? ` até ${fmtDate(escala.vigenciaFim)}` : ' (vigência indeterminada)'}.`
                : `Vale apenas para ${fmtDate(data)}.`}
            </p>
          </div>

          {escala.pagDiferenciado?.ativo && fixo === 'avulso' && (
            <label className="check dif-box">
              <input id="chk-dif" type="checkbox" checked={dif} onChange={(e) => setDif(e.target.checked)} />
              <span>
                Aplicar <b>pagamento diferenciado antecipado</b>: paga {brl(pagComDif)} em vez de {brl(slot.pagBase)}, em D+{pd.prazoDias}
                {urgente && <span className="muted small"> · recomendado para {stInicial === 'furo' ? 'cobertura de furo' : 'vaga anunciada'}</span>}
              </span>
            </label>
          )}
          {fixo === 'fixo' && fixoAtual && fixoAtual.medicoId !== medicoId && (
            <div className="alert warn">
              Esta vaga tem <b>{nome(fixoAtual.medicoId)}</b> como fixo{slot.medicoId ? '' : ' (retirado apenas desta data)'}. Inserir
              outro médico como fixo <b>encerra o fixo de {nome(fixoAtual.medicoId)?.split(' ')[0]}</b> a partir de {fmtDate(data)}. Para cobrir só este dia,
              escolha “Não, só nesta data”.
            </div>
          )}
          {checagem && checagem.conflitos.length > 0 && (
            <div className="alert danger">
              <b>Conflito de horário</b> — o médico já está escalado em:
              <ul>
                {checagem.conflitos.slice(0, 5).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {checagem && checagem.conflitos.length === 0 && checagem.maxH > 24 && (
            <div className="alert warn">
              Atenção: com esta alocação o médico fica <b>{checagem.maxH}h seguidas</b> em plantão (limite de referência: 24h).
            </div>
          )}
          {checagem && checagem.conflitos.length === 0 && checagem.maxH <= 24 && (
            <div className="alert ok">Sem conflitos{fixo === 'fixo' ? ` nas próximas ${checagem.datas} ocorrências` : ''}.</div>
          )}
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

function PublicarModal({ escala, valores, onClose, onPublish, onRascunho }) {
  const sugestao = () => {
    const base = escala.publicadaAte || todayISO()
    const d = parseISO(base < escala.vigenciaInicio ? escala.vigenciaInicio : base)
    const fimMes = new Date(d.getFullYear(), d.getMonth() + 2, 0)
    const iso = `${fimMes.getFullYear()}-${String(fimMes.getMonth() + 1).padStart(2, '0')}-${String(fimMes.getDate()).padStart(2, '0')}`
    return escala.vigenciaFim && iso > escala.vigenciaFim ? escala.vigenciaFim : iso
  }
  const [ate, setAte] = useState(sugestao)
  const [notificar, setNotificar] = useState(true)
  const de = escala.vigenciaInicio > todayISO() ? escala.vigenciaInicio : todayISO()
  const r = resumoPeriodo(escala, valores, de, ate)
  const invalido = !ate || ate < escala.vigenciaInicio || (escala.vigenciaFim && ate > escala.vigenciaFim)

  return (
    <Modal
      title={escala.status === 'publicada' ? 'Atualizar publicação' : 'Publicar escala'}
      onClose={onClose}
      width={640}
      footer={
        <>
          {escala.status === 'publicada' && (
            <button className="btn ghost danger" onClick={onRascunho}>
              Suspender (voltar a rascunho)
            </button>
          )}
          <div className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={invalido} onClick={() => onPublish(ate, notificar)}>
            Publicar até {fmtDate(ate)}
          </button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">
          A vigência define quando a escala vale. A publicação define <b>até quando os médicos já enxergam a grade</b> — dá
          para publicar mês a mês e ir estendendo.
        </p>
        <Field label="Publicada até" hint={`Vigência: ${fmtDate(escala.vigenciaInicio)} → ${escala.vigenciaFim ? fmtDate(escala.vigenciaFim) : 'indeterminada'}`}>
          <input type="date" value={ate} min={escala.vigenciaInicio} max={escala.vigenciaFim || undefined} onChange={(e) => setAte(e.target.value)} />
        </Field>
        <div className="pub-resumo">
          <div>
            <span className="muted small">Plantões no período</span>
            <b>{r.slots}</b>
          </div>
          <div>
            <span className="muted small">Preenchidos</span>
            <b>{r.preenchidos}</b>
          </div>
          <div>
            <span className="muted small">Vagas abertas</span>
            <b className={r.vazios ? 'warn-text' : ''}>{r.vazios}</b>
          </div>
          <div>
            <span className="muted small">Fatura planejada</span>
            <b>{brl(r.fat)}</b>
          </div>
        </div>
        {r.vazios > 0 && escala.anunciarVaga && (
          <p className="alert info">
            {r.vazios} vaga(s) aberta(s) serão anunciadas automaticamente {escala.anuncioHorasAntes}h antes do início, se seguirem sem médico.
          </p>
        )}
        {r.vazios > 0 && !escala.anunciarVaga && <p className="alert warn">{r.vazios} vaga(s) ficarão abertas e o anúncio automático está desligado.</p>}
        <label className="check">
          <input type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} />
          Notificar os médicos escalados (app e WhatsApp)
        </label>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

function Financeiro({ escala, valores }) {
  const hoje = todayISO()
  const [de, setDe] = useState(() => {
    const d = parseISO(hoje)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [ate, setAte] = useState(() => {
    const d = parseISO(hoje)
    const f = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
  })

  const linhas = useMemo(() => {
    const acc = Object.fromEntries(TIPOS_VALOR.map((t) => [t.key, { n: 0, ok: 0, fat: 0, pag: 0, fatPrev: 0, pagPrev: 0, horas: 0 }]))
    acc._dif = { n: 0, extra: 0 }
    let d = de
    let g = 0
    while (d <= ate && g++ < 400) {
      for (const s of slotsDoDia(escala, valores, d)) {
        const a = acc[s.tipo]
        a.n++
        a.fatPrev += s.fat
        a.pagPrev += s.pag
        a.horas += s.turno.duracao
        if (s.diferenciado) {
          acc._dif.n++
          acc._dif.extra += s.pag - s.pagBase
        }
        if (s.medicoId) {
          a.ok++
          a.fat += s.fat
          a.pag += s.pag
        }
      }
      d = addDays(d, 1)
    }
    return acc
  }, [escala, valores, de, ate])

  const dif = linhas._dif
  const tot = TIPOS_VALOR.map((t) => linhas[t.key]).reduce(
    (t, l) => ({ n: t.n + l.n, ok: t.ok + l.ok, fat: t.fat + l.fat, pag: t.pag + l.pag, fatPrev: t.fatPrev + l.fatPrev, pagPrev: t.pagPrev + l.pagPrev, horas: t.horas + l.horas }),
    { n: 0, ok: 0, fat: 0, pag: 0, fatPrev: 0, pagPrev: 0, horas: 0 },
  )
  const margem = (f, p) => (f ? (((f - p) / f) * 100).toFixed(1) + '%' : '—')

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>Planejado no período</h2>
          <div className="inline-fields">
            <Field label="De">
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </Field>
            <Field label="Até">
              <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="fin-kpis">
          <div>
            <span className="muted small">Fatura (escala atual)</span>
            <b>{brl(tot.fat)}</b>
            <small className="muted">potencial 100%: {brl(tot.fatPrev)}</small>
          </div>
          <div>
            <span className="muted small">Paga (escala atual)</span>
            <b>{brl(tot.pag)}</b>
            <small className="muted">potencial 100%: {brl(tot.pagPrev)}</small>
          </div>
          <div>
            <span className="muted small">Margem bruta</span>
            <b>{margem(tot.fat, tot.pag)}</b>
            <small className="muted">{brl(tot.fat - tot.pag)}</small>
          </div>
          <div>
            <span className="muted small">Ocupação</span>
            <b>{tot.n ? Math.round((tot.ok / tot.n) * 100) : 0}%</b>
            <small className="muted">
              {tot.ok}/{tot.n} plantões · {tot.horas}h
            </small>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Tipo de período</th>
              <th className="num">Plantões</th>
              <th className="num">Preenchidos</th>
              <th className="num">Fatura</th>
              <th className="num">Paga</th>
              <th className="num">Margem</th>
            </tr>
          </thead>
          <tbody>
            {TIPOS_VALOR.map((t) => {
              const l = linhas[t.key]
              return (
                <tr key={t.key}>
                  <td>{t.label}</td>
                  <td className="num">{l.n}</td>
                  <td className="num">{l.ok}</td>
                  <td className="num">{brl(l.fat)}</td>
                  <td className="num">{brl(l.pag)}</td>
                  <td className="num">{margem(l.fat, l.pag)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="num">{tot.n}</td>
              <td className="num">{tot.ok}</td>
              <td className="num">{brl(tot.fat)}</td>
              <td className="num">{brl(tot.pag)}</td>
              <td className="num">{margem(tot.fat, tot.pag)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="card note">
        <b>Como esta escala fecha a competência</b>
        <p>
          Faturamento pelo <b>{baseLabel(escala.faturamento)}</b> e pagamento pelo <b>{baseLabel(escala.pagamento)}</b>. Este protótipo mostra
          apenas o planejado; o realizado virá do check-in/check-out ({escala.presenca.map((p) => (p === 'facial' ? 'facial' : 'geolocalização')).join(' + ')}) e o
          apurado da validação do gestor.
        </p>
        <p>
          Pagamento antecipado:{' '}
          <b>{escala.pagAntecipado?.ativo ? `permitido em D+${escala.pagAntecipado.prazoDias}, taxa de ${escala.pagAntecipado.taxa}%` : 'não permitido'}</b>.
          Pagamento diferenciado antecipado:{' '}
          <b>
            {escala.pagDiferenciado?.ativo
              ? `+${escala.pagDiferenciado.tipo === 'percentual' ? escala.pagDiferenciado.valor + '%' : brl(escala.pagDiferenciado.valor)} em D+${escala.pagDiferenciado.prazoDias}`
              : 'não permitido'}
          </b>
          {dif.n > 0 && (
            <>
              {' '}· no período: <b>{dif.n}</b> plantão(ões) com diferenciado, custo extra de <b>{brl(dif.extra)}</b>
            </>
          )}
          .
        </p>
      </div>
    </div>
  )
}
