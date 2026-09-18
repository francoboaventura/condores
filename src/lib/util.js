export const POS = ['GOL', 'ZAG', 'MEI', 'ATA']
// fora do time no momento (DM ou afastamento justificado)
export const fora = (a) => !!(a.dm || a.afastado)

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

export const vencedorDe = (r) => r.vencedor || (r.gols_preto == null ? null : r.gols_preto > r.gols_bege ? 'P' : r.gols_bege > r.gols_preto ? 'B' : 'E')
export const resultado = (r, time) => { const v = vencedorDe(r); return v === 'E' ? 'E' : v === time ? 'V' : 'D' }
export const temPlacar = (r) => r.gols_preto != null && r.gols_bege != null
export const pontos = (res) => (res === 'V' ? 3 : res === 'E' ? 1 : 0)
export const RES_NOME = { V: 'Vitória', E: 'Empate', D: 'Derrota' }

export const nomeVencedor = (r) => ({ P: 'vitória do Preto', B: 'vitória do Bege', E: 'empate' }[vencedorDe(r)] || 'sem resultado')
// link do app (para convites)
export const URL_APP = location.origin + import.meta.env.BASE_URL
export const linkWhatsApp = (numero, texto) => {
  const n = (numero || '').replace(/\D/g, '')
  const num = n ? (n.length <= 11 ? '55' + n : n) : ''
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}
