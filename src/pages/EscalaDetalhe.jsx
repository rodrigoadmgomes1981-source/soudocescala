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
  descDias,
  inicioPlantao,
  logEscala,
  parseISO,
  startOfWeek,
  todayISO,
  toMin,
  uid,
  weekday,
} from '../lib/utils'
import { checarMedico, findSetor, naVigencia, resumoPeriodo, slotsDoDia, statusSlot } from '../lib/escala'
import { ESTADO_PRES, presencaDe } from '../lib/presenca'
import { PresencaPainel } from '../components/Presenca'
import ApuracaoTabela from '../components/Apuracao'
import MedicoAcoesModal from '../components/MedicoAcoes'
import { explicarConflitos } from '../lib/solicitacoes'
import { can, podeDestravar } from '../lib/perms'

const TABS = [
  { key: 'grade', label: 'Grade e médicos', perm: 'grade' },
  { key: 'config', label: 'Configuração', perm: 'config' },
  { key: 'apuracao', label: 'Apuração', perm: 'apurar' },
  { key: 'fin', label: 'Financeiro planejado', perm: 'fin' },
  { key: 'hist', label: 'Log de alterações', perm: 'log' },
]

const STATUS_LABEL = { ofertada: 'Plantão oferecido pelo médico', fixo: 'Fixo', avulso: 'Avulso', anunciada: 'Vaga anunciada', vazia: 'Vaga aberta', furo: 'Furo (plantão sem médico)' }

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
  const { db, update, notify, user, abrirChat } = useStore()
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
  const [apDe, setApDe] = useState(() => todayISO().slice(0, 8) + '01')
  const [apAte, setApAte] = useState(todayISO())

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
  const travada = !!escala.travada
  const ehMedico = user?.perfil === 'medico'
  const pode = {
    grade: true,
    editar: can(user, 'escalas.editar') && !travada,
    alocar: can(user, 'escalas.alocar') && !travada,
    publicar: can(user, 'escalas.publicar') && !travada,
    travar: can(user, 'escalas.travar'),
    destravar: podeDestravar(user),
    config: can(user, 'escalas.editar'),
    fin: can(user, 'financeiro.ver'),
    apurar: can(user, 'apuracao'),
    log: !ehMedico && user?.perfil !== 'visualizador',
    presenca: can(user, 'presenca.ver'),
    chat: can(user, 'chat'),
  }
  if (ehMedico && !escala.alocacoes.some((a) => a.medicoId === user.medicoId))
    return (
      <div className="page">
        <p className="alert warn">Você só pode visualizar escalas em que está inserido.</p>
      </div>
    )
  const tabsVisiveis = TABS.filter((t) => pode[t.perm])
  const tabAtual = tabsVisiveis.some((t) => t.key === tab) ? tab : 'grade'

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

  const alternarTrava = (on) => {
    update((d) => {
      const e = d.escalas.find((x) => x.id === id)
      e.travada = on
      e.travadaPor = on ? user?.nome : null
      e.travadaEm = on ? new Date().toISOString() : null
      logEscala(e, 'regra', on ? 'Escala travada para alterações' : 'Escala destravada')
    })
    setDraft(null)
    notify(on ? 'Escala travada' : 'Escala destravada', on ? 'ok' : 'warn')
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
          {travada && <Badge tone="neutral">Travada</Badge>}
          {pode.publicar && (
            <button className="btn primary" onClick={() => setPublicar(true)}>
              {escala.status === 'publicada' ? 'Atualizar publicação' : 'Publicar escala'}
            </button>
          )}
        </div>
      </header>

      {travada && !ehMedico && (
        <div className="lock-banner">
          <span>
            <b>Escala travada</b> por {escala.travadaPor || '—'}
            {escala.travadaEm ? ` em ${new Date(escala.travadaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}. Nenhuma alteração
            de regras, períodos, médicos ou publicação é permitida.
          </span>
          {pode.destravar && (
            <button className="btn sm" onClick={() => alternarTrava(false)}>
              Destravar
            </button>
          )}
        </div>
      )}

      {escala.pendente && pode.publicar && (
        <div className="alert warn row">
          <span>Há alterações feitas depois da publicação. Os médicos ainda veem a versão v{escala.versao}.</span>
          <button className="btn sm" onClick={() => setPublicar(true)}>
            Republicar como v{escala.versao + 1}
          </button>
        </div>
      )}

      <nav className="tabs">
        {tabsVisiveis.map((t) => (
          <button key={t.key} className={tabAtual === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'hist' && <span className="muted small"> ({escala.historico.length})</span>}
          </button>
        ))}
      </nav>

      {tabAtual === 'grade' && (
        <Grade
          escala={escala}
          valores={valores}
          unidade={unidade}
          dias={dias}
          semana={semana}
          setSemana={setSemana}
          onSlot={setSlotSel}
          meuMedicoId={ehMedico ? user.medicoId : null}
          verValores={pode.fin}
          clicavel={(s) => (ehMedico ? s.medicoId === user.medicoId : pode.alocar || (s.medicoId && pode.presenca))}
        />
      )}

      {tabAtual === 'apuracao' && (
        <div className="card">
          <div className="card-head">
            <h2>Apuração de plantões</h2>
            <div className="inline-fields">
              <Field label="De">
                <input id="ap-de" type="date" value={apDe} onChange={(e) => setApDe(e.target.value)} />
              </Field>
              <Field label="Até">
                <input id="ap-ate" type="date" value={apAte} min={apDe} onChange={(e) => setApAte(e.target.value)} />
              </Field>
            </div>
          </div>
          <ApuracaoTabela escalaIds={[escala.id]} de={apDe} ate={apAte} mostrarEscala={false} />
        </div>
      )}

      {tabAtual === 'config' && (
        <div className="stack">
          <div className={`card lock-card ${travada ? 'on' : ''}`}>
            <div>
              <h2>{travada ? 'Escala travada' : 'Travar escala'}</h2>
              <p className="muted small">
                {travada
                  ? 'Regras, períodos, médicos e publicação estão bloqueados. Somente o administrador pode destravar.'
                  : 'Bloqueia qualquer alteração na escala (regras, períodos, médicos, publicação e solicitações dos médicos).'}
              </p>
            </div>
            {travada ? (
              pode.destravar ? (
                <button className="btn" onClick={() => alternarTrava(false)}>
                  Destravar escala
                </button>
              ) : (
                <span className="muted small">Peça ao administrador para destravar.</span>
              )
            ) : (
              pode.travar && (
                <button className="btn primary" onClick={() => alternarTrava(true)}>
                  Travar escala
                </button>
              )
            )}
          </div>
          <fieldset className="bare stack" disabled={travada}>
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
          </fieldset>
          {mudancas.length > 0 && !travada && (
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

      {tabAtual === 'fin' && <Financeiro escala={escala} valores={valores} />}

      {tabAtual === 'hist' && <LogAlteracoes escala={escala} />}

      {slotSel && ehMedico && <MedicoAcoesModal escala={escala} slot={slotSel} onClose={() => setSlotSel(null)} />}

      {slotSel && !ehMedico && (
        <AlocarModal
          db={db}
          escala={escala}
          slot={slotSel}
          unidade={unidade}
          podeAlocar={pode.alocar}
          podePresenca={pode.presenca}
          verValores={pode.fin}
          onChat={
            pode.chat
              ? (ctx) => {
                  setSlotSel(null)
                  abrirChat(ctx)
                }
              : null
          }
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

function Grade({ escala, valores, unidade, dias, semana, setSemana, onSlot, meuMedicoId, verValores = true, clicavel = () => true }) {
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
          {verValores && (
            <>
              <span>
                Fatura <b>{brl(r.fat)}</b>
              </span>
              <span>
                Paga <b>{brl(r.pag)}</b>
              </span>
            </>
          )}
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
                          const pres = s.medicoId ? presencaDe(escala, s, unidade, nomeMed(s.medicoId)) : null
                          const corP = pres?.cor ? `p-${pres.cor}` : ''
                          const meu = meuMedicoId && s.medicoId === meuMedicoId
                          const ok = clicavel(s)
                          return (
                            <button
                              key={s.key}
                              className={`slot ${st} ${corP} ${meu ? 'meu' : ''}`}
                              disabled={!ok}
                              onClick={() => ok && onSlot(s)}
                              title={`${pres?.estado && pres.estado !== 'futuro' ? ESTADO_PRES[pres.estado].label + ' · ' : ''}${STATUS_LABEL[st]}${verValores ? ` · fatura ${brl(s.fat)} · paga ${brl(s.pag)}` : ''}`}
                            >
                              {s.medicoId ? (
                                <>
                                  <span className="slot-name">{nomeMed(s.medicoId).split(' ').slice(0, 2).join(' ')}</span>
                                  {pres && pres.estado !== 'futuro' ? (
                                    <span className="pres">
                                      <span>E {pres.checkin?.hora || '--:--'}</span>
                                      <span>S {pres.checkout?.hora || (pres.estado === 'andamento' ? '…' : '--:--')}</span>
                                    </span>
                                  ) : (
                                    <span className="slot-tag">
                                      {st === 'ofertada' ? 'Oferecido pelo médico' : st === 'fixo' ? 'Fixo' : 'Avulso'}
                                      {s.diferenciado && <span className="dif">Dif.</span>}
                                    </span>
                                  )}
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
        <span className="legend-group">
          <b>Presença:</b>
          <span>
            <i className="sw p-verde" /> Check-in e check-out
          </span>
          <span>
            <i className="sw p-amarelo" /> Falta um registro
          </span>
          <span>
            <i className="sw p-vermelho" /> Nenhum registro
          </span>
          <span>
            <i className="sw p-azul" /> Em andamento
          </span>
        </span>
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

export function AlocarModal({ db, escala, slot, unidade, podeAlocar = true, podePresenca = true, onChat, onClose, onSave, verValores = true }) {
  const ocupado = !!slot.medicoId
  const [modo, setModo] = useState(ocupado || !podeAlocar ? 'ver' : 'inserir')
  const [aba, setAba] = useState('medico')
  const [medicoId, setMedicoId] = useState('')
  const stInicial = statusSlot(escala, slot)
  const urgente = stInicial === 'anunciada' || stInicial === 'furo'
  const [fixo, setFixo] = useState(urgente ? 'avulso' : 'fixo')
  const [dif, setDif] = useState(urgente && !!escala.pagDiferenciado?.ativo)
  const [q, setQ] = useState('')
  const med = db.medicos.find((m) => m.id === slot.medicoId)
  const { turno, data } = slot

  const diaClicado = weekday(data)
  const [diasFixo, setDiasFixo] = useState([diaClicado])
  const [confirmar, setConfirmar] = useState(false)
  const diasOrdenados = (arr) => [...arr].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  const diasDisponiveis = diasOrdenados(turno.dias)

  // checagem de conflito: avulso só na data; fixo nas próximas 8 ocorrências dos dias escolhidos
  const checagem = useMemo(() => {
    if (!medicoId) return null
    const datas = [data]
    if (fixo === 'fixo') {
      let d = addDays(data, 1)
      let guard = 0
      while (datas.length < 8 && guard++ < 70) {
        if (diasFixo.includes(weekday(d)) && turno.dias.includes(weekday(d)) && naVigencia(escala, d)) datas.push(d)
        d = addDays(d, 1)
      }
    }
    const conflitos = []
    let maxH = 0
    for (const d of datas) {
      const r = checarMedico(db, medicoId, d, turno, d === data ? slot.key : `${turno.id}-${slot.vagaIdx}-${d}`)
      for (const c of r.conflitos) if (!conflitos.some((x) => x.txt === c.txt)) conflitos.push(c)
      maxH = Math.max(maxH, r.horasContinuas)
    }
    const novos = datas.map((d) => {
      const ini = inicioPlantao(d, turno.inicio).getTime()
      return [ini, ini + turno.duracao * 3600e3]
    })
    const exp = explicarConflitos(db, medicoId, conflitos, novos)
    return { conflitos, maxH, datas: datas.length, ...exp }
  }, [medicoId, fixo, diasFixo, data, turno, db, escala, slot])
  const temConflito = !!checagem && checagem.conflitos.length > 0

  const lista = db.medicos.filter((m) => `${m.nome} ${m.especialidade} ${m.crm}`.toLowerCase().includes(q.toLowerCase()))
  const nome = (id) => db.medicos.find((m) => m.id === id)?.nome

  const usaDif = dif && fixo === 'avulso' && !!escala.pagDiferenciado?.ativo
  const pd = escala.pagDiferenciado
  const pagComDif = pd?.ativo ? (pd.tipo === 'percentual' ? slot.pagBase * (1 + pd.valor / 100) : slot.pagBase + pd.valor) : slot.pagBase
  const salvar = () => {
    if (temConflito && !confirmar) {
      setConfirmar(true)
      return
    }
    const mNome = nome(medicoId)
    const confirmTxt = temConflito
      ? ` · conflito de escala confirmado (${checagem.conflitos.map((c) => c.txt).join('; ')})${checagem.porPendencia.length ? ' — pendente de aprovação de passagem/troca' : ''}`
      : ''
    if (fixo === 'fixo') {
      onSave((e) => {
        // fixos anteriores desta vaga nos mesmos dias da semana: encerra a partir de `data`, preservando os demais dias
        const novos = []
        e.alocacoes.forEach((a) => {
          if (!a.fixo || a.turnoId !== turno.id || a.vagaIdx !== slot.vagaIdx || (a.ate && a.ate < data)) return
          const diasA = a.dias || turno.dias
          if (!diasA.some((d) => diasFixo.includes(d))) return
          const restantes = diasA.filter((d) => !diasFixo.includes(d))
          if (a.desde >= data) {
            if (restantes.length) a.dias = restantes
            else a._del = true
          } else {
            const ateOrig = a.ate
            a.ate = addDays(data, -1)
            if (restantes.length) novos.push({ ...a, id: uid('a'), desde: data, ate: ateOrig, dias: restantes })
          }
        })
        e.alocacoes = e.alocacoes.filter((a) => !a._del && !(!a.fixo && a.turnoId === turno.id && a.vagaIdx === slot.vagaIdx && a.data === data))
        e.alocacoes.push(...novos.map(({ _del, ...x }) => x))
        e.alocacoes.push({ id: uid('a'), turnoId: turno.id, vagaIdx: slot.vagaIdx, medicoId, fixo: true, desde: data, dias: diasOrdenados(diasFixo) })
      }, `${mNome} inserido(a) como FIXO em ${descDias(diasFixo)} ${turno.inicio}, a partir de ${fmtDate(data)}${confirmTxt}`)
    } else {
      onSave((e) => {
        e.alocacoes = e.alocacoes.filter((a) => !(!a.fixo && a.turnoId === turno.id && a.vagaIdx === slot.vagaIdx && a.data === data))
        e.alocacoes.push({ id: uid('a'), turnoId: turno.id, vagaIdx: slot.vagaIdx, medicoId, fixo: false, data, ...(usaDif ? { diferenciado: true } : {}) })
      }, `${mNome} inserido(a) como AVULSO em ${fmtDate(data)} ${turno.inicio}${usaDif ? ' com pagamento diferenciado antecipado' : ''}${confirmTxt}`)
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

  const pres = slot.medicoId ? presencaDe(escala, slot, unidade, med?.nome) : null
  const ctxTxt = `${DIAS[weekday(data)]} ${fmtDate(data)} ${turno.inicio}–${fimTurno(turno.inicio, turno.duracao)} · ${escala.nome}`
  const bloqueado = !medicoId || (fixo === 'fixo' && diasFixo.length === 0)
  const fixoSobreposto =
    fixo === 'fixo' &&
    escala.alocacoes.filter(
      (a) =>
        a.fixo &&
        a.medicoId &&
        a.medicoId !== medicoId &&
        a.turnoId === turno.id &&
        a.vagaIdx === slot.vagaIdx &&
        (!a.ate || a.ate >= data) &&
        (a.dias || turno.dias).some((d) => diasFixo.includes(d)),
    )

  return (
    <Modal
      title={`${DIAS[weekday(data)]}, ${fmtDate(data)} · ${turno.inicio}–${fimTurno(turno.inicio, turno.duracao)}`}
      onClose={onClose}
      width={560}
      footer={
        modo === 'ver' ? (
          <>
            {onChat && (slot.medicoId || slot.aloc?.medicoId) && (
              <button className="btn" onClick={() => onChat({ medicoId: slot.medicoId, contexto: { texto: ctxTxt } })}>
                Acionar pelo chat
              </button>
            )}
            {podeAlocar && ocupado && (
              <>
            <button className="btn ghost danger" onClick={liberarData}>
              Retirar só nesta data
            </button>
            {slot.aloc?.fixo && (
              <button className="btn ghost danger" onClick={encerrarFixo}>
                Encerrar fixo a partir daqui
              </button>
            )}
              </>
            )}
            <div className="spacer" />
            {podeAlocar && (
              <button className="btn primary" onClick={() => setModo('inserir')}>
                {ocupado ? 'Substituir médico' : 'Inserir médico'}
              </button>
            )}
          </>
        ) : (
          <>
            <button className="btn ghost" onClick={ocupado ? () => setModo('ver') : onClose}>
              Cancelar
            </button>
            <div className="spacer" />
            {confirmar ? (
              <>
                <button className="btn ghost" onClick={() => setConfirmar(false)}>
                  Não, voltar
                </button>
                <button className="btn primary danger-bg" onClick={salvar}>
                  Sim, prosseguir
                </button>
              </>
            ) : (
              <button className="btn primary" disabled={bloqueado} onClick={salvar}>
                Inserir médico
              </button>
            )}
          </>
        )
      }
    >
      <div className="slot-info" style={verValores ? undefined : { gridTemplateColumns: '1fr 1fr' }}>
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
        {verValores && (
          <>
            <div>
              <span className="muted small">Fatura</span>
              <b>{brl(slot.fat)}</b>
            </div>
            <div>
              <span className="muted small">Paga</span>
              <b>{brl(slot.pag)}</b>
            </div>
          </>
        )}
      </div>

      {modo === 'ver' && !med && (
        <p className="muted">Vaga sem médico{statusSlot(escala, slot) === 'furo' ? ' · o plantão já começou (furo)' : ''}.</p>
      )}

      {modo === 'ver' && med && pres && pres.estado !== 'futuro' && podePresenca && (
        <nav className="tabs" style={{ marginBottom: 14 }}>
          <button className={aba === 'medico' ? 'on' : ''} onClick={() => setAba('medico')}>
            Médico
          </button>
          <button className={aba === 'presenca' ? 'on' : ''} onClick={() => setAba('presenca')}>
            Check-in / check-out
          </button>
        </nav>
      )}

      {modo === 'ver' && med && aba === 'presenca' && <PresencaPainel escala={escala} slot={slot} unidade={unidade} pres={pres} />}

      {modo === 'ver' && med && aba === 'medico' && (
        <div className="med-atual">
          <div className="avatar">{med.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')}</div>
          <div>
            <b>{med.nome}</b>
            <span className="muted small">
              {med.crm} · {med.especialidade}
            </span>
            <span className="small">
              {slot.aloc?.fixo
                ? `Fixo desde ${fmtDate(slot.aloc.desde)}${slot.aloc.ate ? ` até ${fmtDate(slot.aloc.ate)}` : ''} · ${descDias(slot.aloc.dias || turno.dias)}`
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
              <button key={m.id} role="option" aria-selected={medicoId === m.id} className={medicoId === m.id ? 'on' : ''} onClick={() => {
                  setMedicoId(m.id)
                  setConfirmar(false)
                }}>
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
              onChange={(v) => {
                setFixo(v)
                setConfirmar(false)
              }}
              options={[
                { key: 'fixo', label: 'Sim, fixo' },
                { key: 'avulso', label: 'Não, só nesta data' },
              ]}
            />
            {fixo === 'fixo' && (
              <div className="fixo-dias">
                <span className="field-label">Em quais dias da semana ele ficará fixo?</span>
                <div className="days">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const disp = turno.dias.includes(d)
                    const obrig = d === diaClicado
                    return (
                      <button
                        type="button"
                        key={d}
                        disabled={!disp || obrig}
                        aria-pressed={diasFixo.includes(d)}
                        className={diasFixo.includes(d) ? 'on' : ''}
                        title={!disp ? 'Este período não acontece neste dia' : obrig ? 'Dia do plantão selecionado' : ''}
                        onClick={() => {
                          setConfirmar(false)
                          setDiasFixo((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))
                        }}
                      >
                        {DIAS[d]}
                      </button>
                    )
                  })}
                </div>
                <div className="atalhos">
                  <button type="button" className="link small" onClick={() => setDiasFixo(diasDisponiveis)}>
                    Todos os dias do período
                  </button>
                  <button type="button" className="link small" onClick={() => setDiasFixo([...new Set([diaClicado, ...[1, 2, 3, 4, 5].filter((d) => turno.dias.includes(d))])])}>
                    Seg a Sex
                  </button>
                  <button type="button" className="link small" onClick={() => setDiasFixo([...new Set([diaClicado, ...[6, 0].filter((d) => turno.dias.includes(d))])])}>
                    Sáb e Dom
                  </button>
                  <button type="button" className="link small" onClick={() => setDiasFixo([diaClicado])}>
                    Só {DIAS[diaClicado]}
                  </button>
                </div>
              </div>
            )}
            <p className="muted small" style={{ marginTop: 6 }}>
              {fixo === 'fixo'
                ? `Repete toda(o) ${descDias(diasFixo)} às ${turno.inicio}, a partir de ${fmtDate(data)}${escala.vigenciaFim ? ` até ${fmtDate(escala.vigenciaFim)}` : ' (vigência indeterminada)'}.`
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
          {fixoSobreposto && fixoSobreposto.length > 0 && medicoId && (
            <div className="alert warn">
              {fixoSobreposto.map((a) => (
                <div key={a.id}>
                  <b>{nome(a.medicoId)}</b> é fixo nesta vaga em {descDias((a.dias || turno.dias).filter((d) => diasFixo.includes(d)))}. Esses dias passam
                  para o novo médico a partir de {fmtDate(data)}
                  {(a.dias || turno.dias).some((d) => !diasFixo.includes(d))
                    ? `; ${nome(a.medicoId)?.split(' ')[0]} continua fixo em ${descDias((a.dias || turno.dias).filter((d) => !diasFixo.includes(d)))}.`
                    : '.'}
                </div>
              ))}
            </div>
          )}
          {temConflito && (
            <div className="alert danger">
              <b>Conflito de escala</b>: o profissional já está escalado no mesmo horário em:
              <ul>
                {checagem.porPendencia.map((c) => (
                  <li key={c.txt}>
                    {c.txt}
                    <div className="small">
                      O conflito ocorre porque <b>{c.motivo}</b>. Se for aprovada, o conflito deixa de existir.
                    </div>
                  </li>
                ))}
                {checagem.semPendencia.slice(0, 5).map((c) => (
                  <li key={c.txt}>{c.txt}</li>
                ))}
              </ul>
            </div>
          )}
          {checagem && checagem.entrando.length > 0 && (
            <div className="alert warn">
              Atenção: existe pedido pendente que colocaria este profissional no mesmo horário —{' '}
              {checagem.entrando.map((x) => x.motivo).join('; ')}. Se for aprovado, haverá conflito.
            </div>
          )}
          {confirmar && (
            <div className="confirm-box" role="alertdialog" aria-label="Confirmar conflito">
              <b>Profissional com conflito de escala. Deseja prosseguir?</b>
              <span className="small">
                {checagem.porPendencia.length && !checagem.semPendencia.length
                  ? 'O conflito depende de passagem/troca ainda não aprovada. Ao prosseguir, a alocação fica registrada no log com o conflito.'
                  : 'Ao prosseguir, o profissional ficará em dois locais no mesmo horário. A decisão fica registrada no log.'}
              </span>
            </div>
          )}
          {checagem && !temConflito && checagem.maxH > 24 && (
            <div className="alert warn">
              Atenção: com esta alocação o médico fica <b>{checagem.maxH}h seguidas</b> em plantão (limite de referência: 24h).
            </div>
          )}
          {checagem && !temConflito && checagem.entrando.length === 0 && checagem.maxH <= 24 && (
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
