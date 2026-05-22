'use client'

import Link from 'next/link'
import Image from 'next/image'
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
      <div className="flex items-center gap-3 shrink-0">
        {onReset ? (
          <button
            onClick={onReset}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            title="Voltar ao início"
          >
            <LogoArea />
          </button>
        ) : (
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <LogoArea />
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

function LogoArea() {
  return (
    <div className="flex items-center gap-3">
      {/* Logo MSB — versão branca para fundo escuro */}
      <Image
        src="/Logo MSB-12.png"
        alt="MSB"
        width={72}
        height={32}
        style={{ objectFit: 'contain', objectPosition: 'left center' }}
        priority
      />

      {/* Divisor */}
      <div className="h-6 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />

      {/* Subtítulo do produto */}
      <span
        className="font-semibold uppercase tracking-widest"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.45)',
        }}
      >
        ESTAÇÃO · FIBRA
      </span>
    </div>
  )
}
