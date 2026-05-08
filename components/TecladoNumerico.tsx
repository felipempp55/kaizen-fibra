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
      <label className="text-[#1A3344] text-base font-semibold text-center">{label}</label>

      <div className="bg-white border-2 border-[#DDE4EA] rounded-xl w-full py-4 px-6 text-center text-4xl font-mono font-bold text-[#1A3344] min-h-[72px] flex items-center justify-center tracking-widest">
        {valor || <span className="text-[#DDE4EA]">{placeholder ?? '—'}</span>}
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
