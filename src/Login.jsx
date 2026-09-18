import { useState } from 'react'
import { supabase } from './supabase'
import { useToast } from './ui'

const ESCUDO = import.meta.env.BASE_URL + 'escudo.png'

// Tela de entrada. Modo "entrar" (e-mail + senha) ou "cadastro" (link de convite).
export default function Login({ conviteInicial }) {
  const toast = useToast()
  const [modo, setModo] = useState(conviteInicial ? 'cadastro' : 'entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState(conviteInicial || '')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')

  async function entrar(e) {
    e.preventDefault()
    setOcupado(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setOcupado(false)
    if (error) toast(error.message.includes('Invalid') ? 'E-mail ou senha incorretos' : error.message)
  }

  async function cadastrar(e) {
    e.preventDefault()
    if (!nome.trim() || !codigo.trim()) return toast('Preencha nome e código do convite')
    setOcupado(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim(), codigo_convite: codigo.trim().toUpperCase() } },
    })
    setOcupado(false)
    if (error) return toast(error.message)
    // guarda nome+código para liberar o acesso assim que houver sessão (ver App.jsx)
    localStorage.setItem('cond_convite', JSON.stringify({ nome: nome.trim(), codigo: codigo.trim().toUpperCase() }))
    if (!data.session) setAviso('Cadastro feito! Enviamos um e-mail de confirmação. Confirme e depois entre aqui com seu e-mail e senha.')
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
            <p className="dica" style={{ textAlign: 'center', marginTop: 14 }}>
              Recebeu um convite?{' '}
              <a href="#" style={{ color: 'var(--bege)' }} onClick={(e) => { e.preventDefault(); setModo('cadastro') }}>Criar minha conta</a>
            </p>
          </form>
        ) : (
          <form onSubmit={cadastrar}>
            <h2>Criar conta</h2>
            <label className="lb">Seu nome (como aparece no grupo)</label>
            <input className="txt" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <label className="lb">E-mail</label>
            <input className="txt" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="lb">Senha</label>
            <input className="txt" type="password" autoComplete="new-password" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <label className="lb">Código do convite</label>
            <input className="txt" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="CONDORES-XXXXXX" required />
            <button className="btn" disabled={ocupado}>{ocupado ? 'Criando…' : 'Criar conta'}</button>
            <p className="dica" style={{ textAlign: 'center', marginTop: 14 }}>
              <a href="#" style={{ color: 'var(--bege)' }} onClick={(e) => { e.preventDefault(); setModo('entrar') }}>Já tenho conta</a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

// Tela mostrada quando a pessoa está logada mas ainda não foi liberada (não está na diretoria)
export function Convite({ email, onLiberado, onSair }) {
  const toast = useToast()
  const salvo = JSON.parse(localStorage.getItem('cond_convite') || 'null')
  const [nome, setNome] = useState(salvo?.nome || '')
  const [codigo, setCodigo] = useState(salvo?.codigo || '')
  const [ocupado, setOcupado] = useState(false)

  async function liberar(e) {
    e.preventDefault()
    setOcupado(true)
    const { error } = await supabase.rpc('cond_aceitar_convite', { p_codigo: codigo.trim(), p_nome: nome.trim() })
    setOcupado(false)
    if (error) return toast(error.message)
    localStorage.removeItem('cond_convite')
    onLiberado()
  }

  return (
    <div id="login">
      <img src={ESCUDO} alt="Condores" />
      <div className="card">
        <h2>Quase lá</h2>
        <p className="dica" style={{ marginBottom: 12 }}>Logado como {email}. Informe o código do convite que você recebeu.</p>
        <form onSubmit={liberar}>
          <label className="lb">Seu nome</label>
          <input className="txt" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <label className="lb">Código do convite</label>
          <input className="txt" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
          <button className="btn" disabled={ocupado}>Liberar acesso</button>
        </form>
        <button className="btn sec" style={{ marginTop: 10 }} onClick={onSair}>Sair</button>
      </div>
    </div>
  )
}
