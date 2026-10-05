import { addDays, toMin, valorTurno, weekday, valorDiferenciado, inicioPlantao } from './utils'

export const findSetor = (db, crId, unidadeId, setorId) => {
  const cr = db.contratos.find((c) => c.id === crId)
  const unidade = cr?.unidades.find((u) => u.id === unidadeId)
  const setor = unidade?.setores.find((s) => s.id === setorId)
  return { cr, unidade, setor }
}

export const naVigencia = (escala, iso) =>
  iso >= escala.vigenciaInicio && (!escala.vigenciaFim || iso <= escala.vigenciaFim)

/** Retorna a alocação vigente para (turno, vaga, data). Avulsa sobrepõe fixa. */
export const alocacaoDe = (escala, turnoId, vagaIdx, iso) => {
  const avulsa = escala.alocacoes.find(
    (a) => !a.fixo && a.turnoId === turnoId && a.vagaIdx === vagaIdx && a.data === iso,
  )
  if (avulsa) return avulsa
  return escala.alocacoes.find(
    (a) =>
      a.fixo &&
      a.turnoId === turnoId &&
      a.vagaIdx === vagaIdx &&
      a.desde <= iso &&
      (!a.ate || iso <= a.ate),
  )
}

/** Lista de slots (vaga x turno) de uma data */
export const slotsDoDia = (escala, valores, iso) => {
  if (!naVigencia(escala, iso)) return []
  const w = weekday(iso)
  const out = []
  escala.turnos
    .filter((t) => t.dias.includes(w))
    .sort((a, b) => toMin(a.inicio) - toMin(b.inicio))
    .forEach((t) => {
      const v = valorTurno(valores, t.inicio, t.duracao, iso)
      for (let i = 0; i < t.vagas; i++) {
        const aloc = alocacaoDe(escala, t.id, i, iso)
        const dif = !!aloc?.medicoId && !!aloc?.diferenciado && !!escala.pagDiferenciado?.ativo
        out.push({
          key: `${t.id}-${i}-${iso}`,
          diferenciado: dif,
          pagBase: v.pag,
          data: iso,
          turno: t,
          vagaIdx: i,
          aloc,
          medicoId: aloc?.medicoId || null,
          fat: v.fat,
          pag: dif ? valorDiferenciado(v.pag, escala.pagDiferenciado) : v.pag,
          tipo: v.tipo,
        })
      }
    })
  return out
}

export const statusSlot = (escala, slot) => {
  if (slot.medicoId) return slot.aloc?.ofertado ? 'ofertada' : slot.aloc?.fixo ? 'fixo' : 'avulso'
  if (escala.status !== 'publicada' || !escala.publicadaAte || slot.data > escala.publicadaAte) return 'vazia'
  const agora = Date.now()
  if (inicioPlantao(slot.data, slot.turno.inicio).getTime() <= agora) return 'furo'
  if (escala.anunciarVaga && agora >= momentoAnuncio(escala, slot).getTime()) return 'anunciada'
  return 'vazia'
}

/** Intervalos [início, fim) em minutos absolutos a partir de uma data base */
const absMin = (iso, base) => Math.round((new Date(iso) - new Date(base)) / 60000)

/**
 * Verifica conflito de horário e limite de horas contínuas para um médico.
 * Olha todas as escalas do sistema.
 */
export const checarMedico = (db, medicoId, iso, turno, ignorarKey, limiteHoras = 24) => {
  const base = addDays(iso, -2)
  const ini = absMin(iso, base) + toMin(turno.inicio)
  const novo = [ini, ini + turno.duracao * 60]
  const intervalos = []
  const conflitos = []
  for (const esc of db.escalas) {
    const { setor } = findSetor(db, esc.crId, esc.unidadeId, esc.setorId)
    for (let d = -1; d <= 1; d++) {
      const dia = addDays(iso, d)
      for (const s of slotsDoDia(esc, setor?.valores, dia)) {
        if (s.medicoId !== medicoId || s.key === ignorarKey) continue
        const i0 = absMin(dia, base) + toMin(s.turno.inicio)
        const iv = [i0, i0 + s.turno.duracao * 60]
        intervalos.push(iv)
        if (iv[0] < novo[1] && novo[0] < iv[1]) {
          conflitos.push(`${esc.nome} · ${s.data.split('-').reverse().join('/')} ${s.turno.inicio}`)
        }
      }
    }
  }
  // horas contínuas: une intervalos encostados
  const todos = [...intervalos, novo].sort((a, b) => a[0] - b[0])
  let maior = 0
  let cur = null
  for (const iv of todos) {
    if (cur && iv[0] <= cur[1]) cur[1] = Math.max(cur[1], iv[1])
    else {
      if (cur) maior = Math.max(maior, cur[1] - cur[0])
      cur = [...iv]
    }
  }
  if (cur) maior = Math.max(maior, cur[1] - cur[0])
  const horasContinuas = maior / 60
  return { conflitos, horasContinuas, excedeLimite: horasContinuas > limiteHoras }
}

/** Resumo financeiro planejado de um período */
export const resumoPeriodo = (escala, valores, de, ate) => {
  const r = { slots: 0, preenchidos: 0, vazios: 0, fat: 0, pag: 0, fatPrevisto: 0, pagPrevisto: 0 }
  if (!de || !ate || de > ate) return r
  let d = de
  let guard = 0
  while (d <= ate && guard++ < 400) {
    for (const s of slotsDoDia(escala, valores, d)) {
      r.slots++
      r.fatPrevisto += s.fat
      r.pagPrevisto += s.pag
      if (s.medicoId) {
        r.preenchidos++
        r.fat += s.fat
        r.pag += s.pag
      } else r.vazios++
    }
    d = addDays(d, 1)
  }
  return r
}

/** Momento (Date) em que uma vaga vazia passa a ser anunciada */
export const momentoAnuncio = (escala, slot) =>
  new Date(inicioPlantao(slot.data, slot.turno.inicio).getTime() - (escala.anuncioHorasAntes || 0) * 3600e3)

/** Itera slots de todas as escalas válidas num intervalo de datas */
export const slotsGlobais = (db, de, ate, filtro = () => true) => {
  const out = []
  for (const e of db.escalas.filter((x) => !x.incompleta && filtro(x))) {
    const { cr, unidade, setor } = findSetor(db, e.crId, e.unidadeId, e.setorId)
    let d = de
    let g = 0
    while (d <= ate && g++ < 400) {
      for (const s of slotsDoDia(e, setor?.valores, d)) out.push({ ...s, escala: e, cr, unidade, setor })
      d = addDays(d, 1)
    }
  }
  return out
}

/** Hash determinístico 0..1 (simulação de ausências) */
export const hash01 = (str) => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000
}
