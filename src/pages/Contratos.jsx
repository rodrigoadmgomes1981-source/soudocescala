import { useState } from 'react'
import { useStore } from '../lib/store'
import { Field, MoneyInput, Empty, Badge } from '../components/ui'
import { TIPOS_VALOR, brl, fmtDate, uid } from '../lib/utils'

const valoresVazios = () =>
  Object.fromEntries(TIPOS_VALOR.map((t) => [t.key, { fat: 0, pag: 0 }]))

export default function Contratos() {
  const { db, update, notify } = useStore()
  const [selId, setSelId] = useState(db.contratos[0]?.id)
  const cr = db.contratos.find((c) => c.id === selId)

  const novoCR = () => {
    const id = uid('cr')
    update((d) => {
      d.contratos.push({
        id,
        codigo: `CR ${1000 + d.contratos.length + 60}`,
        cliente: 'Novo cliente',
        objeto: '',
        vigenciaInicio: '',
        vigenciaFim: '',
        unidades: [],
      })
    })
    setSelId(id)
    notify('Contrato criado — preencha os dados e cadastre as unidades')
  }

  const setCR = (fn) =>
    update((d) => {
      fn(d.contratos.find((c) => c.id === selId))
    })

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Módulo CR</p>
          <h1>Contratos</h1>
          <p className="muted">
            Lançamento do contrato, unidades, setores e valores a faturar e a pagar por hora. As escalas puxam esses
            valores automaticamente.
          </p>
        </div>
        <button className="btn primary" onClick={novoCR}>
          + Novo contrato
        </button>
      </header>

      <div className="split">
        <aside className="list-col">
          {db.contratos.map((c) => {
            const nSet = c.unidades.reduce((n, u) => n + u.setores.length, 0)
            const nEsc = db.escalas.filter((e) => e.crId === c.id).length
            return (
              <button key={c.id} className={`list-item ${c.id === selId ? 'on' : ''}`} onClick={() => setSelId(c.id)}>
                <strong>{c.codigo}</strong>
                <span>{c.cliente}</span>
                <small className="muted">
                  {c.unidades.length} unid. · {nSet} setores · {nEsc} escalas
                </small>
              </button>
            )
          })}
        </aside>

        {!cr ? (
          <Empty title="Nenhum contrato selecionado" />
        ) : (
          <section className="detail-col">
            <div className="card">
              <div className="card-head">
                <h2>Dados do contrato</h2>
                <Badge tone="info">
                  {fmtDate(cr.vigenciaInicio)} → {fmtDate(cr.vigenciaFim)}
                </Badge>
              </div>
              <div className="grid-form">
                <Field label="Código do CR">
                  <input value={cr.codigo} onChange={(e) => setCR((c) => (c.codigo = e.target.value))} />
                </Field>
                <Field label="Cliente" span={2}>
                  <input value={cr.cliente} onChange={(e) => setCR((c) => (c.cliente = e.target.value))} />
                </Field>
                <Field label="Objeto" span={3}>
                  <input value={cr.objeto} onChange={(e) => setCR((c) => (c.objeto = e.target.value))} />
                </Field>
                <Field label="Início da vigência">
                  <input
                    type="date"
                    value={cr.vigenciaInicio}
                    onChange={(e) => setCR((c) => (c.vigenciaInicio = e.target.value))}
                  />
                </Field>
                <Field label="Fim da vigência">
                  <input
                    type="date"
                    value={cr.vigenciaFim}
                    onChange={(e) => setCR((c) => (c.vigenciaFim = e.target.value))}
                  />
                </Field>
              </div>
            </div>

            <div className="section-head">
              <h2>Unidades e setores</h2>
              <button
                className="btn"
                onClick={() =>
                  setCR((c) => c.unidades.push({ id: uid('u'), nome: 'Nova unidade', cidade: '', setores: [] }))
                }
              >
                + Unidade
              </button>
            </div>

            {cr.unidades.length === 0 && (
              <Empty title="Sem unidades">Cadastre as unidades atendidas por este contrato.</Empty>
            )}

            {cr.unidades.map((u) => {
              const setU = (fn) => setCR((c) => fn(c.unidades.find((x) => x.id === u.id)))
              return (
                <div className="card" key={u.id}>
                  <div className="unit-head">
                    <input
                      className="inline-title"
                      value={u.nome}
                      onChange={(e) => setU((x) => (x.nome = e.target.value))}
                      aria-label="Nome da unidade"
                    />
                    <input
                      className="inline-sub"
                      placeholder="Cidade/UF"
                      value={u.cidade}
                      onChange={(e) => setU((x) => (x.cidade = e.target.value))}
                    />
                    <div className="spacer" />
                    <button
                      className="btn sm"
                      onClick={() =>
                        setU((x) =>
                          x.setores.push({ id: uid('s'), nome: 'Novo setor', valores: valoresVazios() }),
                        )
                      }
                    >
                      + Setor
                    </button>
                    <button
                      className="btn sm ghost danger"
                      disabled={db.escalas.some((e) => e.unidadeId === u.id)}
                      title={
                        db.escalas.some((e) => e.unidadeId === u.id)
                          ? 'Há escalas vinculadas a esta unidade'
                          : 'Remover unidade'
                      }
                      onClick={() => setCR((c) => (c.unidades = c.unidades.filter((x) => x.id !== u.id)))}
                    >
                      Remover
                    </button>
                  </div>

                  {u.setores.map((s) => {
                    const setS = (fn) => setU((x) => fn(x.setores.find((y) => y.id === s.id)))
                    const emUso = db.escalas.some((e) => e.setorId === s.id)
                    return (
                      <div className="setor" key={s.id}>
                        <div className="setor-head">
                          <input
                            className="inline-sub strong"
                            value={s.nome}
                            onChange={(e) => setS((y) => (y.nome = e.target.value))}
                            aria-label="Nome do setor"
                          />
                          {emUso && <Badge tone="ok">em uso por escala</Badge>}
                          <div className="spacer" />
                          <button
                            className="btn sm ghost danger"
                            disabled={emUso}
                            onClick={() => setU((x) => (x.setores = x.setores.filter((y) => y.id !== s.id)))}
                          >
                            Remover
                          </button>
                        </div>
                        <table className="tbl valores">
                          <thead>
                            <tr>
                              <th>Tipo de período</th>
                              <th>Faturar / hora</th>
                              <th>Pagar / hora</th>
                              <th className="num">Margem</th>
                              <th className="num">Plantão 12h (fat · pag)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {TIPOS_VALOR.map((t) => {
                              const val = s.valores[t.key]
                              const m = val.fat ? ((val.fat - val.pag) / val.fat) * 100 : 0
                              return (
                                <tr key={t.key}>
                                  <td>{t.label}</td>
                                  <td>
                                    <MoneyInput
                                      value={val.fat}
                                      onChange={(n) => setS((y) => (y.valores[t.key].fat = n))}
                                    />
                                  </td>
                                  <td>
                                    <MoneyInput
                                      value={val.pag}
                                      onChange={(n) => setS((y) => (y.valores[t.key].pag = n))}
                                    />
                                  </td>
                                  <td className={`num ${m < 15 ? 'warn-text' : ''}`}>{m.toFixed(1)}%</td>
                                  <td className="num muted">
                                    {brl(val.fat * 12)} · {brl(val.pag * 12)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                  {u.setores.length === 0 && <p className="muted pad">Nenhum setor cadastrado.</p>}
                </div>
              )
            })}
            <p className="muted small">
              Diurno = início entre 07:00 e 18:59. Fim de semana/feriado considera a data de início do plantão.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
