'use client'

interface Props {
  etapaAtual: number
  totalEtapas: number
  labels: string[]
}

export default function EtapaIndicador({ etapaAtual, totalEtapas, labels }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 mb-4">
      {/* Barra de progresso */}
      <div className="flex items-center justify-center">
        {Array.from({ length: totalEtapas }).map((_, i) => (
          <div key={i} className="flex items-center">
            <div
              className={`
                w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0
                ${i < etapaAtual ? 'bg-[#1E9FAC] text-white' : ''}
                ${i === etapaAtual ? 'bg-[#1E9FAC] text-white ring-[3px] ring-[#1E9FAC]/25' : ''}
                ${i > etapaAtual ? 'bg-[#DDE4EA] text-[#8FA3B0]' : ''}
              `}
            >
              {i < etapaAtual ? '✓' : i + 1}
            </div>
            {i < totalEtapas - 1 && (
              <div className={`h-[3px] w-6 ${i < etapaAtual ? 'bg-[#1E9FAC]' : 'bg-[#DDE4EA]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Label da etapa atual — abaixo, centralizado */}
      <span className="text-[#1E9FAC] text-xs font-bold uppercase tracking-widest">
        {labels[etapaAtual]}
      </span>
    </div>
  )
}
