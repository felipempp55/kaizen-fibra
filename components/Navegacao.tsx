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
    `px-4 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
      ativo
        ? 'bg-blue-500 text-white'
        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
    }`

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3">
        {onReset && (
          <button
            onClick={onReset}
            className="bg-slate-700 hover:bg-slate-600 active:scale-95 text-white p-2.5 rounded-xl transition-all text-lg"
            title="Voltar ao início"
          >
            🏠
          </button>
        )}
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">Kaizen Fibra</h1>
          <p className="text-slate-400 text-xs">Apontamento de Desperdícios</p>
        </div>
      </div>

      <nav className="flex gap-2">
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

      <div className="text-right shrink-0">
        <p className="text-slate-400 text-xs">
          {agora.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
        </p>
        <p className="text-slate-300 text-sm font-mono">
          {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </header>
  )
}
