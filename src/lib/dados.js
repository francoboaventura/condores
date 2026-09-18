import { supabase } from '../supabase'
import { proximaSegunda } from './util'

async function ok(consulta) {
  const { data, error } = await consulta
  if (error) throw new Error(error.message)
  return data
}
// primeira linha (ou null) — sem depender de single()/maybeSingle()
const um = async (consulta) => { const d = await ok(consulta); return Array.isArray(d) ? d[0] ?? null : d }

// ---------- usuário / convites ----------
export async function meuPerfil() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const u = await um(supabase.from('cond_usuarios').select('*').eq('email', user.email.toLowerCase()).limit(1))
  return { email: user.email, nome: u?.nome || null, papel: u?.papel || null, atleta_id: u?.atleta_id || null, liberado: !!u, diretor: u?.papel === 'diretor' }
}
export const verConvite = (token) => ok(supabase.rpc('cond_ver_convite', { p_token: token }))
export const usarConvite = (token) => ok(supabase.rpc('cond_usar_convite', { p_token: token }))
export async function criarConvite(atleta_id, papel) {
  const token = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/-/g, '').slice(0, 20)
  await ok(supabase.from('cond_convites').insert({ token, atleta_id, papel }))
  return token
}
export const listarUsuarios = () => ok(supabase.from('cond_usuarios').select('*'))

// ---------- atletas ----------
export const listarAtletas = () => ok(supabase.from('cond_atletas').select('*').eq('ativo', true).order('nome'))
export const salvarAtleta = (a) => um(supabase.from('cond_atletas').upsert(a).select())
export const atualizarAtleta = (id, campos) => ok(supabase.from('cond_atletas').update(campos).eq('id', id))
export const excluirAtleta = (id) => atualizarAtleta(id, { ativo: false, dm: false })

// ---------- rodada ----------
export async function rodadaAtual() {
  const data = proximaSegunda()
  const r = await um(supabase.from('cond_rodadas').select('*').eq('data', data).limit(1))
  if (r) return r
  return um(supabase.from('cond_rodadas').insert({ data }).select())
}
export const rodadaPorId = (id) => um(supabase.from('cond_rodadas').select('*').eq('id', id).limit(1))
export async function rodadaPorData(data) {
  const r = await um(supabase.from('cond_rodadas').select('*').eq('data', data).limit(1))
  if (r) return r
  return um(supabase.from('cond_rodadas').insert({ data }).select())
}
// rodadas antigas ainda sem resultado ("a lançar")
export const listarRodadasALancar = () =>
  ok(supabase.from('cond_rodadas').select('*').eq('status', 'aberta').lt('data', proximaSegunda()).order('data', { ascending: false }))

export const listarConfirmacoes = (rodada_id) => ok(supabase.from('cond_confirmacoes').select('*').eq('rodada_id', rodada_id))
export async function setConfirmacao(rodada_id, atleta_id, status) {
  if (!status) return ok(supabase.from('cond_confirmacoes').delete().match({ rodada_id, atleta_id }))
  return ok(supabase.from('cond_confirmacoes').upsert({ rodada_id, atleta_id, status }))
}
export const listarEscalacao = (rodada_id) => ok(supabase.from('cond_escalacoes').select('*').eq('rodada_id', rodada_id))
export const inserirEscalacao = (linha) => ok(supabase.from('cond_escalacoes').insert(linha))
export const atualizarEscalacao = (id, campos) => ok(supabase.from('cond_escalacoes').update(campos).eq('id', id))
export const removerEscalacao = (id) => ok(supabase.from('cond_escalacoes').delete().eq('id', id))
export const limparEscalacao = (rodada_id) => ok(supabase.from('cond_escalacoes').delete().eq('rodada_id', rodada_id))
export const salvarResultado = (id, gols_preto, gols_bege) =>
  ok(supabase.from('cond_rodadas').update({ gols_preto, gols_bege, status: 'encerrada' }).eq('id', id))
// resultado sem placar (só quem venceu)
export const salvarVencedor = (id, vencedor) =>
  ok(supabase.from('cond_rodadas').update({ gols_preto: null, gols_bege: null, vencedor, status: 'encerrada' }).eq('id', id))

export const listarRodadasEncerradas = () =>
  ok(
    supabase
      .from('cond_rodadas')
      .select('*, cond_escalacoes(*, cond_atletas(nome, posicao))')
      .eq('status', 'encerrada')
      .order('data', { ascending: false }),
  )

// ---------- ranking ----------
export const ranking = () => ok(supabase.from('cond_ranking').select('*').gt('jogos', 0).order('pontos', { ascending: false }).order('jogos', { ascending: false }))
export const totalRodadas = async () => (await ok(supabase.from('cond_rodadas').select('id').eq('status', 'encerrada'))).length
export const historicoAtleta = (atleta_id) => ok(supabase.from('cond_historico').select('*').eq('atleta_id', atleta_id).order('data', { ascending: false }))
export const listarDatasEncerradas = () => ok(supabase.from('cond_rodadas').select('id, data').eq('status', 'encerrada').order('data', { ascending: false }))
