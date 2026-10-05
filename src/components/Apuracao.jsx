import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, Modal } from './ui'
import { PresencaPainel } from './Presenca'
import { DIAS, brl, fimTurno, fmtDate, inicioPlantao, logEscala, weekday } from '../lib/utils'
import { slotsGlobais } from '../lib/escala'
import { ESTADO_PRES, apKey, presencaDe, sugestaoApuracao } from '../lib/presenca'

const ST = {
  pendente: { label: 'Pendente', tone: 'neutral' },
  apurado: { label: 'Apurado', tone: 'ok' },
  glosado: { label: 'Glosado', tone: 'danger' },
}

/** Tabela de apuração com seleção em lote. escalaIds vazio = todas as publicadas. */
export default function ApuracaoTabela({ escalaIds = [], de, ate, mostrarEscala = true }) {
  const { db, update, notify, user } = useStore()
  const [status, setStatus] = useState('pendente')
  const [cor, setCor] = useState('todas')
  const [sel, setSel] = useState(() => new Set())
  const [detalhe, setDetalhe] = useState(null)
  const agora = Date.now()

  const travadoPorAntecipacao = useMemo(() => {
    const s = new Set()
    for (const a of db.antecipacoes || []) if (a.status !== 'recusada') a.itens.forEach((k) => s.add(k))
    return s
  }, [db.antecipacoes])

  const linhas = useMemo(() => {
    const nome = (id) => db.medicos.find((m) => m.id === id)?.nome || ''
    return slotsGlobais(db, de, ate, (e) => e.status === 'publicada' && (escalaIds.length === 0 || escalaIds.includes(e.id)))
      .filter((s) => s.medicoId && inicioPlantao(s.data, s.turno.inicio).getTime() + s.turno.duracao * 3600e3 <= agora)
      .map((s) => {
        const pres = presencaDe(s.escala, s, s.unidade, nome(s.medicoId))
        const sug = sugestaoApuracao(s, pres)
        const k = apKey(s.escala.id, s.key)
        const ap = db.apuracoes?.[k]
        return { ...s, k, pres, sug, ap, st: ap?.status || 'pendente', medNome: nome(s.medicoId) }
      })
      .sort((a, b) => (a.data === b.data ? a.turno.inicio.localeCompare(b.turno.inicio) : a.data.localeCompare(b.data)))
  }, [db, de, ate, escalaIds, agora])

  const visiveis = linhas.filter((l) => (status === 'todos' || l.st === status) && (cor === 'todas' || l.pres?.cor === cor))
  const selecionadas = linhas.filter((l) => sel.has(l.k))
  const toggle = (k) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const todosVisSel = visiveis.length > 0 && visiveis.every((l) => sel.has(l.k))

  const aplicar = (modo) => {
    const alvo = selecionadas.filter((l) => !(modo === 'reabrir' && travadoPorAntecipacao.has(l.k)))
    if (!alvo.length) return
    update((d) => {
      if (!d.apuracoes) d.apuracoes = {}
      const porEscala = {}
      for (const l of alvo) {
        porEscala[l.escala.id] = (porEscala[l.escala.id] || 0) + 1
        if (modo === 'reabrir') {
          delete d.apuracoes[l.k]
          continue
        }
        const glosa = modo === 'glosar' || (modo === 'sugestao' && l.sug.glosa)
        const integral = modo === 'integral'
        d.apuracoes[l.k] = {
          status: glosa ? 'glosado' : 'apurado',
          horas: glosa ? 0 : integral ? l.turno.duracao : l.sug.horas,
          pag: glosa ? 0 : integral ? l.pag : l.sug.pag,
          fat: glosa ? 0 : integral ? l.fat : l.sug.fat,
          medicoId: l.medicoId,
          por: user?.nome,
          em: new Date().toISOString(),
        }
      }
      const txt = { sugestao: 'apurados conforme presença', integral: 'apurados pelo valor integral', glosar: 'glosados', reabrir: 'reabertos' }[modo]
      for (const [eid, n] of Object.entries(porEscala)) logEscala(d.escalas.find((x) => x.id === eid), 'apuracao', `${n} plantão(ões) ${txt} em lote`)
    })
    setSel(new Set())
    notify(`${alvo.length} plantão(ões) atualizados`)
  }

  const tot = selecionadas.reduce(
    (t, l) => ({ h: t.h + (l.sug?.horas || 0), pag: t.pag + (l.sug?.pag || 0), fat: t.fat + (l.sug?.fat || 0) }),
    { h: 0, pag: 0, fat: 0 },
  )
  const contagem = (st) => linhas.filter((l) => l.st === st).length

  return (
    <div className="stack">
      <div className="filters">
        <div className="chips-filter" role="group" aria-label="Status">
          {[
            ['pendente', `Pendentes (${contagem('pendente')})`],
            ['apurado', `Apurados (${contagem('apurado')})`],
            ['glosado', `Glosados (${contagem('glosado')})`],
            ['todos', `Todos (${linhas.length})`],
          ].map(([k, l]) => (
            <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="chips-filter" role="group" aria-label="Presença">
          {[
            ['todas', 'Todas as cores'],
            ['verde', 'Verde'],
            ['amarelo', 'Amarelo'],
            ['vermelho', 'Vermelho'],
          ].map(([k, l]) => (
            <button key={k} className={cor === k ? 'on' : ''} onClick={() => setCor(k)}>
              {k !== 'todas' && <i className={`dot ${k}`} />}
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="sel-bar">
        <b>{selecionadas.length} selecionado(s)</b>
        {selecionadas.length > 0 && (
          <span className="muted small">
            {tot.h}h · paga {brl(tot.pag)} · fatura {brl(tot.fat)} (sugerido)
          </span>
        )}
        <div className="spacer" />
        <button className="btn sm ghost" onClick={() => setSel(new Set(visiveis.filter((l) => l.st === 'pendente' && l.pres?.cor === 'verde').map((l) => l.k)))}>
          Selecionar pendentes verdes
        </button>
        <button className="btn sm primary" disabled={!selecionadas.length} onClick={() => aplicar('sugestao')}>
          Apurar conforme presença
        </button>
        <button className="btn sm" disabled={!selecionadas.length} onClick={() => aplicar('integral')}>
          Apurar integral
        </button>
        <button className="btn sm ghost danger" disabled={!selecionadas.length} onClick={() => aplicar('glosar')}>
          Glosar
        </button>
        <button className="btn sm ghost" disabled={!selecionadas.length} onClick={() => aplicar('reabrir')}>
          Reabrir
        </button>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th className="chk">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={todosVisSel}
                  onChange={() =>
                    setSel((s) => {
                      const n = new Set(s)
                      visiveis.forEach((l) => (todosVisSel ? n.delete(l.k) : n.add(l.k)))
                      return n
                    })
                  }
                />
              </th>
              <th>Presença</th>
              <th>Plantão</th>
              {mostrarEscala && <th>Escala</th>}
              <th>Médico</th>
              <th>Entrada / saída</th>
              <th className="num">Horas</th>
              <th className="num">Paga (sugerido)</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  Nenhum plantão neste filtro.
                </td>
              </tr>
            )}
            {visiveis.map((l) => (
              <tr key={l.k} className={sel.has(l.k) ? 'sel' : ''}>
                <td className="chk">
                  <input type="checkbox" aria-label={`Selecionar ${l.data} ${l.turno.inicio}`} checked={sel.has(l.k)} onChange={() => toggle(l.k)} />
                </td>
                <td className="small">
                  <i className={`dot ${l.pres?.cor || ''}`} />
                  {ESTADO_PRES[l.pres?.estado]?.label}
                </td>
                <td>
                  <b>
                    {DIAS[weekday(l.data)]} {fmtDate(l.data)}
                  </b>
                  <div className="muted small">
                    {l.turno.inicio}–{fimTurno(l.turno.inicio, l.turno.duracao)}
                  </div>
                </td>
                {mostrarEscala && <td className="small">{l.escala.nome}</td>}
                <td>{l.medNome}</td>
                <td className="small" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {l.pres?.checkin?.hora || '—'} / {l.pres?.checkout?.hora || '—'}
                </td>
                <td className="num">
                  {l.ap ? l.ap.horas : l.sug?.horas}h<span className="muted small"> / {l.turno.duracao}h</span>
                </td>
                <td className="num">
                  {brl(l.ap ? l.ap.pag : l.sug?.pag)}
                  {l.diferenciado && <div className="muted small">com diferenciado</div>}
                </td>
                <td>
                  <Badge tone={ST[l.st].tone}>{ST[l.st].label}</Badge>
                  {travadoPorAntecipacao.has(l.k) && <div className="muted small">em antecipação</div>}
                </td>
                <td>
                  <button className="btn sm ghost" onClick={() => setDetalhe(l)}>
                    Detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Sugestão: registros completos usam as horas entre check-in e check-out; com um registro ausente usa as horas planejadas (conferir justificativa); sem
        registros sugere glosa.
      </p>

      {detalhe && (
        <Modal title={`${detalhe.medNome} · ${fmtDate(detalhe.data)} ${detalhe.turno.inicio}`} onClose={() => setDetalhe(null)} width={640}>
          <PresencaPainel escala={detalhe.escala} unidade={detalhe.unidade} pres={detalhe.pres} />
          <p className="small" style={{ marginTop: 12 }}>
            <b>Sugestão:</b> {detalhe.sug?.motivo} · {detalhe.sug?.horas}h · paga {brl(detalhe.sug?.pag)}
          </p>
        </Modal>
      )}
    </div>
  )
}
