'use client'

interface Props {
  etapaAtual: number
  totalEtapas: number
  labels: string[]
}

export default function EtapaIndicador({ etapaAtual, totalEtapas, labels }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: totalEtapas }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
              ${i < etapaAtual ? 'bg-green-500 text-white' : ''}
              ${i === etapaAtual ? 'bg-blue-500 text-white ring-4 ring-blue-300/30' : ''}
              ${i > etapaAtual ? 'bg-slate-700 text-slate-400' : ''}
            `}
          >
            {i < etapaAtual ? '✓' : i + 1}
          </div>
          {i < totalEtapas - 1 && (
            <div className={`h-1 w-8 rounded ${i < etapaAtual ? 'bg-green-500' : 'bg-slate-700'}`} />
          )}
        </div>
      ))}
      <span className="ml-3 text-slate-400 text-sm font-medium">{labels[etapaAtual]}</span>
    </div>
  )
}
