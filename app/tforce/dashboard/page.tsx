'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import type { Apontamento } from '@/lib/types'
import Navegacao from '@/components/Navegacao'
import GraficoPareto from '@/components/GraficoPareto'
import { PIS_TFORCE, buscarPI } from '@/lib/tforce'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const LINHA = 'tforce' as const

type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado'

const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: 'hoje',          label: 'Hoje'          },
  { valor: 'semana',        label: 'Semana'        },
  { valor: 'mes',           label: 'Mês'           },
  { valor: 'ano',           label: 'Ano'           },
  { valor: 'personalizado', label: 'Personalizado' },
]

const TT = {
  contentStyle: { backgroundColor: '#1F3744', border: '1px solid #56A4BB', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#ffffff', fontWeight: 700 },
  itemStyle: { color: '#b3d4e0' },
}

function getIntervalo(p: Periodo, ini: string, fim: string) {
  const agora = new Date()
  const sod = (d: Date) => { d.setHours(0, 0, 0, 0); return d }
  if (p === 'hoje') return { de: sod(new Date()).toISOString(), ate: agora.toISOString() }
  if (p === 'semana') {
    const seg = new Date(); const dow = seg.getDay()
    seg.setDate(seg.getDate() + (dow === 0 ? -6 : 1 - dow))
    const sex = new Date(seg); sex.setDate(seg.getDate() + 4); sex.setHours(23, 59, 59, 999)
    return { de: sod(seg).toISOString(), ate: sex.toISOString() }
  }
  if (p === 'mes') { const d = new Date(); d.setDate(1); return { de: sod(d).toISOString(), ate: agora.toISOString() } }
  if (p === 'ano') { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return { de: sod(d).toISOString(), ate: agora.toISOString() } }
  return {
    de: ini ? new Date(ini + 'T00:00:00').toISOString() : sod(new Date()).toISOString(),
    ate: fim ? new Date(fim + 'T23:59:59').toISOString() : agora.toISOString(),
  }
}

function pareto(itens: { nome: string; valor: number }[]) {
  const s = [...itens].sort((a, b) => b.valor - a.valor).filter(i => i.valor > 0)
  const total = s.reduce((acc, i) => acc + i.valor, 0)
  let acum = 0
  return s.map(i => { acum += i.valor; return { ...i, percentualAcumulado: total > 0 ? Math.round((acum / total) * 100) : 0 } })
}

// ─── Login (mesma credencial do dashboard da fibra) ────────────────────────────
function LoginDashboard({ onSuccess }: { onSuccess: () => void }) {
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(false)

  function tentar() {
    if (login.trim().toLowerCase() === 'qualidade' && senha === 'pareto') onSuccess()
    else { setErro(true); setSenha('') }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-page)' }}>
      <Navegacao linha="tforce" />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col gap-6 p-8 rounded-2xl" style={{ background: '#fff', border: '1px solid var(--line)', boxShadow: '0 1px 4px rgba(31,55,68,0.06)' }}>
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Image src="/Logo MSB-14.png" alt="MSB" width={96} height={42} style={{ objectFit: 'contain' }} priority />
            </div>
            <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              Acesso ao Dashboard T-Force
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Área restrita — informe suas credenciais</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold" style={{ color: 'var(--text-body)', fontFamily: 'var(--font-display)' }}>Login</label>
              <input type="text" value={login} onChange={e => { setLogin(e.target.value); setErro(false) }} onKeyDown={e => { if (e.key === 'Enter') tentar() }}
                placeholder="login" autoFocus className="w-full h-12 px-3.5 rounded-xl text-base outline-none" style={{ border: '1.5px solid var(--line)', color: 'var(--text-strong)' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold" style={{ color: 'var(--text-body)', fontFamily: 'var(--font-display)' }}>Senha</label>
              <input type="password" value={senha} onChange={e => { setSenha(e.target.value); setErro(false) }} onKeyDown={e => { if (e.key === 'Enter') tentar() }}
                placeholder="••••••" className="w-full h-12 px-3.5 rounded-xl text-base outline-none" style={{ border: '1.5px solid var(--line)', color: 'var(--text-strong)' }} />
            </div>
            {erro && <p className="text-sm text-center font-semibold" style={{ color: 'var(--signal-red)' }}>Login ou senha incorretos</p>}
          </div>
          <button onClick={tentar} className="font-bold text-lg py-4 rounded-xl transition-all active:scale-[0.97]" style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)', boxShadow: '0 4px 14px rgba(86,164,187,0.3)' }}>
            Entrar →
          </button>
        </div>
      </div>
    </div>
  )
}

function Painel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#DDE6EB] rounded-xl p-4 flex flex-col gap-3 shadow-sm">
      {titulo && (
        <h3 className="text-[#1F3744] font-bold text-[11px] uppercase tracking-wider flex items-center gap-2">
          <span className="w-1 h-3.5 bg-[#56A4BB] rounded-full inline-block shrink-0" />
          {titulo}
        </h3>
      )}
      {children}
    </div>
  )
}

