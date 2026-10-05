import { useState } from 'react'
import { useStore } from '../lib/store'
import { Field, Badge } from '../components/ui'
import { RegrasForm, TurnosEditor, descTurno } from '../components/EscalaForms'
import { TIPOS_VALOR, brl, fmtDate, logEscala, todayISO, uid } from '../lib/utils'
import { findSetor } from '../lib/escala'

const PASSOS = ['Local', 'Regras', 'Dias e períodos', 'Vigência']

const nova = () => ({
  id: uid('e'),
  incompleta: true,
  passo: 0,
  crId: '',
  unidadeId: '',
  setorId: '',
  nome: '',
  presenca: ['facial'],
  raioGeo: 200,
  toleranciaMin: 15,
  faturamento: 'planejado',
  pagamento: 'realizado',
  passagem: 'aprovacao',
  troca: 'aprovacao',
  antecedenciaHoras: 24,
  anunciarVaga: true,
  anuncioHorasAntes: 72,
  pagAntecipado: { ativo: false, prazoDias: 5, taxa: 0 },
  pagDiferenciado: { ativo: false, tipo: 'percentual', valor: 20, prazoDias: 2 },
  vigenciaInicio: todayISO(),
  vigenciaFim: '',
  publicadaAte: '',
  status: 'rascunho',
  versao: 1,
  historico: [],
  turnos: [],
  alocacoes: [],
})

