import { useEffect, useState } from 'react'
import { Modal, useToast } from './ui'
import { ddmm, RES_NOME, RES_CLASSE, nomeVencedor, temPlacar, tresTimes, TIMES } from './lib/util'
import * as db from './lib/dados'

export default function Ranking({ atletas, meuNome, irParaMsg }) {
  const toast = useToast()
  const [aba, setAba] = useState('rank')
  const [rank, setRank] = useState([])
  const [datas, setDatas] = useState([])
  const [encerradas, setEncerradas] = useState([])
  const [hist, setHist] = useState(null) // {atleta, linhas}
  const [aberta, setAberta] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const [r, d, e] = await Promise.all([db.ranking(), db.listarDatasEncerradas(), db.listarRodadasEncerradas()])
        setRank(r); setDatas(d); setEncerradas(e)
      } catch (err) { toast(err.message) }
    })()
  }, [])

  async function abrirHist(x) {
    try {
      const linhas = await db.historicoAtleta(x.atleta_id)
      const porRodada = new Map(linhas.map((l) => [l.rodada_id, l]))
      setHist({ atleta: x, linhas: datas.map((d) => ({ data: d.data, l: porRodada.get(d.id) })) })
    } catch (err) { toast(err.message) }
  }

  const nomesTime = (r, t) => {
    const lista = r.cond_escalacoes.filter((e) => e.time === t).sort((a, b) => (b.goleiro ? 1 : 0) - (a.goleiro ? 1 : 0))
    return lista.map((e) => (e.goleiro ? '🧤 ' : '') + (e.convidado_nome ? `${e.convidado_nome} (conv.)` : e.cond_atletas?.nome || '(excluído)')).join(', ') || '—'
  }
  const timesDa = (r) => (tresTimes(r) ? ['P', 'B', 'V'] : ['P', 'B'])

  return (
    <section className="tela on">
      <div className="row sb" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Ranking {new Date().getFullYear()}</h2>
        <span className="tag">{datas.length} rodadas</span>
      </div>
      <div className="seg">
        <button className={aba === 'rank' ? 'on' : ''} onClick={() => setAba('rank')}>Ranking</button>
        <button className={aba === 'hist' ? 'on' : ''} onClick={() => setAba('hist')}>Histórico de jogos</button>
      </div>

      {aba === 'rank' && (
        <div>
          <div className="card" style={{ padding: '6px 10px' }}>
            <table>
              <thead><tr><th>#</th><th>Atleta</th><th>Pts</th><th>J</th><th>Freq</th><th>Méd</th></tr></thead>
              <tbody>
                {rank.map((x, i) => (
                  <tr key={x.atleta_id} className={`${i < 3 ? 'top' : ''} ${meuNome && x.nome === meuNome ? 'eu' : ''}`} onClick={() => abrirHist(x)} style={{ cursor: 'pointer' }}>
                    <td className="pos">{i + 1}</td>
                    <td>{x.nome}{x.dm && <> <span className="tag dm">DM</span></>}{!x.ativo && <> <span className="tag">excluído</span></>}</td>
                    <td className="pts">{x.pontos}</td>
                    <td>{x.jogos}</td>
                    <td>{Math.round(x.frequencia * 100)}%</td>
                    <td>{Number(x.media).toFixed(2).replace('.', ',')}</td>
                  </tr>
                ))}
                {!rank.length && <tr><td colSpan={6} className="dica" style={{ textAlign: 'left' }}>Nenhuma rodada encerrada ainda.</td></tr>}
              </tbody>
            </table>
          </div>
          <button className="btn sec" onClick={() => irParaMsg('ranking', { tela: 'ranking', nome: 'Ranking' })}>Gerar ranking pro WhatsApp</button>
          <p className="dica">Toque num atleta para ver o histórico dele, jogo a jogo.</p>
        </div>
      )}

      {aba === 'hist' && (
        <div>
          <div className="card"><div className="lista">
            {encerradas.map((r, i) => (
              <div key={r.id}>
                <div className={`item ${aberta === r.id ? 'aberto' : ''}`} onClick={() => setAberta(aberta === r.id ? null : r.id)} style={{ cursor: 'pointer' }}>
                  <div className="av">{encerradas.length - i}</div>
                  <div className="nome">Seg {ddmm(r.data)}<span className="sub">{r.cond_escalacoes.filter((e) => e.atleta_id).length} atletas · {nomeVencedor(r)}</span></div>
                  {temPlacar(r)
                    ? <><span className="tag preto">{r.gols_preto}</span><span className="tag bege">{r.gols_bege}</span></>
                    : <span className="tag">{r.vencedor === 'E' ? '=' : TIMES[r.vencedor]?.emoji}</span>}
                </div>
                <div className="hist-det">{timesDa(r).map((t) => (
                  <div key={t}><b>{TIMES[t].emoji} {TIMES[t].nome}:</b> {nomesTime(r, t)}</div>
                ))}</div>
              </div>
            ))}
            {!encerradas.length && <p className="dica">Nenhuma rodada encerrada ainda.</p>}
          </div></div>
          <p className="dica">Toque na rodada para abrir a escalação e o resultado de cada um.</p>
        </div>
      )}

      <Modal aberto={!!hist}>
        {hist && (
          <>
            <div className="row sb" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>{hist.atleta.nome}</h2>
              <button className="btn sm sec" onClick={() => setHist(null)}>Fechar</button>
            </div>
            <div className="card" style={{ padding: '6px 10px', maxHeight: '60vh', overflow: 'auto' }}>
              <table>
                <thead><tr><th>Rodada</th><th>Time</th><th>Res.</th><th>Pts</th></tr></thead>
                <tbody>
                  {hist.linhas.map(({ data, l }) => l ? (
                    <tr key={data}>
                      <td>{ddmm(data)}</td>
                      <td><span className={`tag ${TIMES[l.time].classe}`}>{TIMES[l.time].nome}{l.goleiro ? ' 🧤' : ''}</span></td>
                      <td className={`res ${RES_CLASSE[l.resultado]}`}>{RES_NOME[l.resultado]}</td>
                      <td>{l.pontos}</td>
                    </tr>
                  ) : (
                    <tr key={data} style={{ opacity: .4 }}><td>{ddmm(data)}</td><td>—</td><td>não jogou</td><td>—</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </section>
  )
}
