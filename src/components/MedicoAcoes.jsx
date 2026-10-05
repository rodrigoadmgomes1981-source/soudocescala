import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, Field, Modal, Segmented } from './ui'
import { DIAS, addDays, brl, fimTurno, fmtDate, todayISO, uid, weekday } from '../lib/utils'
import { findSetor, slotsDoDia } from '../lib/escala'
import { TIPOS_SOL, aplicarSolicitacao, bloqueioSolicitacao, descPlantao } from '../lib/solicitacoes'
import { enderecoTxt } from '../lib/presenca'

/** Modal do médico sobre um plantão seu: passar, trocar, anunciar */
export default function MedicoAcoesModal({ escala, slot, onClose }) {
  const { db, update, notify, user, abrirChat } = useStore()
  const me = user.medicoId
  const [acao, setAcao] = useState('passagem')
  const [destino, setDestino] = useState('')
  const [trocaKey, setTrocaKey] = useState('')
  const [motivo, setMotivo] = useState('')
  const { unidade, setor } = findSetor(db, escala.crId, escala.unidadeId, escala.setorId)
  const bloqueio = bloqueioSolicitacao(escala, slot)
  const nome = (id) => db.medicos.find((m) => m.id === id)?.nome || '—'
  const pendente = (db.solicitacoes || []).find(
    (s) => s.status === 'pendente' && s.escalaId === escala.id && s.turnoId === slot.turno.id && s.vagaIdx === slot.vagaIdx && s.data === slot.data,
  )

  // plantões de outros médicos desta escala (próximos 30 dias) para troca
  const opcoesTroca = useMemo(() => {
    const out = []
    for (let d = todayISO(), i = 0; i < 30; d = addDays(d, 1), i++)
      for (const s of slotsDoDia(escala, setor?.valores, d))
        if (s.medicoId && s.medicoId !== me && !bloqueioSolicitacao(escala, s)) out.push(s)
    return out
  }, [escala, setor, me])

  const auto = { passagem: escala.passagem === 'automatica', troca: escala.troca === 'automatica', anuncio: true }[acao]
  const opcoes = [
    { key: 'passagem', label: 'Passar plantão' },
    { key: 'troca', label: 'Trocar plantão' },
    ...(escala.anunciarVaga ? [{ key: 'anuncio', label: 'Anunciar no mural' }] : []),
  ]
  const valido = acao === 'passagem' ? !!destino : acao === 'troca' ? !!trocaKey : true

  const enviar = () => {
    const alvo = opcoesTroca.find((s) => s.key === trocaKey)
    const sol = {
      id: uid('sol'),
      tipo: acao,
      escalaId: escala.id,
      turnoId: slot.turno.id,
      vagaIdx: slot.vagaIdx,
      data: slot.data,
      medicoId: me,
      ...(acao === 'passagem' ? { destinoId: destino } : {}),
      ...(acao === 'troca' && alvo ? { troca: { turnoId: alvo.turno.id, vagaIdx: alvo.vagaIdx, data: alvo.data, medicoId: alvo.medicoId } } : {}),
      motivo,
      status: auto ? 'aprovada' : 'pendente',
      automatica: auto,
      criadoEm: new Date().toISOString(),
    }
    update((d) => {
      if (!d.solicitacoes) d.solicitacoes = []
      d.solicitacoes.push(sol)
      if (auto) aplicarSolicitacao(d.escalas.find((x) => x.id === escala.id), sol, nome)
    })
    notify(auto ? `${TIPOS_SOL[acao]} concluída` : `${TIPOS_SOL[acao]} enviada para aprovação do escalista`)
    onClose()
  }

  const cancelar = () => {
    update((d) => {
      const s = d.solicitacoes.find((x) => x.id === pendente.id)
      s.status = 'cancelada'
    })
    notify('Solicitação cancelada', 'warn')
    onClose()
  }

  return (
    <Modal
      title={`${DIAS[weekday(slot.data)]}, ${fmtDate(slot.data)} · ${slot.turno.inicio}–${fimTurno(slot.turno.inicio, slot.turno.duracao)}`}
      onClose={onClose}
      width={580}
      footer={
        <>
          <button className="btn ghost" onClick={() => abrirChat({ medicoId: me, comoMedico: true })}>
            Falar com a central
          </button>
          <div className="spacer" />
          {pendente ? (
            <button className="btn ghost danger" onClick={cancelar}>
              Cancelar solicitação
            </button>
          ) : (
            !bloqueio && (
              <button className="btn primary" disabled={!valido} onClick={enviar}>
                {auto ? `Confirmar ${acao === 'anuncio' ? 'anúncio' : acao}` : 'Enviar para aprovação'}
              </button>
            )
          )}
        </>
      }
    >
      <div className="stack">
        <div className="med-atual">
          <div>
            <b>{escala.nome}</b>
            <span className="muted small">{enderecoTxt(unidade)}</span>
            <span className="small">
              Paga {brl(slot.pag)}
              {slot.diferenciado ? ' (com diferenciado)' : ''}
            </span>
          </div>
        </div>

        {slot.aloc?.ofertado && <p className="alert warn">Você anunciou este plantão no mural. Ele continua seu até outro médico assumir.</p>}

        {pendente ? (
          <p className="alert info">
            {TIPOS_SOL[pendente.tipo]} aguardando aprovação desde {new Date(pendente.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            {pendente.destinoId ? ` · para ${nome(pendente.destinoId)}` : ''}.
          </p>
        ) : bloqueio ? (
          <p className="alert warn">{bloqueio}</p>
        ) : (
          <>
            <Segmented name="Ação" value={acao} onChange={setAcao} options={opcoes} />
            <p className="muted small">
              Regra desta escala:{' '}
              {acao === 'anuncio'
                ? 'o plantão vai para o mural de vagas e continua seu até alguém assumir.'
                : auto
                  ? 'automática, sem aprovação.'
                  : 'depende de aprovação do escalista.'}{' '}
              Antecedência mínima de {escala.antecedenciaHoras}h.
            </p>

            {acao === 'passagem' && (
              <Field label="Passar para">
                <select id="pass-destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
                  <option value="">Selecione o médico…</option>
                  {db.medicos
                    .filter((m) => m.id !== me)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} · {m.especialidade}
                      </option>
                    ))}
                </select>
              </Field>
            )}

            {acao === 'troca' && (
              <Field label="Trocar com o plantão de" hint={`${opcoesTroca.length} plantões disponíveis nos próximos 30 dias`}>
                <select id="troca-alvo" value={trocaKey} onChange={(e) => setTrocaKey(e.target.value)}>
                  <option value="">Selecione…</option>
                  {opcoesTroca.map((s) => (
                    <option key={s.key} value={s.key}>
                      {nome(s.medicoId)} · {descPlantao(escala, s.turno.id, s.data)}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Motivo (opcional)">
              <input id="sol-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: compromisso pessoal" />
            </Field>
            {!auto && <Badge tone="warn">Precisa de aprovação</Badge>}
          </>
        )}
      </div>
    </Modal>
  )
}
