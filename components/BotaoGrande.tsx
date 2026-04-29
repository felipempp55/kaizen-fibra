'use client'

interface Props {
  label: string
  selecionado?: boolean
  onClick: () => void
  cor?: string
  disabled?: boolean
}

export default function BotaoGrande({ label, selecionado, onClick, cor, disabled }: Props) {
  const base = 'w-full min-h-[72px] rounded-2xl text-white font-bold text-lg px-4 py-4 transition-all active:scale-95 select-none leading-tight'

  const estilo = cor
    ? `${base} ${cor} ${selecionado ? 'ring-4 ring-white/40 scale-[1.02]' : ''}`
    : `${base} ${
        selecionado
          ? 'bg-blue-500 ring-4 ring-blue-300/40 scale-[1.02]'
          : 'bg-slate-700 hover:bg-slate-600'
      }`

  return (
    <button
      className={estilo}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {label}
    </button>
  )
}
