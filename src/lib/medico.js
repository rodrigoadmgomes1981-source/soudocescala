// Visão do médico: plantões, horas e valores
import { inicioPlantao } from './utils'
import { slotsGlobais } from './escala'
import { apKey, presencaDe, sugestaoApuracao } from './presenca'

const H = 3600e3

/** Plantões do médico em escalas publicadas, enriquecidos com presença, apuração e antecipação */
export const plantoesDoMedico = (db, medicoId, de, ate) => {
  const agora = Date.now()
  const nome = db.medicos.find((m) => m.id === medicoId)?.nome
  const antPorItem = {}
  for (const a of db.antecipacoes || []) if (a.status !== 'recusada') a.itens.forEach((k) => (antPorItem[k] = a))
  return slotsGlobais(db, de, ate, (e) => e.status === 'publicada')
    .filter((s) => s.medicoId === medicoId)
    .map((s) => {
      const ini = inicioPlantao(s.data, s.turno.inicio).getTime()
      const fim = ini + s.turno.duracao * H
      const k = apKey(s.escala.id, s.key)
      const ap = db.apuracoes?.[k]
      const pres = ini <= agora ? presencaDe(s.escala, s, s.unidade, nome) : null
      const sug = fim <= agora ? sugestaoApuracao(s, pres) : null
      let fin
      if (ini > agora) fin = { status: 'previsto', valor: s.pag }
      else if (fim > agora) fin = { status: 'andamento', valor: s.pag }
      else if (ap?.status === 'apurado') fin = { status: 'apurado', valor: ap.pag }
      else if (ap?.status === 'glosado') fin = { status: 'glosado', valor: 0 }
      else fin = { status: 'aguardando', valor: sug?.pag || 0 }
      const horasExec = fim <= agora ? (ap ? ap.horas : sug?.horas || 0) : null
      return { ...s, ini, fim, k, ap, pres, sug, fin, horasExec, antecipacao: antPorItem[k] || null }
    })
    .sort((a, b) => a.ini - b.ini)
}

export const FIN_LABEL = {
  previsto: { label: 'Previsto', tone: 'neutral' },
  andamento: { label: 'Em andamento', tone: 'info' },
  apurado: { label: 'Apurado', tone: 'ok' },
  aguardando: { label: 'Aguardando apuração', tone: 'warn' },
  glosado: { label: 'Glosado', tone: 'danger' },
}
