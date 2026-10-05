import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import { can, perfilLabel } from './lib/perms'
import Contratos from './pages/Contratos'
import Escalas from './pages/Escalas'
import NovaEscala from './pages/NovaEscala'
import EscalaDetalhe from './pages/EscalaDetalhe'
import Medicos from './pages/Medicos'
import VagasAnunciadas from './pages/VagasAnunciadas'
import Furos from './pages/Furos'
import Apuracao from './pages/Apuracao'
import Antecipacoes from './pages/Antecipacoes'
import Solicitacoes from './pages/Solicitacoes'
import Usuarios from './pages/Usuarios'
import Agenda from './pages/medico/Agenda'
import Horas from './pages/medico/Horas'
import FinanceiroMedico from './pages/medico/Financeiro'
import ChatDrawer from './components/Chat'

const parseHash = () => {
  try {
    const [page, id, semana] = window.location.hash.replace(/^#\/?/, '').split('/')
    return { page: page || '', id, semana }
  } catch {
    return { page: '' }
  }
}

/** Menu por perfil. perm = permissão exigida */
const MENU = [
  { sec: 'Médico', key: 'agenda', label: 'Minha agenda', icon: '◷', perm: 'medico' },
  { key: 'horas', label: 'Minhas horas', icon: '◔', perm: 'medico' },
  { key: 'meu-financeiro', label: 'Meu financeiro', icon: '$', perm: 'medico' },
  { key: 'escalas', label: 'Minhas escalas', icon: '▦', perm: 'medico' },
  { key: 'mensagens', label: 'Falar com a central', icon: '✉', perm: 'medico' },

  { sec: 'Gestão', key: 'contratos', label: 'Contratos (CR)', icon: '▤', perm: 'contratos.ver' },
  { key: 'escalas', label: 'Escalas', icon: '▦', perm: 'escalas.ver' },
  { key: 'vagas', label: 'Vagas anunciadas', icon: '◎', perm: 'vagas' },
  { key: 'furos', label: 'Furos de escala', icon: '△', perm: 'furos' },
  { key: 'solicitacoes', label: 'Solicitações', icon: '⇄', perm: 'solicitacoes', count: 'sol' },
  { sec: 'Faturamento', key: 'apuracao', label: 'Apuração', icon: '✓', perm: 'apuracao' },
  { key: 'antecipacoes', label: 'Antecipações', icon: '»', perm: 'antecipacoes', count: 'ant' },
  { sec: 'Cadastros', key: 'medicos', label: 'Médicos', icon: '◉', perm: 'medicos' },
  { key: 'usuarios', label: 'Usuários e perfis', icon: '☰', perm: 'usuarios' },
]

const paginaInicial = (user) => (user?.perfil === 'medico' ? 'agenda' : 'escalas')

export default function App() {
  const { db, toast, reset, notify, user, setUsuario, chat, abrirChat } = useStore()
  const [route, setRoute] = useState(() => {
    const r = parseHash()
    return r.page ? r : { page: paginaInicial(user) }
  })
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    const h = () => {
      const r = parseHash()
      if (r.page) setRoute(r)
    }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  // Navegação por estado; o hash é só um espelho (a prévia pode bloquear alterações de URL)
  const go = (r) => {
    if (r.page === 'mensagens') {
      abrirChat({ medicoId: user.medicoId, comoMedico: true })
      setMenu(false)
      return
    }
    setRoute(r)
    setMenu(false)
    try {
      window.history.replaceState(null, '', `#/${r.page}${r.id ? '/' + r.id : ''}${r.semana ? '/' + r.semana : ''}`)
    } catch {
      /* ignore */
    }
    try {
      window.scrollTo(0, 0)
    } catch {
      /* ignore */
    }
  }

  const itens = MENU.filter((m) => can(user, m.perm))
  const visivel = (page) => itens.some((m) => m.key === page) || (page === 'nova' && can(user, 'escalas.editar')) || (page === 'escala' && (can(user, 'escalas.ver') || can(user, 'medico')))
  const page = visivel(route.page) ? route.page : paginaInicial(user)
  const ativo = ['nova', 'escala'].includes(page) ? 'escalas' : page
  const contagem = {
    sol: (db.solicitacoes || []).filter((s) => s.status === 'pendente').length,
    ant: (db.antecipacoes || []).filter((a) => a.status === 'pendente').length,
  }
  let ultimaSec = null

  return (
    <div className="app">
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <div className="brand">
          <span className="logo">S</span>
          <div>
            <b>Sou DOC</b>
            <small>Gestão de escalas</small>
          </div>
        </div>
        <nav>
          {itens.map((n) => {
            const sec = n.sec || ultimaSec
            const mostrarSec = n.sec && n.sec !== ultimaSec
            ultimaSec = sec
            return (
              <div key={n.key + n.label}>
                {mostrarSec && itens.filter((x) => x.sec).length > 1 && <div className="nav-sec">{n.sec}</div>}
                <button className={ativo === n.key ? 'on' : ''} onClick={() => go({ page: n.key })}>
                  <span className="nav-ic">{n.icon}</span>
                  {n.label}
                  {n.count && contagem[n.count] > 0 && <span className="nav-count">{contagem[n.count]}</span>}
                </button>
              </div>
            )
          })}
        </nav>

        <div className="user-switch">
          <label htmlFor="user-switch">Acessando como</label>
          <select
            id="user-switch"
            value={user?.id}
            onChange={(e) => {
              const u = db.usuarios.find((x) => x.id === e.target.value)
              setUsuario(e.target.value)
              abrirChat(null)
              go({ page: paginaInicial(u) })
              notify(`Agora você está como ${u.nome} (${perfilLabel(u.perfil)})`)
            }}
          >
            {db.usuarios
              .filter((u) => u.ativo)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} · {perfilLabel(u.perfil)}
                </option>
              ))}
          </select>
          <small>Troca de perfil apenas para testar o protótipo.</small>
        </div>

        <button
          className="btn sm ghost reset"
          onClick={() => {
            reset()
            abrirChat(null)
            notify('Dados de demonstração restaurados')
            setRoute({ page: 'escalas' })
          }}
        >
          Restaurar dados de demonstração
        </button>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setMenu(!menu)} aria-label="Menu">
            ☰
          </button>
          <b>Sou DOC · Escalas</b>
          <span className="muted small" style={{ marginLeft: 'auto' }}>
            {user?.nome.split(' ')[0]} · {perfilLabel(user?.perfil)}
          </span>
        </div>
        {page === 'contratos' && <Contratos go={go} />}
        {page === 'escalas' && <Escalas go={go} />}
        {page === 'nova' && <NovaEscala key={route.id || 'nova'} id={route.id} go={go} />}
        {page === 'escala' && <EscalaDetalhe key={route.id + (route.semana || '') + user?.id} id={route.id} semanaInicial={route.semana} go={go} />}
        {page === 'medicos' && <Medicos go={go} />}
        {page === 'vagas' && <VagasAnunciadas go={go} />}
        {page === 'furos' && <Furos go={go} />}
        {page === 'apuracao' && <Apuracao go={go} />}
        {page === 'antecipacoes' && <Antecipacoes go={go} />}
        {page === 'solicitacoes' && <Solicitacoes go={go} />}
        {page === 'usuarios' && <Usuarios go={go} />}
        {page === 'agenda' && <Agenda go={go} />}
        {page === 'horas' && <Horas go={go} />}
        {page === 'meu-financeiro' && <FinanceiroMedico go={go} />}
      </div>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      {chat && <ChatDrawer chat={chat} comoMedico={!!chat.comoMedico} onClose={() => abrirChat(null)} />}
      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
