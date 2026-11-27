import { useEffect, useState } from 'react'
import { useToast } from './ui'
import { ini } from './lib/util'
import * as db from './lib/dados'

const ESCUDO = import.meta.env.BASE_URL + 'escudo.png'

// Tela pública (sem login): .../condores/#/votacao
// Passo 1: quem é você? · Passo 2: em quem vota · Passo 3: obrigado
export default function Votacao() {
  const toast = useToast()
  const [atletas, setAtletas] = useState(null)
  const [passo, setPasso] = useState(1)
  const [eu, setEu] = useState(null)
  const [escolhido, setEscolhido] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')

  async function carregar() {
    try { setAtletas(await db.votacaoAtletas()) } catch (e) { toast(e.message); setAtletas([]) }
  }
  useEffect(() => { carregar() }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [passo])

  function souEu(a) {
    if (a.ja_votou) return
    setAviso(''); setEu(a); setEscolhido(null); setPasso(2)
  }

  async function confirmar() {
    if (!eu || !escolhido || enviando) return
    setEnviando(true)
    try {
      await db.votar(eu.id, escolhido.id)
      // trava o nome na hora, mesmo antes de a lista recarregar
      setAtletas((l) => l.map((a) => (a.id === eu.id ? { ...a, ja_votou: true } : a)))
      setPasso(3)
    } catch (e) {
      if (e.jaVotou) { setAviso('Esse atleta já votou'); setPasso(1); setEu(null); setEscolhido(null) }
      else toast(e.message)
    } finally {
      setEnviando(false)
      carregar()
    }
  }

  function inicio() { setEu(null); setEscolhido(null); setAviso(''); setPasso(1); carregar() }

  const avatar = (a) => <span className="av camisa">{a.numero ?? ini(a.nome)}</span>

  return (
    <div className="app votacao">
      <header>
        <img src={ESCUDO} alt="Condores" />
        <h1>ATLETA MAIS CONDORES<small>Votação do time</small></h1>
      </header>
      <main>
        {passo === 1 && (
          <section>
            <h2>Quem é você?</h2>
            {aviso && <div className="aviso">{aviso}</div>}
            <p className="dica" style={{ marginTop: 0, marginBottom: 12 }}>Toque no seu nome. Cada atleta vota uma vez só.</p>
            {atletas === null ? <p className="dica">Carregando…</p> : (
              <div className="card lista">
                {atletas.map((a) => (
                  <button key={a.id} className={`item voto-op ${a.ja_votou ? 'votou' : ''}`} disabled={a.ja_votou} onClick={() => souEu(a)}>
                    {avatar(a)}
                    <span className="nome">{a.nome}</span>
                    {a.ja_votou && <span className="tag ok">já votou</span>}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {passo === 2 && eu && (
          <section>
            <div className="migalhas"><button onClick={inicio}>‹ Trocar nome</button><span>›</span><b>{eu.nome}</b></div>
            <h2>Em quem você vota?</h2>
            <p className="dica" style={{ marginTop: 0, marginBottom: 12 }}>Escolha o Atleta Mais Condores e confirme.</p>
            <div className="card lista">
              {atletas.filter((a) => a.id !== eu.id).map((a) => (
                <button key={a.id} className={`item voto-op ${escolhido?.id === a.id ? 'on' : ''}`} onClick={() => setEscolhido(a)}>
                  {avatar(a)}
                  <span className="nome">{a.nome}</span>
                  <span className="marca">{escolhido?.id === a.id ? '✓' : ''}</span>
                </button>
              ))}
            </div>
            <div className="voto-barra">
              <button className="btn" disabled={!escolhido || enviando} onClick={confirmar}>
                {enviando ? 'Enviando…' : escolhido ? `Confirmar voto em ${escolhido.nome}` : 'Escolha um atleta'}
              </button>
            </div>
          </section>
        )}

        {passo === 3 && (
          <section className="voto-fim">
            <div className="tr">🏆</div>
            <h2>Obrigado, {eu?.nome}!</h2>
            <p>Seu voto foi registrado.</p>
            <button className="btn sec" onClick={inicio}>Voltar ao início</button>
          </section>
        )}
      </main>
    </div>
  )
}
