'use client'

interface Props {
  etapaAtual: number
  totalEtapas: number
  labels: string[]
}

export default function EtapaIndicador({ etapaAtual, totalEtapas, labels }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 mb-4 px-2">
      {/* Linha de progresso com círculos */}
      <div className="flex items-center justify-center w-full max-w-sm">
        {Array.from({ length: totalEtapas }).map((_, i) => (
          <div key={i} className="flex items-center">
            {/* Círculo da etapa */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
              style={{
                background:
                  i < etapaAtual
                    ? 'var(--brand-primary)'
                    : i === etapaAtual
                      ? 'var(--brand-deep)'
                      : '#fff',
                border:
                  i < etapaAtual
                    ? '1.5px solid var(--brand-primary)'
                    : i === etapaAtual
                      ? '1.5px solid var(--brand-deep)'
                      : '1.5px solid var(--line)',
                color: i <= etapaAtual ? '#fff' : 'var(--text-faint)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                boxShadow: i === etapaAtual
                  ? '0 0 0 4px rgba(86,164,187,0.15)'
                  : 'none',
              }}
            >
              {i < etapaAtual ? (
                // Checkmark SVG
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l4.5 4.5L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>

            {/* Conector entre etapas */}
            {i < totalEtapas - 1 && (
              <div
                className="h-[2px] w-5 transition-all duration-200"
                style={{ background: i < etapaAtual ? 'var(--brand-primary)' : 'var(--line)' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Label da etapa atual */}
      <span
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}
      >
        {labels[etapaAtual]}
      </span>
    </div>
  )
}
