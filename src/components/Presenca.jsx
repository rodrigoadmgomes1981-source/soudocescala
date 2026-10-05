import { Badge } from './ui'
import { ESTADO_PRES, enderecoTxt } from '../lib/presenca'

const atrasoTxt = (min, tipo) => {
  if (min === 0) return 'no horário'
  if (tipo === 'in') return min > 0 ? `${min} min de atraso` : `${-min} min antes`
  return min > 0 ? `${min} min após o fim` : `${-min} min antes do fim`
}

function Registro({ titulo, r, tipo, escala, previsto }) {
  if (!r)
    return (
      <div className="pres-box falta">
        <h5>{titulo}</h5>
        <span className="hora">—</span>
        <span className="small">Sem registro (previsto {previsto})</span>
      </div>
    )
  return (
    <div className="pres-box">
      <h5>{titulo}</h5>
      <span className="hora">{r.hora}</span>
      <span className={`small ${tipo === 'in' && r.atrasoMin > (escala.toleranciaMin || 0) ? 'warn-text' : 'muted'}`}>{atrasoTxt(r.atrasoMin, tipo)}</span>
      {r.foto && <img src={r.foto} alt={`Foto do reconhecimento facial · ${titulo.toLowerCase()} às ${r.hora}`} />}
      {r.geo && (
        <div className="pres-geo">
          <span>{r.endereco}</span>
          <span className="muted">
            {r.geo.lat.toFixed(5)}, {r.geo.lng.toFixed(5)}
          </span>
          <span className={r.geo.dentro ? 'dist-ok' : 'dist-fora'}>
            {r.geo.distancia} m do endereço cadastrado {r.geo.dentro ? '· dentro do raio' : `· fora do raio de ${escala.raioGeo} m`}
          </span>
          <a className="link small" href={`https://www.google.com/maps?q=${r.geo.lat},${r.geo.lng}`} target="_blank" rel="noreferrer">
            Ver no mapa ↗
          </a>
        </div>
      )}
    </div>
  )
}

export function PresencaPainel({ escala, slot, unidade, pres }) {
  if (!pres) return null
  const est = ESTADO_PRES[pres.estado]
  const previsto = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (pres.estado === 'futuro')
    return (
      <div className="stack">
        <p className="muted small">Plantão ainda não começou. Check-in e check-out aparecem aqui a partir do início.</p>
      </div>
    )
  return (
    <div className="stack">
      <div className="row-actions" style={{ alignItems: 'center' }}>
        <Badge tone={est.tone}>{est.label}</Badge>
        <span className="muted small">
          Controle: {escala.presenca.map((p) => (p === 'facial' ? 'reconhecimento facial' : 'geolocalização')).join(' + ')}
          {escala.presenca.includes('geo') && ` · raio ${escala.raioGeo} m`}
        </span>
      </div>
      {escala.presenca.includes('geo') && unidade && (
        <p className="small muted">
          Endereço cadastrado: <b style={{ color: 'var(--text)' }}>{enderecoTxt(unidade) || '—'}</b>
        </p>
      )}
      <div className="pres-grid">
        <Registro titulo="Check-in" r={pres.checkin} tipo="in" escala={escala} previsto={previsto(pres.ini)} />
        <Registro titulo="Check-out" r={pres.checkout} tipo="out" escala={escala} previsto={previsto(pres.fim)} />
      </div>
      <p className="muted small">Registros simulados para o protótipo{escala.presenca.includes('facial') ? '; as fotos são ilustrações' : ''}.</p>
      {slot && null}
    </div>
  )
}
