import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { POS } from './lib/util'

// ---------- toast ----------
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const timer = useRef()
  const toast = (t) => {
    setMsg(t)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 1800)
  }
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {msg && <div className="toast" style={{ display: 'block' }}>{msg}</div>}
    </ToastCtx.Provider>
  )
}

// ---------- folha inferior / modal ----------
export function Modal({ aberto, children }) {
  if (!aberto) return null
  return (
    <div className="modal on">
      <div className="card">{children}</div>
    </div>
  )
}

// ---------- botão de posição (segurar para trocar) ----------
export function PosBtn({ pos, onChange, big }) {
  const [aberto, setAberto] = useState(false)
  const [xy, setXy] = useState({ top: 0, left: 0 })
  const hold = useRef(null)
  const btn = useRef(null)
  const popRef = useRef(null)

  const abrir = () => {
    const r = btn.current.getBoundingClientRect()
    setXy({ top: r.top - 52, right: r.right })
    setAberto(true)
  }
  const down = (e) => {
    e.stopPropagation()
    hold.current = setTimeout(() => { hold.current = null; abrir() }, 450)
  }
  const cancel = () => { if (hold.current) { clearTimeout(hold.current); hold.current = null } }

  useEffect(() => {
    if (!aberto) return
    const fechar = (e) => { if (!popRef.current?.contains(e.target)) setAberto(false) }
    document.addEventListener('pointerdown', fechar)
    return () => document.removeEventListener('pointerdown', fechar)
  }, [aberto])

  // posiciona o popover após render (precisa da largura)
  useEffect(() => {
    if (!aberto || !popRef.current) return
    const w = popRef.current.offsetWidth
    popRef.current.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, xy.right - w)) + 'px'
    popRef.current.style.top = xy.top + 'px'
  }, [aberto, xy])

  return (
    <>
      <span
        ref={btn}
        className={`posbtn ${pos} ${big ? 'big' : ''}`}
        onPointerDown={down}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        {pos}
      </span>
      {aberto && (
        <div ref={popRef} className="pop on">
          {POS.map((x) => (
            <button
              key={x}
              className={`${x === 'GOL' ? 'gol' : ''} ${x === pos ? 'on' : ''}`}
              onClick={(e) => { e.stopPropagation(); setAberto(false); if (x !== pos) onChange(x) }}
            >
              {x}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// ---------- ícones da navegação ----------
export const Icone = {
  atletas: <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7"/><circle cx="17" cy="9" r="3"/><path d="M22 20c0-3-2-5-5-5"/></svg>,
  rodada: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
  ranking: <svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0zM6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3"/></svg>,
  msg: <svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/></svg>,
}
