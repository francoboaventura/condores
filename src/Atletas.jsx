import { useState } from 'react'
import { PosBtn, Modal, useToast } from './ui'
import { ini, aniv, pad } from './lib/util'
import * as db from './lib/dados'

const vazio = { nome: '', posicao: 'MEI', anivTxt: '', whatsapp: '' }

export default function Atletas({ atletas, recarregar }) {
  const toast = useToast()
  const [form, setForm] = useState(null) // null | {id?, nome, posicao, anivTxt, whatsapp}
  const [menu, setMenu] = useState(null) // atleta

  const noDM = atletas.filter((a) => a.dm).length

  const run = async (fn, okMsg) => {
    try { await fn(); await recarregar(); if (okMsg) toast(okMsg) } catch (e) { toast(e.message) }
  }

  function abrirEditar(a) {
    setForm({ id: a.id, nome: a.nome, posicao: a.posicao, anivTxt: aniv(a), whatsapp: a.whatsapp || '' })
  }

  async function salvar() {
    if (!form.nome.trim()) return toast('Informe o nome')
    let aniv_dia = null, aniv_mes = null
    if (form.anivTxt.trim()) {
      const m = form.anivTxt.trim().match(/^(\d{1,2})[\/-](\d{1,2})$/)
      if (!m) return toast('Aniversário no formato dd/mm')
      aniv_dia = +m[1]; aniv_mes = +m[2]
    }
    const linha = { nome: form.nome.trim(), posicao: form.posicao, aniv_dia, aniv_mes, whatsapp: form.whatsapp.trim() || null }
    if (form.id) linha.id = form.id
    await run(() => db.salvarAtleta(linha), form.id ? 'Atleta atualizado' : 'Atleta cadastrado')
    setForm(null)
  }

  async function toggleDM() {
    const a = menu; setMenu(null)
    await run(() => db.atualizarAtleta(a.id, { dm: !a.dm }), a.dm ? `${a.nome} de volta` : `${a.nome} no DM`)
  }
  async function excluir() {
    const a = menu
    if (!confirm(`Excluir ${a.nome}? O histórico de rodadas dele é mantido no ranking.`)) return
    setMenu(null)
    await run(() => db.excluirAtleta(a.id), 'Atleta excluído')
  }

  return (
    <section className="tela on">
      <div className="row sb" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Atletas</h2>
        <span className="tag">{atletas.length} atletas{noDM ? ` · ${noDM} no DM` : ''}</span>
      </div>
      <div className="card">
        <div className="lista">
          {atletas.map((a) => (
            <div key={a.id} className={`item ${a.dm ? 'dm' : ''}`}>
              <div className="av">{ini(a.nome)}</div>
              <div className="nome" onClick={() => abrirEditar(a)} style={{ cursor: 'pointer' }}>
                {a.nome} {a.dm && <span className="tag dm">DM</span>}
                <span className="sub">🎂 {aniv(a) || '—'} · 📱 {a.whatsapp || '—'}</span>
              </div>
              <PosBtn pos={a.posicao} onChange={(p) => run(() => db.atualizarAtleta(a.id, { posicao: p }))} />
              <button className="more" onClick={() => setMenu(a)}>⋯</button>
            </div>
          ))}
          {!atletas.length && <p className="dica">Nenhum atleta ainda. Toque em + para cadastrar.</p>}
        </div>
      </div>
      <button className="fab" onClick={() => setForm({ ...vazio })}>+</button>

      <Modal aberto={!!form}>
        {form && (
          <>
            <h2>{form.id ? 'Editar atleta' : 'Novo atleta'}</h2>
            <label className="lb">Nome</label>
            <input className="txt" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: João" />
            <label className="lb">Posição</label>
            <PosBtn big pos={form.posicao} onChange={(p) => setForm({ ...form, posicao: p })} />
            <p className="dica" style={{ margin: '-2px 0 10px' }}>Segure o botão para escolher: GOL · ZAG · MEI · ATA.</p>
            <label className="lb">Aniversário</label>
            <input className="txt" value={form.anivTxt} onChange={(e) => setForm({ ...form, anivTxt: e.target.value })} placeholder="dd/mm" />
            <label className="lb">WhatsApp</label>
            <input className="txt" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(51) 9xxxx-xxxx" />
            <p className="dica" style={{ margin: '-4px 0 12px' }}>Foto do atleta: entra numa próxima versão.</p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sec" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn" onClick={salvar}>Salvar</button>
            </div>
          </>
        )}
      </Modal>

      <Modal aberto={!!menu}>
        {menu && (
          <div className="sheet">
            <h2>{menu.nome}</h2>
            <button onClick={toggleDM}>{menu.dm ? '✅ Voltar do DM' : '🏥 Enviar para o DM'}</button>
            <button onClick={() => setMenu(null)}>Fechar</button>
            <button className="perigo" onClick={excluir}>🗑 Excluir atleta</button>
          </div>
        )}
      </Modal>
    </section>
  )
}
