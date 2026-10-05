import { useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, Field } from '../components/ui'
import { PERFIS, perfilLabel } from '../lib/perms'
import { uid } from '../lib/utils'

export default function Usuarios() {
  const { db, update, notify, user } = useStore()
  const vazio = { nome: '', email: '', perfil: 'visualizador', medicoId: '' }
  const [f, setF] = useState(vazio)
  const medicosSemUsuario = db.medicos.filter((m) => !db.usuarios.some((u) => u.medicoId === m.id))
  const valido = f.nome.trim() && /\S+@\S+\.\S+/.test(f.email) && (f.perfil !== 'medico' || f.medicoId)

  const criar = (e) => {
    e.preventDefault()
    if (!valido) return
    update((d) => {
      d.usuarios.push({ id: uid('u'), nome: f.nome.trim(), email: f.email.trim(), perfil: f.perfil, ...(f.perfil === 'medico' ? { medicoId: f.medicoId } : {}), ativo: true })
    })
    notify(`Usuário ${f.nome} criado com perfil ${perfilLabel(f.perfil)}`)
    setF(vazio)
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Usuários e perfis</h1>
          <p className="muted">Crie acessos de visualização, escalista, faturamento e médico. No protótipo não há senha: use “Acessando como” na barra lateral para testar cada perfil.</p>
        </div>
      </header>

      <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {PERFIS.map((p) => (
          <div className="card" key={p.key} style={{ padding: 14 }}>
            <b>{p.label}</b>
            <p className="muted small" style={{ marginTop: 4 }}>
              {p.desc}
            </p>
            <p className="small" style={{ marginTop: 8 }}>
              {db.usuarios.filter((u) => u.perfil === p.key).length} usuário(s)
            </p>
          </div>
        ))}
      </div>

      <form className="card" onSubmit={criar}>
        <h2>Novo usuário</h2>
        <div className="grid-form g4">
          <Field label="Nome">
            <input id="us-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <input id="us-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Perfil">
            <select id="us-perfil" value={f.perfil} onChange={(e) => setF({ ...f, perfil: e.target.value })}>
              {PERFIS.filter((p) => p.key !== 'admin').map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
              <option value="admin">Administrador</option>
            </select>
          </Field>
          {f.perfil === 'medico' ? (
            <Field label="Médico vinculado" hint="Cadastro do médico usado nas escalas">
              <select id="us-medico" value={f.medicoId} onChange={(e) => setF({ ...f, medicoId: e.target.value })}>
                <option value="">Selecione…</option>
                {medicosSemUsuario.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div />
          )}
        </div>
        <div className="card-foot">
          <span className="muted small">{PERFIS.find((p) => p.key === f.perfil)?.desc}</span>
          <div className="spacer" />
          <button className="btn primary" disabled={!valido}>
            Criar usuário
          </button>
        </div>
      </form>

      <div className="card">
        <h2>{db.usuarios.length} usuários</h2>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {db.usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.nome}</b>
                    {u.medicoId && <div className="muted small">{db.medicos.find((m) => m.id === u.medicoId)?.crm}</div>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      aria-label={`Perfil de ${u.nome}`}
                      value={u.perfil}
                      disabled={u.id === user.id || u.perfil === 'medico'}
                      onChange={(e) =>
                        update((d) => {
                          d.usuarios.find((x) => x.id === u.id).perfil = e.target.value
                        })
                      }
                      style={{ width: 'auto' }}
                    >
                      {PERFIS.filter((p) => p.key !== 'medico' || u.perfil === 'medico').map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{u.ativo ? <Badge tone="ok">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                  <td className="num">
                    {u.id !== user.id && (
                      <button
                        className="btn sm ghost"
                        onClick={() =>
                          update((d) => {
                            const x = d.usuarios.find((y) => y.id === u.id)
                            x.ativo = !x.ativo
                          })
                        }
                      >
                        {u.ativo ? 'Desativar' : 'Reativar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
