import { ddmm, TIMES, chavesTimes, tresTimes, POS } from './util'

// Lista de sexta: só quem ainda não respondeu (DM e afastados não entram)
export function msgFaltam(rodada, atletas, confirmacoes) {
  const resp = new Set(confirmacoes.map((c) => c.atleta_id))
  const pend = atletas.filter((a) => !a.dm && !a.afastado && !resp.has(a.id)).map((a) => a.nome)
  const lista = pend.map((n, i) => `${i + 1}. ${n}`).join('\n') || 'Todo mundo já respondeu 👏'
  return `⚽ *CONDORES — Segunda ${ddmm(rodada.data)}*\n🕗 20h às 21h · Radar\n\n❓ *Ainda não confirmaram (${pend.length})*\n${lista}\n\nConfirma aí até domingo! 🦅`
}

// Escalação de segunda: goleiro primeiro, linha numerada, convidados marcados
export function msgEscalacao(rodada, atletas, escalacao) {
  const nome = (e) => {
    if (e.convidado_nome) return `${e.convidado_nome} (convidado${e.convidado_pos ? `, ${e.convidado_pos}` : ''})`
    const a = atletas.find((x) => x.id === e.atleta_id)
    return a ? `${a.nome} (${a.posicao})` : '?'
  }
  const ordem = (e) => {
    const i = POS.indexOf(e.convidado_nome ? e.convidado_pos : atletas.find((x) => x.id === e.atleta_id)?.posicao)
    return i < 0 ? POS.length : i
  }
  const bloco = (t) => {
    const gk = escalacao.filter((e) => e.time === t && e.goleiro).map((e) => `${TIMES[t].emojiGk} ${nome(e)}`)
    const lin = escalacao.filter((e) => e.time === t && !e.goleiro)
      .sort((a, b) => ordem(a) - ordem(b))
      .map((e) => `${TIMES[t].emojiMsg} ${nome(e)}`)
    return [...gk, ...lin].join('\n') || '—'
  }
  // sem título de time: o emoji ao lado de cada nome já diz de que lado ele joga
  const times = chavesTimes(rodada.times_qtd).map((t) => bloco(t)).join('\n\n')
  return `🦅 *ESCALAÇÃO — Segunda ${ddmm(rodada.data)}*\n🕗 20h · Radar${tresTimes(rodada) ? '\n(rodada com 3 times)' : ''}\n\n${times}\n\nBom jogo, Condores! 🏆`
}

export function msgRanking(rank, total) {
  const linhas = rank.map((x, i) => `${i + 1}. ${x.nome} — ${x.pontos} pts (${x.jogos} j)`).join('\n')
  return `🏆 *RANKING CONDORES ${new Date().getFullYear()}*\n${total} rodadas\n\n${linhas}\n\n3 pts vitória · 1 empate · 0 derrota`
}
