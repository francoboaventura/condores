import { useEffect, useState } from 'react'
import { useToast } from './ui'
import { ddmm, URL_APP } from './lib/util'
import * as db from './lib/dados'

// Lista de presença do churrasco. A diretoria abre (nome + data), fecha e reabre;
// cada atleta marca "vou" ou "não vou" enquanto estiver aberta (o banco recusa com a lista fechada).
export default function Churrasco({ atletas, diretor, meuAtletaId }) {
  const toast = useToast()
  const [ev, setEv] = useState(undefined)   // undefined = carregando, null = nenhum
  const [pres, setPres] = useState([])
  const [form, setForm] = useState(null)    // {titulo, data}
  const [lista, setLista] = useState(false)

  async function carregar() {
    try {
      const e = await db.ultimoChurrasco()
      setEv(e); setPres(e ? await db.listarPresencasEvento(e.id) : [])
    } catch (err) { setEv(null); toast(err.message) }
  }
  useEffect(() => { carregar() }, [])
  const run = async (fn, msg) => { try { await fn(); await carregar(); if (msg) toast(msg) } catch (e) { toast(e.message) } }

  if (ev === undefined) return null
  if (!ev && !diretor) return null

  async function abrir() {
    if (!form.titulo.trim()) return toast('Dê um nome ao churrasco')
    if (!form.data) return toast('Escolha a data')
    await run(() => db.criarChurrasco(form.titulo.trim(), form.data), 'Lista do churrasco aberta')
    setForm(null)
  }

  if (!ev || form) {
    return (
      <div className="card churras">
        {!form
          ? <button className="btn sec" onClick={() => setForm({ titulo: 'Churrasco dos Condores', data: '' })}>🍖 Abrir lista de presença do churrasco</button>
          : <>
            <h4>🍖 Novo churrasco</h4>
            <label className="lb">Nome</label>
            <input className="txt" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            <label className="lb">Data</label>
            <input className="txt" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sec" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn" onClick={abrir}>Abrir a lista</button>
            </div>
          </>}
      </div>
    )
  }

  const nome = (id) => atletas.find((a) => a.id === id)?.nome
  const vao = pres.filter((p) => p.status === 'S').map((p) => nome(p.atleta_id)).filter(Boolean).sort()
  const naoVao = pres.filter((p) => p.status === 'N').map((p) => nome(p.atleta_id)).filter(Boolean).sort()
  const meu = pres.find((p) => p.atleta_id === meuAtletaId)?.status
  const marcar = (s) => {
    if (!ev.aberta) return toast('A lista do churrasco está fechada')
    run(() => db.setPresencaEvento(ev.id, meuAtletaId, meu === s ? null : s))
  }
  const texto = `🍖 *${ev.titulo}* — ${ddmm(ev.data)}\n\n✅ Vão (${vao.length}):\n${vao.map((n, i) => `${i + 1}. ${n}`).join('\n') || '—'}`
    + (ev.aberta ? `\n\nAinda não marcou? Entre no app e confirme: ${URL_APP}` : '')
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); toast('Lista copiada') } catch { toast('Não deu para copiar') }
  }

  return (
    <div className="card churras">
      <h4>🍖 {ev.titulo}</h4>
      <div className="sub">{ddmm(ev.data)} · {ev.aberta ? 'lista aberta' : 'lista fechada'} · {vao.length} vão{naoVao.length ? ` · ${naoVao.length} não vão` : ''}</div>
      {meuAtletaId && (ev.aberta || meu) && (
        <div className="escolha">
          <button className={`btn ${meu === 'S' ? 'on' : 'sec'}`} onClick={() => marcar('S')}>✅ Vou</button>
          <button className={`btn ${meu === 'N' ? 'on' : 'sec'}`} onClick={() => marcar('N')}>✗ Não vou</button>
        </div>
      )}
      <button className="fechar" style={{ marginTop: 8 }} onClick={() => setLista(!lista)}>{lista ? 'esconder a lista' : 'ver quem vai'}</button>
      {lista && (
        <ul>
          {vao.map((n, i) => <li key={n}>{i + 1}. {n}</li>)}
          {!vao.length && <li>Ninguém confirmou ainda.</li>}
          {naoVao.length > 0 && <li style={{ color: 'var(--mudo)' }}>Não vão: {naoVao.join(', ')}</li>}
        </ul>
      )}
      {diretor && (
        <div className="acoes">
          <button className="btn sm" onClick={copiar}>Copiar lista p/ WhatsApp</button>
          <button className="btn sm sec" onClick={() => run(() => db.setChurrascoAberto(ev.id, !ev.aberta), ev.aberta ? 'Lista fechada' : 'Lista reaberta')}>{ev.aberta ? '🔒 Fechar a lista' : '🔓 Reabrir'}</button>
          {!ev.aberta && <button className="btn sm sec" onClick={() => setForm({ titulo: 'Churrasco dos Condores', data: '' })}>🍖 Novo churrasco</button>}
        </div>
      )}
    </div>
  )
}
