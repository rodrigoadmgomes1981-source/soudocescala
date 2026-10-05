import { useState } from 'react'
import { useStore } from '../lib/store'
import { Field, Badge } from '../components/ui'
import { RegrasForm, TurnosEditor } from '../components/EscalaForms'
import { TIPOS_VALOR, brl, fmtDate, todayISO, uid } from '../lib/utils'
import { findSetor } from '../lib/escala'

const PASSOS = ['Local', 'Regras', 'Dias e períodos', 'Vigência']

const nova = () => ({
  id: uid('e'),
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
  vigenciaInicio: todayISO(),
  vigenciaFim: '',
  publicadaAte: '',
  status: 'rascunho',
  versao: 1,
  historico: [],
  turnos: [],
  alocacoes: [],
})

export default function NovaEscala({ go }) {
  const { db, update, notify } = useStore()
  const [e, setE] = useState(nova)
  const [passo, setPasso] = useState(0)
  const set = (fn) =>
    setE((prev) => {
      const n = structuredClone(prev)
      fn(n)
      return n
    })

  const { cr, unidade, setor } = findSetor(db, e.crId, e.unidadeId, e.setorId)

  const valido = [
    !!setor,
    e.nome.trim() && e.presenca.length > 0,
    e.turnos.length > 0 && e.turnos.every((t) => t.dias.length > 0),
    !!e.vigenciaInicio && (!e.vigenciaFim || e.vigenciaFim >= e.vigenciaInicio),
  ]

  const avancar = () => {
    if (passo === 0 && !e.nome && unidade && setor) set((x) => (x.nome = `${unidade.nome} · ${setor.nome}`))
    setPasso(passo + 1)
  }

  const criar = () => {
    const final = { ...e, historico: [{ em: new Date().toISOString(), acao: 'Escala criada' }] }
    update((d) => d.escalas.push(final))
    notify('Escala criada como rascunho — agora insira os médicos e publique')
    go({ page: 'escala', id: final.id })
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <button className="link" onClick={() => go({ page: 'escalas' })}>
            ← Escalas
          </button>
          <h1>Nova escala</h1>
        </div>
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
                <select value={e.crId} onChange={(ev) => set((x) => { x.crId = ev.target.value; x.unidadeId = ''; x.setorId = '' })}>
                  <option value="">Selecione…</option>
                  {db.contratos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} — {c.cliente}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="2. Unidade">
                <select disabled={!cr} value={e.unidadeId} onChange={(ev) => set((x) => { x.unidadeId = ev.target.value; x.setorId = '' })}>
                  <option value="">Selecione…</option>
                  {cr?.unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="3. Setor">
                <select disabled={!unidade} value={e.setorId} onChange={(ev) => set((x) => (x.setorId = ev.target.value))}>
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

        {passo === 2 && <TurnosEditor e={e} set={set} valores={setor?.valores} />}

        {passo === 3 && (
          <div className="stack">
            <div className="grid-form">
              <Field label="Início da vigência" hint={cr?.vigenciaInicio ? `Contrato a partir de ${fmtDate(cr.vigenciaInicio)}` : ''}>
                <input type="date" value={e.vigenciaInicio} onChange={(ev) => set((x) => (x.vigenciaInicio = ev.target.value))} />
              </Field>
              <Field label="Fim da vigência (opcional)" hint="Em branco = indeterminada">
                <input type="date" value={e.vigenciaFim} min={e.vigenciaInicio} onChange={(ev) => set((x) => (x.vigenciaFim = ev.target.value))} />
              </Field>
            </div>
            {cr?.vigenciaInicio && e.vigenciaInicio < cr.vigenciaInicio && (
              <p className="alert warn">A escala começa antes da vigência do contrato.</p>
            )}
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
                  {e.passagem === 'automatica' ? 'Automática' : 'Com aprovação'} /{' '}
                  {e.troca === 'automatica' ? 'Automática' : 'Com aprovação'}
                </dd>
                <dt>Anúncio de vaga</dt>
                <dd>{e.anunciarVaga ? `Sim, ${e.anuncioHorasAntes}h antes` : 'Não'}</dd>
                <dt>Períodos</dt>
                <dd>
                  {e.turnos.length} período(s), {e.turnos.reduce((n, t) => n + t.vagas * t.dias.length, 0)} vagas/semana
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
          {passo < PASSOS.length - 1 ? (
            <button className="btn primary" disabled={!valido[passo]} onClick={avancar}>
              Continuar
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
