'use client'

import { useRef, useEffect } from 'react'

interface Props {
  valor: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
  max?: number
  maxLength?: number
  /** Chamado quando o usuário pressiona Enter no teclado físico */
  onEnter?: () => void
  /** Foca automaticamente ao montar o componente */
  autoFocus?: boolean
}

export default function TecladoNumerico({
  valor, onChange, label, placeholder, max, maxLength = 9, onEnter, autoFocus = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-foco opcional (para etapas onde é o único campo na tela)
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  function pressionar(tecla: string) {
    if (tecla === '⌫') { onChange(valor.slice(0, -1)); inputRef.current?.focus(); return }
    if (tecla === 'C')  { onChange('');                 inputRef.current?.focus(); return }
    const novo = valor + tecla
    if (max && parseInt(novo) > max) { inputRef.current?.focus(); return }
    if (novo.length > maxLength)     { inputRef.current?.focus(); return }
    onChange(novo)
    inputRef.current?.focus()
  }

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']

  return (
    <div className="flex flex-col items-center gap-4">
      <label className="text-[#1A3344] text-base font-semibold text-center">{label}</label>

      {/*
        Input invisível que captura o teclado físico.
        inputMode="none" impede a abertura do teclado virtual no tablet/mobile.
      */}
      <input
        ref={inputRef}
        type="text"
        inputMode="none"
        readOnly
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); return }
          if (e.key === 'Backspace') { onChange(valor.slice(0, -1)); return }
          if (e.key >= '0' && e.key <= '9') {
            const novo = valor + e.key
            if (max && parseInt(novo) > max) return
            if (novo.length > maxLength) return
            onChange(novo)
          }
        }}
      />

      {/* Visor — clicável para focar o input oculto */}
      <div
        className="bg-white border-2 border-[#DDE4EA] rounded-xl w-full py-4 px-4 text-center text-4xl font-mono font-bold text-[#1A3344] min-h-[72px] flex items-center justify-center tracking-widest overflow-hidden cursor-text select-none"
        onClick={() => inputRef.current?.focus()}
      >
        {valor
          ? <span className="truncate">{valor}</span>
          : <span className="text-[#DDE4EA] text-lg font-sans font-normal tracking-normal">{placeholder ?? '—'}</span>
        }
      </div>

      <div className="grid grid-cols-3 gap-3 w-full">
        {teclas.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => pressionar(t)}
            className={`
              h-16 rounded-xl text-2xl font-bold transition-all active:scale-95 border
              ${t === 'C'  ? 'bg-red-500 hover:bg-red-600 text-white border-transparent' : ''}
              ${t === '⌫'  ? 'bg-[#DDE4EA] hover:bg-[#c8d3db] text-[#3D5568] border-transparent' : ''}
              ${t !== 'C' && t !== '⌫' ? 'bg-white hover:bg-[#E6F6F8] hover:border-[#1E9FAC] text-[#1A3344] border-[#DDE4EA]' : ''}
            `}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
