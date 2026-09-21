import { useEffect, useState } from 'react'
import { Modal, useToast } from './ui'
import { ddmm, RES_NOME, RES_CLASSE, nomeVencedor, temPlacar, tresTimes, TIMES } from './lib/util'
import * as db from './lib/dados'

export default function Ranking({ atletas, meuNome, diretor, irParaMsg, aoMudarTemporadas }) {
  const toast = useToast()
  const [aba, setAba] = useState('rank')
  const [ano, setAno] = useState(db.anoAtual())
  const [anos, setAnos] = useState([db.anoAtual()])
  const [temporadas, setTemporadas] = useState([])
  const [rank, setRank] = useState([])
  const [datas, setDatas] = useState([])
  const [encerradas, setEncerradas] = useState([])
  const [hist, setHist] = useState(null)
  const [aberta, setAberta] = useState(null)
  const [verSaidos, setVerSaidos] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const temporada = temporadas.find((t) => t.ano === ano)   // ano já encerrado?

  async function carregar(alvo = ano) {
    setCarregando(true)
    try {
      const [ts, listaAnos] = await Promise.all([db.listarTemporadas(), db.anosComRodadas()])
      setTemporadas(ts)
      setAnos([...new Set([...listaAnos, ...ts.map((t) => t.ano), db.anoAtual()])].sort((a, b) => b - a))
      const fechada = ts.find((t) => t.ano === alvo)
      const [r, d, e] = await Promise.all([
        fechada ? db.rankingTemporada(alvo) : db.ranking(alvo),
        db.listarDatasEncerradas(alvo),
        db.listarRodadasEncerradas(),
      ])
      setRank(r); setDatas(d); setEncerradas(e.filter((x) => +x.data.slice(0, 4) === alvo))
    } catch (err) { toast(err.message) } finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])
  useEffect(() => { carregar(ano) }, [ano])

  async function encerrar() {
    if (!confirm(`Encerrar ${ano}? O ranking do ano fica guardado e o próximo ano começa do zero. Dá para reabrir depois.`)) return
    try {
      const r = await db.encerrarAno(ano)
      toast(`${ano} encerrado · campeão ${r.campeao}`)
      await carregar(ano); aoMudarTemporadas?.()
    } catch (e) { toast(e.message) }
  }
  async function reabrir() {
    if (!confirm(`Reabrir ${ano}? O ranking volta a ser calculado ao vivo.`)) return
    try { await db.reabrirAno(ano); toast(`${ano} reaberto`); await carregar(ano); aoMudarTemporadas?.() }
    catch (e) { toast(e.message) }
  }

  async function abrirHist(x) {
    if (temporada) return   // temporada encerrada: a tabela já é o retrato final
    try {
      const linhas = await db.historicoAtleta(x.atleta_id, ano)
      const porRodada = new Map(linhas.map((l) => [l.rodada_id, l]))
      setHist({ atleta: x, linhas: datas.map((d) => ({ data: d.data, l: porRodada.get(d.id) })) })
    } catch (err) { toast(err.message) }
  }

  const nomesTime = (r, t) => {
    const lista = r.cond_escalacoes.filter((e) => e.time === t).sort((a, b) => (b.goleiro ? 1 : 0) - (a.goleiro ? 1 : 0))
    return lista.map((e) => (e.goleiro ? '🧤 ' : '') + (e.convidado_nome ? `${e.convidado_nome} (conv.)` : e.cond_atletas?.nome || '(saiu)')).join(', ') || '—'
  }
  const timesDa = (r) => (tresTimes(r) ? ['P', 'B', 'V'] : ['P', 'B'])

  // numa temporada encerrada mostramos o retrato inteiro; no ano corrente escondemos quem saiu
  const rankVisivel = temporada ? rank : rank.filter((x) => x.ativo || verSaidos)
  const qtdSaidos = temporada ? 0 : rank.filter((x) => !x.ativo).length

  return (
    <section className="tela on">
      <div className="row sb" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Ranking {ano}</h2>
        <span className="tag">{datas.length} rodadas</span>
      </div>

      {anos.length > 1 && (
        <div className="filtros" style={{ marginBottom: 8 }}>
          <div className="fl">
            {anos.map((a) => (
              <button key={a} className={a === ano ? 'on' : ''} onClick={() => setAno(a)}>
                {a}{temporadas.some((t) => t.ano === a) ? ' 🏆' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {temporada && (
        <div className="campeao-faixa">
          🏆 <b>Campeão {temporada.ano}: {temporada.campeao_nome}</b>
          <span>{temporada.campeao_pontos} pts em {temporada.campeao_jogos} jogos · temporada encerrada</span>
        </div>
      )}

      <div className="seg">
        <button className={aba === 'rank' ? 'on' : ''} onClick={() => setAba('rank')}>Ranking</button>
        <button className={aba === 'hist' ? 'on' : ''} onClick={() => setAba('hist')}>Histórico de jogos</button>
      </div>

      {carregando && <p className="dica">Carregando…</p>}

      {!carregando && aba === 'rank' && (
        <div>
          {qtdSaidos > 0 && (
            <div className="filtros" style={{ marginBottom: 8 }}>
              <div className="fl">
                <button className={verSaidos ? 'on' : ''} onClick={() => setVerSaidos(!verSaidos)}>
                  {verSaidos ? '🚪 Ocultar quem saiu' : `🚪 Mostrar quem saiu (${qtdSaidos})`}
                </button>
              </div>
            </div>
          )}
          <div className="card" style={{ padding: '6px 10px' }}>
            <table>
              <thead><tr><th>#</th><th>Atleta</th><th>Pts</th><th>J</th><th>Freq</th><th>Méd</th></tr></thead>
              <tbody>
                {rankVisivel.map((x, i) => (
                  <tr key={x.atleta_id || x.nome} className={`${i < 3 ? 'top' : ''} ${meuNome && x.nome === meuNome ? 'eu' : ''}`}
                      onClick={() => abrirHist(x)} style={{ cursor: temporada ? 'default' : 'pointer' }}>
                    <td className="pos">{i + 1}</td>
                    <td>{x.nome}{x.dm && <> <span className="tag dm">DM</span></>}{x.ativo === false && <> <span className="tag dm">saiu</span></>}</td>
                    <td className="pts">{x.pontos}</td>
                    <td>{x.jogos}</td>
                    <td>{Math.round(x.frequencia * 100)}%</td>
                    <td>{Number(x.media).toFixed(2).replace('.', ',')}</td>
                  </tr>
                ))}
                {!rankVisivel.length && <tr><td colSpan={6} className="dica" style={{ textAlign: 'left' }}>Nenhuma rodada encerrada em {ano}.</td></tr>}
              </tbody>
            </table>
          </div>
          <button className="btn sec" onClick={() => irParaMsg('ranking', { tela: 'ranking', nome: 'Ranking' })}>Gerar ranking pro WhatsApp</button>
          {!temporada && <p className="dica">Toque num atleta para ver o histórico dele, jogo a jogo.</p>}

          {diretor && rank.length > 0 && (
            temporada
              ? <button className="btn sec" style={{ marginTop: 10 }} onClick={reabrir}>Reabrir {ano}</button>
              : <button className="btn sec" style={{ marginTop: 10 }} onClick={encerrar}>🏁 Encerrar o ano de {ano}</button>
          )}
          {diretor && !temporada && rank.length > 0 && (
            <p className="dica">Ao encerrar, o ranking de {ano} fica guardado com o campeão e o ano seguinte começa do zero.</p>
          )}
        </div>
      )}

      {!carregando && aba === 'hist' && (
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
            {!encerradas.length && <p className="dica">Nenhuma rodada encerrada em {ano}.</p>}
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
