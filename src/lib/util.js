export const POS = ['GOL', 'ZAG', 'MEI', 'ATA']
export const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XGG']
// fora do time no momento (DM ou afastamento justificado)
export const fora = (a) => !!(a.dm || a.afastado)

// Times: P = Preto, B = Bege, V = Vermelho (o terceiro, usado só de vez em quando)
export const TIMES = {
  // emojiMsg / emojiGk: como cada jogador aparece na mensagem do WhatsApp (cor do colete)
  P: { nome: 'Preto', emoji: '⚫', classe: 'preto', gk: 'verde', emojiMsg: '⚫', emojiGk: '🟢' },
  B: { nome: 'Bege', emoji: '🟡', classe: 'bege', gk: 'laranja', emojiMsg: '⚪', emojiGk: '🟠' },
  V: { nome: 'Vermelho', emoji: '🔴', classe: 'vermelho', gk: 'azul', emojiMsg: '🔴', emojiGk: '🔵' },
}
export const chavesTimes = (qtd) => (qtd === 3 ? ['P', 'B', 'V'] : ['P', 'B'])

export const ini = (n) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export const pad = (n) => String(n).padStart(2, '0')

// 'YYYY-MM-DD' -> 'dd/mm'
export const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')

export const aniv = (a) => (a.aniv_dia && a.aniv_mes ? `${pad(a.aniv_dia)}/${pad(a.aniv_mes)}` : '')

// Próxima segunda-feira (ou hoje, se hoje for segunda), no fuso local, como 'YYYY-MM-DD'
export function proximaSegunda() {
  const d = new Date()
  const diff = (1 - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const temPlacar = (r) => r.gols_preto != null && r.gols_bege != null
export const tresTimes = (r) => r.times_qtd === 3

// resultado de um time numa rodada: 'V'/'E'/'D' (2 times) ou '1'/'2'/'3' (3 times)
export const resultado = (r, time) => {
  if (tresTimes(r)) return time === r.vencedor ? '1' : time === r.vice ? '2' : '3'
  return r.vencedor === 'E' ? 'E' : r.vencedor === time ? 'V' : 'D'
}
export const pontos = (res) => (res === 'V' || res === '1' ? 3 : res === 'E' || res === '2' ? 1 : 0)
export const RES_NOME = { V: 'Vitória', E: 'Empate', D: 'Derrota', 1: '1º lugar', 2: '2º lugar', 3: '3º lugar' }
export const RES_CLASSE = { V: 'V', E: 'E', D: 'D', 1: 'V', 2: 'E', 3: 'D' }

export function nomeVencedor(r) {
  if (!r.vencedor) return 'sem resultado'
  if (tresTimes(r)) return `${TIMES[r.vencedor].nome} campeão${r.vice ? `, ${TIMES[r.vice].nome} em 2º` : ''}`
  return r.vencedor === 'E' ? 'empate' : `vitória do ${TIMES[r.vencedor].nome}`
}

// link do app (para convites)
export const URL_APP = location.origin + import.meta.env.BASE_URL
export const linkWhatsApp = (numero, texto) => {
  const n = (numero || '').replace(/\D/g, '')
  const num = n ? (n.length <= 11 ? '55' + n : n) : ''
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}

const embaralhar = (a) => a.slice().sort(() => Math.random() - 0.5)

/**
 * Sorteia times equilibrados: um goleiro por time e ZAG/MEI/ATA divididos por igual.
 * jogadores: [{ id, posicao, convidado? }]  → devolve [{ ...jogador, time, goleiro }]
 * Se faltar goleiro, a faixa do time fica vazia (avisar quem escala).
 */
export function sortearTimes(jogadores, qtdTimes = 2) {
  const times = chavesTimes(qtdTimes)
  const escalados = []
  const contagem = Object.fromEntries(times.map((t) => [t, { total: 0, ZAG: 0, MEI: 0, ATA: 0 }]))

  const goleiros = embaralhar(jogadores.filter((j) => j.posicao === 'GOL'))
  // um goleiro por time; goleiro que sobrar entra como jogador de linha
  goleiros.slice(0, times.length).forEach((j, i) => {
    escalados.push({ ...j, time: times[i], goleiro: true })
    contagem[times[i]].total++
  })
  const sobraGol = goleiros.slice(times.length)

  // cada posição é distribuída para o time que tem menos gente daquela posição
  const linha = { ZAG: [], MEI: [], ATA: [] }
  jogadores.filter((j) => j.posicao !== 'GOL').forEach((j) => linha[j.posicao]?.push(j))
  sobraGol.forEach((j) => linha.ZAG.push(j)) // goleiro extra vira zagueiro
  ;['ZAG', 'MEI', 'ATA'].forEach((pos) => {
    embaralhar(linha[pos]).forEach((j) => {
      const alvo = embaralhar(times).reduce((a, b) =>
        contagem[b][pos] < contagem[a][pos] || (contagem[b][pos] === contagem[a][pos] && contagem[b].total < contagem[a].total) ? b : a,
      )
      escalados.push({ ...j, time: alvo, goleiro: false })
      contagem[alvo][pos]++; contagem[alvo].total++
    })
  })

  const semGoleiro = times.filter((t) => !escalados.some((e) => e.time === t && e.goleiro))
  return { escalados, semGoleiro }
}
