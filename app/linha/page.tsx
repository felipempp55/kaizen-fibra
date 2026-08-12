'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'

// Chave usada para lembrar a última linha escolhida no tablet
const CHAVE_LINHA = 'kaizen-linha'

export default function SeletorLinhaPage() {
  const router = useRouter()

  function escolher(linha: 'fibra' | 'tforce') {
    try { localStorage.setItem(CHAVE_LINHA, linha) } catch {}
    router.push(linha === 'tforce' ? '/tforce' : '/')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-10" style={{ background: 'var(--bg-page)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-2xl px-6 py-4" style={{ background: 'var(--brand-deep)' }}>
          <Image src="/Logo MSB-12.png" alt="MSB" width={110} height={48} style={{ objectFit: 'contain' }} priority />
        </div>
        <p
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.18em' }}
        >
          Selecione a linha de produção
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        <CardLinha
          titulo="Fibra Óptica"
          descricao="Polimento · Epóxi · Clivagem · Dimensionais"
          cor="var(--brand-primary)"
          onClick={() => escolher('fibra')}
        />
        <CardLinha
          titulo="T-Force"
          descricao="Sonda Extratora · retrabalhos por PI"
          cor="var(--brand-deep-2)"
          onClick={() => escolher('tforce')}
        />
      </div>

      <p className="text-xs text-center max-w-sm" style={{ color: 'var(--text-faint)' }}>
        Sua escolha fica salva neste tablet. Para trocar depois, use o botão <strong>⇄ Linha</strong> no topo da tela.
      </p>
    </div>
  )
}

function CardLinha({ titulo, descricao, cor, onClick }: { titulo: string; descricao: string; cor: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-8 flex flex-col items-center gap-3 transition-all active:scale-[0.97]"
      style={{ background: '#fff', border: `2px solid var(--line)`, boxShadow: '0 2px 10px rgba(31,55,68,0.06)' }}
    >
      <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: cor }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" /><path d="M3 8l9 5 9-5M12 13v9" opacity="0.7" />
        </svg>
      </span>
      <span className="text-2xl font-extrabold" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
        {titulo}
      </span>
      <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        {descricao}
      </span>
    </button>
  )
}
