import { useEffect, useRef, useState } from 'react'
import { useToast } from './ui'
import { ini, ddmm, nomeVencedor, temPlacar, tresTimes, proximaSegunda, fora, TIMES, chavesTimes, sortearTimes, POS } from './lib/util'
import * as db from './lib/dados'

export default function Rodada({ atletas, diretor, meuAtletaId, passoInicial = 1, onPasso, irParaMsg, irParaRanking }) {
  const toast = useToast()
  const [passo, setPassoState] = useState(passoInicial)
  const setPasso = (n) => { setPassoState(n); onPasso?.(n) }
  const [rodada, setRodada] = useState(null)
  const [conf, setConf] = useState([])           // {rodada_id, atleta_id, status}
  const [esc, setEsc] = useState([])             // linhas de cond_escalacoes
  const [convBanco, setConvBanco] = useState([]) // convidados sem time: {nome, pos}
  const [convNome, setConvNome] = useState('')
  const [convPos, setConvPos] = useState('MEI')
  const [gp, setGp] = useState('')
  const [gb, setGb] = useState('')
  const [podio, setPodio] = useState({ v: null, s: null }) // campeão / vice (3 times)
  const [encerradas, setEncerradas] = useState([])
  const [editando, setEditando] = useState(null)
  const [aberta, setAberta] = useState(null)   // rodada registrada aberta (mostra a escalação do dia)
  const [carregando, setCarregando] = useState(true)
  const [aLancar, setALancar] = useState([])
  const [escolher, setEscolher] = useState(false)
  const [outraData, setOutraData] = useState('')
  const [rodadaId, setRodadaId] = useState(null)
  const [semGoleiro, setSemGoleiro] = useState([])
  const [detalhe, setDetalhe] = useState(null)   // 'sim' | 'nao' | 'pend' — caixa aberta nas confirmações

  const fechada = rodada?.status === 'encerrada'
  const passada = rodada && rodada.data < proximaSegunda()
  const podeEditar = diretor && !fechada
  const times = chavesTimes(rodada?.times_qtd)
  const tres = rodada && tresTimes(rodada)

  async function carregar(id = rodadaId) {
    try {
      const r = id ? await db.rodadaPorId(id) : await db.rodadaAtual()
      setRodada(r)
      const [c, e, enc, al] = await Promise.all([
        db.listarConfirmacoes(r.id), db.listarEscalacao(r.id), db.listarRodadasEncerradas(), diretor ? db.listarRodadasALancar() : [],
      ])
      setConf(c); setEsc(e); setEncerradas(enc); setALancar(al)
      setGp(r.gols_preto != null ? String(r.gols_preto) : ''); setGb(r.gols_bege != null ? String(r.gols_bege) : '')
      setPodio({ v: r.vencedor || null, s: r.vice || null })
    } catch (err) { toast(err.message) } finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])

  const run = async (fn, okMsg) => {
    try { await fn(); await carregar(); if (okMsg) toast(okMsg) } catch (e) { toast(e.message) }
  }

  async function trocarRodada(id) {
    setEscolher(false); setRodadaId(id); setConvBanco([]); setSemGoleiro([]); setPasso(id ? 2 : 1)
    await carregar(id)
  }
  async function abrirOutraData() {
    if (!outraData) return
    const d = new Date(outraData + 'T12:00:00')
    if (d.getDay() !== 1) return toast('Escolha uma segunda-feira')
    try { const r = await db.rodadaPorData(outraData); await trocarRodada(r.id) } catch (e) { toast(e.message) }
  }

  // ---------- confirmações ----------
  const statusDe = (id) => conf.find((c) => c.atleta_id === id)?.status
  const ativos = atletas.filter((a) => !fora(a))
  const sim = conf.filter((c) => c.status === 'S').map((c) => c.atleta_id)
  const nao = conf.filter((c) => c.status === 'N').length
  const indisponiveis = atletas.filter((a) => fora(a)).length   // DM + afastamento justificado
  const naoVao = nao + indisponiveis
  const pend = ativos.length - sim.length - nao

  const porId = (id) => atletas.find((a) => a.id === id)
  const listaDetalhe = {
    sim: sim.map(porId).filter(Boolean).map((a) => ({ nome: a.nome, pos: a.posicao })),
    nao: [
      ...conf.filter((c) => c.status === 'N').map((c) => porId(c.atleta_id)).filter(Boolean).map((a) => ({ nome: a.nome, pos: a.posicao })),
      ...atletas.filter((a) => a.dm).map((a) => ({ nome: a.nome, pos: a.posicao, tag: 'DM' })),
      ...atletas.filter((a) => a.afastado).map((a) => ({ nome: a.nome, pos: a.posicao, tag: 'afastado' })),
    ],
    pend: ativos.filter((a) => !statusDe(a.id)).map((a) => ({ nome: a.nome, pos: a.posicao })),
  }
  const TITULO = { sim: 'Confirmados', nao: 'Não vão', pend: 'Sem resposta' }

  function alternar(a) {
    if (fechada) return toast('Rodada encerrada')
    if (!diretor && a.id !== meuAtletaId) return
    if (a.dm) return toast('Atleta no DM')
    if (a.afastado) return toast('Atleta afastado')
    const s = statusDe(a.id)
    const novo = s === 'S' ? 'N' : s === 'N' ? null : 'S'
    run(async () => {
      await db.setConfirmacao(rodada.id, a.id, novo)
      if (novo !== 'S') { const linha = esc.find((e) => e.atleta_id === a.id); if (linha) await db.removerEscalacao(linha.id) }
    })
  }

  // ---------- escalação ----------
  const nomeDe = (e) => e.convidado_nome || atletas.find((a) => a.id === e.atleta_id)?.nome || '?'
  const posDe = (e) => (e.convidado_nome ? e.convidado_pos || 'conv.' : atletas.find((a) => a.id === e.atleta_id)?.posicao || '')
  const baseBanco = passada ? ativos.map((a) => a.id) : sim
  const semTime = baseBanco.filter((id) => !esc.some((e) => e.atleta_id === id)).map((id) => atletas.find((a) => a.id === id)).filter(Boolean)
  // banco agrupado por posição: goleiros em cima, depois ZAG / MEI / ATA em colunas
  const bancoTodos = [
    ...semTime.map((a) => ({ key: `a:${a.id}`, nome: a.nome, pos: a.posicao })),
    ...convBanco.map((c, i) => ({ key: `c:${i}`, nome: c.nome, pos: c.pos, convidado: true, indice: i })),
  ]
  const bancoPor = (p) => bancoTodos.filter((j) => j.pos === p)

  async function mudarQtdTimes(n) {
    if (!podeEditar) return
    await run(async () => {
      if (n === 2) {
        // quem estava no Vermelho volta para o banco
        const vermelhos = esc.filter((e) => e.time === 'V')
        setConvBanco((b) => [...b, ...vermelhos.filter((e) => e.convidado_nome).map((e) => ({ nome: e.convidado_nome, pos: e.convidado_pos || 'MEI' }))])
        for (const e of vermelhos) await db.removerEscalacao(e.id)
      }
      await db.setTimesQtd(rodada.id, n)
    })
  }

  // key: 'a:<atleta_id>' (banco) | 'c:<i>' (convidado no banco) | 'e:<id>' (já escalado)
  async function colocar(key, t, gk) {
    if (!podeEditar) return toast(diretor ? 'Rodada encerrada' : 'Só a diretoria escala')
    await run(async () => {
      if (gk && t) {
        for (const e of esc.filter((x) => x.time === t && x.goleiro && `e:${x.id}` !== key)) {
          if (e.convidado_nome) setConvBanco((b) => [...b, { nome: e.convidado_nome, pos: e.convidado_pos || 'MEI' }])
          await db.removerEscalacao(e.id)
        }
      }
      if (key.startsWith('a:')) {
        if (!t) return
        await db.inserirEscalacao({ rodada_id: rodada.id, atleta_id: key.slice(2), time: t, goleiro: !!gk })
      } else if (key.startsWith('c:')) {
        if (!t) return
        const i = +key.slice(2); const c = convBanco[i]
        setConvBanco((b) => b.filter((_, j) => j !== i))
        await db.inserirEscalacao({ rodada_id: rodada.id, convidado_nome: c.nome, convidado_pos: c.pos, time: t, goleiro: !!gk })
      } else {
        const id = key.slice(2); const linha = esc.find((e) => e.id === id)
        if (!t) {
          if (linha?.convidado_nome) setConvBanco((b) => [...b, { nome: linha.convidado_nome, pos: linha.convidado_pos || 'MEI' }])
          await db.removerEscalacao(id)
        } else await db.atualizarEscalacao(id, { time: t, goleiro: !!gk })
      }
    })
  }

  const tirarConvidadoBanco = (i) => setConvBanco((b) => b.filter((_, j) => j !== i))
  const tirarConvidadoEscalado = (id) => run(() => db.removerEscalacao(id), 'Convidado removido')

  function addConvidado() {
    const n = convNome.trim(); if (!n) return
    setConvBanco((b) => [...b, { nome: n, pos: convPos }]); setConvNome(''); setConvPos('MEI')
  }

  async function sortear() {
    if (!podeEditar) return toast('Rodada encerrada')
    const doBanco = baseBanco.map((id) => atletas.find((a) => a.id === id)).filter(Boolean)
      .map((a) => ({ atleta_id: a.id, posicao: a.posicao }))
    const convidados = [
      ...convBanco.map((c) => ({ convidado_nome: c.nome, convidado_pos: c.pos, posicao: c.pos })),
      ...esc.filter((e) => e.convidado_nome).map((e) => ({ convidado_nome: e.convidado_nome, convidado_pos: e.convidado_pos || 'MEI', posicao: e.convidado_pos || 'MEI' })),
    ]
    const { escalados, semGoleiro: faltando } = sortearTimes([...doBanco, ...convidados], tres ? 3 : 2)
    await run(async () => {
      await db.limparEscalacao(rodada.id)
      setConvBanco([])
      if (escalados.length) {
        await db.inserirEscalacao(escalados.map((j) => ({
          rodada_id: rodada.id, atleta_id: j.atleta_id ?? null, convidado_nome: j.convidado_nome ?? null,
          convidado_pos: j.convidado_pos ?? null, time: j.time, goleiro: j.goleiro,
        })))
      }
    })
    setSemGoleiro(faltando)
    if (faltando.length) toast(`Sem goleiro: ${faltando.map((t) => TIMES[t].nome).join(', ')}`)
  }
  async function limpar() {
    if (!podeEditar) return toast('Rodada encerrada')
    setSemGoleiro([])
    await run(async () => {
      setConvBanco((b) => [...b, ...esc.filter((e) => e.convidado_nome).map((e) => ({ nome: e.convidado_nome, pos: e.convidado_pos || 'MEI' }))])
      await db.limparEscalacao(rodada.id)
    })
  }

  // arrastar (pointer events: dedo e mouse)
  const drag = useRef(null)
  useEffect(() => {
    const down = (e) => {
      if (!podeEditar) return
      const el = e.target.closest('[data-key]'); if (!el) return
      drag.current = { key: el.dataset.key, label: el.textContent.trim(), ghost: null, x: e.clientX, y: e.clientY }
    }
    const move = (e) => {
      const d = drag.current; if (!d) return
      if (!d.ghost) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return
        d.ghost = document.createElement('div'); d.ghost.className = 'ghost'; d.ghost.textContent = d.label; document.body.appendChild(d.ghost)
      }
      d.ghost.style.left = e.clientX + 'px'; d.ghost.style.top = e.clientY + 'px'
      document.querySelectorAll('.drop.over').forEach((z) => z.classList.remove('over'))
      document.elementFromPoint(e.clientX, e.clientY)?.closest('.drop')?.classList.add('over')
    }
    const up = (e) => {
      const d = drag.current; if (!d) return
      drag.current = null
      if (!d.ghost) return
      d.ghost.remove()
      document.querySelectorAll('.drop.over').forEach((z) => z.classList.remove('over'))
      const z = document.elementFromPoint(e.clientX, e.clientY)?.closest('.drop')
      if (z) colocar(d.key, z.dataset.t, !!z.dataset.gk)
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
    return () => {
      document.removeEventListener('pointerdown', down); document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up)
    }
  })

  // escalação de uma rodada já registrada
  const nomesDaRodada = (r, t) => {
    const lista = r.cond_escalacoes.filter((e) => e.time === t).sort((a, b) => (b.goleiro ? 1 : 0) - (a.goleiro ? 1 : 0))
    return lista
      .map((e) => (e.goleiro ? '🧤 ' : '') + (e.convidado_nome ? `${e.convidado_nome} (conv.)` : e.cond_atletas?.nome || '(saiu)'))
      .join(', ') || '—'
  }

  // ---------- resultado ----------
  async function salvarResultado() {
    if (gp === '' || gb === '') return toast('Preencha o placar')
    await run(() => db.salvarResultado(rodada.id, +gp, +gb), 'Rodada salva · ranking atualizado')
    irParaRanking()
  }
  async function salvarVencedor(v) {
    await run(() => db.salvarVencedor(rodada.id, v), 'Resultado salvo · ranking atualizado')
    irParaRanking()
  }
  async function salvarPodio() {
    if (!podio.v || !podio.s) return toast('Escolha o campeão e o 2º lugar')
    if (podio.v === podio.s) return toast('Campeão e 2º lugar precisam ser times diferentes')
    await run(() => db.salvarPodio(rodada.id, podio.v, podio.s), 'Resultado salvo · ranking atualizado')
    irParaRanking()
  }
  async function salvarCorrecao() {
    if (editando.gp === '' || editando.gb === '') return toast('Preencha o placar')
    await run(() => db.salvarResultado(editando.id, +editando.gp, +editando.gb), 'Placar corrigido')
    setEditando(null)
  }

  if (carregando) return <section className="tela on"><p className="dica">Carregando rodada…</p></section>

  const Chip = ({ j }) => (
    <span className={`chip ${j.convidado ? 'conv' : ''} ${j.pos === 'GOL' ? 'g' : ''}`} data-key={j.key}>
      {j.convidado ? '👤 ' : ''}{j.nome}
      {j.convidado && (
        <button className="del" onPointerDown={(ev) => ev.stopPropagation()} onClick={() => tirarConvidadoBanco(j.indice)} title="Remover convidado">×</button>
      )}
    </span>
  )

  const Time = ({ t }) => {
    const { nome, emoji, classe, gk } = TIMES[t]
    const gks = esc.filter((e) => e.time === t && e.goleiro)
    const lin = esc.filter((e) => e.time === t && !e.goleiro)
    return (
      <div className={`time ${classe}`}>
        <h4>{emoji} {nome} <span>{gks.length + lin.length}</span></h4>
        <div className={`gk ${gk} drop ${gks.length ? '' : 'vazio'}`} data-t={t} data-gk="1">
          {gks.length
            ? gks.map((e) => (
                <div key={e.id} className={`j ${e.convidado_nome ? 'conv' : ''}`} data-key={`e:${e.id}`}>
                  🧤 {nomeDe(e)}
                  {e.convidado_nome && podeEditar
                    ? <button className="del" onPointerDown={(ev) => ev.stopPropagation()} onClick={() => tirarConvidadoEscalado(e.id)} title="Remover convidado">×</button>
                    : <span className="x">⇄</span>}
                </div>
              ))
            : '🧤 goleiro'}
        </div>
        <div className="linha drop" data-t={t}>
          {lin.map((e) => (
            <div key={e.id} className={`j ${e.convidado_nome ? 'conv' : ''}`} data-key={`e:${e.id}`}>
              {nomeDe(e)} <small style={{ opacity: .6 }}>{posDe(e)}</small>
              {e.convidado_nome && podeEditar
                ? <button className="del" onPointerDown={(ev) => ev.stopPropagation()} onClick={() => tirarConvidadoEscalado(e.id)} title="Remover convidado">×</button>
                : <span className="x">⇄</span>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="tela on">
      <div className="row sb" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Rodada</h2>
        <button className="tag preto" style={{ cursor: diretor ? 'pointer' : 'default', font: 'inherit', fontSize: 11, fontWeight: 600 }} onClick={() => diretor && setEscolher(true)}>
          Seg {ddmm(rodada.data)}{fechada ? ' · encerrada' : passada ? ' · a lançar' : ''}{diretor ? ' ▾' : ''}
        </button>
      </div>
      {diretor && aLancar.length > 0 && !passada && (
        <p className="dica" style={{ margin: '-4px 0 12px' }}>⚠️ {aLancar.length} rodada{aLancar.length > 1 ? 's' : ''} antiga{aLancar.length > 1 ? 's' : ''} sem resultado — toque na data acima para lançar.</p>
      )}
      {!diretor && <p className="dica" style={{ margin: '-4px 0 12px' }}>Toque no seu nome para confirmar presença. Escalação e resultado são lançados pela diretoria.</p>}
      <div className="seg">
        {[1, 2, 3].map((n) => <button key={n} className={passo === n ? 'on' : ''} onClick={() => setPasso(n)}>{n} · {['Confirmações', 'Escalação', 'Resultado'][n - 1]}</button>)}
      </div>

      {escolher && (
        <div className="modal on"><div className="card sheet">
          <h2>Qual rodada?</h2>
          <button onClick={() => trocarRodada(null)}>📅 Próxima segunda ({ddmm(proximaSegunda())})</button>
          {aLancar.map((r) => <button key={r.id} onClick={() => trocarRodada(r.id)}>⚠️ Seg {ddmm(r.data)} — a lançar</button>)}
          <label className="lb" style={{ marginTop: 8 }}>Outra segunda-feira</label>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <input className="txt" type="date" value={outraData} onChange={(e) => setOutraData(e.target.value)} style={{ margin: 0 }} />
            <button className="btn sm" onClick={abrirOutraData}>Abrir</button>
          </div>
          <button onClick={() => setEscolher(false)}>Fechar</button>
        </div></div>
      )}

      {passo === 1 && (
        <div>
          <div className="stat">
            <button className={`card ${detalhe === 'sim' ? 'on' : ''}`} onClick={() => setDetalhe(detalhe === 'sim' ? null : 'sim')}>
              <b>{sim.length}</b><span>Confirmados</span>
            </button>
            <button className={`card ${detalhe === 'nao' ? 'on' : ''}`} onClick={() => setDetalhe(detalhe === 'nao' ? null : 'nao')}>
              <b>{naoVao}</b><span>Não vão</span>
              {indisponiveis > 0 && <small>{indisponiveis} DM/afast.</small>}
            </button>
            <button className={`card ${detalhe === 'pend' ? 'on' : ''}`} onClick={() => setDetalhe(detalhe === 'pend' ? null : 'pend')}>
              <b>{pend}</b><span>Sem resposta</span>
            </button>
          </div>
          {detalhe && (
            <div className="card detalhe">
              <div className="row sb" style={{ marginBottom: 8 }}>
                <h5>{TITULO[detalhe]} ({listaDetalhe[detalhe].length})</h5>
                <button className="fechar" onClick={() => setDetalhe(null)}>fechar</button>
              </div>
              {listaDetalhe[detalhe].length ? (
                <ul>
                  {listaDetalhe[detalhe].map((j, i) => (
                    <li key={j.nome + i}>{i + 1}. {j.nome} <small>{j.pos}</small>{j.tag && <span className="tag dm">{j.tag}</span>}</li>
                  ))}
                </ul>
              ) : <p className="dica" style={{ margin: 0 }}>Ninguém por aqui.</p>}
            </div>
          )}
          <div className="card"><div className="lista">
            {atletas.map((a) => { const s = statusDe(a.id); return (
              <div key={a.id} className={`item ${fora(a) ? 'dm' : ''}`} onClick={() => alternar(a)} style={{ cursor: diretor || a.id === meuAtletaId ? 'pointer' : 'default', background: a.id === meuAtletaId ? '#151306' : undefined }}>
                <div className={`av ${a.numero != null ? 'camisa' : ''}`}>{a.numero != null ? a.numero : ini(a.nome)}</div>
                <div className="nome">{a.nome}<span className="sub">{a.posicao}{a.tamanho ? ` · 👕 ${a.tamanho}` : ''}</span></div>
                {a.dm ? <span className="tag dm">DM</span> : a.afastado ? <span className="tag dm">afastado</span> : s === 'S' ? <span className="tag ok">✓ vai</span> : s === 'N' ? <span className="tag nao">✗ não vai</span> : <span className="tag">—</span>}
              </div>) })}
          </div></div>
          {diretor && <button className="btn" onClick={() => irParaMsg('lista', { tela: 'rodada', passo: 1, nome: 'Confirmações' })}>Cobrar quem ainda não confirmou</button>}
          {diretor && <p className="dica">Toque no nome para alternar: confirmado → não vai → sem resposta.</p>}
        </div>
      )}

      {passo === 2 && (
        <div>
          {podeEditar && (
            <div className="qtd-times">
              <span>Times:</span>
              <button className={!tres ? 'on' : ''} onClick={() => mudarQtdTimes(2)}>2</button>
              <button className={tres ? 'on' : ''} onClick={() => mudarQtdTimes(3)}>3</button>
            </div>
          )}
          {semGoleiro.length > 0 && (
            <div className="aviso">⚠️ Sem goleiro: {semGoleiro.map((t) => TIMES[t].nome).join(' e ')}. Arraste alguém para a faixa do gol.</div>
          )}
          <div className={`times ${tres ? 'tres' : ''}`}>
            {times.map((t) => <Time key={t} t={t} />)}
          </div>
          {podeEditar && <>
            <h3>Confirmados sem time {semTime.length + convBanco.length ? `(${semTime.length + convBanco.length})` : ''}</h3>
            <div className="card">
              <div className="banco drop" data-t="">
                {bancoTodos.length ? (
                  <>
                    <div className="banco-gol" data-pos="GOL">
                      <h5>🧤 Goleiros</h5>
                      <div className="chips">
                        {bancoPor('GOL').map((j) => <Chip key={j.key} j={j} />)}
                        {!bancoPor('GOL').length && <span className="vazio">—</span>}
                      </div>
                    </div>
                    <div className="banco-cols">
                      {['ZAG', 'MEI', 'ATA'].map((p) => (
                        <div className="banco-col" key={p} data-pos={p}>
                          <h5>{p}</h5>
                          <div className="chips">
                            {bancoPor(p).map((j) => <Chip key={j.key} j={j} />)}
                            {!bancoPor(p).length && <span className="vazio">—</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <span className="dica" style={{ margin: 0 }}>Todos escalados. Arraste alguém pra cá para tirar do time.</span>}
              </div>
              <div className="conv-add">
                <input className="txt" value={convNome} onChange={(e) => setConvNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addConvidado()} placeholder="Nome do convidado" />
                <select className="txt" value={convPos} onChange={(e) => setConvPos(e.target.value)} style={{ margin: 0, width: 88, flex: 'none' }}>
                  {POS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button className="btn sm" onClick={addConvidado}>+</button>
              </div>
              <p className="dica" style={{ marginTop: 6 }}>Convidado entra só nesta rodada — escolha a posição dele para o sorteio considerar. Toque no × para apagar. Não fica cadastrado nem pontua.</p>
            </div>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <button className="btn sec" onClick={sortear}>Sortear times</button>
              <button className="btn sec" onClick={limpar}>Limpar</button>
            </div>
            <button className="btn" onClick={() => irParaMsg('escalacao', { tela: 'rodada', passo: 2, nome: 'Escalação' })}>Gerar escalação pro WhatsApp (segunda)</button>
            <p className="dica">O sorteio dá um goleiro para cada time e divide zagueiros, meias e atacantes por igual. Arraste para ajustar; a faixa colorida no topo é o gol.{passada ? ' Rodada antiga: não precisa de confirmação — arraste direto da lista de atletas.' : ''}</p>
          </>}
          {!podeEditar && !esc.length && <p className="dica">Escalação ainda não definida.</p>}
        </div>
      )}

      {passo === 3 && (
        <div>
          {diretor && tres && (
            <div className="card">
              <label className="lb">Campeão da noite (3 pts)</label>
              <div className="row podio" style={{ gap: 6, marginBottom: 12 }}>
                {times.map((t) => <button key={t} className={podio.v === t ? 'on' : ''} onClick={() => setPodio({ ...podio, v: t })}>{TIMES[t].emoji} {TIMES[t].nome}</button>)}
              </div>
              <label className="lb">2º lugar (1 pt)</label>
              <div className="row podio" style={{ gap: 6, marginBottom: 12 }}>
                {times.map((t) => <button key={t} className={podio.s === t ? 'on' : ''} onClick={() => setPodio({ ...podio, s: t })}>{TIMES[t].emoji} {TIMES[t].nome}</button>)}
              </div>
              <button className="btn" onClick={salvarPodio}>{fechada ? 'Atualizar resultado' : 'Salvar resultado e pontuar'}</button>
              <p className="dica">Com 3 times: campeão 3 pts, 2º lugar 1 pt, 3º lugar 0. Convidados não pontuam.</p>
            </div>
          )}
          {diretor && !tres && (
            <div className="card">
              <div className="placar">
                <div className="lb"><span className="tag preto">Preto</span><input type="number" min="0" value={gp} onChange={(e) => setGp(e.target.value)} /></div>
                <span>×</span>
                <div className="lb"><span className="tag bege">Bege</span><input type="number" min="0" value={gb} onChange={(e) => setGb(e.target.value)} /></div>
              </div>
              <button className="btn" onClick={salvarResultado}>{fechada ? 'Atualizar resultado' : 'Salvar resultado e pontuar'}</button>
              <p className="dica" style={{ textAlign: 'center' }}>Não lembra o placar? Marque só quem venceu:</p>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn sec sm" style={{ flex: 1 }} onClick={() => salvarVencedor('P')}>⚫ Preto</button>
                <button className="btn sec sm" style={{ flex: 1 }} onClick={() => salvarVencedor('E')}>Empate</button>
                <button className="btn sec sm" style={{ flex: 1 }} onClick={() => salvarVencedor('B')}>🟡 Bege</button>
              </div>
              <p className="dica">Vitória = 3 pts · Empate = 1 pt · Derrota = 0. Cada jogador escalado recebe os pontos do seu time. Quem não jogou não conta jogo nem ponto. Convidados não pontuam.</p>
            </div>
          )}
          {!diretor && (
            <div className="card"><p className="dica" style={{ margin: 0 }}>
              {fechada ? `Resultado: ${nomeVencedor(rodada)}${temPlacar(rodada) ? ` (${rodada.gols_preto} × ${rodada.gols_bege})` : ''}` : 'Resultado ainda não lançado.'}
            </p></div>
          )}

          <h3>Rodadas registradas</h3>
          <div className="card"><div className="lista">
            {encerradas.map((r) => (
              <div key={r.id}>
                <div className={`item ${aberta === r.id ? 'aberto' : ''}`}
                     onClick={() => { setAberta(aberta === r.id ? null : r.id); setEditando(null) }}
                     style={{ cursor: 'pointer' }}>
                  <div className="nome">Seg {ddmm(r.data)}<span className="sub">
                    {r.cond_escalacoes.filter((e) => e.atleta_id).length} atletas
                    {r.cond_escalacoes.some((e) => e.convidado_nome) ? ` + ${r.cond_escalacoes.filter((e) => e.convidado_nome).length} conv.` : ''}
                    {tresTimes(r) ? ' · 3 times' : ''} · {nomeVencedor(r)}
                  </span></div>
                  {temPlacar(r)
                    ? <><span className="tag preto">Preto {r.gols_preto}</span><span className="tag bege">Bege {r.gols_bege}</span></>
                    : <span className="tag">{r.vencedor === 'E' ? 'empate' : `${TIMES[r.vencedor]?.emoji || ''} venceu`}</span>}
                </div>
                <div className="hist-det">
                  {chavesTimes(r.times_qtd).map((t) => (
                    <div key={t}><b>{TIMES[t].emoji} {TIMES[t].nome}:</b> {nomesDaRodada(r, t)}</div>
                  ))}
                  {diretor && temPlacar(r) && (
                    editando?.id === r.id ? (
                      <div style={{ paddingTop: 8 }}>
                        <div className="placar" style={{ margin: '4px 0 10px' }}>
                          <input type="number" min="0" value={editando.gp} onChange={(e) => setEditando({ ...editando, gp: e.target.value })} />
                          <span>×</span>
                          <input type="number" min="0" value={editando.gb} onChange={(e) => setEditando({ ...editando, gb: e.target.value })} />
                        </div>
                        <button className="btn sm" onClick={salvarCorrecao}>Salvar placar</button>
                      </div>
                    ) : (
                      <button className="btn sm sec" style={{ marginTop: 8 }}
                              onClick={(ev) => { ev.stopPropagation(); setEditando({ id: r.id, gp: r.gols_preto ?? '', gb: r.gols_bege ?? '' }) }}>
                        Corrigir placar
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
            {!encerradas.length && <p className="dica">Nenhuma rodada encerrada ainda.</p>}
          </div></div>
        </div>
      )}
    </section>
  )
}
