import { useState } from 'react'
import { useStore } from '../lib/store'
import { Field } from '../components/ui'
import { uid } from '../lib/utils'

export default function Medicos() {
  const { db, update, notify } = useStore()
  const [f, setF] = useState({ nome: '', crm: '', especialidade: '' })
  const [q, setQ] = useState('')

  const add = (e) => {
    e.preventDefault()
    if (!f.nome.trim()) return
    update((d) => d.medicos.push({ id: uid('m'), ...f }))
    setF({ nome: '', crm: '', especialidade: '' })
    notify('Médico cadastrado')
  }

  const lista = db.medicos.filter((m) =>
    `${m.nome} ${m.crm} ${m.especialidade}`.toLowerCase().includes(q.toLowerCase()),
  )

  const escalasDo = (id) =>
    db.escalas.filter((e) => e.alocacoes.some((a) => a.medicoId === id)).map((e) => e.nome)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Cadastro</p>
          <h1>Médicos</h1>
          <p className="muted">Base usada para alocar profissionais nas escalas.</p>
        </div>
      </header>

      <form className="card grid-form" onSubmit={add}>
        <Field label="Nome">
          <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required />
        </Field>
        <Field label="CRM">
          <input value={f.crm} onChange={(e) => setF({ ...f, crm: e.target.value })} placeholder="CRM/UF 00000" />
        </Field>
        <Field label="Especialidade">
          <input value={f.especialidade} onChange={(e) => setF({ ...f, especialidade: e.target.value })} />
        </Field>
        <div className="form-actions span-3">
          <button className="btn primary">Cadastrar médico</button>
        </div>
      </form>

      <div className="card">
        <div className="card-head">
          <h2>{db.medicos.length} médicos</h2>
          <input className="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CRM</th>
              <th>Especialidade</th>
              <th>Escalas</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.nome}</strong>
                </td>
                <td>{m.crm}</td>
                <td>{m.especialidade}</td>
                <td className="muted">{escalasDo(m.id).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
