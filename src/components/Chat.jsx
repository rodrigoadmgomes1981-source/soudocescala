import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { fmtDate } from '../lib/utils'

/**
 * Chat de atendimento entre a central (escalista/admin) e o médico.
 * chat = { medicoId, contexto?: { texto } } — contexto é o plantão que originou o acionamento.
 */
export default function ChatDrawer({ chat, onClose, comoMedico = false }) {
  const { db, update, user } = useStore()
  const [txt, setTxt] = useState('')
  const fim = useRef(null)
  const med = db.medicos.find((m) => m.id === chat.medicoId)
  const msgs = db.chats?.[chat.medicoId] || []

  useEffect(() => {
    try {
      fim.current?.scrollIntoView({ block: 'end' })
    } catch {
      /* ignore */
    }
  }, [msgs.length])

  const enviar = (texto) => {
    const t = (texto ?? txt).trim()
    if (!t) return
    update((d) => {
      if (!d.chats) d.chats = {}
      if (!d.chats[chat.medicoId]) d.chats[chat.medicoId] = []
      d.chats[chat.medicoId].push({
        de: comoMedico ? 'medico' : 'central',
        autor: user?.nome,
        texto: t,
        em: new Date().toISOString(),
        ...(chat.contexto && !comoMedico ? { ref: chat.contexto.texto } : {}),
      })
    })
    setTxt('')
  }

  const primeiro = med?.nome.split(' ')[0]
  const templates = comoMedico
    ? ['Estou a caminho.', 'Vou me atrasar alguns minutos.', 'Confirmado.']
    : chat.contexto
      ? [
          `Olá, Dr(a). ${primeiro}. Pode confirmar presença no plantão ${chat.contexto.texto}?`,
          `Dr(a). ${primeiro}, não identificamos seu check-in no plantão ${chat.contexto.texto}. Está tudo bem?`,
          `Dr(a). ${primeiro}, temos uma vaga aberta: ${chat.contexto.texto}. Tem disponibilidade?`,
        ]
      : [`Olá, Dr(a). ${primeiro}. Tudo bem?`]

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Chat de atendimento">
        <div className="drawer-head">
          <div className="avatar">
            {(comoMedico ? 'CE' : med?.nome)
              ?.split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')}
          </div>
          <div>
            <b>{comoMedico ? 'Central de escalas' : med?.nome}</b>
            <div className="muted small">{comoMedico ? 'Atendimento Sou DOC' : `${med?.crm} · chat de atendimento`}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="chat-msgs">
          {msgs.length === 0 && <p className="muted small">Nenhuma mensagem ainda.</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.de} ${comoMedico ? 'eu-medico' : ''}`}>
              {m.ref && <span className="msg-ref">Plantão: {m.ref}</span>}
              <span>{m.texto}</span>
              <small>
                {m.autor} · {fmtDate(m.em.slice(0, 10))} {m.em.slice(11, 16)}
              </small>
            </div>
          ))}
          <div ref={fim} />
        </div>
        <div className="chat-templates">
          {templates.map((t) => (
            <button key={t} type="button" onClick={() => enviar(t)} title={t}>
              {t.length > 48 ? t.slice(0, 46) + '…' : t}
            </button>
          ))}
        </div>
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault()
            enviar()
          }}
        >
          <input id="chat-input" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Escreva uma mensagem…" autoComplete="off" />
          <button className="btn primary" disabled={!txt.trim()}>
            Enviar
          </button>
        </form>
      </aside>
    </>
  )
}
