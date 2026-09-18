import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useToast } from './ui'
import * as db from './lib/dados'

const ESCUDO = import.meta.env.BASE_URL + 'escudo.png'

// Tela de entrada. Com um convite na URL (#/convite/TOKEN) abre o cadastro; sem, abre o login.
export default function Login({ token }) {
  const toast = useToast()
  const [modo, setModo] = useState(token ? 'cadastro' : 'entrar')
  const [convite, setConvite] = useState(null) // {nome, papel, usado}
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (!token) return
    db.verConvite(token).then((c) => { if (!c) { toast('Convite inválido'); setModo('entrar') } else setConvite(c) }).catch((e) => toast(e.message))
  }, [token])

  async function entrar(e) {
    e.preventDefault()
    setOcupado(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setOcupado(false)
    if (error) toast(error.message.includes('Invalid') ? 'E-mail ou senha incorretos' : error.message)
  }

  async function cadastrar(e) {
    e.preventDefault()
    setOcupado(true)
    // guarda o convite: assim que houver sessão, o App liga a conta à ficha (ver App.jsx)
    localStorage.setItem('cond_convite_token', token)
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha })
    setOcupado(false)
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        // já tem conta: basta entrar que o convite é aplicado
        const r = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
        if (r.error) toast('Esse e-mail já tem conta. Entre com a senha dele para aceitar o convite.')
        return
      }
      return toast(error.message)
    }
    if (!data.session) setAviso('Conta criada! Enviamos um e-mail de confirmação. Confirme e depois entre aqui com seu e-mail e senha — o convite é aplicado automaticamente.')
  }

  return (
    <div id="login">
      <img src={ESCUDO} alt="Condores" />
      <div className="card">
        {aviso ? (
          <>
            <p style={{ lineHeight: 1.5, marginBottom: 14 }}>{aviso}</p>
            <button className="btn" onClick={() => { setAviso(''); setModo('entrar') }}>Ir para o login</button>
          </>
        ) : modo === 'entrar' ? (
          <form onSubmit={entrar}>
            <label className="lb">E-mail</label>
            <input className="txt" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="lb">Senha</label>
            <input className="txt" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <button className="btn" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
            <p className="dica" style={{ textAlign: 'center', marginTop: 14 }}>Ainda não tem conta? Peça o link de convite para a diretoria.</p>
          </form>
        ) : (
          <form onSubmit={cadastrar}>
            <h2>Criar conta</h2>
            {convite && (
              <p style={{ marginBottom: 12, lineHeight: 1.5 }}>
                Convite para <b>{convite.nome}</b> · {convite.papel === 'diretor' ? 'diretoria' : 'atleta'}
                {convite.usado && <span className="dica"> (este convite já foi usado — se for você, é só entrar)</span>}
              </p>
            )}
            <label className="lb">Seu e-mail</label>
            <input className="txt" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="lb">Crie uma senha</label>
            <input className="txt" type="password" autoComplete="new-password" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <button className="btn" disabled={ocupado || !convite}>{ocupado ? 'Criando…' : 'Criar conta'}</button>
            <p className="dica" style={{ textAlign: 'center', marginTop: 14 }}>
              <a href="#" style={{ color: 'var(--bege)' }} onClick={(e) => { e.preventDefault(); setModo('entrar') }}>Já tenho conta</a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

// Logado, mas ainda sem vínculo (não está em cond_usuarios) e sem convite guardado
export function SemAcesso({ email, onSair }) {
  return (
    <div id="login">
      <img src={ESCUDO} alt="Condores" />
      <div className="card">
        <h2>Quase lá</h2>
        <p className="dica" style={{ marginBottom: 12, lineHeight: 1.5 }}>Você entrou como {email}, mas essa conta ainda não está ligada a nenhum atleta. Abra o link de convite que a diretoria te mandou pelo WhatsApp (estando logado) e o acesso é liberado na hora.</p>
        <button className="btn sec" onClick={onSair}>Sair</button>
      </div>
    </div>
  )
}
