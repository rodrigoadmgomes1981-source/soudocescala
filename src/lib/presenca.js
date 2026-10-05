// Presença (check-in/check-out) simulada e apuração de plantões
import { inicioPlantao } from './utils'
import { hash01 } from './escala'

const MIN = 60000
const H = 3600e3

export const haversine = (a, b) => {
  const R = 6371000
  const rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Ponto a `dist` metros na direção `ang` (rad) */
const deslocar = (p, dist, ang) => ({
  lat: p.lat + (dist * Math.cos(ang)) / 111320,
  lng: p.lng + (dist * Math.sin(ang)) / (111320 * Math.cos((p.lat * Math.PI) / 180)),
})

export const enderecoTxt = (u) => {
  const e = u?.endereco || {}
  const l1 = [e.logradouro, e.numero].filter(Boolean).join(', ')
  return [l1, e.complemento, e.bairro, u?.cidade && `${u.cidade}/${u.uf}`, e.cep && `CEP ${e.cep}`].filter(Boolean).join(' · ')
}

/** Foto simulada (SVG) do registro facial */
const fotoSimulada = (seed, hora, nome) => {
  const hue = Math.round(hash01(seed) * 360)
  const ini = (nome || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><rect width="120" height="150" fill="hsl(${hue},30%,82%)"/><circle cx="60" cy="58" r="26" fill="hsl(${hue},25%,55%)"/><path d="M18 150c4-34 22-50 42-50s38 16 42 50z" fill="hsl(${hue},25%,55%)"/><text x="60" y="64" font-family="sans-serif" font-size="16" font-weight="700" text-anchor="middle" fill="#fff">${ini}</text><rect y="126" width="120" height="24" fill="rgba(0,0,0,.55)"/><text x="60" y="142" font-family="monospace" font-size="11" text-anchor="middle" fill="#fff">${hora}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const hhmm = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/**
 * Presença de um plantão. Determinística (simulada) a partir da chave do plantão.
 * estado: futuro | aguardando | andamento | sem-checkin | ok | parcial | ausente
 * cor (regra): ok = verde, parcial = amarelo, ausente/sem-checkin = vermelho
 */
export const presencaDe = (escala, slot, unidade, medicoNome) => {
  if (!slot.medicoId) return null
  const agora = Date.now()
  const ini = inicioPlantao(slot.data, slot.turno.inicio).getTime()
  const fim = ini + slot.turno.duracao * H
  if (ini > agora) return { estado: 'futuro', cor: null }
  const k = `${escala.id}|${slot.key}|${slot.medicoId}`
  const h = hash01(k)
  const h2 = hash01('in' + k)
  const h3 = hash01('out' + k)
  // distribuição: 6% sem nenhum registro, 8% só entrada, 4% só saída, resto completo
  const temIn = !(h < 0.06 || (h >= 0.14 && h < 0.18))
  const temOut = h >= 0.14
  let cin = temIn ? ini + Math.round(h2 * 35 - 15) * MIN : null
  let cout = temOut ? fim + Math.round(h3 * 35 - 10) * MIN : null
  if (cin && cin > agora) cin = null
  if (cout && cout > agora) cout = null
  const emAndamento = agora < fim

  const tol = (escala.toleranciaMin || 0) * MIN
  let estado
  if (emAndamento) estado = cin ? 'andamento' : agora - ini > tol ? 'sem-checkin' : 'aguardando'
  else estado = cin && cout ? 'ok' : cin || cout ? 'parcial' : 'ausente'
  const cor = { ok: 'verde', parcial: 'amarelo', ausente: 'vermelho', 'sem-checkin': 'vermelho', andamento: 'azul', aguardando: null }[estado]

  const usaGeo = escala.presenca.includes('geo')
  const usaFacial = escala.presenca.includes('facial')
  const base = unidade?.geo?.lat ? unidade.geo : null
  const reg = (ms, tag) => {
    if (!ms) return null
    const r = { ms, hora: hhmm(ms), atrasoMin: Math.round((ms - (tag === 'in' ? ini : fim)) / MIN) }
    if (usaFacial) r.foto = fotoSimulada(k + tag, `${tag === 'in' ? 'ENTRADA' : 'SAÍDA'} ${r.hora}`, medicoNome)
    if (usaGeo && base) {
      const fora = hash01('fora' + tag + k) < 0.07
      const dist = fora ? 350 + hash01('d' + tag + k) * 600 : 10 + hash01('d' + tag + k) * 160
      const p = deslocar(base, dist, hash01('a' + tag + k) * Math.PI * 2)
      const e = unidade.endereco || {}
      const num = Number(e.numero) || 100
      r.geo = { ...p, distancia: Math.round(haversine(base, p)) }
      r.geo.dentro = r.geo.distancia <= (escala.raioGeo || 200)
      r.endereco = `${e.logradouro || 'Endereço aproximado'}, ${Math.max(1, num + Math.round((hash01('n' + tag + k) - 0.5) * (fora ? 900 : 120)))} · ${e.bairro || ''} · ${unidade.cidade}/${unidade.uf}`
    }
    return r
  }
  return { estado, cor, checkin: reg(cin, 'in'), checkout: reg(cout, 'out'), ini, fim }
}

export const ESTADO_PRES = {
  ok: { label: 'Check-in e check-out', tone: 'ok' },
  parcial: { label: 'Falta um registro', tone: 'warn' },
  ausente: { label: 'Sem check-in e check-out', tone: 'danger' },
  'sem-checkin': { label: 'Sem check-in (em andamento)', tone: 'danger' },
  andamento: { label: 'Em andamento', tone: 'info' },
  aguardando: { label: 'Aguardando check-in', tone: 'neutral' },
  futuro: { label: 'Plantão futuro', tone: 'neutral' },
}

/** Horas realizadas e valor sugerido para apuração */
export const sugestaoApuracao = (slot, pres) => {
  const dur = slot.turno.duracao
  if (!pres || pres.estado === 'futuro') return null
  let horas = 0
  let motivo = ''
  if (pres.checkin && pres.checkout) {
    horas = Math.round(((pres.checkout.ms - pres.checkin.ms) / H) * 4) / 4
    motivo = 'Registros completos'
  } else if (pres.checkin || pres.checkout) {
    horas = dur
    motivo = 'Um registro ausente: horas planejadas, conferir justificativa'
  } else {
    horas = 0
    motivo = 'Sem registros: sugerida glosa'
  }
  const fator = horas >= dur - 0.5 ? 1 : Math.min(1, horas / dur)
  return {
    horas,
    motivo,
    glosa: horas === 0,
    pag: Math.round(slot.pag * fator * 100) / 100,
    fat: Math.round(slot.fat * fator * 100) / 100,
  }
}

export const apKey = (escalaId, slotKey) => `${escalaId}|${slotKey}`
