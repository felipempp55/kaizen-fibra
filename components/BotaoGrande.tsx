'use client'

interface Props {
  label: string
  selecionado?: boolean
  onClick: () => void
  cor?: string
  disabled?: boolean
}

export default function BotaoGrande({ label, selecionado, onClick, cor, disabled }: Props) {
  if (cor) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full min-h-[72px] rounded-xl font-bold text-lg px-4 py-4 transition-all active:scale-[0.97] select-none leading-tight border-2 border-transparent text-white"
        style={{
          background: cor.includes('#') || cor.includes('rgb') ? cor : undefined,
          fontFamily: 'var(--font-display)',
          boxShadow: selecionado ? '0 4px 16px rgba(0,0,0,0.2)' : 'none',
          transform: selecionado ? 'scale(1.02)' : undefined,
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full min-h-[72px] rounded-xl font-bold text-lg px-4 py-4 transition-all active:scale-[0.97] select-none leading-tight"
      style={{
        background: selecionado ? 'var(--brand-primary)' : '#fff',
        color: selecionado ? '#fff' : 'var(--text-strong)',
        border: selecionado ? '2px solid var(--brand-primary)' : '2px solid var(--line)',
        fontFamily: 'var(--font-display)',
        boxShadow: selecionado ? '0 4px 16px rgba(86,164,187,0.3)' : 'none',
        transform: selecionado ? 'scale(1.02)' : undefined,
      }}
    >
      {label}
    </button>
  )
}
