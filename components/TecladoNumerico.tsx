'use client'

interface Props {
  valor: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
  max?: number
  maxLength?: number
}

export default function TecladoNumerico({ valor, onChange, label, placeholder, max, maxLength = 9 }: Props) {
  function pressionar(tecla: string) {
    if (tecla === '⌫') {
      onChange(valor.slice(0, -1))
      return
    }
    if (tecla === 'C') {
      onChange('')
      return
    }
    const novo = valor + tecla
    if (max && parseInt(novo) > max) return
    if (novo.length > maxLength) return
    onChange(novo)
  }

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']

  return (
    <div className="flex flex-col items-center gap-4">
      <label className="text-slate-300 text-lg font-semibold">{label}</label>

      <div className="bg-slate-800 rounded-2xl w-full py-4 px-6 text-center text-4xl font-mono font-bold text-white min-h-[72px] flex items-center justify-center tracking-widest">
        {valor || <span className="text-slate-600">{placeholder ?? '—'}</span>}
      </div>

      <div className="grid grid-cols-3 gap-3 w-full">
        {teclas.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => pressionar(t)}
            className={`
              h-16 rounded-2xl text-2xl font-bold transition-all active:scale-95
              ${t === 'C' ? 'bg-red-600 hover:bg-red-500 text-white' : ''}
              ${t === '⌫' ? 'bg-slate-600 hover:bg-slate-500 text-white' : ''}
              ${t !== 'C' && t !== '⌫' ? 'bg-slate-700 hover:bg-slate-600 text-white' : ''}
            `}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
