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
// "Saiu do time": fica oculto nas listas e fora do ranking, mas o histórico é mantido
export const marcarSaida = (id) => atualizarAtleta(id, { ativo: false, dm: false, afastado: false })
export const voltarAoTime = (id) => atualizarAtleta(id, { ativo: true })
export const listarSaidos = () => ok(supabase.from('cond_atletas').select('*').eq('ativo', false).order('nome'))

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
  ok(supabase.from('cond_rodadas').update({ gols_preto: null, gols_bege: null, vencedor, vice: null, status: 'encerrada' }).eq('id', id))
// resultado com 3 times: campeão e vice
export const salvarPodio = (id, vencedor, vice) =>
  ok(supabase.from('cond_rodadas').update({ vencedor, vice, status: 'encerrada' }).eq('id', id))
// 2 ou 3 times nesta rodada
export const setTimesQtd = (id, times_qtd) => ok(supabase.from('cond_rodadas').update({ times_qtd }).eq('id', id))

export const listarRodadasEncerradas = () =>
  ok(
    supabase
      .from('cond_rodadas')
      .select('*, cond_escalacoes(*, cond_atletas(nome, posicao))')
      .eq('status', 'encerrada')
      .order('data', { ascending: false }),
  )

// ---------- ranking / temporadas ----------
export const anoAtual = () => new Date().getFullYear()
export const ranking = (ano = anoAtual()) =>
  ok(supabase.from('cond_ranking_ano').select('*').eq('ano', ano).gt('jogos', 0)
    .order('pontos', { ascending: false }).order('jogos', { ascending: false }))
export const totalRodadas = async (ano = anoAtual()) =>
  (await ok(supabase.from('cond_rodadas').select('data').eq('status', 'encerrada')
    .gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`))).length
// anos que já tiveram rodadas encerradas
export async function anosComRodadas() {
  const linhas = await ok(supabase.from('cond_rodadas').select('data').eq('status', 'encerrada'))
  const anos = [...new Set(linhas.map((r) => +r.data.slice(0, 4)))].sort((a, b) => b - a)
  return anos.length ? anos : [anoAtual()]
}
export const listarTemporadas = () => ok(supabase.from('cond_temporadas').select('*').order('ano', { ascending: false }))
export const rankingTemporada = (ano) =>
  ok(supabase.from('cond_temporada_ranking').select('*').eq('ano', ano).order('posicao_no'))
export const encerrarAno = (ano) => ok(supabase.rpc('cond_encerrar_ano', { p_ano: ano }))
export const reabrirAno = (ano) => ok(supabase.rpc('cond_reabrir_ano', { p_ano: ano }))
export const historicoAtleta = (atleta_id, ano = anoAtual()) =>
  ok(supabase.from('cond_historico').select('*').eq('atleta_id', atleta_id)
    .gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`).order('data', { ascending: false }))
export const listarDatasEncerradas = (ano = anoAtual()) =>
  ok(supabase.from('cond_rodadas').select('id, data').eq('status', 'encerrada')
    .gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`).order('data', { ascending: false }))
