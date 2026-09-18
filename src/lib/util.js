export const POS = ['GOL', 'ZAG', 'MEI', 'ATA']

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

export const resultado = (r, time) => {
  if (r.gols_preto === r.gols_bege) return 'E'
  const venceu = r.gols_preto > r.gols_bege ? 'P' : 'B'
  return venceu === time ? 'V' : 'D'
}
export const pontos = (res) => (res === 'V' ? 3 : res === 'E' ? 1 : 0)
export const RES_NOME = { V: 'Vitória', E: 'Empate', D: 'Derrota' }

export const nomeVencedor = (r) =>
  r.gols_preto > r.gols_bege ? 'vitória do Preto' : r.gols_bege > r.gols_preto ? 'vitória do Bege' : 'empate'
