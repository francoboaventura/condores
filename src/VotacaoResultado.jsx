import { useEffect, useState } from 'react'
import { useToast } from './ui'
import * as db from './lib/dados'
import { URL_APP } from './lib/util'

// Resultado da votação "Atleta Mais Condores" (só diretoria)
export default function VotacaoResultado() {
  const toast = useToast()
  const [r, setR] = useState(null)
  const [senha, setSenha] = useState('')
  const texto = `🦅 *CONDORES — o app está liberado!*\n\nEntre em ${URL_APP}\n\n1. Escolha o seu nome\n2. Senha: *${senha || '…'}*\n3. Crie a sua senha e confira seus dados\n4. Vote no 🏆 *Atleta Mais Condores* (cada um vota uma vez)`

  async function carregar() {
    try { setR(await db.votacaoResultado()) } catch (e) { toast(e.message) }
  }
  useEffect(() => { db.senhaPadrao().then((s) => setSenha(s || '')).catch(() => {}) }, [])
  useEffect(() => { carregar() }, [])

  async function copiar() {
    try { await navigator.clipboard.writeText(texto); toast('Mensagem copiada!') }
    catch { toast('Não deu pra copiar automaticamente — copie o texto acima.') }
  }

  const max = r?.ranking?.[0]?.votos || 0

  return (
    <section className="tela on">
      <div className="row sb" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Atleta Mais Condores</h2>
        <button className="btn sm sec" onClick={carregar}>Atualizar</button>
      </div>

      <div className="stat">
        <div className="card"><b>{r ? r.total_votos : '–'}</b><span>Votos</span></div>
        <div className="card"><b>{r ? r.faltam_votar : '–'}</b><span>Ainda não votaram</span></div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Ranking</h3>
        {!r ? <p className="dica">Carregando…</p> : r.ranking.length === 0 ? <p className="dica">Nenhum voto ainda.</p> : (
          <table>
            <thead><tr><th>#</th><th>Atleta</th><th>Votos</th></tr></thead>
            <tbody>
              {r.ranking.map((x, i) => (
                <tr key={x.atleta_id} className={x.votos === max ? 'top' : ''}>
                  <td className="pos">{i + 1}</td>
                  <td>{x.nome}</td>
                  <td className="pts">{x.votos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Convite para os atletas</h3>
        <pre className="msg">{texto}</pre>
        <button className="btn" onClick={copiar}>Copiar mensagem para o WhatsApp</button>
        <a className="btn sec" style={{ marginTop: 8, textDecoration: 'none' }} href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">Abrir no WhatsApp</a>
        <p className="dica">A votação aparece para cada atleta logo depois do primeiro acesso. Se alguém esquecer a senha, use 🔑 no menu ⋯ do atleta (tela Atletas).</p>
      </div>
    </section>
  )
}
