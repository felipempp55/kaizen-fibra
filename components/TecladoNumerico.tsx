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
  /** Permite entrada decimal — troca o botão C pela vírgula */
  decimal?: boolean
}

export default function TecladoNumerico({
  valor, onChange, label, placeholder, max, maxLength = 9, onEnter, autoFocus = false, decimal = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  function parseValor(v: string): number {
    return parseFloat(v.replace(',', '.')) || 0
  }

  function pressionar(tecla: string) {
    if (tecla === '⌫') { onChange(valor.slice(0, -1)); inputRef.current?.focus(); return }
    if (tecla === 'C')  { onChange('');                 inputRef.current?.focus(); return }

    if (tecla === ',') {
      // Só uma vírgula por vez
      if (valor.includes(',')) { inputRef.current?.focus(); return }
      // Vírgula no início → prefixar com 0
      const novo = (valor === '' ? '0' : valor) + ','
      onChange(novo)
      inputRef.current?.focus()
      return
    }

    const novo = valor + tecla
    if (max && parseValor(novo) > max) { inputRef.current?.focus(); return }
    if (novo.replace(',', '').length > maxLength) { inputRef.current?.focus(); return }
    onChange(novo)
    inputRef.current?.focus()
  }

  // Layout: com decimal troca 'C' por ',' e mantém '⌫'
  const teclas = decimal
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']

  return (
    <div className="flex flex-col items-center gap-4">
      <label className="text-[#1A3344] text-base font-semibold text-center">{label}</label>

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
          if (decimal && (e.key === ',' || e.key === '.')) {
            if (valor.includes(',')) return
            onChange((valor === '' ? '0' : valor) + ',')
            return
          }
          if (e.key >= '0' && e.key <= '9') {
            const novo = valor + e.key
            if (max && parseValor(novo) > max) return
            if (novo.replace(',', '').length > maxLength) return
            onChange(novo)
          }
        }}
      />

      {/* Visor */}
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
              ${t === ','  ? 'bg-[#F2F5F7] hover:bg-[#E6F6F8] hover:border-[#1E9FAC] text-[#1A3344] border-[#DDE4EA] text-3xl' : ''}
              ${t !== 'C' && t !== '⌫' && t !== ',' ? 'bg-white hover:bg-[#E6F6F8] hover:border-[#1E9FAC] text-[#1A3344] border-[#DDE4EA]' : ''}
            `}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
