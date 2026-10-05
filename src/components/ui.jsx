import { useEffect } from 'react'

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

/** Seleção múltipla de escalas (chips). value = [] significa todas. */
export function EscalaFiltro({ escalas, value, onChange, label = 'Escalas' }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="chips-filter" role="group" aria-label={label}>
        <button type="button" className={value.length === 0 ? 'on' : ''} onClick={() => onChange([])}>
          Todas ({escalas.length})
        </button>
        {escalas.map((e) => (
          <button type="button" key={e.id} aria-pressed={value.includes(e.id)} className={value.includes(e.id) ? 'on' : ''} onClick={() => toggle(e.id)}>
            {e.nome}
          </button>
        ))}
      </div>
    </div>
  )
}
