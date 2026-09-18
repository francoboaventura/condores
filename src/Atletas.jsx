import { useEffect, useState } from 'react'
import { PosBtn, Modal, useToast } from './ui'
import { ini, aniv, URL_APP, linkWhatsApp, fora } from './lib/util'
import * as db from './lib/dados'

const vazio = { nome: '', posicao: 'MEI', anivTxt: '', whatsapp: '' }

export default function Atletas({ atletas, recarregar, diretor }) {
  const toast = useToast()
  const [form, setForm] = useState(null)      // null | {id?, nome, posicao, anivTxt, whatsapp}
  const [menu, setMenu] = useState(null)      // atleta (folha ⋯)
  const [convite, setConvite] = useState(null) // {atleta, papel?, token?}
  const [usuarios, setUsuarios] = useState([])

  const noDM = atletas.filter((a) => a.dm).length
  const afastados = atletas.filter((a) => a.afastado).length
  const comConta = (a) => usuarios.find((u) => u.atleta_id === a.id)

  useEffect(() => { if (diretor) db.listarUsuarios().then(setUsuarios).catch(() => {}) }, [diretor, atletas])

  const run = async (fn, okMsg) => {
    try { await fn(); await recarregar(); if (okMsg) toast(okMsg) } catch (e) { toast(e.message) }
  }

  function abrirEditar(a) {
    if (!diretor) return
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
  async function toggleAfastado() {
    const a = menu; setMenu(null)
    await run(() => db.atualizarAtleta(a.id, { afastado: !a.afastado }), a.afastado ? `${a.nome} de volta ao time` : `${a.nome} afastado`)
  }
  async function excluir() {
    const a = menu
    if (!confirm(`Excluir ${a.nome}? O histórico de rodadas dele é mantido no ranking.`)) return
    setMenu(null)
    await run(() => db.excluirAtleta(a.id), 'Atleta excluído')
  }

  // ---------- convite ----------
  async function gerarConvite(papel) {
    try {
      const token = await db.criarConvite(convite.atleta.id, papel)
      setConvite({ ...convite, papel, token })
    } catch (e) { toast(e.message) }
  }
  const textoConvite = (c) =>
    `🦅 *CONDORES — seu acesso ao app*\n\nFala, ${c.atleta.nome}! Esse é o seu link pessoal pra entrar no app do Condores${c.papel === 'diretor' ? ' (acesso de diretoria)' : ''}:\n\n${URL_APP}#/convite/${c.token}\n\nAbre, cria sua senha e pronto. Lá você confirma presença, vê a escalação e o ranking.`
  async function copiarConvite() {
    try { await navigator.clipboard.writeText(textoConvite(convite)); toast('Copiado!') } catch { toast('Selecione o texto e copie') }
  }

  return (
    <section className="tela on">
      <div className="row sb" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Atletas</h2>
        <span className="tag">{atletas.length} atletas{noDM ? ` · ${noDM} no DM` : ''}{afastados ? ` · ${afastados} afastado${afastados > 1 ? 's' : ''}` : ''}</span>
      </div>
      <div className="card">
        <div className="lista">
          {atletas.map((a) => (
            <div key={a.id} className={`item ${fora(a) ? 'dm' : ''}`}>
              <div className="av">{ini(a.nome)}</div>
              <div className="nome" onClick={() => abrirEditar(a)} style={{ cursor: diretor ? 'pointer' : 'default' }}>
                {a.nome} {a.dm && <span className="tag dm">DM</span>}{a.afastado && <span className="tag dm">afastado</span>}
                <span className="sub">🎂 {aniv(a) || '—'} · 📱 {a.whatsapp || '—'}{diretor && comConta(a) ? ` · ${comConta(a).papel === 'diretor' ? '⭐ diretoria' : '✅ tem acesso'}` : ''}</span>
              </div>
              {diretor
                ? <PosBtn pos={a.posicao} onChange={(p) => run(() => db.atualizarAtleta(a.id, { posicao: p }))} />
                : <span className={`posbtn ${a.posicao}`} style={{ cursor: 'default' }}>{a.posicao}</span>}
              {diretor && <button className="more" title="Convidar para o app" onClick={() => setConvite({ atleta: a })}>✉</button>}
              {diretor && <button className="more" onClick={() => setMenu(a)}>⋯</button>}
            </div>
          ))}
          {!atletas.length && <p className="dica">Nenhum atleta ainda.</p>}
        </div>
      </div>
      {diretor && <button className="fab" onClick={() => setForm({ ...vazio })}>+</button>}
      {diretor && <p className="dica">✉ envia o convite de acesso ao app · ⋯ abre DM, afastamento e excluir · segure a posição para trocar.</p>}

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
            <button onClick={toggleAfastado}>{menu.afastado ? '✅ Voltar ao time' : '⏸ Afastamento justificado'}</button>
            <button onClick={() => setMenu(null)}>Fechar</button>
            <button className="perigo" onClick={excluir}>🗑 Excluir atleta</button>
          </div>
        )}
      </Modal>

      <Modal aberto={!!convite}>
        {convite && !convite.token && (
          <div className="sheet">
            <h2>Convidar {convite.atleta.nome}</h2>
            <p className="dica" style={{ marginBottom: 12 }}>Que tipo de acesso?</p>
            <button onClick={() => gerarConvite('atleta')}>👤 Usuário comum — vê tudo e confirma a própria presença</button>
            <button onClick={() => gerarConvite('diretor')}>⭐ Diretor — cadastra, escala, lança resultado e convida</button>
            <button onClick={() => setConvite(null)}>Cancelar</button>
          </div>
        )}
        {convite && convite.token && (
          <>
            <h2>Convite pronto</h2>
            <pre className="msg">{textoConvite(convite)}</pre>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={copiarConvite}>Copiar</button>
              <a className="btn sec" href={linkWhatsApp(convite.atleta.whatsapp, textoConvite(convite))} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Abrir no WhatsApp</a>
            </div>
            <p className="dica">O link é pessoal: quem abrir cria a conta já ligada à ficha de {convite.atleta.nome}.</p>
            <button className="btn sec" style={{ marginTop: 8 }} onClick={() => setConvite(null)}>Fechar</button>
          </>
        )}
      </Modal>
    </section>
  )
}
