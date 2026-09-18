import { supabase } from '../supabase'
import { proximaSegunda } from './util'

async function ok(consulta) {
  const { data, error } = await consulta
  if (error) throw new Error(error.message)
  return data
}
// primeira linha (ou null) — sem depender de single()/maybeSingle()
const um = async (consulta) => { const d = await ok(consulta); return Array.isArray(d) ? d[0] ?? null : d }

// ---------- diretoria / login ----------
export async function meuPerfil() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const dir = await um(supabase.from('cond_diretoria').select('*').eq('email', user.email.toLowerCase()).limit(1))
  return { email: user.email, nome: dir?.nome || null, liberado: !!dir }
}
export const aceitarConvite = (codigo, nome) => ok(supabase.rpc('cond_aceitar_convite', { p_codigo: codigo, p_nome: nome }))

// ---------- atletas ----------
export const listarAtletas = () => ok(supabase.from('cond_atletas').select('*').eq('ativo', true).order('nome'))
export const listarTodosAtletas = () => ok(supabase.from('cond_atletas').select('*').order('nome'))
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
export const listarConfirmacoes = (rodada_id) => ok(supabase.from('cond_confirmacoes').select('*').eq('rodada_id', rodada_id))
export async function setConfirmacao(rodada_id, atleta_id, status) {
  if (!status) return ok(await supabase.from('cond_confirmacoes').delete().match({ rodada_id, atleta_id }))
  return ok(await supabase.from('cond_confirmacoes').upsert({ rodada_id, atleta_id, status }))
}
export const listarEscalacao = (rodada_id) => ok(supabase.from('cond_escalacoes').select('*').eq('rodada_id', rodada_id))
export const inserirEscalacao = (linha) => ok(supabase.from('cond_escalacoes').insert(linha))
export const atualizarEscalacao = (id, campos) => ok(supabase.from('cond_escalacoes').update(campos).eq('id', id))
export const removerEscalacao = (id) => ok(supabase.from('cond_escalacoes').delete().eq('id', id))
export const limparEscalacao = (rodada_id) => ok(supabase.from('cond_escalacoes').delete().eq('rodada_id', rodada_id))
export const salvarResultado = (id, gols_preto, gols_bege) =>
  ok(supabase.from('cond_rodadas').update({ gols_preto, gols_bege, status: 'encerrada' }).eq('id', id))
export const reabrirRodada = (id) => ok(supabase.from('cond_rodadas').update({ status: 'aberta' }).eq('id', id))

// rodadas encerradas com escalação e nomes
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
