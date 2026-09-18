import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { ToastProvider, Icone, useToast } from './ui'
import Login, { Convite } from './Login'
import Atletas from './Atletas'
import Rodada from './Rodada'
import Ranking from './Ranking'
import Mensagens from './Mensagens'
import * as db from './lib/dados'

const ESCUDO = import.meta.env.BASE_URL + 'escudo.png'

// código de convite vindo do link: .../condores/#/convite/CODIGO
function conviteDaUrl() {
  const m = location.hash.match(/#\/convite\/([^/?#]+)/i)
  return m ? decodeURIComponent(m[1]).toUpperCase() : ''
}

function Shell() {
  const toast = useToast()
  const [sessao, setSessao] = useState(undefined) // undefined = ainda não sei
  const [perfil, setPerfil] = useState(null)
  const [tela, setTela] = useState('atletas')
  const [msgTipo, setMsgTipo] = useState('lista')
  const [atletas, setAtletas] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregarPerfil = useCallback(async () => {
    try {
      const p = await db.meuPerfil()
      // se acabou de se cadastrar pelo convite, libera automaticamente
      if (p && !p.liberado) {
        const salvo = JSON.parse(localStorage.getItem('cond_convite') || 'null')
        if (salvo?.codigo && salvo?.nome) {
          const { error } = await supabase.rpc('cond_aceitar_convite', { p_codigo: salvo.codigo, p_nome: salvo.nome })
          if (!error) { localStorage.removeItem('cond_convite'); return setPerfil(await db.meuPerfil()) }
        }
      }
      setPerfil(p)
    } catch (e) { toast(e.message) }
  }, [])

  const recarregarAtletas = useCallback(async () => {
    try { setAtletas(await db.listarAtletas()) } catch (e) { toast(e.message) }
  }, [])

  useEffect(() => { if (sessao) carregarPerfil(); else setPerfil(null) }, [sessao])
  useEffect(() => { if (perfil?.liberado) recarregarAtletas() }, [perfil])

  if (sessao === undefined) return <div className="app" />
  if (!sessao) return <div className="app"><Login conviteInicial={conviteDaUrl()} /></div>
  if (!perfil) return <div className="app" />
  if (!perfil.liberado) return <div className="app"><Convite email={perfil.email} onLiberado={carregarPerfil} onSair={() => supabase.auth.signOut()} /></div>

  const irParaMsg = (t) => { setMsgTipo(t); setTela('msg') }
  const abas = [['atletas', 'Atletas'], ['rodada', 'Rodada'], ['ranking', 'Ranking'], ['msg', 'WhatsApp']]

  return (
    <div className="app">
      <header>
        <img src={ESCUDO} alt="Condores" />
        <h1>CONDORES<small>Segundas · 20h–21h · Radar</small></h1>
        <div className="usr">logado como<b>{perfil.nome}</b><a href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut() }} style={{ color: 'var(--mudo)' }}>sair</a></div>
      </header>
      <main>
        {tela === 'atletas' && <Atletas atletas={atletas} recarregar={recarregarAtletas} />}
        {tela === 'rodada' && <Rodada atletas={atletas} irParaMsg={irParaMsg} irParaRanking={() => setTela('ranking')} />}
        {tela === 'ranking' && <Ranking atletas={atletas} meuNome={perfil.nome} irParaMsg={irParaMsg} />}
        {tela === 'msg' && <Mensagens atletas={atletas} tipoInicial={msgTipo} />}
      </main>
      <nav>
        {abas.map(([k, nome]) => (
          <button key={k} className={tela === k ? 'on' : ''} onClick={() => setTela(k)}>{Icone[k]}{nome}</button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return <ToastProvider><Shell /></ToastProvider>
}
