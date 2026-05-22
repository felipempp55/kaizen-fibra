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
      if (valor.includes(',')) { inputRef.current?.focus(); return }
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

  const teclas = decimal
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']

  return (
    <div className="flex flex-col items-center gap-4">
      <label
        className="text-base font-semibold text-center"
        style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}
      >
        {label}
      </label>

      {/* Input oculto para teclado físico */}
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
        className="w-full min-h-[72px] rounded-xl flex items-center justify-center cursor-text select-none overflow-hidden"
        style={{
          background: '#fff',
          border: '2px solid var(--line)',
          boxShadow: '0 1px 3px rgba(31,55,68,0.06)',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {valor ? (
          <span
            className="text-4xl font-bold tracking-widest truncate px-4"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}
          >
            {valor}
          </span>
        ) : (
          <span
            className="text-base font-normal"
            style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-body)' }}
          >
            {placeholder ?? '—'}
          </span>
        )}
      </div>

      {/* Grade de teclas */}
      <div className="grid grid-cols-3 gap-2.5 w-full">
        {teclas.map((t) => {
          const isClear = t === 'C'
          const isDel   = t === '⌫'
          const isComma = t === ','

          return (
            <button
              key={t}
              type="button"
              onClick={() => pressionar(t)}
              className="h-16 rounded-xl transition-all active:scale-[0.96] select-none flex items-center justify-center"
              style={{
                background: isClear
                  ? 'var(--signal-red-soft)'
                  : isDel
                    ? 'var(--brand-soft)'
                    : '#fff',
                color: isClear
                  ? 'var(--signal-red)'
                  : isDel
                    ? 'var(--text-body)'
                    : 'var(--text-strong)',
                border: '1px solid var(--line)',
                fontFamily: (isComma || isDel) ? 'var(--font-body)' : 'var(--font-mono)',
                fontSize: isDel ? 14 : 22,
                fontWeight: 700,
                boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
              }}
            >
              {isDel ? (
                // Backspace SVG
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 6H10l-6 6 6 6h12V6z" />
                  <path d="M14 10l5 5M19 10l-5 5" />
                </svg>
              ) : t}
            </button>
          )
        })}
      </div>
    </div>
  )
}
