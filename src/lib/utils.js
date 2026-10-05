// ---------- Datas ----------
export const pad = (n) => String(n).padStart(2, '0')
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (iso, n) => {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export const todayISO = () => toISO(new Date())
export const weekday = (iso) => parseISO(iso).getDay() // 0 = domingo
export const startOfWeek = (iso) => addDays(iso, -((weekday(iso) + 6) % 7)) // segunda
export const fmtDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')
export const fmtDateShort = (iso) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
export const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DIAS_ORDEM = [1, 2, 3, 4, 5, 6, 0]

export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const fimTurno = (inicio, duracao) => {
  const t = toMin(inicio) + duracao * 60
  const virou = t >= 1440
  const m = t % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}${virou ? ' (+1)' : ''}`
}

// Feriados nacionais (protótipo — em produção virá de cadastro por município/UF)
export const FERIADOS = {
  '2026-01-01': 'Confraternização Universal',
  '2026-02-16': 'Carnaval',
  '2026-02-17': 'Carnaval',
  '2026-04-03': 'Sexta-feira Santa',
  '2026-04-21': 'Tiradentes',
  '2026-05-01': 'Dia do Trabalho',
  '2026-06-04': 'Corpus Christi',
  '2026-09-07': 'Independência',
  '2026-10-12': 'Nossa Senhora Aparecida',
  '2026-11-02': 'Finados',
  '2026-11-15': 'Proclamação da República',
  '2026-11-20': 'Consciência Negra',
  '2026-12-25': 'Natal',
  '2027-01-01': 'Confraternização Universal',
  '2027-02-08': 'Carnaval',
  '2027-02-09': 'Carnaval',
  '2027-03-26': 'Sexta-feira Santa',
  '2027-04-21': 'Tiradentes',
  '2027-05-01': 'Dia do Trabalho',
}

// ---------- Dinheiro ----------
export const brl = (v) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })

// ---------- Tipos de valor ----------
export const TIPOS_VALOR = [
  { key: 'diu_util', label: 'Diurno · dia útil' },
  { key: 'not_util', label: 'Noturno · dia útil' },
  { key: 'diu_fds', label: 'Diurno · fim de semana/feriado' },
  { key: 'not_fds', label: 'Noturno · fim de semana/feriado' },
]
export const tipoLabel = (k) => TIPOS_VALOR.find((t) => t.key === k)?.label || k

export const isDiurno = (inicio) => {
  const h = toMin(inicio) / 60
  return h >= 7 && h < 19
}
export const isFdsOuFeriado = (iso) => {
  const w = weekday(iso)
  return w === 0 || w === 6 || !!FERIADOS[iso]
}
export const tipoValor = (inicio, iso) =>
  `${isDiurno(inicio) ? 'diu' : 'not'}_${iso && isFdsOuFeriado(iso) ? 'fds' : 'util'}`

/** valores = { diu_util: {fat, pag}, ... } — valor por HORA */
export const valorTurno = (valores, inicio, duracao, iso) => {
  const t = tipoValor(inicio, iso)
  const v = valores?.[t] || { fat: 0, pag: 0 }
  return { tipo: t, fat: v.fat * duracao, pag: v.pag * duracao }
}

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`

// ---------- Opções de regra ----------
export const BASES = [
  { key: 'planejado', label: 'Planejado', hint: 'o que está na escala publicada' },
  { key: 'realizado', label: 'Realizado', hint: 'o que o check-in/check-out registrou' },
  { key: 'apurado', label: 'Apurado', hint: 'realizado validado pelo gestor (glosas e ajustes)' },
]
export const baseLabel = (k) => BASES.find((b) => b.key === k)?.label || k

// Usuário logado (mock do protótipo)
export let USUARIO = 'Rodrigo Gomes'
export const setUsuarioLog = (nome) => {
  USUARIO = nome
}

export const TIPOS_LOG = [
  { key: 'regra', label: 'Regras' },
  { key: 'periodo', label: 'Períodos' },
  { key: 'medico', label: 'Médicos' },
  { key: 'publicacao', label: 'Publicação' },
  { key: 'apuracao', label: 'Apuração' },
  { key: 'solicitacao', label: 'Solicitações' },
]

/** Registra entrada no log da escala */
export const logEscala = (e, tipo, acao, detalhes) => {
  if (!e.historico) e.historico = []
  e.historico.push({ em: new Date().toISOString(), usuario: USUARIO, tipo, acao, ...(detalhes?.length ? { detalhes } : {}) })
}

/** Data/hora absoluta de início de um plantão */
export const inicioPlantao = (iso, inicio) => {
  const d = parseISO(iso)
  const [h, m] = inicio.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

export const descDias = (dias) => {
  const s = [...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  const key = s.join(',')
  if (key === '1,2,3,4,5,6,0') return 'Todos os dias'
  if (key === '1,2,3,4,5') return 'Seg a Sex'
  if (key === '6,0') return 'Sáb e Dom'
  return s.map((d) => DIAS[d]).join(', ')
}

/** Aplica pagamento diferenciado sobre o valor base de pagamento */
export const valorDiferenciado = (pag, cfg) =>
  !cfg?.ativo ? pag : cfg.tipo === 'percentual' ? pag * (1 + (cfg.valor || 0) / 100) : pag + (cfg.valor || 0)
