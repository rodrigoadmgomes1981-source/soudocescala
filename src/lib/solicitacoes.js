// Passagem, troca e anúncio de plantão pelo médico
import { DIAS, fimTurno, fmtDate, inicioPlantao, logEscala, uid, weekday } from './utils'

export const TIPOS_SOL = {
  passagem: 'Passagem de plantão',
  troca: 'Troca de plantão',
  anuncio: 'Anúncio de plantão',
}

const setAvulso = (e, turnoId, vagaIdx, data, medicoId, extra = {}) => {
  e.alocacoes = e.alocacoes.filter((a) => !(!a.fixo && a.turnoId === turnoId && a.vagaIdx === vagaIdx && a.data === data))
  e.alocacoes.push({ id: uid('a'), turnoId, vagaIdx, data, medicoId, fixo: false, ...extra })
}

export const descPlantao = (e, turnoId, data) => {
  const t = e.turnos.find((x) => x.id === turnoId)
  return `${DIAS[weekday(data)]} ${fmtDate(data)} ${t?.inicio}–${t ? fimTurno(t.inicio, t.duracao) : ''}`
}

/** Aplica uma solicitação aprovada (ou automática) na escala `e` (mutável) */
export const aplicarSolicitacao = (e, sol, nome) => {
  if (sol.tipo === 'passagem') {
    setAvulso(e, sol.turnoId, sol.vagaIdx, sol.data, sol.destinoId)
    logEscala(e, 'solicitacao', `Passagem: ${nome(sol.medicoId)} → ${nome(sol.destinoId)} em ${descPlantao(e, sol.turnoId, sol.data)}`)
  } else if (sol.tipo === 'troca') {
    const o = sol.troca
    setAvulso(e, sol.turnoId, sol.vagaIdx, sol.data, o.medicoId)
    setAvulso(e, o.turnoId, o.vagaIdx, o.data, sol.medicoId)
    logEscala(
      e,
      'solicitacao',
      `Troca: ${nome(sol.medicoId)} (${descPlantao(e, sol.turnoId, sol.data)}) ⇄ ${nome(o.medicoId)} (${descPlantao(e, o.turnoId, o.data)})`,
    )
  } else if (sol.tipo === 'anuncio') {
    setAvulso(e, sol.turnoId, sol.vagaIdx, sol.data, sol.medicoId, { ofertado: true })
    logEscala(e, 'solicitacao', `${nome(sol.medicoId)} anunciou o plantão ${descPlantao(e, sol.turnoId, sol.data)} no mural`)
  }
}

/** Verifica se o médico ainda pode mexer neste plantão (antecedência, trava) */
export const bloqueioSolicitacao = (escala, slot) => {
  if (escala.travada) return 'A escala está travada para alterações.'
  if (escala.status !== 'publicada') return 'A escala ainda não foi publicada.'
  const ini = inicioPlantao(slot.data, slot.turno.inicio).getTime()
  const horas = (ini - Date.now()) / 3600e3
  if (horas <= 0) return 'O plantão já começou.'
  if (horas < (escala.antecedenciaHoras || 0))
    return `Fora do prazo: a escala exige ${escala.antecedenciaHoras}h de antecedência (faltam ${Math.floor(horas)}h).`
  return null
}

const intervalo = (e, turnoId, data) => {
  const t = e?.turnos.find((x) => x.id === turnoId)
  if (!t) return null
  const ini = inicioPlantao(data, t.inicio).getTime()
  return [ini, ini + t.duracao * 3600e3]
}

/**
 * Explica conflitos de escala de um médico considerando passagens/trocas pendentes.
 * - saindo: o conflito existe porque o médico pediu para sair do plantão conflitante e o pedido não foi aprovado
 * - entrando: há pedido pendente que colocaria o médico em um plantão no mesmo horário
 * novos = lista de [ini, fim] (ms) dos plantões que estão sendo alocados
 */
export const explicarConflitos = (db, medicoId, conflitos, novos) => {
  const nome = (id) => db.medicos.find((m) => m.id === id)?.nome || '—'
  const pend = (db.solicitacoes || []).filter((s) => s.status === 'pendente')
  const esc = (id) => db.escalas.find((x) => x.id === id)
  const motivoTxt = (s) => {
    const e = esc(s.escalaId)
    if (s.tipo === 'passagem')
      return `a passagem de ${nome(s.medicoId)} (${descPlantao(e, s.turnoId, s.data)} · ${e?.nome}) para ${nome(s.destinoId)} ainda não foi aprovada`
    return `a troca entre ${nome(s.medicoId)} (${descPlantao(e, s.turnoId, s.data)}) e ${nome(s.troca.medicoId)} (${descPlantao(e, s.troca.turnoId, s.troca.data)}) ainda não foi aprovada`
  }

  const porPendencia = []
  const semPendencia = []
  for (const c of conflitos) {
    const s = pend.find(
      (x) =>
        x.escalaId === c.escalaId &&
        ((x.medicoId === medicoId && x.turnoId === c.turnoId && x.vagaIdx === c.vagaIdx && x.data === c.data) ||
          (x.tipo === 'troca' && x.troca?.medicoId === medicoId && x.troca.turnoId === c.turnoId && x.troca.vagaIdx === c.vagaIdx && x.troca.data === c.data)),
    )
    if (s) porPendencia.push({ ...c, sol: s, motivo: motivoTxt(s) })
    else semPendencia.push(c)
  }

  const overlap = (iv) => iv && novos.some(([a, b]) => iv[0] < b && a < iv[1])
  const entrando = []
  for (const s of pend) {
    const e = esc(s.escalaId)
    if (s.tipo === 'passagem' && s.destinoId === medicoId && overlap(intervalo(e, s.turnoId, s.data))) entrando.push({ sol: s, motivo: motivoTxt(s) })
    if (s.tipo === 'troca' && s.troca?.medicoId === medicoId && overlap(intervalo(e, s.turnoId, s.data))) entrando.push({ sol: s, motivo: motivoTxt(s) })
    if (s.tipo === 'troca' && s.medicoId === medicoId && overlap(intervalo(e, s.troca.turnoId, s.troca.data))) entrando.push({ sol: s, motivo: motivoTxt(s) })
  }
  return { porPendencia, semPendencia, entrando }
}
