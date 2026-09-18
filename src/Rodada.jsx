import { useEffect, useRef, useState } from 'react'
import { useToast } from './ui'
import { ini, ddmm, nomeVencedor } from './lib/util'
import * as db from './lib/dados'

export default function Rodada({ atletas, irParaMsg, irParaRanking }) {
  const toast = useToast()
  const [passo, setPasso] = useState(1)
  const [rodada, setRodada] = useState(null)
  const [conf, setConf] = useState([])         // {rodada_id, atleta_id, status}
  const [esc, setEsc] = useState([])           // linhas de cond_escalacoes
  const [convBanco, setConvBanco] = useState([]) // convidados ainda sem time (só local)
  const [convNome, setConvNome] = useState('')
  const [gp, setGp] = useState('')
  const [gb, setGb] = useState('')
  const [encerradas, setEncerradas] = useState([])
  const [editando, setEditando] = useState(null) // rodada encerrada em correção
  const [carregando, setCarregando] = useState(true)

  const fechada = rodada?.status === 'encerrada'

  async function carregar() {
    try {
      const r = await db.rodadaAtual()
      setRodada(r)
      const [c, e, enc] = await Promise.all([db.listarConfirmacoes(r.id), db.listarEscalacao(r.id), db.listarRodadasEncerradas()])
      setConf(c); setEsc(e); setEncerradas(enc)
      if (r.gols_preto != null) { setGp(String(r.gols_preto)); setGb(String(r.gols_bege)) }
    } catch (err) { toast(err.message) } finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])

  const run = async (fn, okMsg) => {
    try { await fn(); await carregar(); if (okMsg) toast(okMsg) } catch (e) { toast(e.message) }
  }

  // ---------- confirmações ----------
  const statusDe = (id) => conf.find((c) => c.atleta_id === id)?.status
  const ativos = atletas.filter((a) => !a.dm)
  const sim = conf.filter((c) => c.status === 'S').map((c) => c.atleta_id)
  const nao = conf.filter((c) => c.status === 'N').length
  const pend = ativos.length - sim.length - nao

  function alternar(a) {
    if (fechada) return toast('Rodada encerrada')
    if (a.dm) return toast('Atleta no DM')
    const s = statusDe(a.id)
    const novo = s === 'S' ? 'N' : s === 'N' ? null : 'S'
    run(async () => {
      await db.setConfirmacao(rodada.id, a.id, novo)
      if (novo !== 'S') { const linha = esc.find((e) => e.atleta_id === a.id); if (linha) await db.removerEscalacao(linha.id) }
    })
  }

  // ---------- escalação ----------
  const nomeDe = (e) => e.convidado_nome || atletas.find((a) => a.id === e.atleta_id)?.nome || '?'
  const posDe = (e) => (e.convidado_nome ? 'conv.' : atletas.find((a) => a.id === e.atleta_id)?.posicao || '')
  const confirmadosSemTime = sim.filter((id) => !esc.some((e) => e.atleta_id === id)).map((id) => atletas.find((a) => a.id === id)).filter(Boolean)

  // key: 'a:<atleta_id>' (banco) | 'c:<i>' (convidado no banco) | 'e:<id>' (linha já escalada)
  async function colocar(key, t, gk) {
    if (fechada) return toast('Rodada encerrada')
    await run(async () => {
      if (gk && t) {
        // só um goleiro por time: o anterior volta pro banco
        for (const e of esc.filter((x) => x.time === t && x.goleiro && `e:${x.id}` !== key)) {
          if (e.convidado_nome) setConvBanco((b) => [...b, e.convidado_nome])
          await db.removerEscalacao(e.id)
        }
      }
      if (key.startsWith('a:')) {
        if (!t) return
        await db.inserirEscalacao({ rodada_id: rodada.id, atleta_id: key.slice(2), time: t, goleiro: !!gk })
      } else if (key.startsWith('c:')) {
        if (!t) return
        const i = +key.slice(2); const nome = convBanco[i]
        setConvBanco((b) => b.filter((_, j) => j !== i))
        await db.inserirEscalacao({ rodada_id: rodada.id, convidado_nome: nome, time: t, goleiro: !!gk })
      } else {
        const id = key.slice(2); const linha = esc.find((e) => e.id === id)
        if (!t) {
          if (linha?.convidado_nome) setConvBanco((b) => [...b, linha.convidado_nome])
          await db.removerEscalacao(id)
        } else await db.atualizarEscalacao(id, { time: t, goleiro: !!gk })
      }
    })
  }

  function addConvidado() {
    const n = convNome.trim(); if (!n) return
    setConvBanco((b) => [...b, n]); setConvNome('')
  }

  async function sortear() {
    if (fechada) return toast('Rodada encerrada')
    const c = sim.map((id) => atletas.find((a) => a.id === id)).filter(Boolean).sort(() => Math.random() - 0.5)
    const gks = c.filter((a) => a.posicao === 'GOL'), lin = c.filter((a) => a.posicao !== 'GOL')
    const linhas = []
    gks.forEach((a, i) => linhas.push({ rodada_id: rodada.id, atleta_id: a.id, time: i % 2 ? 'B' : 'P', goleiro: i < 2 }))
    lin.forEach((a, i) => linhas.push({ rodada_id: rodada.id, atleta_id: a.id, time: i % 2 ? 'B' : 'P', goleiro: false }))
    await run(async () => {
      const conv = esc.filter((e) => e.convidado_nome).map((e) => e.convidado_nome)
      await db.limparEscalacao(rodada.id)
      setConvBanco((b) => [...b, ...conv])
      if (linhas.length) await db.inserirEscalacao(linhas)
    })
  }
  async function limpar() {
    if (fechada) return toast('Rodada encerrada')
    await run(async () => {
      const conv = esc.filter((e) => e.convidado_nome).map((e) => e.convidado_nome)
      setConvBanco((b) => [...b, ...conv])
      await db.limparEscalacao(rodada.id)
    })
  }

  // arrastar (pointer events: dedo e mouse)
  const drag = useRef(null)
  useEffect(() => {
    const down = (e) => {
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

  // ---------- resultado ----------
  async function salvarResultado() {
    if (gp === '' || gb === '') return toast('Preencha o placar')
    await run(() => db.salvarResultado(rodada.id, +gp, +gb), 'Rodada salva · ranking atualizado')
    irParaRanking()
  }
  async function salvarCorrecao() {
    if (editando.gp === '' || editando.gb === '') return toast('Preencha o placar')
    await run(() => db.salvarResultado(editando.id, +editando.gp, +editando.gb), 'Placar corrigido')
    setEditando(null)
  }

  if (carregando) return <section className="tela on"><p className="dica">Carregando rodada…</p></section>

  const Time = ({ t, nome, emoji }) => {
    const gks = esc.filter((e) => e.time === t && e.goleiro)
    const lin = esc.filter((e) => e.time === t && !e.goleiro)
    return (
      <div className={`time ${t === 'P' ? 'preto' : 'bege'}`}>
        <h4>{emoji} {nome} <span>{gks.length + lin.length}</span></h4>
        <div className={`gk ${t === 'P' ? 'verde' : 'laranja'} drop ${gks.length ? '' : 'vazio'}`} data-t={t} data-gk="1">
          {gks.length ? gks.map((e) => <div key={e.id} className={`j ${e.convidado_nome ? 'conv' : ''}`} data-key={`e:${e.id}`}>🧤 {nomeDe(e)}<span className="x">⇄</span></div>) : '🧤 goleiro'}
        </div>
        <div className="linha drop" data-t={t}>
          {lin.map((e) => <div key={e.id} className={`j ${e.convidado_nome ? 'conv' : ''}`} data-key={`e:${e.id}`}>{nomeDe(e)} <small style={{ opacity: .6 }}>{posDe(e)}</small><span className="x">⇄</span></div>)}
        </div>
      </div>
    )
  }

  return (
    <section className="tela on">
      <div className="row sb" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Rodada</h2>
        <span className="tag preto">Seg {ddmm(rodada.data)}{fechada ? ' · encerrada' : ''}</span>
      </div>
      <div className="seg">
        {[1, 2, 3].map((n) => <button key={n} className={passo === n ? 'on' : ''} onClick={() => setPasso(n)}>{n} · {['Confirmações', 'Escalação', 'Resultado'][n - 1]}</button>)}
      </div>

      {passo === 1 && (
        <div>
          <div className="stat">
            <div className="card"><b>{sim.length}</b><span>Confirmados</span></div>
            <div className="card"><b>{nao}</b><span>Não vão</span></div>
            <div className="card"><b>{pend}</b><span>Sem resposta</span></div>
          </div>
          <div className="card"><div className="lista">
            {atletas.map((a) => { const s = statusDe(a.id); return (
              <div key={a.id} className={`item ${a.dm ? 'dm' : ''}`} onClick={() => alternar(a)} style={{ cursor: 'pointer' }}>
                <div className="av">{ini(a.nome)}</div>
                <div className="nome">{a.nome}<span className="sub">{a.posicao}</span></div>
                {a.dm ? <span className="tag dm">DM</span> : s === 'S' ? <span className="tag ok">✓ vai</span> : s === 'N' ? <span className="tag nao">✗ não vai</span> : <span className="tag">—</span>}
              </div>) })}
          </div></div>
          <button className="btn" onClick={() => irParaMsg('lista')}>Cobrar quem ainda não confirmou</button>
          <p className="dica">Toque no nome para alternar: confirmado → não vai → sem resposta.</p>
        </div>
      )}

      {passo === 2 && (
        <div>
          <div className="times">
            <Time t="P" nome="Preto" emoji="⚫" />
            <Time t="B" nome="Bege" emoji="🟡" />
          </div>
          <h3>Confirmados sem time {confirmadosSemTime.length + convBanco.length ? `(${confirmadosSemTime.length + convBanco.length})` : ''}</h3>
          <div className="card">
            <div className="banco drop" data-t="">
              {confirmadosSemTime.map((a) => <span key={a.id} className={`chip ${a.posicao === 'GOL' ? 'g' : ''}`} data-key={`a:${a.id}`}>{a.nome} <small style={{ opacity: .6 }}>{a.posicao}</small></span>)}
              {convBanco.map((n, i) => <span key={`c${i}`} className="chip conv" data-key={`c:${i}`}>👤 {n}</span>)}
              {!confirmadosSemTime.length && !convBanco.length && <span className="dica" style={{ margin: 0 }}>Todos escalados. Arraste alguém pra cá para tirar do time.</span>}
            </div>
            <div className="conv-add">
              <input className="txt" value={convNome} onChange={(e) => setConvNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addConvidado()} placeholder="Nome do convidado" />
              <button className="btn sm" onClick={addConvidado}>+ Convidado</button>
            </div>
            <p className="dica" style={{ marginTop: 6 }}>Convidado entra só nesta rodada — não fica cadastrado nem pontua.</p>
          </div>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <button className="btn sec" onClick={sortear}>Sortear times</button>
            <button className="btn sec" onClick={limpar}>Limpar</button>
          </div>
          <button className="btn" onClick={() => irParaMsg('escalacao')}>Gerar escalação pro WhatsApp (segunda)</button>
          <p className="dica">Arraste o nome para dentro do time. Goleiro vai na faixa verde (Preto) ou laranja (Bege). Arraste de volta pro banco para tirar.</p>
        </div>
      )}

      {passo === 3 && (
        <div>
          <div className="card">
            <div className="placar">
              <div className="lb"><span className="tag preto">Preto</span><input type="number" min="0" value={gp} onChange={(e) => setGp(e.target.value)} /></div>
              <span>×</span>
              <div className="lb"><span className="tag bege">Bege</span><input type="number" min="0" value={gb} onChange={(e) => setGb(e.target.value)} /></div>
            </div>
            <button className="btn" onClick={salvarResultado}>{fechada ? 'Atualizar resultado' : 'Salvar resultado e pontuar'}</button>
            <p className="dica">Vitória = 3 pts · Empate = 1 pt · Derrota = 0. Cada jogador escalado recebe os pontos do seu time. Quem não jogou não conta jogo nem ponto. Convidados não pontuam.</p>
          </div>
          <h3>Rodadas registradas</h3>
          <div className="card"><div className="lista">
            {encerradas.map((r) => (
              <div key={r.id}>
                <div className="item" onClick={() => setEditando(editando?.id === r.id ? null : { id: r.id, gp: String(r.gols_preto), gb: String(r.gols_bege) })} style={{ cursor: 'pointer' }}>
                  <div className="nome">Seg {ddmm(r.data)}<span className="sub">{r.cond_escalacoes.filter((e) => e.atleta_id).length} atletas{r.cond_escalacoes.some((e) => e.convidado_nome) ? ` + ${r.cond_escalacoes.filter((e) => e.convidado_nome).length} conv.` : ''} · {nomeVencedor(r)}</span></div>
                  <span className="tag preto">Preto {r.gols_preto}</span><span className="tag bege">Bege {r.gols_bege}</span>
                </div>
                {editando?.id === r.id && (
                  <div style={{ padding: '4px 0 12px' }}>
                    <div className="placar" style={{ margin: '4px 0 10px' }}>
                      <input type="number" min="0" value={editando.gp} onChange={(e) => setEditando({ ...editando, gp: e.target.value })} />
                      <span>×</span>
                      <input type="number" min="0" value={editando.gb} onChange={(e) => setEditando({ ...editando, gb: e.target.value })} />
                    </div>
                    <button className="btn sm" onClick={salvarCorrecao}>Corrigir placar</button>
                  </div>
                )}
              </div>
            ))}
            {!encerradas.length && <p className="dica">Nenhuma rodada encerrada ainda.</p>}
          </div></div>
        </div>
      )}
    </section>
  )
}
