import { useEffect, useState } from 'react'
import { PosBtn, Modal, useToast } from './ui'
import { ini, aniv, URL_APP, linkWhatsApp, fora, POS, TAMANHOS } from './lib/util'
import * as db from './lib/dados'

const vazio = { nome: '', posicao: 'MEI', anivTxt: '', whatsapp: '', numero: '', tamanho: '' }

export default function Atletas({ atletas, recarregar, diretor, temporada, verRanking }) {
  const toast = useToast()
  const [form, setForm] = useState(null)      // null | {id?, nome, posicao, anivTxt, whatsapp}
  const [menu, setMenu] = useState(null)      // atleta (folha ⋯)
  const [convite, setConvite] = useState(null) // {atleta, papel?, token?}
  const [usuarios, setUsuarios] = useState([])
  const [fPos, setFPos] = useState(null)      // GOL | ZAG | MEI | ATA
  const [fSit, setFSit] = useState(null)      // apto | dm | afastado
  const [ordem, setOrdem] = useState('nome')  // nome | numero | posicao | aniv
  const [saidos, setSaidos] = useState([])    // quem saiu do time (ativo = false)

  const noDM = atletas.filter((a) => a.dm).length
  const afastados = atletas.filter((a) => a.afastado).length
  const comConta = (a) => usuarios.find((u) => u.atleta_id === a.id)

  const ORD = { nome: 'A–Z', numero: 'Número', posicao: 'Posição', aniv: 'Aniversário' }
  const mesDia = (a) => (a.aniv_mes ? a.aniv_mes * 100 + a.aniv_dia : 9999)
  const fonte = fSit === 'saiu' ? saidos : atletas
  const lista = fonte
    .filter((a) => (!fPos || a.posicao === fPos)
      && (!fSit || fSit === 'saiu' || (fSit === 'dm' ? a.dm : fSit === 'afastado' ? a.afastado : !fora(a))))
    .sort((x, y) => (
      ordem === 'numero' ? (x.numero ?? 999) - (y.numero ?? 999) || x.nome.localeCompare(y.nome)
        : ordem === 'posicao' ? POS.indexOf(x.posicao) - POS.indexOf(y.posicao) || x.nome.localeCompare(y.nome)
        : ordem === 'aniv' ? mesDia(x) - mesDia(y) || x.nome.localeCompare(y.nome)
          : x.nome.localeCompare(y.nome)
    ))
  const filtrando = fPos || fSit

  useEffect(() => { if (diretor) db.listarUsuarios().then(setUsuarios).catch(() => {}) }, [diretor, atletas])
  useEffect(() => { if (fSit === 'saiu') db.listarSaidos().then(setSaidos).catch((e) => toast(e.message)) }, [fSit, atletas])

  const run = async (fn, okMsg) => {
    try { await fn(); await recarregar(); if (okMsg) toast(okMsg) } catch (e) { toast(e.message) }
  }

  function abrirEditar(a) {
    if (!diretor) return
    setForm({ id: a.id, nome: a.nome, posicao: a.posicao, anivTxt: aniv(a), whatsapp: a.whatsapp || '', numero: a.numero ?? '', tamanho: a.tamanho || '' })
  }

  async function salvar() {
    if (!form.nome.trim()) return toast('Informe o nome')
    let aniv_dia = null, aniv_mes = null
    if (form.anivTxt.trim()) {
      const m = form.anivTxt.trim().match(/^(\d{1,2})[\/-](\d{1,2})$/)
      if (!m) return toast('Aniversário no formato dd/mm')
      aniv_dia = +m[1]; aniv_mes = +m[2]
    }
    if (form.numero !== '' && (isNaN(+form.numero) || +form.numero < 0 || +form.numero > 99)) return toast('Número de 0 a 99')
    const linha = {
      nome: form.nome.trim(), posicao: form.posicao, aniv_dia, aniv_mes,
      whatsapp: form.whatsapp.trim() || null,
      numero: form.numero === '' ? null : +form.numero,
      tamanho: form.tamanho || null,
    }
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
  async function saiuDoTime() {
    const a = menu
    if (!confirm(`${a.nome} saiu do time? Ele fica oculto nas listas e sai do ranking; o histórico das rodadas é mantido.`)) return
    setMenu(null)
    await run(() => db.marcarSaida(a.id), `${a.nome} saiu do time`)
  }
  async function voltouAoTime() {
    const a = menu; setMenu(null)
    try { await db.voltarAoTime(a.id); setSaidos(await db.listarSaidos()); await recarregar(); toast(`${a.nome} voltou ao time`) }
    catch (e) { toast(e.message) }
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
      {temporada && temporada.campeao_nome && (
        <div className="campeao-faixa home" onClick={verRanking}>
          <span className="tr">🏆</span>
          <div>
            <b>Campeão {temporada.ano}: {temporada.campeao_nome}</b>
            <span>{temporada.campeao_pontos} pts em {temporada.campeao_jogos} jogos · {temporada.total_rodadas} rodadas</span>
          </div>
        </div>
      )}
      <div className="row sb" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Atletas</h2>
        <span className="tag">
          {fSit === 'saiu' ? `${lista.length} saíram` : filtrando ? `${lista.length} de ${atletas.length}` : `${atletas.length} atletas`}
          {!filtrando && noDM ? ` · ${noDM} no DM` : ''}
          {!filtrando && afastados ? ` · ${afastados} afastado${afastados > 1 ? 's' : ''}` : ''}
        </span>
      </div>

      <div className="filtros">
        <div className="fl">
          {POS.map((p) => <button key={p} className={fPos === p ? 'on' : ''} onClick={() => setFPos(fPos === p ? null : p)}>{p}</button>)}
          <button className="ord" onClick={() => setOrdem(ordem === 'nome' ? 'numero' : ordem === 'numero' ? 'posicao' : ordem === 'posicao' ? 'aniv' : 'nome')} title="Mudar a ordem">⇅ {ORD[ordem]}</button>
        </div>
        <div className="fl">
          {[['apto', 'Disponíveis'], ['dm', '🏥 DM'], ['afastado', '⏸ Afastados'], ['saiu', '🚪 Saíram']].map(([k, nome]) => (
            <button key={k} className={fSit === k ? 'on' : ''} onClick={() => setFSit(fSit === k ? null : k)}>{nome}</button>
          ))}
          {filtrando && <button className="limpa" onClick={() => { setFPos(null); setFSit(null) }}>limpar</button>}
        </div>
      </div>
      <div className="card">
        <div className="lista">
          {lista.map((a) => (
            <div key={a.id} className={`item ${fora(a) || a.ativo === false ? 'dm' : ''}`}>
              <div className={`av ${a.numero != null ? 'camisa' : ''}`}>{a.numero != null ? a.numero : ini(a.nome)}</div>
              <div className="nome" onClick={() => abrirEditar(a)} style={{ cursor: diretor ? 'pointer' : 'default' }}>
                {a.nome} {a.dm && <span className="tag dm">DM</span>}{a.afastado && <span className="tag dm">afastado</span>}{a.ativo === false && <span className="tag dm">saiu</span>}
                <span className="sub">{a.tamanho ? `👕 ${a.tamanho} · ` : ''}🎂 {aniv(a) || '—'} · 📱 {a.whatsapp || '—'}{diretor && comConta(a) ? ` · ${comConta(a).papel === 'diretor' ? '⭐ diretoria' : '✅ tem acesso'}` : ''}</span>
              </div>
              {diretor
                ? <PosBtn pos={a.posicao} onChange={(p) => run(() => db.atualizarAtleta(a.id, { posicao: p }))} />
                : <span className={`posbtn ${a.posicao}`} style={{ cursor: 'default' }}>{a.posicao}</span>}
              {diretor && <button className="more" title="Convidar para o app" onClick={() => setConvite({ atleta: a })}>✉</button>}
              {diretor && <button className="more" onClick={() => setMenu(a)}>⋯</button>}
            </div>
          ))}
          {!lista.length && <p className="dica">{atletas.length ? 'Nenhum atleta com esses filtros.' : 'Nenhum atleta ainda.'}</p>}
        </div>
      </div>
      {diretor && <button className="fab" onClick={() => setForm({ ...vazio })}>+</button>}
      {diretor && <p className="dica">✉ envia o convite de acesso ao app · ⋯ abre DM, afastamento e saída do time · segure a posição para trocar.</p>}

      <Modal aberto={!!form}>
        {form && (
          <>
            <h2>{form.id ? 'Editar atleta' : 'Novo atleta'}</h2>
            <label className="lb">Nome</label>
            <input className="txt" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: João" />
            <label className="lb">Posição</label>
            <PosBtn big pos={form.posicao} onChange={(p) => setForm({ ...form, posicao: p })} />
            <p className="dica" style={{ margin: '-2px 0 10px' }}>Segure o botão para escolher: GOL · ZAG · MEI · ATA.</p>
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <label className="lb">Camisa nº</label>
                <input className="txt" type="number" min="0" max="99" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="—" />
              </div>
              <div style={{ flex: 1 }}>
                <label className="lb">Tamanho</label>
                <select className="txt" value={form.tamanho} onChange={(e) => setForm({ ...form, tamanho: e.target.value })}>
                  <option value="">—</option>
                  {TAMANHOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
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
            {menu.ativo === false ? (
              <>
                <button onClick={voltouAoTime}>↩️ Voltou ao time</button>
                <button onClick={() => setMenu(null)}>Fechar</button>
              </>
            ) : (
              <>
                <button onClick={toggleDM}>{menu.dm ? '✅ Voltar do DM' : '🏥 Enviar para o DM'}</button>
                <button onClick={toggleAfastado}>{menu.afastado ? '✅ Voltar ao time' : '⏸ Afastamento justificado'}</button>
                <button onClick={() => setMenu(null)}>Fechar</button>
                <button className="perigo" onClick={saiuDoTime}>🚪 Saiu do time</button>
              </>
            )}
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
