import { ddmm } from './util'

// Lista de sexta: só quem ainda não respondeu (DM não entra)
export function msgFaltam(rodada, atletas, confirmacoes) {
  const resp = new Set(confirmacoes.map((c) => c.atleta_id))
  const pend = atletas.filter((a) => !a.dm && !resp.has(a.id)).map((a) => a.nome)
  const lista = pend.map((n, i) => `${i + 1}. ${n}`).join('\n') || 'Todo mundo já respondeu 👏'
  return `⚽ *CONDORES — Segunda ${ddmm(rodada.data)}*\n🕗 20h às 21h · Radar\n\n❓ *Ainda não confirmaram (${pend.length})*\n${lista}\n\nConfirma aí até domingo! 🦅`
}

// Escalação de segunda: goleiro primeiro, linha numerada, convidados marcados
export function msgEscalacao(rodada, atletas, escalacao) {
  const nome = (e) => {
    if (e.convidado_nome) return `${e.convidado_nome} (convidado)`
    const a = atletas.find((x) => x.id === e.atleta_id)
    return a ? `${a.nome} (${a.posicao})` : '?'
  }
  const bloco = (t) => {
    const gk = escalacao.filter((e) => e.time === t && e.goleiro).map((e) => `🧤 ${nome(e)}`)
    const lin = escalacao.filter((e) => e.time === t && !e.goleiro).map((e, i) => `${i + 1}. ${nome(e)}`)
    return [...gk, ...lin].join('\n') || '—'
  }
  return `🦅 *ESCALAÇÃO — Segunda ${ddmm(rodada.data)}*\n🕗 20h · Radar\n\n⚫ *PRETO*\n${bloco('P')}\n\n🟡 *BEGE*\n${bloco('B')}\n\nBom jogo, Condores! 🏆`
}

export function msgRanking(rank, total) {
  const linhas = rank.map((x, i) => `${i + 1}. ${x.nome} — ${x.pontos} pts (${x.jogos} j)`).join('\n')
  return `🏆 *RANKING CONDORES ${new Date().getFullYear()}*\n${total} rodadas\n\n${linhas}\n\n3 pts vitória · 1 empate · 0 derrota`
}
