import { Field, Segmented, MultiToggle, Toggle, Badge } from './ui'
import { BASES, DIAS, DIAS_ORDEM, brl, fimTurno, isDiurno, uid, valorTurno } from '../lib/utils'

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
    </div>
  )
}

const PRESETS = [
  {
    label: '12h diurno + 12h noturno · todos os dias',
    turnos: [
      { inicio: '07:00', duracao: 12, vagas: 1, dias: [0, 1, 2, 3, 4, 5, 6] },
      { inicio: '19:00', duracao: 12, vagas: 1, dias: [0, 1, 2, 3, 4, 5, 6] },
    ],
  },
  { label: '24h · todos os dias', turnos: [{ inicio: '07:00', duracao: 24, vagas: 1, dias: [0, 1, 2, 3, 4, 5, 6] }] },
  {
    label: '6h manhã/tarde · seg a sex',
    turnos: [
      { inicio: '07:00', duracao: 6, vagas: 1, dias: [1, 2, 3, 4, 5] },
      { inicio: '13:00', duracao: 6, vagas: 1, dias: [1, 2, 3, 4, 5] },
    ],
  },
]

export function TurnosEditor({ e, set, valores, travado }) {
  const add = (t) => set((x) => x.turnos.push({ id: uid('t'), inicio: '07:00', duracao: 12, vagas: 1, dias: [1, 2, 3, 4, 5], ...t }))
  return (
    <div className="stack">
      {e.turnos.length === 0 && (
        <div className="presets">
          <span className="muted">Comece por um modelo:</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn sm" onClick={() => p.turnos.forEach((t) => add(t))}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {e.turnos.map((t, i) => {
        const setT = (fn) => set((x) => fn(x.turnos.find((y) => y.id === t.id)))
        const util = valorTurno(valores, t.inicio, t.duracao, '2026-10-07')
        const fds = valorTurno(valores, t.inicio, t.duracao, '2026-10-10')
        const temAloc = e.alocacoes?.some((a) => a.turnoId === t.id && a.medicoId)
        return (
          <div className="turno" key={t.id}>
            <div className="turno-top">
              <strong>Período {i + 1}</strong>
              <Badge tone={isDiurno(t.inicio) ? 'sun' : 'moon'}>{isDiurno(t.inicio) ? 'Diurno' : 'Noturno'}</Badge>
              <div className="spacer" />
              <button
                type="button"
                className="btn sm ghost danger"
                disabled={travado && temAloc}
                title={travado && temAloc ? 'Há médicos alocados neste período' : ''}
                onClick={() => set((x) => {
                  x.turnos = x.turnos.filter((y) => y.id !== t.id)
                  if (x.alocacoes) x.alocacoes = x.alocacoes.filter((a) => a.turnoId !== t.id)
                })}
              >
                Remover
              </button>
            </div>
            <div className="turno-grid">
              <Field label="Dias da semana">
                <div className="days">
                  {DIAS_ORDEM.map((d) => (
                    <button
                      type="button"
                      key={d}
                      className={t.dias.includes(d) ? 'on' : ''}
                      onClick={() => setT((y) => (y.dias = y.dias.includes(d) ? y.dias.filter((z) => z !== d) : [...y.dias, d]))}
                    >
                      {DIAS[d]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Início">
                <input type="time" value={t.inicio} onChange={(ev) => setT((y) => (y.inicio = ev.target.value || '00:00'))} />
              </Field>
              <Field label="Duração (h)" hint={`Término: ${fimTurno(t.inicio, t.duracao)}`}>
                <input type="number" min="1" max="24" value={t.duracao} onChange={(ev) => setT((y) => (y.duracao = Math.min(24, Math.max(1, Number(ev.target.value)))))} />
              </Field>
              <Field label="Médicos por período">
                <input type="number" min="1" max="10" value={t.vagas} onChange={(ev) => setT((y) => (y.vagas = Math.min(10, Math.max(1, Number(ev.target.value)))))} />
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
          </div>
        )
      })}
      <div>
        <button type="button" className="btn" onClick={() => add({})}>
          + Adicionar período
        </button>
      </div>
    </div>
  )
}
