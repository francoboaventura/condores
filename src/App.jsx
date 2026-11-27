import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { ToastProvider, Icone, useToast } from './ui'
import Login, { SemAcesso } from './Login'
import Atletas from './Atletas'
import Rodada from './Rodada'
import Ranking from './Ranking'
import Mensagens from './Mensagens'
import Votacao from './Votacao'
import VotacaoResultado from './VotacaoResultado'
import PrimeiroAcesso from './PrimeiroAcesso'
import VotoPopup from './VotoPopup'
import * as db from './lib/dados'

const ESCUDO = import.meta.env.BASE_URL + 'escudo.png'

// token de convite vindo do link: .../condores/#/convite/TOKEN
function tokenDaUrl() {
  const m = location.hash.match(/#\/convite\/([^/?#]+)/i)
  return m ? decodeURIComponent(m[1]) : ''
}

function Shell() {
  const toast = useToast()
  const [sessao, setSessao] = useState(undefined) // undefined = ainda não sei
  const [perfil, setPerfil] = useState(null)
  const [tela, setTela] = useState('atletas')
  const [msgTipo, setMsgTipo] = useState('lista')
  const [origem, setOrigem] = useState(null)      // de onde a pessoa veio para a tela de Mensagens
  const [rodadaPasso, setRodadaPasso] = useState(1)
  const [atletas, setAtletas] = useState([])
  const [atletasOk, setAtletasOk] = useState(false)  // lista já carregada (para decidir o primeiro acesso)
  const [voto, setVoto] = useState(false)            // pop-up da votação aberto
  const [temporada, setTemporada] = useState(null)   // última temporada encerrada (destaque do campeão)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregarPerfil = useCallback(async () => {
    try {
      // convite pendente (da URL ou guardado no cadastro): aplica agora que há sessão
      const token = tokenDaUrl() || localStorage.getItem('cond_convite_token')
      if (token) {
        const { error } = await supabase.rpc('cond_usar_convite', { p_token: token })
        if (!error) { localStorage.removeItem('cond_convite_token'); history.replaceState(null, '', location.pathname); toast('Acesso liberado!') }
        else if (!/já foi usado/.test(error.message)) toast(error.message)
        else { localStorage.removeItem('cond_convite_token'); history.replaceState(null, '', location.pathname) }
      }
      setPerfil(await db.meuPerfil())
    } catch (e) { toast(e.message) }
  }, [])

  const recarregarAtletas = useCallback(async () => {
    try { setAtletas(await db.listarAtletas()); setAtletasOk(true) } catch (e) { toast(e.message) }
  }, [])

  const recarregarTemporadas = useCallback(async () => {
    try { const ts = await db.listarTemporadas(); setTemporada(ts[0] || null) } catch { /* sem temporada encerrada */ }
  }, [])

  useEffect(() => { if (sessao) carregarPerfil(); else { setPerfil(null); setAtletasOk(false); setVoto(false) } }, [sessao])
  useEffect(() => { if (perfil?.liberado) { recarregarAtletas(); recarregarTemporadas() } }, [perfil])
  // votação: abre o pop-up para quem tem ficha de atleta, já passou pelo primeiro acesso e ainda não votou
  useEffect(() => {
    if (!perfil?.atleta_id || !atletasOk) return
    const eu = atletas.find((a) => a.id === perfil.atleta_id)
    if (perfil.papel === 'atleta' && (perfil.trocar_senha || !eu?.cadastro_ok_em)) return
    db.jaVotei(perfil.atleta_id).then((j) => setVoto(!j)).catch(() => {})
  }, [perfil, atletasOk])
  // ao trocar de tela, volta para o topo (senão a pessoa cai no meio da página)
  useEffect(() => { window.scrollTo(0, 0) }, [tela])

  if (sessao === undefined) return <div className="app" />
  if (!sessao) return <div className="app"><Login token={tokenDaUrl()} /></div>
  if (!perfil) return <div className="app" />
  if (!perfil.liberado) return <div className="app"><SemAcesso email={perfil.email} onSair={() => supabase.auth.signOut()} /></div>
  if (!atletasOk) return <div className="app" />

  // primeiro acesso do atleta: senha própria + dados; depois, o pop-up da votação
  const meuAtleta = atletas.find((a) => a.id === perfil.atleta_id)
  if (perfil.papel === 'atleta' && meuAtleta && (perfil.trocar_senha || !meuAtleta.cadastro_ok_em)) {
    const pronto = async () => { await recarregarAtletas(); setPerfil(await db.meuPerfil()) }
    return <div className="app"><PrimeiroAcesso atleta={meuAtleta} trocarSenha={perfil.trocar_senha} onPronto={pronto} onSair={() => supabase.auth.signOut()} /></div>
  }

  const irParaMsg = (t, de) => { setMsgTipo(t); if (de) { setOrigem(de); if (de.passo) setRodadaPasso(de.passo) } else setOrigem(null); setTela('msg') }
  const voltar = () => { if (!origem) return; setTela(origem.tela); setOrigem(null) }
  const trocarTela = (k) => { setTela(k); if (k !== 'msg') setOrigem(null) }
  // por enquanto o ranking fica só para a diretoria
  const abas = perfil.diretor
    ? [['atletas', 'Atletas'], ['rodada', 'Rodada'], ['ranking', 'Ranking'], ['msg', 'WhatsApp'], ['votacao', 'Votação']]
    : [['atletas', 'Atletas'], ['rodada', 'Rodada'], ['msg', 'WhatsApp']]

  return (
    <div className="app">
      <header>
        <img src={ESCUDO} alt="Condores" />
        <h1>CONDORES<small>Segundas · 20h–21h · Radar</small></h1>
        <div className="usr">{perfil.diretor ? 'diretoria' : 'atleta'}<b>{perfil.nome}</b><a href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut() }} style={{ color: 'var(--mudo)' }}>sair</a></div>
      </header>
      <main>
        {tela === 'atletas' && <Atletas atletas={atletas} recarregar={recarregarAtletas} diretor={perfil.diretor} temporada={temporada} verRanking={perfil.diretor ? () => setTela('ranking') : null} />}
        {tela === 'rodada' && <Rodada atletas={atletas} diretor={perfil.diretor} meuAtletaId={perfil.atleta_id} passoInicial={rodadaPasso} onPasso={setRodadaPasso} irParaMsg={irParaMsg} irParaRanking={() => setTela('ranking')} />}
        {tela === 'ranking' && perfil.diretor && <Ranking atletas={atletas} meuNome={perfil.nome} diretor={perfil.diretor} irParaMsg={irParaMsg} aoMudarTemporadas={recarregarTemporadas} />}
        {tela === 'msg' && <Mensagens atletas={atletas} tipoInicial={msgTipo} origem={origem} onVoltar={voltar} diretor={perfil.diretor} />}
        {tela === 'votacao' && perfil.diretor && <VotacaoResultado />}
      </main>
      {voto && <VotoPopup atletas={atletas} meuAtletaId={perfil.atleta_id} onFechar={() => setVoto(false)} />}
      <nav>
        {abas.map(([k, nome]) => (
          <button key={k} className={tela === k ? 'on' : ''} onClick={() => trocarTela(k)}>{Icone[k]}{nome}</button>
        ))}
      </nav>
    </div>
  )
}

// votação pública (sem login): .../condores/#/votacao
const ehVotacao = () => /^#\/votacao\b/i.test(location.hash) || /\/votacao\/?$/i.test(location.pathname)

export default function App() {
  const [votacao, setVotacao] = useState(ehVotacao())
  useEffect(() => {
    const f = () => setVotacao(ehVotacao())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return <ToastProvider>{votacao ? <Votacao /> : <Shell />}</ToastProvider>
}