export default function NovaEscala({ id, go }) {
  const { db, update, notify, user } = useStore()
  const existente = id && db.escalas.find((x) => x.id === id && x.incompleta)
  const [e, setE] = useState(() => (existente ? structuredClone(existente) : nova()))
  const [passo, setPasso] = useState(existente?.passo || 0)
  const [salvoEm, setSalvoEm] = useState(existente ? 'retomado' : null)

  const set = (fn) =>
    setE((prev) => {
      const n = structuredClone(prev)
      fn(n)
      return n
    })

  /** Grava o rascunho da escala no banco (cria ou atualiza) */
  const persistir = (escala, passoAtual, log) => {
    const copia = structuredClone({ ...escala, passo: passoAtual })
    if (log) logEscala(copia, log.tipo, log.acao, log.detalhes)
    update((d) => {
      const i = d.escalas.findIndex((x) => x.id === copia.id)
      if (i >= 0) d.escalas[i] = copia
      else d.escalas.push(copia)
    })
    setE(copia)
    setSalvoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
  }

  const { cr, unidade, setor } = findSetor(db, e.crId, e.unidadeId, e.setorId)

  const pendencias = [
    !setor ? 'Selecione contrato, unidade e setor.' : '',
    !e.nome.trim() ? 'Informe o nome da escala.' : e.presenca.length === 0 ? 'Escolha ao menos uma forma de controle de presença.' : '',
    e.turnos.length === 0 ? 'Salve ao menos um período.' : '',
    !e.vigenciaInicio ? 'Informe o início da vigência.' : e.vigenciaFim && e.vigenciaFim < e.vigenciaInicio ? 'O fim da vigência é anterior ao início.' : '',
  ]
  const valido = pendencias.map((p) => !p)

  const avancar = () => {
    let next = e
    if (passo === 0 && !e.nome && unidade && setor) next = { ...e, nome: `${unidade.nome} · ${setor.nome}` }
    const primeiraVez = !db.escalas.some((x) => x.id === e.id)
    persistir(next, passo + 1, primeiraVez ? { tipo: 'regra', acao: 'Escala iniciada (rascunho em criação)' } : null)
    setPasso(passo + 1)
  }

  const salvarPeriodo = (t, anterior) => {
    const next = structuredClone(e)
    const i = next.turnos.findIndex((x) => x.id === t.id)
    if (i >= 0) next.turnos[i] = t
    else next.turnos.push(t)
    persistir(next, passo, {
      tipo: 'periodo',
      acao: anterior ? 'Período alterado' : `Período adicionado: ${descTurno(t)}`,
      detalhes: anterior ? [{ campo: 'Período', de: descTurno(anterior), para: descTurno(t) }] : null,
    })
    notify(anterior ? 'Período alterado e salvo' : 'Período salvo')
  }

  const removerPeriodo = (t) => {
    const next = structuredClone(e)
    next.turnos = next.turnos.filter((x) => x.id !== t.id)
    persistir(next, passo, { tipo: 'periodo', acao: `Período removido: ${descTurno(t)}` })
  }

  const criar = () => {
    const final = structuredClone({ ...e, incompleta: false, passo: undefined })
    logEscala(final, 'regra', 'Escala criada como rascunho')
    update((d) => {
      const i = d.escalas.findIndex((x) => x.id === final.id)
      if (i >= 0) d.escalas[i] = final
      else d.escalas.push(final)
    })
    notify('Escala criada como rascunho. Agora insira os médicos e publique.')
    go({ page: 'escala', id: final.id })
  }

  const descartar = () => {
    update((d) => {
      d.escalas = d.escalas.filter((x) => x.id !== e.id)
    })
    notify('Rascunho descartado', 'warn')
    go({ page: 'escalas' })
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <button className="link" onClick={() => go({ page: 'escalas' })}>
            ← Escalas
          </button>
          <h1>{existente ? 'Continuar escala' : 'Nova escala'}</h1>
          <p className="muted small">
            Criada por {user?.nome}.{' '}
            {salvoEm && <span className="autosave">{salvoEm === 'retomado' ? 'Rascunho retomado.' : `Rascunho salvo às ${salvoEm}.`}</span>}
          </p>
        </div>
        {db.escalas.some((x) => x.id === e.id) && (
          <button className="btn ghost danger" onClick={descartar}>
            Descartar rascunho
          </button>
        )}
      </header>

      <ol className="stepper">
        {PASSOS.map((p, i) => (
          <li key={p} className={i === passo ? 'on' : i < passo ? 'done' : ''}>
            <button disabled={i > passo && !valido.slice(0, i).every(Boolean)} onClick={() => setPasso(i)}>
              <span className="step-n">{i < passo ? '✓' : i + 1}</span>
              {p}
            </button>
          </li>
        ))}
      </ol>

      <div className="card wizard">
        {passo === 0 && (
          <div className="stack">
            <p className="muted">Escolha o CR, depois a unidade e o setor. Os valores vêm do cadastro do contrato.</p>
            <div className="grid-form">
              <Field label="1. Contrato (CR)">
                <select id="sel-cr" value={e.crId} onChange={(ev) => set((x) => { x.crId = ev.target.value; x.unidadeId = ''; x.setorId = '' })}>
                  <option value="">Selecione…</option>
                  {db.contratos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} — {c.cliente}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="2. Unidade">
                <select id="sel-unidade" disabled={!cr} value={e.unidadeId} onChange={(ev) => set((x) => { x.unidadeId = ev.target.value; x.setorId = '' })}>
                  <option value="">Selecione…</option>
                  {cr?.unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="3. Setor">
                <select id="sel-setor" disabled={!unidade} value={e.setorId} onChange={(ev) => set((x) => (x.setorId = ev.target.value))}>
                  <option value="">Selecione…</option>
                  {unidade?.setores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {setor && (
              <div className="preview-valores">
                <strong>Valores por hora cadastrados para {setor.nome}</strong>
                <div className="chips">
                  {TIPOS_VALOR.map((t) => (
                    <div key={t.key} className="chip-val">
                      <span>{t.label}</span>
                      <b>{brl(setor.valores[t.key].fat)}</b> fatura · <b>{brl(setor.valores[t.key].pag)}</b> paga
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {passo === 1 && <RegrasForm e={e} set={set} />}

        {passo === 2 && (
          <div className="stack">
            <p className="muted">Cada período é salvo assim que você clica em “Salvar período”. Use “Alterar” para mudar um período já salvo.</p>
            <TurnosEditor turnos={e.turnos} valores={setor?.valores} onSave={salvarPeriodo} onRemove={removerPeriodo} />
          </div>
        )}

        {passo === 3 && (
          <div className="stack">
            <div className="grid-form">
              <Field label="Início da vigência" hint={cr?.vigenciaInicio ? `Contrato a partir de ${fmtDate(cr.vigenciaInicio)}` : ''}>
                <input id="vig-ini" type="date" value={e.vigenciaInicio} onChange={(ev) => set((x) => (x.vigenciaInicio = ev.target.value))} />
              </Field>
              <Field label="Fim da vigência (opcional)" hint="Em branco = indeterminada">
                <input id="vig-fim" type="date" value={e.vigenciaFim} min={e.vigenciaInicio} onChange={(ev) => set((x) => (x.vigenciaFim = ev.target.value))} />
              </Field>
            </div>
            {cr?.vigenciaInicio && e.vigenciaInicio < cr.vigenciaInicio && <p className="alert warn">A escala começa antes da vigência do contrato.</p>}
            <div className="resumo-final">
              <h3>Resumo</h3>
              <dl>
                <dt>Local</dt>
                <dd>
                  {cr?.codigo} · {unidade?.nome} · {setor?.nome}
                </dd>
                <dt>Nome</dt>
                <dd>{e.nome}</dd>
                <dt>Presença</dt>
                <dd>{e.presenca.map((p) => (p === 'facial' ? 'Facial' : 'Geolocalização')).join(' + ')}</dd>
                <dt>Faturamento / pagamento</dt>
                <dd>
                  <Badge>{e.faturamento}</Badge> / <Badge>{e.pagamento}</Badge>
                </dd>
                <dt>Passagem / troca</dt>
                <dd>
                  {e.passagem === 'automatica' ? 'Automática' : 'Com aprovação'} / {e.troca === 'automatica' ? 'Automática' : 'Com aprovação'}
                </dd>
                <dt>Anúncio de vaga</dt>
                <dd>{e.anunciarVaga ? `Sim, ${e.anuncioHorasAntes}h antes` : 'Não'}</dd>
                <dt>Pagamento antecipado</dt>
                <dd>{e.pagAntecipado?.ativo ? `Sim, D+${e.pagAntecipado.prazoDias}, taxa ${e.pagAntecipado.taxa}%` : 'Não'}</dd>
                <dt>Pag. diferenciado antecipado</dt>
                <dd>
                  {e.pagDiferenciado?.ativo
                    ? `Sim, +${e.pagDiferenciado.tipo === 'percentual' ? e.pagDiferenciado.valor + '%' : brl(e.pagDiferenciado.valor)} em D+${e.pagDiferenciado.prazoDias}`
                    : 'Não'}
                </dd>
                <dt>Períodos</dt>
                <dd>
                  {e.turnos.map((t) => (
                    <div key={t.id}>{descTurno(t)}</div>
                  ))}
                </dd>
              </dl>
              <p className="muted small">
                A escala será criada como <b>rascunho</b>. Na próxima tela você insere os médicos e publica.
              </p>
            </div>
          </div>
        )}

        <div className="wizard-foot">
          <button className="btn ghost" disabled={passo === 0} onClick={() => setPasso(passo - 1)}>
            Voltar
          </button>
          <div className="spacer" />
          {!valido[passo] && <span className="wizard-msg">{pendencias[passo]}</span>}
          {passo < PASSOS.length - 1 ? (
            <button className="btn primary" disabled={!valido[passo]} onClick={avancar}>
              Salvar e continuar
            </button>
          ) : (
            <button className="btn primary" disabled={!valido.every(Boolean)} onClick={criar}>
              Criar escala
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
