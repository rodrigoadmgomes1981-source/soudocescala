import { Field, Segmented, MultiToggle, Toggle } from './ui'
import { useState } from 'react'
import { BASES, DIAS, DIAS_ORDEM, brl, descDias, fimTurno, isDiurno, uid, valorTurno } from '../lib/utils'

const APROVACAO = [
  { key: 'automatica', label: 'Automática' },
  { key: 'aprovacao', label: 'Depende de aprovação' },
]

export function RegrasForm({ e, set }) {
  return (
    <div className="stack">
      <Field label="Nome da escala">
        <input value={e.nome} onChange={(ev) => set((x) => (x.nome = ev.target.value))} placeholder="Ex.: PA Central · Clínica Médica" />
      </Field>

      <div className="rule">
        <div className="rule-text">
          <strong>Controle de presença</strong>
          <span>Como o médico registra check-in e check-out. Pode combinar os dois.</span>
        </div>
        <div className="rule-ctrl">
          <MultiToggle
            options={[
              { key: 'facial', label: 'Reconhecimento facial' },
              { key: 'geo', label: 'Geolocalização' },
            ]}
            value={e.presenca}
            onChange={(v) => set((x) => (x.presenca = v))}
          />
          <div className="inline-fields">
            {e.presenca.includes('geo') && (
              <Field label="Raio (m)">
                <input type="number" min="50" step="50" value={e.raioGeo} onChange={(ev) => set((x) => (x.raioGeo = Number(ev.target.value)))} />
              </Field>
            )}
            <Field label="Tolerância de atraso (min)">
              <input type="number" min="0" value={e.toleranciaMin} onChange={(ev) => set((x) => (x.toleranciaMin = Number(ev.target.value)))} />
            </Field>
          </div>
        </div>
      </div>

      <div className="rule">
        <div className="rule-text">
          <strong>Base de faturamento</strong>
          <span>{BASES.find((b) => b.key === e.faturamento)?.hint}</span>
        </div>
        <div className="rule-ctrl">
          <Segmented options={BASES} value={e.faturamento} onChange={(v) => set((x) => (x.faturamento = v))} name="Faturamento" />
        </div>
      </div>

      <div className="rule">
        <div className="rule-text">
          <strong>Base de pagamento</strong>
          <span>{BASES.find((b) => b.key === e.pagamento)?.hint}</span>
        </div>
        <div className="rule-ctrl">
          <Segmented options={BASES} value={e.pagamento} onChange={(v) => set((x) => (x.pagamento = v))} name="Pagamento" />
        </div>
      </div>

      <div className="rule">
        <div className="rule-text">
          <strong>Passagem de plantão</strong>
          <span>Médico cede o plantão para outro médico habilitado no setor.</span>
        </div>
        <div className="rule-ctrl">
          <Segmented options={APROVACAO} value={e.passagem} onChange={(v) => set((x) => (x.passagem = v))} name="Passagem" />
        </div>
      </div>

      <div className="rule">
        <div className="rule-text">
          <strong>Troca de plantão</strong>
          <span>Dois médicos permutam plantões entre si.</span>
        </div>
        <div className="rule-ctrl">
          <Segmented options={APROVACAO} value={e.troca} onChange={(v) => set((x) => (x.troca = v))} name="Troca" />
          <div className="inline-fields">
            <Field label="Antecedência mínima (h)">
              <input type="number" min="0" value={e.antecedenciaHoras} onChange={(ev) => set((x) => (x.antecedenciaHoras = Number(ev.target.value)))} />
            </Field>
          </div>
        </div>
      </div>

      <div className="rule">
        <div className="rule-text">
          <strong>Anunciar vaga automaticamente</strong>
          <span>Vaga sem médico é publicada no mural de vagas quando faltar o prazo definido.</span>
        </div>
        <div className="rule-ctrl">
          <Toggle checked={e.anunciarVaga} onChange={(v) => set((x) => (x.anunciarVaga = v))} label={e.anunciarVaga ? 'Ativado' : 'Desativado'} />
          {e.anunciarVaga && (
            <div className="inline-fields">
              <Field label="Anunciar com (h) de antecedência">
                <input type="number" min="1" value={e.anuncioHorasAntes} onChange={(ev) => set((x) => (x.anuncioHorasAntes = Number(ev.target.value)))} />
              </Field>
            </div>
          )}
        </div>
      </div>

      <div className="rule">
        <div className="rule-text">
          <strong>Pagamento antecipado</strong>
          <span>Médico pode receber antes do ciclo normal de pagamento, com taxa de antecipação opcional.</span>
        </div>
        <div className="rule-ctrl">
          <Toggle
            checked={!!e.pagAntecipado?.ativo}
            onChange={(v) => set((x) => (x.pagAntecipado = { prazoDias: 5, taxa: 0, ...x.pagAntecipado, ativo: v }))}
            label={e.pagAntecipado?.ativo ? 'Permitido' : 'Não permitido'}
          />
          {e.pagAntecipado?.ativo && (
            <div className="inline-fields">
              <Field label="Prazo (dias após o plantão)" hint={`Paga em D+${e.pagAntecipado.prazoDias}`}>
                <input type="number" min="0" value={e.pagAntecipado.prazoDias} onChange={(ev) => set((x) => (x.pagAntecipado.prazoDias = Number(ev.target.value)))} />
              </Field>
              <Field label="Taxa de antecipação (%)" hint="0 = sem desconto">
                <input type="number" min="0" step="0.1" value={e.pagAntecipado.taxa} onChange={(ev) => set((x) => (x.pagAntecipado.taxa = Number(ev.target.value)))} />
              </Field>
            </div>
          )}
        </div>
      </div>

      <div className="rule">
        <div className="rule-text">
          <strong>Pagamento diferenciado antecipado</strong>
          <span>Valor acima da tabela, pago antecipadamente, para cobrir vagas anunciadas ou furos. Aplicado plantão a plantão na alocação.</span>
        </div>
        <div className="rule-ctrl">
          <Toggle
            checked={!!e.pagDiferenciado?.ativo}
            onChange={(v) => set((x) => (x.pagDiferenciado = { tipo: 'percentual', valor: 20, prazoDias: 2, ...x.pagDiferenciado, ativo: v }))}
            label={e.pagDiferenciado?.ativo ? 'Permitido' : 'Não permitido'}
          />
          {e.pagDiferenciado?.ativo && (
            <>
              <Segmented
                name="Tipo de acréscimo"
                value={e.pagDiferenciado.tipo}
                onChange={(v) => set((x) => (x.pagDiferenciado.tipo = v))}
                options={[
                  { key: 'percentual', label: '% sobre o valor' },
                  { key: 'valor', label: 'R$ por plantão' },
                ]}
              />
              <div className="inline-fields">
                <Field label={e.pagDiferenciado.tipo === 'percentual' ? 'Acréscimo (%)' : 'Acréscimo (R$)'}>
                  <input type="number" min="0" value={e.pagDiferenciado.valor} onChange={(ev) => set((x) => (x.pagDiferenciado.valor = Number(ev.target.value)))} />
                </Field>
                <Field label="Prazo (dias após o plantão)" hint={`Paga em D+${e.pagDiferenciado.prazoDias}`}>
                  <input type="number" min="0" value={e.pagDiferenciado.prazoDias} onChange={(ev) => set((x) => (x.pagDiferenciado.prazoDias = Number(ev.target.value)))} />
                </Field>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const PRESETS = [
  {
    label: 'Diurno + noturno 12h · todos os dias',
    turnos: [
      { inicio: '07:00', duracao: 12, vagas: 1, dias: [0, 1, 2, 3, 4, 5, 6] },
      { inicio: '19:00', duracao: 12, vagas: 1, dias: [0, 1, 2, 3, 4, 5, 6] },
    ],
  },
  { label: '24h · todos os dias', turnos: [{ inicio: '07:00', duracao: 24, vagas: 1, dias: [0, 1, 2, 3, 4, 5, 6] }] },
  {
    label: 'Manhã + tarde 6h · seg a sex',
    turnos: [
      { inicio: '07:00', duracao: 6, vagas: 1, dias: [1, 2, 3, 4, 5] },
      { inicio: '13:00', duracao: 6, vagas: 1, dias: [1, 2, 3, 4, 5] },
    ],
  },
]

const TIPOS_TURNO = [
  { key: 'diurno', label: 'Diurno 07–19', inicio: '07:00', duracao: 12 },
  { key: 'noturno', label: 'Noturno 19–07', inicio: '19:00', duracao: 12 },
  { key: '24h', label: '24h', inicio: '07:00', duracao: 24 },
  { key: 'custom', label: 'Personalizado' },
]
const tipoDoTurno = (t) => TIPOS_TURNO.find((x) => x.inicio === t.inicio && x.duracao === t.duracao)?.key || 'custom'

const ATALHOS_DIAS = [
  { label: 'Todos', dias: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Seg a Sex', dias: [1, 2, 3, 4, 5] },
  { label: 'Sáb e Dom', dias: [6, 0] },
]

// eslint-disable-next-line react-refresh/only-export-components
export const descTurno = (t) =>
  `${descDias(t.dias)} · ${t.inicio}–${fimTurno(t.inicio, t.duracao)} (${t.duracao}h) · ${t.vagas} ${t.vagas > 1 ? 'médicos' : 'médico'}`

/**
 * Editor de períodos: cada período tem modo resumo (com "Alterar") e modo edição (com "Salvar período").
 * onSave(turno, anterior|null) é chamado a cada período salvo; onRemove(turno).
 */
export function TurnosEditor({ turnos, valores, onSave, onRemove, podeRemover = () => true }) {
  const [editando, setEditando] = useState({})
  const [rascunho, setRascunho] = useState(null) // período novo ainda não salvo

  const abrirNovo = (base = {}) =>
    setRascunho({ id: uid('t'), inicio: '07:00', duracao: 12, vagas: 1, dias: [1, 2, 3, 4, 5], ...base })

  const presetsVisiveis = turnos.length === 0 && !rascunho

  return (
    <div className="stack">
      {presetsVisiveis && (
        <div className="presets">
          <span className="muted">Comece por um modelo:</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn sm" onClick={() => p.turnos.forEach((t) => onSave({ id: uid('t'), ...t }, null))}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {turnos.map((t, i) =>
        editando?.[t.id] ? (
          <TurnoForm
            key={t.id}
            titulo={`Alterar período ${i + 1}`}
            inicial={t}
            outros={turnos.filter((x) => x.id !== t.id)}
            valores={valores}
            onCancel={() => setEditando((e) => ({ ...e, [t.id]: false }))}
            onSave={(novo) => {
              onSave(novo, t)
              setEditando((e) => ({ ...e, [t.id]: false }))
            }}
          />
        ) : (
          <TurnoResumo
            key={t.id}
            n={i + 1}
            t={t}
            valores={valores}
            onEdit={() => setEditando((e) => ({ ...e, [t.id]: true }))}
            onRemove={() => onRemove(t)}
            podeRemover={podeRemover(t)}
          />
        ),
      )}

      {rascunho && (
        <TurnoForm
          titulo={`Novo período`}
          inicial={rascunho}
          outros={turnos}
          valores={valores}
          onCancel={() => setRascunho(null)}
          onSave={(novo) => {
            onSave(novo, null)
            setRascunho(null)
          }}
        />
      )}

      {!rascunho && (
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => abrirNovo({ inicio: '07:00', duracao: 12 })}>
            + Período diurno
          </button>
          <button type="button" className="btn" onClick={() => abrirNovo({ inicio: '19:00', duracao: 12 })}>
            + Período noturno
          </button>
          <button type="button" className="btn ghost" onClick={() => abrirNovo({ inicio: '07:00', duracao: 6 })}>
            + Outro horário
          </button>
        </div>
      )}
    </div>
  )
}

function TurnoResumo({ n, t, valores, onEdit, onRemove, podeRemover }) {
  const util = valorTurno(valores, t.inicio, t.duracao, '2026-10-07')
  const fds = valorTurno(valores, t.inicio, t.duracao, '2026-10-10')
  return (
    <div className="turno resumo" data-testid="turno-resumo">
      <div className="turno-top">
        <strong>Período {n}</strong>
        <span className={`badge ${isDiurno(t.inicio) ? 'sun' : 'moon'}`}>{isDiurno(t.inicio) ? 'Diurno' : 'Noturno'}</span>
        <span className="badge ok">Salvo</span>
        <div className="spacer" />
        <button type="button" className="btn sm" onClick={onEdit}>
          Alterar
        </button>
        <button type="button" className="btn sm ghost danger" disabled={!podeRemover} title={podeRemover ? '' : 'Há médicos alocados neste período'} onClick={onRemove}>
          Remover
        </button>
      </div>
      <div className="resumo-linha">
        <span>
          <b>{descDias(t.dias)}</b>
        </span>
        <span>
          {t.inicio} – {fimTurno(t.inicio, t.duracao)} · {t.duracao}h
        </span>
        <span>
          {t.vagas} {t.vagas > 1 ? 'médicos' : 'médico'}
        </span>
        <span className="muted">
          Dia útil {brl(util.fat)} / {brl(util.pag)} · FDS {brl(fds.fat)} / {brl(fds.pag)}
        </span>
      </div>
    </div>
  )
}

/** Períodos que se sobrepõem no mesmo dia da semana (considera virada da meia-noite) */
const sobreposicoes = (t, outros) => {
  const iv = (x, d) => {
    const ini = d * 1440 + Number(x.inicio.slice(0, 2)) * 60 + Number(x.inicio.slice(3, 5))
    return [ini, ini + x.duracao * 60]
  }
  const W = 7 * 1440
  const hits = []
  for (const o of outros) {
    let bate = false
    for (const d of t.dias)
      for (const e of o.dias) {
        const [a0, a1] = iv(t, d)
        for (const sh of [-W, 0, W]) {
          const [b0, b1] = iv(o, e).map((v) => v + sh)
          if (a0 < b1 && b0 < a1) bate = true
        }
      }
    if (bate) hits.push(o)
  }
  return hits
}

function TurnoForm({ titulo, inicial, valores, onSave, onCancel, outros = [] }) {
  const [t, setT] = useState(inicial)
  const tipo = tipoDoTurno(t)
  const util = valorTurno(valores, t.inicio, t.duracao, '2026-10-07')
  const fds = valorTurno(valores, t.inicio, t.duracao, '2026-10-10')
  const set = (patch) => setT((x) => ({ ...x, ...patch }))
  const valido = t.dias.length > 0 && t.duracao >= 1 && t.vagas >= 1
  return (
    <div className="turno editando">
      <div className="turno-top">
        <strong>{titulo}</strong>
        <span className={`badge ${isDiurno(t.inicio) ? 'sun' : 'moon'}`}>{isDiurno(t.inicio) ? 'Diurno' : 'Noturno'}</span>
      </div>

      <Field label="Tipo de período">
        <Segmented
          name="Tipo de período"
          value={tipo}
          onChange={(k) => {
            const p = TIPOS_TURNO.find((x) => x.key === k)
            if (p.inicio) set({ inicio: p.inicio, duracao: p.duracao })
            else set({ inicio: '08:00', duracao: 6 })
          }}
          options={TIPOS_TURNO}
        />
      </Field>

      <div className="turno-grid">
        <Field label="Dias da semana">
          <div className="days">
            {DIAS_ORDEM.map((d) => (
              <button
                type="button"
                key={d}
                aria-pressed={t.dias.includes(d)}
                className={t.dias.includes(d) ? 'on' : ''}
                onClick={() => set({ dias: t.dias.includes(d) ? t.dias.filter((z) => z !== d) : [...t.dias, d] })}
              >
                {DIAS[d]}
              </button>
            ))}
          </div>
          <div className="atalhos">
            {ATALHOS_DIAS.map((a) => (
              <button type="button" key={a.label} className="link small" onClick={() => set({ dias: a.dias })}>
                {a.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Início">
          <input type="time" value={t.inicio} onChange={(ev) => set({ inicio: ev.target.value || '00:00' })} />
        </Field>
        <Field label="Duração (h)" hint={`Término: ${fimTurno(t.inicio, t.duracao)}`}>
          <input type="number" min="1" max="24" value={t.duracao} onChange={(ev) => set({ duracao: Math.min(24, Math.max(1, Number(ev.target.value))) })} />
        </Field>
        <Field label="Médicos por período">
          <input type="number" min="1" max="10" value={t.vagas} onChange={(ev) => set({ vagas: Math.min(10, Math.max(1, Number(ev.target.value))) })} />
        </Field>
      </div>

      <div className="turno-valores">
        <div>
          <span className="muted">Dia útil · por médico</span>
          <span>
            Fatura <b>{brl(util.fat)}</b> · Paga <b>{brl(util.pag)}</b>
          </span>
        </div>
        <div>
          <span className="muted">Fim de semana/feriado · por médico</span>
          <span>
            Fatura <b>{brl(fds.fat)}</b> · Paga <b>{brl(fds.pag)}</b>
          </span>
        </div>
        <small className="muted">Valores puxados do cadastro do CR (valor/hora × duração).</small>
      </div>

      {sobreposicoes(t, outros).length > 0 && (
        <p className="alert warn">
          Este período se sobrepõe a: {sobreposicoes(t, outros).map((o) => `${descDias(o.dias)} ${o.inicio}–${fimTurno(o.inicio, o.duracao)}`).join('; ')}. Confira se é
          intencional (ex.: reforço de equipe).
        </p>
      )}

      <div className="turno-foot">
        {!valido && <span className="warn-text small">Selecione ao menos um dia da semana.</span>}
        <div className="spacer" />
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn primary" disabled={!valido} onClick={() => onSave(t)}>
          Salvar período
        </button>
      </div>
    </div>
  )
}
