import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import Contratos from './pages/Contratos'
import Escalas from './pages/Escalas'
import NovaEscala from './pages/NovaEscala'
import EscalaDetalhe from './pages/EscalaDetalhe'
import Medicos from './pages/Medicos'

const parseHash = () => {
  const [page = 'escalas', id] = window.location.hash.replace(/^#\/?/, '').split('/')
  return { page: page || 'escalas', id }
}

const NAV = [
  { key: 'contratos', label: 'Contratos (CR)', icon: '▤' },
  { key: 'escalas', label: 'Escalas', icon: '▦' },
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

  const go = (r) => {
    window.location.hash = `/${r.page}${r.id ? '/' + r.id : ''}`
    setMenu(false)
    window.scrollTo(0, 0)
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
        {route.page === 'nova' && <NovaEscala go={go} />}
        {route.page === 'escala' && <EscalaDetalhe key={route.id} id={route.id} go={go} />}
        {route.page === 'medicos' && <Medicos go={go} />}
      </div>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </div>
  )
}
