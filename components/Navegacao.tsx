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
    const timer = setInterval(() => setAgora(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const horaFmt = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const itemStyle = (ativo: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 border ` +
    (ativo
      ? 'bg-white/[0.07] text-white border-white/[0.12]'
      : 'text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.04]')

  return (
    <header
      className="h-16 shrink-0 flex items-center px-6 gap-6"
      style={{ background: 'var(--brand-deep)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* ─── Esquerda: logo ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {onReset ? (
          <button
            onClick={onReset}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            title="Voltar ao início"
          >
            <LogoMark />
            <LogoWordmark />
          </button>
        ) : (
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <LogoMark />
            <LogoWordmark />
          </Link>
        )}
      </div>

      {/* ─── Centro: navegação ─────────────────────────────────── */}
      <nav className="flex-1 flex items-center justify-center gap-1">
        {pathname === '/' && onReset ? (
          <button onClick={onReset} className={itemStyle(true)}>
            Apontamentos
          </button>
        ) : (
          <Link href="/" className={itemStyle(pathname === '/')}>
            Apontamentos
          </Link>
        )}
        <Link href="/dashboard" className={itemStyle(pathname === '/dashboard')}>
          Dashboard
        </Link>
        <Link href="/cep" className={itemStyle(pathname === '/cep')}>
          CEP
        </Link>
      </nav>

      {/* ─── Direita: status + hora ─────────────────────────────── */}
      <div className="flex items-center gap-4">
        {/* Live dot + turno */}
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span
              className="pulse-dot absolute inline-flex h-full w-full rounded-full"
              style={{ background: 'var(--signal-green)' }}
            />
          </span>
          <span
            className="text-[10px] font-bold tracking-widest uppercase hidden sm:block"
            style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}
          >
            ONLINE
          </span>
        </div>

        {/* Separador */}
        <div className="h-4 w-px bg-white/10" />

        {/* Hora */}
        <span
          className="text-sm font-semibold text-white tabular-nums"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {horaFmt}
        </span>
      </div>
    </header>
  )
}

function LogoMark() {
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: 'var(--brand-primary)' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="5.5" stroke="white" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="1.6" fill="white" />
      </svg>
    </div>
  )
}

function LogoWordmark() {
  return (
    <div className="flex flex-col leading-none">
      <span
        className="font-extrabold tracking-tight text-white"
        style={{ fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: '-0.02em' }}
      >
        MSB<span style={{ color: 'var(--brand-tecno)', marginLeft: 2 }}>·</span>
      </span>
      <span
        className="font-semibold uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.16em',
          color: 'rgba(255,255,255,0.4)',
          marginTop: 3,
        }}
      >
        KAIZEN · FIBRA
      </span>
    </div>
  )
}
