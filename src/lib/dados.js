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
  return { email: user.email, nome: u?.nome || null, papel: u?.papel || null, atleta_id: u?.atleta_id || null, liberado: !!u, diretor: u?.papel === 'diretor', trocar_senha: !!u?.trocar_senha }
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
    .order('pontos', { ascending: false }).order('jogos', { ascending: false }).order('nome'))
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

// ---------- acesso dos atletas (nome + senha) ----------
export const loginAtletas = () => ok(supabase.rpc('cond_login_atletas'))
// primeiro acesso: troca a senha padrão pela do atleta (o banco confere que mudou)
export async function trocarSenha(nova) {
  const { error } = await supabase.auth.updateUser({ password: nova })
  if (error) throw new Error(/different|same/i.test(error.message) ? 'A senha nova precisa ser diferente da senha padrão.' : error.message)
  await ok(supabase.rpc('cond_senha_trocada'))
}
export const completarCadastro = (whatsapp, aniv_dia, aniv_mes, foto_url) =>
  ok(supabase.rpc('cond_completar_cadastro', { p_whatsapp: whatsapp, p_aniv_dia: aniv_dia, p_aniv_mes: aniv_mes, p_foto_url: foto_url }))
// reduz a foto no celular (até 800px) e sobe para o Storage; devolve o endereço público
export async function enviarFoto(atleta_id, arquivo) {
  const img = await createImageBitmap(arquivo)
  const k = Math.min(1, 800 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85))
  const caminho = `${atleta_id}/foto-${Date.now()}.jpg`
  await ok(supabase.storage.from('cond-fotos').upload(caminho, blob, { contentType: 'image/jpeg', upsert: true }))
  return supabase.storage.from('cond-fotos').getPublicUrl(caminho).data.publicUrl
}
// diretoria
export const resetarSenhaAtleta = (atleta_id) => ok(supabase.rpc('cond_resetar_senha_atleta', { p_atleta: atleta_id }))
export const senhaPadrao = () => ok(supabase.rpc('cond_senha_padrao'))

// ---------- votação "Atleta Mais Condores" (com login: cada um vota como ele mesmo) ----------
export async function jaVotei(atleta_id) {
  const l = await ok(supabase.from('cond_votos_atleta_mais_condores').select('eleitor_id').eq('eleitor_id', atleta_id).limit(1))
  return l.length > 0
}
export async function votar(eleitor_id, votado_id) {
  const { error } = await supabase.from('cond_votos_atleta_mais_condores').insert({ eleitor_id, votado_id })
  if (!error) return
  // 23505 = já existe voto desse atleta (unicidade no banco)
  if (error.code === '23505') { const e = new Error('Esse atleta já votou'); e.jaVotou = true; throw e }
  throw new Error(error.message)
}
// só diretoria
export const votacaoResultado = () => ok(supabase.rpc('cond_votacao_resultado'))
