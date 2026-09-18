import { useEffect, useState } from 'react'
import { useToast } from './ui'
import { msgFaltam, msgEscalacao, msgRanking } from './lib/mensagens'
import * as db from './lib/dados'

export default function Mensagens({ atletas, tipoInicial }) {
  const toast = useToast()
  const [tipo, setTipo] = useState(tipoInicial || 'lista')
  const [txt, setTxt] = useState('')

  useEffect(() => { if (tipoInicial) setTipo(tipoInicial) }, [tipoInicial])

  useEffect(() => {
    (async () => {
      try {
        if (tipo === 'ranking') {
          const [r, total] = await Promise.all([db.ranking(), db.totalRodadas()])
          setTxt(msgRanking(r, total))
        } else {
          const rodada = await db.rodadaAtual()
          if (tipo === 'lista') setTxt(msgFaltam(rodada, atletas, await db.listarConfirmacoes(rodada.id)))
          else setTxt(msgEscalacao(rodada, atletas, await db.listarEscalacao(rodada.id)))
        }
      } catch (err) { toast(err.message) }
    })()
  }, [tipo, atletas])

  async function copiar() {
    try { await navigator.clipboard.writeText(txt); toast('Copiado!') }
    catch { toast('Não deu pra copiar automaticamente — selecione o texto e copie.') }
  }

  return (
    <section className="tela on">
      <h2>Mensagens</h2>
      <div className="seg">
        <button className={tipo === 'lista' ? 'on' : ''} onClick={() => setTipo('lista')}>Faltam confirmar</button>
        <button className={tipo === 'escalacao' ? 'on' : ''} onClick={() => setTipo('escalacao')}>Escalação (seg)</button>
        <button className={tipo === 'ranking' ? 'on' : ''} onClick={() => setTipo('ranking')}>Ranking</button>
      </div>
      <pre className="msg">{txt || 'Carregando…'}</pre>
      <button className="btn" onClick={copiar}>Copiar mensagem</button>
      <p className="dica">Depois é só colar na comunidade do WhatsApp.</p>
    </section>
  )
}
