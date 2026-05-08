'use client'

interface Props {
  label: string
  selecionado?: boolean
  onClick: () => void
  cor?: string
  disabled?: boolean
}

export default function BotaoGrande({ label, selecionado, onClick, cor, disabled }: Props) {
  const base = 'w-full min-h-[72px] rounded-xl font-bold text-lg px-4 py-4 transition-all active:scale-95 select-none leading-tight border'

  const estilo = cor
    ? `${base} ${cor} text-white border-transparent ${selecionado ? 'ring-4 ring-offset-1 ring-white/40 scale-[1.02]' : ''}`
    : `${base} ${
        selecionado
          ? 'bg-[#1E9FAC] text-white border-[#1E9FAC] ring-4 ring-[#1E9FAC]/20 scale-[1.02]'
          : 'bg-white text-[#1A3344] border-[#DDE4EA] hover:border-[#1E9FAC] hover:text-[#1E9FAC]'
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
