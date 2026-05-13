'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Props {
  onReset?: () => void
}

export default function Navegacao({ onReset }: Props) {
  const pathname = usePathname()
  const [agora, setAgora] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const tabClass = (ativo: boolean) =>
    `px-5 py-2.5 text-sm font-semibold transition-all active:scale-95 rounded-lg ${
      ativo
        ? 'bg-[#1E9FAC] text-white'
        : 'bg-white border border-[#DDE4EA] text-[#8FA3B0] hover:border-[#1E9FAC] hover:text-[#1E9FAC]'
    }`

  return (
    <header className="bg-white border-b-[3px] border-[#1E9FAC] px-6 py-3 grid grid-cols-3 items-center shrink-0 shadow-sm">
      {/* Esquerda: logo + título */}
      <div className="flex items-center gap-3">
        {onReset && (
          <button
            onClick={onReset}
            className="bg-[#F2F5F7] hover:bg-[#E6F6F8] active:scale-95 border border-[#DDE4EA] text-[#1A3344] p-2.5 rounded-lg transition-all"
            title="Voltar ao início"
          >
            🏠
          </button>
        )}
        <img src="/Logo MSB-14.png" alt="MSB" className="h-10 w-auto" />
        <div>
          <h1 className="text-base font-extrabold text-[#1A3344] leading-tight tracking-tight">
            Kaizen Fibra
          </h1>
          <p className="text-[11px] text-[#8FA3B0] font-medium">Apontamento de Desperdícios</p>
        </div>
      </div>

      {/* Centro: tabs de navegação */}
      <nav className="flex gap-1.5 justify-center">
        {pathname === '/' && onReset ? (
          <button onClick={onReset} className={tabClass(true)}>
            📋 Apontamento
          </button>
        ) : (
          <Link href="/" className={tabClass(pathname === '/')}>
            📋 Apontamento
          </Link>
        )}
<Link href="/dashboard" className={tabClass(pathname === '/dashboard')}>
          📊 Dashboard
        </Link>
      </nav>

      {/* Direita: data e hora */}
      <div className="text-right">
        <p className="text-[11px] text-[#8FA3B0]">
          {agora.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
        </p>
        <p className="text-sm font-bold text-[#1A3344] font-mono">
          {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </header>
  )
}
