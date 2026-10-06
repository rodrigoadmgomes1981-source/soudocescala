import { useEffect, useRef, useState } from 'react'

export function Modal({ title, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className="modal" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children, span }) {
  return (
    <label className={`field ${span ? 'span-' + span : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

/** Escolha única em botões */
export function Segmented({ options, value, onChange, name }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          type="button"
          key={o.key}
          role="radio"
          aria-checked={value === o.key}
          className={value === o.key ? 'on' : ''}
          onClick={() => onChange(o.key)}
          title={o.hint}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Múltipla escolha em botões */
export function MultiToggle({ options, value, onChange }) {
  const toggle = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k])
  return (
    <div className="segmented multi">
      {options.map((o) => (
        <button
          type="button"
          key={o.key}
          aria-pressed={value.includes(o.key)}
          className={value.includes(o.key) ? 'on' : ''}
          onClick={() => toggle(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track">
        <span className="thumb" />
      </span>
      <span>{label}</span>
    </label>
  )
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function MoneyInput({ value, onChange }) {
  return (
    <div className="money">
      <span>R$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

/** Seleção múltipla de escalas (lista suspensa com caixas de seleção). value = [] significa todas. */
export function EscalaFiltro({ escalas, value, onChange, label = 'Escalas' }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e) => ref.current && !ref.current.contains(e.target) && setAberto(false)
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  const resumo =
    value.length === 0
      ? `Todas as escalas (${escalas.length})`
      : value.length === 1
        ? escalas.find((e) => e.id === value[0])?.nome || '1 escala'
        : `${value.length} escalas selecionadas`
  return (
    <div className="field multi-sel" ref={ref}>
      <span className="field-label">{label}</span>
      <button type="button" className="multi-btn" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <span>{resumo}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {aberto && (
        <div className="multi-pop" role="listbox" aria-multiselectable="true">
          <label className="multi-opt todas">
            <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} />
            Todas as escalas
          </label>
          {escalas.map((e) => (
            <label key={e.id} className="multi-opt">
              <input type="checkbox" checked={value.includes(e.id)} onChange={() => toggle(e.id)} />
              <span>
                {e.nome}
                {e.status && e.status !== 'publicada' && <small className="muted"> · {e.incompleta ? 'em criação' : 'rascunho'}</small>}
              </span>
            </label>
          ))}
          <div className="multi-foot">
            <button type="button" className="link small" onClick={() => onChange(escalas.map((e) => e.id))}>
              Marcar todas
            </button>
            <button type="button" className="link small" onClick={() => onChange([])}>
              Limpar
            </button>
            <button type="button" className="btn sm primary" onClick={() => setAberto(false)}>
              Aplicar
            </button>
          </div>
        </div>
      )}
      {value.length > 0 && (
        <div className="multi-tags">
          {value.map((id) => (
            <span key={id} className="tag-x">
              {escalas.find((e) => e.id === id)?.nome}
              <button type="button" aria-label="Remover" onClick={() => toggle(id)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Janelas de tempo para dashboards */
export const JANELAS = [
  { key: '24', h: 24, label: 'Próximas 24h' },
  { key: '48', h: 48, label: 'Próximas 48h' },
  { key: '72', h: 72, label: 'Próximas 72h' },
]

/** Converte a janela escolhida em intervalo de datas (para busca) e de milissegundos (para filtro) */
// eslint-disable-next-line react-refresh/only-export-components
export const resolverJanela = (j, extras = []) => {
  const preset = [...JANELAS, ...extras].find((x) => x.key === j.modo)
  if (preset) {
    const ini = Date.now()
    const fim = ini + preset.h * 3600e3
    const d0 = new Date(ini)
    const d1 = new Date(fim)
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { ini, fim, de: iso(new Date(d0.getTime() - 86400e3)), ate: iso(d1), label: preset.label }
  }
  const [y0, m0, dd0] = j.de.split('-').map(Number)
  const [y1, m1, dd1] = j.ate.split('-').map(Number)
  return {
    ini: new Date(y0, m0 - 1, dd0).getTime(),
    fim: new Date(y1, m1 - 1, dd1, 23, 59, 59).getTime(),
    de: j.de,
    ate: j.ate,
    label: 'Personalizado',
  }
}

export function JanelaTempo({ value, onChange, extras = [] }) {
  const opcoes = [...JANELAS, ...extras]
  return (
    <div className="field janela">
      <span className="field-label">Cenário</span>
      <div className="janela-row">
        <div className="chips-filter" role="group" aria-label="Janela de tempo">
          {opcoes.map((o) => (
            <button type="button" key={o.key} className={value.modo === o.key ? 'on' : ''} onClick={() => onChange({ ...value, modo: o.key })}>
              {o.label}
            </button>
          ))}
          <button type="button" className={value.modo === 'custom' ? 'on' : ''} onClick={() => onChange({ ...value, modo: 'custom' })}>
            Personalizado
          </button>
        </div>
        {value.modo === 'custom' && (
          <div className="inline-input">
            <input type="date" aria-label="De" value={value.de} onChange={(e) => onChange({ ...value, de: e.target.value })} />
            <span className="muted small">até</span>
            <input type="date" aria-label="Até" value={value.ate} min={value.de} onChange={(e) => onChange({ ...value, ate: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  )
}
