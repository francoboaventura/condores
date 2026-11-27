import { useState } from 'react'
import { useToast } from './ui'
import { aniv, ini } from './lib/util'
import * as db from './lib/dados'

const ESCUDO = import.meta.env.BASE_URL + 'escudo.png'

// Primeiro acesso do atleta: cria a própria senha (se ainda está com a padrão),
// confirma WhatsApp e aniversário e, se quiser, sobe uma foto.
export default function PrimeiroAcesso({ atleta, trocarSenha, onPronto, onSair }) {
  const toast = useToast()
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [whats, setWhats] = useState(atleta.whatsapp || '')
  const [anivTxt, setAnivTxt] = useState(aniv(atleta))
  const [foto, setFoto] = useState(null)          // arquivo escolhido
  const [previa, setPrevia] = useState(atleta.foto_url || '')
  const [ocupado, setOcupado] = useState(false)

  function escolherFoto(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFoto(f); setPrevia(URL.createObjectURL(f))
  }

  async function salvar(e) {
    e.preventDefault()
    if (trocarSenha) {
      if (senha.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres')
      if (senha !== senha2) return toast('As duas senhas não são iguais')
    }
    const m = anivTxt.trim().match(/^(\d{1,2})[/-](\d{1,2})$/)
    if (!m || +m[1] < 1 || +m[1] > 31 || +m[2] < 1 || +m[2] > 12) return toast('Aniversário no formato dd/mm')
    if (!whats.trim()) return toast('Informe o WhatsApp')
    setOcupado(true)
    try {
      if (trocarSenha) await db.trocarSenha(senha)
      let url = null
      if (foto) {
        try { url = await db.enviarFoto(atleta.id, foto) }
        catch { toast('Não deu para enviar a foto — dá para tentar depois') }
      }
      await db.completarCadastro(whats.trim(), +m[1], +m[2], url)
      onPronto()
    } catch (err) { toast(err.message) } finally { setOcupado(false) }
  }

  return (
    <div id="login" className="primeiro">
      <img src={ESCUDO} alt="Condores" />
      <div className="card">
        <form onSubmit={salvar}>
          <h2>Bem-vindo, {atleta.nome}!</h2>
          <p className="dica" style={{ marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>Primeiro acesso: confira seus dados para entrar no app.</p>

          {trocarSenha && (
            <>
              <label className="lb">Crie sua senha</label>
              <input className="txt" type="password" autoComplete="new-password" autoCapitalize="none" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} required />
              <label className="lb">Repita a senha</label>
              <input className="txt" type="password" autoComplete="new-password" autoCapitalize="none" minLength={6} value={senha2} onChange={(e) => setSenha2(e.target.value)} required />
              <p className="dica" style={{ marginTop: -4, marginBottom: 12 }}>A partir de agora você entra com essa senha, não mais com a padrão.</p>
            </>
          )}

          <label className="lb">WhatsApp</label>
          <input className="txt" type="tel" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(51) 9xxxx-xxxx" required />
          <label className="lb">Aniversário</label>
          <input className="txt" inputMode="numeric" value={anivTxt} onChange={(e) => setAnivTxt(e.target.value)} placeholder="dd/mm" required />

          <label className="lb">Foto (opcional)</label>
          <label className="foto-up">
            {previa ? <img src={previa} alt="" /> : <span className="av camisa">{atleta.numero ?? ini(atleta.nome)}</span>}
            <span>{previa ? 'Trocar foto' : 'Escolher foto'}</span>
            <input type="file" accept="image/*" onChange={escolherFoto} hidden />
          </label>

          <button className="btn" disabled={ocupado} style={{ marginTop: 6 }}>{ocupado ? 'Salvando…' : 'Salvar e entrar'}</button>
          <p className="dica" style={{ textAlign: 'center', marginTop: 14 }}>
            <a href="#" style={{ color: 'var(--mudo)' }} onClick={(e) => { e.preventDefault(); onSair() }}>Não é você? Sair</a>
          </p>
        </form>
      </div>
    </div>
  )
}
