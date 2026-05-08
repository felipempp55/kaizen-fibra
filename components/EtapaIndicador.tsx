'use client'

interface Props {
  etapaAtual: number
  totalEtapas: number
  labels: string[]
}

export default function EtapaIndicador({ etapaAtual, totalEtapas, labels }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 mb-5">
      {Array.from({ length: totalEtapas }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
              ${i < etapaAtual ? 'bg-[#1E9FAC] text-white' : ''}
              ${i === etapaAtual ? 'bg-[#1E9FAC] text-white ring-4 ring-[#1E9FAC]/20' : ''}
              ${i > etapaAtual ? 'bg-[#DDE4EA] text-[#8FA3B0]' : ''}
            `}
          >
            {i < etapaAtual ? '✓' : i + 1}
          </div>
          {i < totalEtapas - 1 && (
            <div className={`h-1 w-8 rounded ${i < etapaAtual ? 'bg-[#1E9FAC]' : 'bg-[#DDE4EA]'}`} />
          )}
        </div>
      ))}
      <span className="ml-3 text-[#8FA3B0] text-sm font-semibold">{labels[etapaAtual]}</span>
    </div>
  )
}
