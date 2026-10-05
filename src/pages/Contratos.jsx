import { useState } from 'react'
import { useStore } from '../lib/store'
import { Field, MoneyInput, Empty, Badge } from '../components/ui'
import { TIPOS_VALOR, brl, fmtDate, uid } from '../lib/utils'
import { UFS, cidadesDe } from '../lib/cidades'
import { can } from '../lib/perms'

const valoresVazios = () => Object.fromEntries(TIPOS_VALOR.map((t) => [t.key, { fat: 0, pag: 0 }]))
const CAMPOS_CR = ['codigo', 'cliente', 'objeto', 'vigenciaInicio', 'vigenciaFim']
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Aceita "-26.9078, -48.6619" (formato copiado do Google Maps) */
const parseCoords = (txt) => {
  const m = String(txt).match(/(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)/)
  if (!m) return null
  const lat = Number(m[1].replace(',', '.'))
  const lng = Number(m[2].replace(',', '.'))
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export default function Contratos() {
  const { db, update, notify, user } = useStore()
  const editavel = can(user, 'contratos.editar')
  const [selId, setSelId] = useState(db.contratos[0]?.id)
  const crDb = db.contratos.find((c) => c.id === selId)
  const [draft, setDraft] = useState(() => (crDb ? structuredClone(crDb) : null))
  const [colar, setColar] = useState({})

  const selecionar = (id) => {
    setSelId(id)
    const c = db.contratos.find((x) => x.id === id)
    setDraft(c ? structuredClone(c) : null)
  }

  const novoCR = () => {
    const id = uid('cr')
    const novo = { id, codigo: `CR ${1000 + db.contratos.length + 60}`, cliente: 'Novo cliente', objeto: '', vigenciaInicio: '', vigenciaFim: '', unidades: [] }
    update((d) => {
      d.contratos.push(structuredClone(novo))
    })
    setSelId(id)
    setDraft(novo)
    notify('Contrato criado. Preencha os dados e cadastre as unidades.')
  }

  const setD = (fn) =>
    setDraft((prev) => {
      const n = structuredClone(prev)
      fn(n)
      return n
    })

  const dadosAlterados = draft && crDb && CAMPOS_CR.some((k) => draft[k] !== crDb[k])
  const unidadeAlterada = (u) => !igual(u, crDb?.unidades.find((x) => x.id === u.id))
  const unidadeNova = (u) => !crDb?.unidades.some((x) => x.id === u.id)
  const pendentes = draft ? draft.unidades.filter(unidadeAlterada).length + (dadosAlterados ? 1 : 0) : 0

  const salvarDados = () => {
    update((d) => {
      const c = d.contratos.find((x) => x.id === selId)
      CAMPOS_CR.forEach((k) => (c[k] = draft[k]))
    })
    notify('Dados do contrato salvos')
  }
  const salvarUnidade = (u) => {
    if (!u.nome.trim() || !u.uf || !u.cidade) {
      notify('Preencha nome, estado e cidade da unidade antes de salvar', 'warn')
      return
    }
    update((d) => {
      const c = d.contratos.find((x) => x.id === selId)
      const i = c.unidades.findIndex((x) => x.id === u.id)
      if (i >= 0) c.unidades[i] = structuredClone(u)
      else c.unidades.push(structuredClone(u))
    })
    notify(`Unidade "${u.nome}" e ${u.setores.length} setor(es) salvos`)
  }
  const descartarUnidade = (u) => {
    const orig = crDb.unidades.find((x) => x.id === u.id)
    setD((c) => {
      if (orig) c.unidades[c.unidades.findIndex((x) => x.id === u.id)] = structuredClone(orig)
      else c.unidades = c.unidades.filter((x) => x.id !== u.id)
    })
  }
  const removerUnidade = (u) => {
    setD((c) => (c.unidades = c.unidades.filter((x) => x.id !== u.id)))
    if (!unidadeNova(u))
      update((d) => {
        const c = d.contratos.find((x) => x.id === selId)
        c.unidades = c.unidades.filter((x) => x.id !== u.id)
      })
    notify('Unidade removida', 'warn')
  }
  const salvarTudo = () => {
    if (draft.unidades.some((u) => !u.nome.trim() || !u.uf || !u.cidade)) {
      notify('Há unidade sem nome, estado ou cidade', 'warn')
      return
    }
    update((d) => {
      const i = d.contratos.findIndex((x) => x.id === selId)
      d.contratos[i] = structuredClone(draft)
    })
    notify('Contrato, unidades e setores salvos')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Módulo CR</p>
          <h1>Contratos</h1>
          <p className="muted">
            Contrato, unidades (com endereço e geolocalização), setores e valores a faturar e a pagar por hora. As escalas puxam esses valores
            automaticamente.
          </p>
        </div>
        {editavel && (
          <button className="btn primary" onClick={novoCR}>
            + Novo contrato
          </button>
        )}
      </header>

      {!editavel && <p className="alert info">Seu perfil pode consultar os contratos, mas não alterá-los.</p>}

      <div className="split">
        <aside className="list-col">
          {db.contratos.map((c) => {
            const nSet = c.unidades.reduce((n, u) => n + u.setores.length, 0)
            const nEsc = db.escalas.filter((e) => e.crId === c.id).length
            return (
              <button key={c.id} className={`list-item ${c.id === selId ? 'on' : ''}`} onClick={() => selecionar(c.id)}>
                <strong>{c.codigo}</strong>
                <span>{c.cliente}</span>
                <small className="muted">
                  {c.unidades.length} unid. · {nSet} setores · {nEsc} escalas
                </small>
              </button>
            )
          })}
        </aside>

        {!draft ? (
          <Empty title="Nenhum contrato selecionado" />
        ) : (
          <fieldset className="detail-col bare" disabled={!editavel}>
            <div className="card">
              <div className="card-head">
                <h2>Dados do contrato</h2>
                <Badge tone="info">
                  {fmtDate(draft.vigenciaInicio)} → {fmtDate(draft.vigenciaFim)}
                </Badge>
              </div>
              <div className="grid-form">
                <Field label="Código do CR">
                  <input id="cr-codigo" value={draft.codigo} onChange={(e) => setD((c) => (c.codigo = e.target.value))} />
                </Field>
                <Field label="Cliente" span={2}>
                  <input id="cr-cliente" value={draft.cliente} onChange={(e) => setD((c) => (c.cliente = e.target.value))} />
                </Field>
                <Field label="Objeto" span={3}>
                  <input id="cr-objeto" value={draft.objeto} onChange={(e) => setD((c) => (c.objeto = e.target.value))} />
                </Field>
                <Field label="Início da vigência">
                  <input id="cr-ini" type="date" value={draft.vigenciaInicio} onChange={(e) => setD((c) => (c.vigenciaInicio = e.target.value))} />
                </Field>
                <Field label="Fim da vigência">
                  <input id="cr-fim" type="date" value={draft.vigenciaFim} onChange={(e) => setD((c) => (c.vigenciaFim = e.target.value))} />
                </Field>
              </div>
              {editavel && (
                <div className="card-foot">
                  {dadosAlterados ? <Badge tone="warn">Não salvo</Badge> : <Badge tone="ok">Salvo</Badge>}
                  <div className="spacer" />
                  <button className="btn primary" disabled={!dadosAlterados} onClick={salvarDados}>
                    Salvar dados do contrato
                  </button>
                </div>
              )}
            </div>

            <div className="section-head">
              <h2>Unidades e setores</h2>
              {editavel && (
                <button
                  className="btn"
                  onClick={() =>
                    setD((c) =>
                      c.unidades.push({
                        id: uid('u'),
                        nome: '',
                        uf: '',
                        cidade: '',
                        endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '' },
                        geo: { lat: '', lng: '' },
                        setores: [],
                      }),
                    )
                  }
                >
                  + Unidade
                </button>
              )}
            </div>

            {draft.unidades.length === 0 && <Empty title="Sem unidades">Cadastre as unidades atendidas por este contrato.</Empty>}

            {draft.unidades.map((u) => {
              const setU = (fn) => setD((c) => fn(c.unidades.find((x) => x.id === u.id)))
              const emUsoU = db.escalas.some((e) => e.unidadeId === u.id)
              const alterada = unidadeAlterada(u)
              const temGeo = u.geo?.lat !== '' && u.geo?.lat != null && u.geo?.lng !== '' && u.geo?.lng != null
              return (
                <div className={`card unidade ${alterada ? 'dirty' : ''}`} key={u.id}>
                  <div className="unit-head">
                    <h3>{u.nome || 'Nova unidade'}</h3>
                    {alterada ? <Badge tone="warn">{unidadeNova(u) ? 'Nova · não salva' : 'Alterações não salvas'}</Badge> : <Badge tone="ok">Salva</Badge>}
                    <div className="spacer" />
                    {editavel && (
                      <button
                        className="btn sm ghost danger"
                        disabled={emUsoU}
                        title={emUsoU ? 'Há escalas vinculadas a esta unidade' : 'Remover unidade'}
                        onClick={() => removerUnidade(u)}
                      >
                        Remover unidade
                      </button>
                    )}
                  </div>

                  <div className="grid-form g4">
                    <Field label="Nome da unidade" span={2}>
                      <input value={u.nome} placeholder="Ex.: Pronto Atendimento Central" onChange={(e) => setU((x) => (x.nome = e.target.value))} />
                    </Field>
                    <Field label="Estado (UF)">
                      <select
                        value={u.uf || ''}
                        onChange={(e) =>
                          setU((x) => {
                            x.uf = e.target.value
                            x.cidade = ''
                          })
                        }
                      >
                        <option value="">Selecione o estado…</option>
                        {Object.entries(UFS)
                          .sort((a, b) => a[1].localeCompare(b[1]))
                          .map(([sigla, nome]) => (
                            <option key={sigla} value={sigla}>
                              {nome} ({sigla})
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Cidade" hint={u.uf ? `${cidadesDe(u.uf).length} municípios` : 'Escolha o estado primeiro'}>
                      <select value={u.cidade || ''} disabled={!u.uf} onChange={(e) => setU((x) => (x.cidade = e.target.value))}>
                        <option value="">{u.uf ? 'Selecione a cidade…' : '—'}</option>
                        {cidadesDe(u.uf).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="subsec">
                    <h4>Endereço completo</h4>
                    <div className="grid-form g4">
                      <Field label="CEP">
                        <input value={u.endereco?.cep || ''} placeholder="00000-000" onChange={(e) => setU((x) => (x.endereco = { ...x.endereco, cep: e.target.value }))} />
                      </Field>
                      <Field label="Logradouro" span={2}>
                        <input value={u.endereco?.logradouro || ''} placeholder="Rua, avenida…" onChange={(e) => setU((x) => (x.endereco = { ...x.endereco, logradouro: e.target.value }))} />
                      </Field>
                      <Field label="Número">
                        <input value={u.endereco?.numero || ''} onChange={(e) => setU((x) => (x.endereco = { ...x.endereco, numero: e.target.value }))} />
                      </Field>
                      <Field label="Complemento" span={2}>
                        <input value={u.endereco?.complemento || ''} placeholder="Bloco, andar, entrada…" onChange={(e) => setU((x) => (x.endereco = { ...x.endereco, complemento: e.target.value }))} />
                      </Field>
                      <Field label="Bairro" span={2}>
                        <input value={u.endereco?.bairro || ''} onChange={(e) => setU((x) => (x.endereco = { ...x.endereco, bairro: e.target.value }))} />
                      </Field>
                    </div>
                  </div>

                  <div className="subsec">
                    <h4>Geolocalização</h4>
                    <p className="muted small">
                      Ponto de referência do check-in por geolocalização. No Google Maps, clique com o botão direito sobre a entrada da unidade e copie as
                      coordenadas.
                    </p>
                    <div className="grid-form g4">
                      <Field label="Colar coordenadas" span={2} hint="Ex.: -26.9078, -48.6619">
                        <div className="inline-input">
                          <input value={colar[u.id] || ''} placeholder="latitude, longitude" onChange={(e) => setColar((c) => ({ ...c, [u.id]: e.target.value }))} />
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => {
                              const p = parseCoords(colar[u.id])
                              if (!p) return notify('Não reconheci as coordenadas. Use o formato "latitude, longitude".', 'warn')
                              setU((x) => (x.geo = p))
                              setColar((c) => ({ ...c, [u.id]: '' }))
                            }}
                          >
                            Aplicar
                          </button>
                        </div>
                      </Field>
                      <Field label="Latitude">
                        <input type="number" step="0.000001" value={u.geo?.lat ?? ''} onChange={(e) => setU((x) => (x.geo = { ...x.geo, lat: e.target.value === '' ? '' : Number(e.target.value) }))} />
                      </Field>
                      <Field label="Longitude">
                        <input type="number" step="0.000001" value={u.geo?.lng ?? ''} onChange={(e) => setU((x) => (x.geo = { ...x.geo, lng: e.target.value === '' ? '' : Number(e.target.value) }))} />
                      </Field>
                    </div>
                    {temGeo && (
                      <a className="link small" href={`https://www.google.com/maps?q=${u.geo.lat},${u.geo.lng}`} target="_blank" rel="noreferrer">
                        Conferir ponto no mapa ↗
                      </a>
                    )}
                  </div>

                  <div className="subsec">
                    <div className="section-head">
                      <h4>Setores</h4>
                      {editavel && (
                        <button className="btn sm" onClick={() => setU((x) => x.setores.push({ id: uid('s'), nome: 'Novo setor', valores: valoresVazios() }))}>
                          + Setor
                        </button>
                      )}
                    </div>
                    {u.setores.map((s) => {
                      const setS = (fn) => setU((x) => fn(x.setores.find((y) => y.id === s.id)))
                      const emUso = db.escalas.some((e) => e.setorId === s.id)
                      return (
                        <div className="setor" key={s.id}>
                          <div className="setor-head">
                            <input className="inline-sub strong" value={s.nome} onChange={(e) => setS((y) => (y.nome = e.target.value))} aria-label="Nome do setor" />
                            {emUso && <Badge tone="ok">em uso por escala</Badge>}
                            <div className="spacer" />
                            {editavel && (
                              <button className="btn sm ghost danger" disabled={emUso} onClick={() => setU((x) => (x.setores = x.setores.filter((y) => y.id !== s.id)))}>
                                Remover
                              </button>
                            )}
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
                                      <MoneyInput value={val.fat} onChange={(n) => setS((y) => (y.valores[t.key].fat = n))} />
                                    </td>
                                    <td>
                                      <MoneyInput value={val.pag} onChange={(n) => setS((y) => (y.valores[t.key].pag = n))} />
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

                  {editavel && (
                    <div className="card-foot">
                      {alterada && (
                        <button className="btn ghost" onClick={() => descartarUnidade(u)}>
                          Descartar alterações
                        </button>
                      )}
                      <div className="spacer" />
                      <button className="btn primary" disabled={!alterada} onClick={() => salvarUnidade(u)}>
                        Salvar unidade e setores
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            <p className="muted small">Diurno = início entre 07:00 e 18:59. Fim de semana/feriado considera a data de início do plantão.</p>

            {editavel && pendentes > 0 && (
              <div className="save-bar">
                <span className="muted">{pendentes} bloco(s) com alterações não salvas</span>
                <button className="btn ghost" onClick={() => selecionar(selId)}>
                  Descartar tudo
                </button>
                <button className="btn primary" onClick={salvarTudo}>
                  Salvar tudo
                </button>
              </div>
            )}
          </fieldset>
        )}
      </div>
    </div>
  )
}
