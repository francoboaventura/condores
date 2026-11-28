import { useState } from 'react'
import { Modal, useToast } from './ui'
import { ini } from './lib/util'
import * as db from './lib/dados'

// Pop-up "Atleta Mais Condores": o atleta logado escolhe em quem vota (o próprio nome não aparece)
export default function VotoPopup({ atletas, meuAtletaId, onFechar }) {
  const toast = useToast()
  const [escolhido, setEscolhido] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [fim, setFim] = useState(null)   // 'ok' | 'ja'

  async function confirmar() {
    if (!escolhido || enviando) return
    setEnviando(true)
    try { await db.votar(meuAtletaId, escolhido.id); setFim('ok') }
    catch (e) { if (e.jaVotou) setFim('ja'); else toast(e.message) }
    finally { setEnviando(false) }
  }

  return (
    <Modal aberto>
      <div className="voto-pop">
        {fim ? (
          <div className="voto-fim">
            <div className="tr">🏆</div>
            <h2>{fim === 'ok' ? 'Voto registrado!' : 'Esse atleta já votou'}</h2>
            <p>{fim === 'ok' ? `Obrigado! Você votou em ${escolhido.nome}.` : 'Seu voto já tinha sido registrado antes.'}</p>
            <button className="btn" onClick={onFechar}>Ir para o app</button>
          </div>
        ) : (
          <>
            <h2 style={{ marginBottom: 4 }}>🏆 Atleta Mais Condores</h2>
            <p className="dica" style={{ marginTop: 0, marginBottom: 10 }}>Em quem você vota? Cada atleta vota uma vez só.</p>
            <div className="lista voto-lista">
              {atletas.filter((a) => a.id !== meuAtletaId).map((a) => (
                <button key={a.id} className={`item voto-op ${escolhido?.id === a.id ? 'on' : ''}`} onClick={() => setEscolhido(a)}>
                  {a.foto_url ? <img className="av foto" src={a.foto_url} alt="" /> : <span className="av camisa">{a.numero ?? ini(a.nome)}</span>}
                  <span className="nome">{a.nome}</span>
                  <span className="marca">{escolhido?.id === a.id ? '✓' : ''}</span>
                </button>
              ))}
            </div>
            <button className="btn" style={{ marginTop: 12 }} disabled={!escolhido || enviando} onClick={confirmar}>
              {enviando ? 'Enviando…' : escolhido ? `Confirmar voto em ${escolhido.nome}` : 'Escolha um atleta'}
            </button>
            <button className="btn sec" style={{ marginTop: 8 }} onClick={onFechar}>Votar depois</button>
          </>
        )}
      </div>
    </Modal>
  )
}
