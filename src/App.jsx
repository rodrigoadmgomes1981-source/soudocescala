import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import Contratos from './pages/Contratos'
import Escalas from './pages/Escalas'
import NovaEscala from './pages/NovaEscala'
import EscalaDetalhe from './pages/EscalaDetalhe'
import Medicos from './pages/Medicos'
import VagasAnunciadas from './pages/VagasAnunciadas'
import Furos from './pages/Furos'

const parseHash = () => {
  try {
    const [page = 'escalas', id, semana] = window.location.hash.replace(/^#\/?/, '').split('/')
    return { page: page || 'escalas', id, semana }
  } catch {
    return { page: 'escalas' }
  }
}

const NAV = [
  { key: 'contratos', label: 'Contratos (CR)', icon: '▤' },
  { key: 'escalas', label: 'Escalas', icon: '▦' },
  { key: 'vagas', label: 'Vagas anunciadas', icon: '◎' },
  { key: 'furos', label: 'Furos de escala', icon: '△' },
  { key: 'medicos', label: 'Médicos', icon: '◉' },
]

export default function App() {
  const { toast, reset, notify } = useStore()
  const [route, setRoute] = useState(parseHash)
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    const h = () => setRoute(parseHash())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  // Navegação por estado; o hash é só um espelho (o ambiente de prévia pode bloquear alterações de URL)
  const go = (r) => {
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

  const ativo = ['nova', 'escala'].includes(route.page) ? 'escalas' : route.page

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
          {NAV.map((n) => (
            <button key={n.key} className={ativo === n.key ? 'on' : ''} onClick={() => go({ page: n.key })}>
              <span className="nav-ic">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="flow">
          <p className="eyebrow">Fluxo</p>
          <ol>
            <li>Lançar contrato, unidades, setores e valores no CR</li>
            <li>Criar escala: local, regras e períodos</li>
            <li>Inserir médicos (fixo ou avulso)</li>
            <li>Definir vigência e publicar</li>
            <li>Acompanhar vagas anunciadas e furos</li>
          </ol>
        </div>
        <button
          className="btn sm ghost reset"
          onClick={() => {
            reset()
            notify('Dados de demonstração restaurados')
            go({ page: 'escalas' })
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
        </div>
        {route.page === 'contratos' && <Contratos go={go} />}
        {route.page === 'escalas' && <Escalas go={go} />}
        {route.page === 'nova' && <NovaEscala key={route.id || 'nova'} id={route.id} go={go} />}
        {route.page === 'escala' && <EscalaDetalhe key={route.id + (route.semana || '')} id={route.id} semanaInicial={route.semana} go={go} />}
        {route.page === 'medicos' && <Medicos go={go} />}
        {route.page === 'vagas' && <VagasAnunciadas go={go} />}
        {route.page === 'furos' && <Furos go={go} />}
      </div>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