function Vazio() {
  return <p className="text-[#607A89] text-sm text-center py-10">Sem dados no período</p>
}

function KPI({ label, valor, unidade, cor }: { label: string; valor: string; unidade?: string; cor: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid var(--line)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</p>
      <p className="text-2xl font-black leading-tight mt-1" style={{ color: cor, fontFamily: 'var(--font-display)' }}>
        {valor}{unidade && <span className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>{unidade}</span>}
      </p>
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────────

export default function TForceDashboardPage() {
  const [autenticado, setAutenticado] = useState(false)
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [ini, setIni] = useState('')
  const [fim, setFim] = useState('')
  const [dados, setDados] = useState<Apontamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [pisExcluidos, setPisExcluidos] = useState<Set<string>>(new Set())
  const [piTendencia, setPiTendencia] = useState<string>(PIS_TFORCE[0].codigo)

  function togglePI(codigo: string) {
    setPisExcluidos(prev => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo); else next.add(codigo)
      return next
    })
  }

  const buscar = useCallback(async () => {
    setCarregando(true)
    const { de, ate } = getIntervalo(periodo, ini, fim)
    const { data } = await supabase.from('apontamentos').select('*')
      .eq('linha', LINHA)
      .gte('created_at', de).lte('created_at', ate)
      .order('created_at', { ascending: true })
    setDados(data ?? [])
    setCarregando(false)
  }, [periodo, ini, fim])

  useEffect(() => { if (autenticado) buscar() }, [autenticado, buscar])

  // ── Métricas derivadas do período selecionado ───────────────────────────────
  const dp = useMemo(() => {
    const totalRetrabalhos = dados.reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)
    const totalPerdas = dados.reduce((s, a) => s + (a.quantidade_ml ?? 0), 0)

    const opTamanhoMap = new Map<string, number>()
    dados.forEach(a => { if (a.tamanho_op && !opTamanhoMap.has(a.numero_op)) opTamanhoMap.set(a.numero_op, a.tamanho_op) })
    const totalTamanhoOp = Array.from(opTamanhoMap.values()).reduce((s, v) => s + v, 0)

    const taxaRetrabalho = totalTamanhoOp > 0 ? (totalRetrabalhos / totalTamanhoOp) * 100 : 0
    const taxaPerda = totalTamanhoOp > 0 ? (totalPerdas / totalTamanhoOp) * 100 : 0

    // Pareto por PI
    const mPerdaPI = new Map<string, number>()
    const mRetrabalhoPI = new Map<string, number>()
    dados.forEach(a => {
      const pi = buscarPI(a.grupo)
      const label = pi ? pi.curto : a.grupo
      if (a.quantidade_pecas) mRetrabalhoPI.set(label, (mRetrabalhoPI.get(label) ?? 0) + a.quantidade_pecas)
      if (a.quantidade_ml) mPerdaPI.set(label, (mPerdaPI.get(label) ?? 0) + a.quantidade_ml)
    })

    // Ranking por Operação + Modo (top ocorrências de defeito específico)
    const mModo = new Map<string, number>()
    dados.forEach(a => {
      const chave = a.modo_falha ? `${a.tipo_desperdicio} · ${a.modo_falha}` : a.tipo_desperdicio
      const qtd = (a.quantidade_pecas ?? 0) + (a.quantidade_ml ?? 0)
      mModo.set(chave, (mModo.get(chave) ?? 0) + qtd)
    })

    // Últimos registros para o histórico
    const historico = [...dados].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return {
      totalApontamentos: dados.length,
      totalRetrabalhos, totalPerdas, totalTamanhoOp, taxaRetrabalho, taxaPerda,
      paretoPerdaPI: pareto(Array.from(mPerdaPI.entries()).map(([nome, valor]) => ({ nome, valor })).filter(p => !pisExcluidos.has(p.nome))),
      paretoRetrabalhoPI: pareto(Array.from(mRetrabalhoPI.entries()).map(([nome, valor]) => ({ nome, valor })).filter(p => !pisExcluidos.has(p.nome))),
      paretoModo: pareto(Array.from(mModo.entries()).map(([nome, valor]) => ({ nome, valor }))).slice(0, 10),
      historico,
    }
  }, [dados, pisExcluidos])

  // ── Tendência de taxa de retrabalho por PI (segue granularidade do período) ──
  const [tendDados, setTendDados] = useState<Apontamento[]>([])
  useEffect(() => {
    if (!autenticado) return
    let de: Date
    if (periodo === 'hoje') { de = new Date(); de.setDate(de.getDate() - 7); de.setHours(0, 0, 0, 0) }
    else if (periodo === 'semana') { de = new Date(); de.setDate(de.getDate() - 7 * 7); de.setHours(0, 0, 0, 0) }
    else if (periodo === 'mes' || periodo === 'ano') { const h = new Date(); de = new Date(h.getFullYear(), h.getMonth() - 7, 1) }
    else { const { de: deStr } = getIntervalo(periodo, ini, fim); de = new Date(deStr) }
    supabase.from('apontamentos').select('*')
      .eq('linha', LINHA)
      .gte('created_at', de.toISOString())
      .order('created_at', { ascending: true })
      .then(({ data }) => setTendDados(data ?? []))
  }, [autenticado, periodo, ini, fim])

  const tendencia = useMemo(() => {
    const fmtDiaMes = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    const fmtMesAno = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
    type Bucket = { inicio: Date; fim: Date; label: string }
    const buckets: Bucket[] = []

    if (periodo === 'hoje') {
      for (let i = 7; i >= 0; i--) {
        const inicio = new Date(); inicio.setDate(inicio.getDate() - i); inicio.setHours(0, 0, 0, 0)
        const fim = new Date(inicio); fim.setDate(fim.getDate() + 1)
        buckets.push({ inicio, fim, label: fmtDiaMes(inicio) })
      }
    } else if (periodo === 'semana') {
      function inicioSemana(d: Date): Date {
        const dt = new Date(d); const dow = dt.getDay()
        dt.setDate(dt.getDate() + (dow === 0 ? -6 : 1 - dow)); dt.setHours(0, 0, 0, 0)
        return dt
      }
      const semanaAtual = inicioSemana(new Date())
      for (let i = 7; i >= 0; i--) {
        const inicio = new Date(semanaAtual); inicio.setDate(inicio.getDate() - i * 7)
        const fim = new Date(inicio); fim.setDate(fim.getDate() + 7)
        buckets.push({ inicio, fim, label: fmtDiaMes(inicio) })
      }
    } else if (periodo === 'mes' || periodo === 'ano') {
      const hoje = new Date()
      for (let i = 7; i >= 0; i--) {
        const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
        const fim = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 1)
        buckets.push({ inicio, fim, label: fmtMesAno(inicio) })
      }
    } else {
      const { de, ate } = getIntervalo(periodo, ini, fim)
      const cursor = new Date(de); cursor.setHours(0, 0, 0, 0)
      const limite = new Date(ate); limite.setHours(0, 0, 0, 0)
      while (cursor <= limite) {
        const inicio = new Date(cursor)
        const fimB = new Date(inicio); fimB.setDate(fimB.getDate() + 1)
        buckets.push({ inicio, fim: fimB, label: fmtDiaMes(inicio) })
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    return buckets.map(({ inicio, fim, label }) => {
      const doBucket = tendDados.filter(a => { const dt = new Date(a.created_at); return dt >= inicio && dt < fim })
      const opTamanhoMapBucket = new Map<string, number>()
      doBucket.forEach(a => { if (a.tamanho_op && !opTamanhoMapBucket.has(a.numero_op)) opTamanhoMapBucket.set(a.numero_op, a.tamanho_op) })
      const baseBucket = Array.from(opTamanhoMapBucket.values()).reduce((s, v) => s + v, 0)
      const retrabalhosBucket = doBucket.filter(a => a.grupo === piTendencia).reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)
      const taxa = baseBucket > 0 ? Math.round((retrabalhosBucket / baseBucket) * 1000) / 10 : 0
      return { periodo: label, TaxaRetrabalho: taxa, retrabalhos: retrabalhosBucket, base: baseBucket }
    })
  }, [tendDados, piTendencia, periodo, ini, fim])

  const labelJanela = periodo === 'hoje' ? 'ÚLTIMOS 8 DIAS'
    : periodo === 'semana' ? 'ÚLTIMAS 8 SEMANAS'
    : (periodo === 'mes' || periodo === 'ano') ? 'ÚLTIMOS 8 MESES'
    : 'PERÍODO SELECIONADO'

  if (!autenticado) return <LoginDashboard onSuccess={() => setAutenticado(true)} />

  return (
    <div className="min-h-screen bg-[#EEF3F5] flex flex-col">
      <Navegacao linha="tforce" />

      {/* ── Cabeçalho fixo ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--line)', boxShadow: '0 1px 6px rgba(31,55,68,0.07)' }}>
        <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-2 flex-wrap">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              DASHBOARD · T-FORCE
            </p>
            <h1 className="text-xl font-extrabold leading-tight mt-0.5" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              Retrabalhos da Sonda Extratora
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-page)' }}>
              {PERIODOS.filter(p => p.valor !== 'personalizado').map(p => (
                <button key={p.valor} onClick={() => setPeriodo(p.valor)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={periodo === p.valor ? { background: 'var(--brand-primary)', color: '#fff', boxShadow: '0 2px 8px rgba(86,164,187,0.3)' } : { background: 'transparent', color: 'var(--text-muted)' }}>
                  {p.label}
                </button>
              ))}
              <button onClick={() => setPeriodo('personalizado')} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={periodo === 'personalizado' ? { background: 'var(--brand-primary)', color: '#fff', boxShadow: '0 2px 8px rgba(86,164,187,0.3)' } : { background: 'transparent', color: 'var(--text-muted)' }}>
                ···
              </button>
            </div>
            <button onClick={buscar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all" style={{ background: 'var(--bg-page)', color: 'var(--text-muted)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={carregando ? 'animate-spin' : ''}>
                <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" />
              </svg>
              {carregando ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        {periodo === 'personalizado' && (
          <div className="flex items-center gap-2 px-5 pb-3">
            <input type="date" value={ini} onChange={e => setIni(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg" style={{ border: '1px solid var(--line)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>até</span>
            <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg" style={{ border: '1px solid var(--line)' }} />
          </div>
        )}
      </div>

      <main className="flex-1 overflow-y-auto p-4 max-w-6xl mx-auto w-full flex flex-col gap-4">

        {/* ── KPIs ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI label="Apontamentos" valor={String(dp.totalApontamentos)} cor="var(--brand-primary)" />
          <KPI label="Retrabalhos" valor={String(dp.totalRetrabalhos)} unidade="pç" cor="var(--signal-amber)" />
          <KPI label="Peças Perdidas" valor={String(dp.totalPerdas)} unidade="pç" cor="var(--signal-red)" />
          <KPI label="Taxa de Retrabalho" valor={dp.taxaRetrabalho.toFixed(2)} unidade="%" cor="var(--signal-amber)" />
          <KPI label="Taxa de Perda" valor={dp.taxaPerda.toFixed(2)} unidade="%" cor="var(--signal-red)" />
        </div>

        {/* ── Filtro por PI ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PI:</span>
          {PIS_TFORCE.map(pi => {
            const ativo = !pisExcluidos.has(pi.codigo)
            return (
              <button key={pi.codigo} type="button" onClick={() => togglePI(pi.codigo)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-[0.96]"
                style={{ background: ativo ? '#1F3744' : '#fff', color: ativo ? '#fff' : '#607A89', border: `1px solid ${ativo ? '#1F3744' : '#DDE6EB'}` }}>
                {pi.curto}
              </button>
            )
          })}
        </div>

        {/* ── Pareto: Perdas e Retrabalhos por PI ─────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Painel titulo="Pareto — Perdas por PI (peças)">
            <GraficoPareto dados={dp.paretoPerdaPI} corBarra="#ef4444" labelValor="Perdas (pç)" />
          </Painel>
          <Painel titulo="Pareto — Retrabalhos por PI (peças)">
            <GraficoPareto dados={dp.paretoRetrabalhoPI} corBarra="#D4A155" labelValor="Retrabalhos (pç)" />
          </Painel>
        </div>

        {/* ── Ranking por modo de falha ────────────────────────────────────── */}
        <Painel titulo="Ranking — Top 10 Modos de Falha (Operação · Modo)">
          <GraficoPareto dados={dp.paretoModo} corBarra="#8b5cf6" labelValor="Ocorrências (pç)" />
        </Painel>

        {/* ── Tendência de Taxa de Retrabalho por PI ──────────────────────── */}
        <Painel titulo="">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{labelJanela}</p>
              <h3 className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>Tendência de Taxa de Retrabalho (%)</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {PIS_TFORCE.map(pi => {
                const ativo = piTendencia === pi.codigo
                return (
                  <button key={pi.codigo} type="button" onClick={() => setPiTendencia(pi.codigo)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-[0.96]"
                    style={{ background: ativo ? '#D4A155' : '#fff', color: ativo ? '#fff' : '#607A89', border: `1px solid ${ativo ? '#D4A155' : '#DDE6EB'}` }}>
                    {pi.curto}
                  </button>
                )
              })}
            </div>
          </div>
          {tendencia.every(p => p.TaxaRetrabalho === 0) ? <Vazio /> : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={tendencia} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradTendTForce" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4A155" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#D4A155" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fill: '#607A89', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#607A89', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip {...TT} formatter={(v: unknown, n: unknown, p: { payload?: { retrabalhos: number; base: number } }) => [
                  `${v}% (${p?.payload?.retrabalhos ?? 0} retr. / ${p?.payload?.base ?? 0} pç)`, 'Taxa de Retrabalho'
                ]} />
                <Area type="monotone" dataKey="TaxaRetrabalho" stroke="#D4A155" strokeWidth={2.5} fill="url(#gradTendTForce)"
                  dot={{ r: 4, fill: '#D4A155', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Painel>

        {/* ── Histórico ────────────────────────────────────────────────────── */}
        <Painel titulo={`HISTÓRICO · ${dp.historico.length} ${dp.historico.length === 1 ? 'APONTAMENTO' : 'APONTAMENTOS'}`}>
          {dp.historico.length === 0 ? <Vazio /> : (
            <div className="overflow-auto -mx-4" style={{ maxHeight: 480 }}>
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: 'var(--bg-page)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
                    <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Data/Hora</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>OP</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PI</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Operação · Modo</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {dp.historico.map((a, i) => {
                    const dt = new Date(a.created_at)
                    const dataFmt = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                    const horaFmt = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    const pi = buscarPI(a.grupo)
                    return (
                      <tr key={a.id ?? i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                        <td className="px-5 py-2.5 tabular-nums whitespace-nowrap" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {dataFmt} <span style={{ color: 'var(--text-strong)' }}>{horaFmt}</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-body)', fontFamily: 'var(--font-mono)' }}>{a.numero_op}</td>
                        <td className="px-3 py-2.5 font-bold tabular-nums" style={{ color: 'var(--brand-primary-dark)', fontFamily: 'var(--font-mono)' }}>{pi?.curto ?? a.grupo}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold" style={{ color: 'var(--text-strong)' }}>{a.tipo_desperdicio}</span>
                          {a.modo_falha && <span style={{ color: 'var(--text-muted)' }}> · {a.modo_falha}</span>}
                        </td>
                        <td className="px-5 py-2.5 text-right whitespace-nowrap font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                          {a.quantidade_pecas != null && a.quantidade_pecas > 0 && <span style={{ color: 'var(--signal-amber)' }}>{a.quantidade_pecas} <span className="text-[10px] uppercase">retr</span></span>}
                          {a.quantidade_pecas != null && a.quantidade_pecas > 0 && a.quantidade_ml != null && a.quantidade_ml > 0 && <span style={{ color: 'var(--text-faint)' }}> · </span>}
                          {a.quantidade_ml != null && a.quantidade_ml > 0 && <span style={{ color: 'var(--signal-red)' }}>{a.quantidade_ml} <span className="text-[10px] uppercase">perd</span></span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Painel>
      </main>
    </div>
  )
}
