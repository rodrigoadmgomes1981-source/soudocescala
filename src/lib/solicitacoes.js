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
