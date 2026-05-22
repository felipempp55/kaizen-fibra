'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Apontamento } from '@/lib/types'
import Navegacao from '@/components/Navegacao'
import GraficoPareto from '@/components/GraficoPareto'
import { calcularPerdaMateriais, calcularCustoTotal, formatarReal } from '@/lib/materiais'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type Periodo = 'hoje' | 'semana' | 'mes' | 'personalizado'
type Aba = 'producao' | 'qualidade' | 'financeiro'

interface ApontamentoRico extends Apontamento {
  custo: number
  diaFmt: string
  horaFmt: string
}

// ─── Constantes visuais ───────────────────────────────────────────────────────

const CORES_GRUPO: Record<string, string> = {
  'Epóxi': '#8b5cf6',
  'Polimento': '#1E9FAC',
  'Problemas Dimensionais': '#f97316',
  'Clivagem': '#ef4444',
}

const PALETA = ['#1E9FAC', '#ef4444', '#eab308', '#8b5cf6', '#f97316', '#06b6d4', '#10b981', '#f43f5e']

const TT = {
  contentStyle: { backgroundColor: '#1A3344', border: '1px solid #1E9FAC', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#ffffff', fontWeight: 700 },
  itemStyle: { color: '#b3d4e0' },
}

const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: 'hoje', label: 'Hoje' },
  { valor: 'semana', label: '7 dias' },
  { valor: 'mes', label: '30 dias' },
  { valor: 'personalizado', label: 'Personalizado' },
]

// ─── Utilitários ──────────────────────────────────────────────────────────────

function getIntervalo(p: Periodo, ini: string, fim: string) {
  const agora = new Date()
  const sod = (d: Date) => { d.setHours(0, 0, 0, 0); return d }
  if (p === 'hoje') return { de: sod(new Date()).toISOString(), ate: agora.toISOString() }
  if (p === 'semana') { const d = new Date(); d.setDate(d.getDate() - 6); return { de: sod(d).toISOString(), ate: agora.toISOString() } }
  if (p === 'mes') { const d = new Date(); d.setDate(d.getDate() - 29); return { de: sod(d).toISOString(), ate: agora.toISOString() } }
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

const fmtDia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const R = (v: number) => formatarReal(v)

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [ini, setIni] = useState('')
  const [fim, setFim] = useState('')
  const [dados, setDados] = useState<Apontamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<Aba>('producao')

  const buscar = useCallback(async () => {
    setCarregando(true)
    const { de, ate } = getIntervalo(periodo, ini, fim)
    const { data } = await supabase
      .from('apontamentos').select('*')
      .gte('created_at', de).lte('created_at', ate)
      .order('created_at', { ascending: true })
    setDados(data ?? [])
    setCarregando(false)
  }, [periodo, ini, fim])

  useEffect(() => { buscar() }, [buscar])

  // ── Processamento único de todos os dados ──────────────────────────────────
  const dp = useMemo(() => {
    // Enriquecer cada apontamento com custo calculado
    const ricos: ApontamentoRico[] = dados.map(a => {
      const fibra = a.fibra ?? 'F272'
      const itens = calcularPerdaMateriais(a.tipo_desperdicio, fibra, a.quantidade_pecas, a.quantidade_ml)
      return { ...a, custo: calcularCustoTotal(itens), diaFmt: fmtDia(a.created_at), horaFmt: fmtHora(a.created_at) }
    })

    // ── Totais gerais ──────────────────────────────────────────────────────
    const custoTotal = ricos.reduce((s, a) => s + a.custo, 0)
    const totalPecas = dados.reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)
    const totalTempo = dados.reduce((s, a) => s + (a.tempo_minutos ?? 0), 0)
    const operadoras = new Set(dados.map(a => a.nome_operador))
    const ops = new Set(dados.map(a => a.numero_op))

    // Peças efetivamente perdidas (por tipo)
    const pecasPerdidas =
      dados.filter(a => a.classificacao === 'perda').reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0) +
      dados.filter(a => a.tipo_desperdicio === 'Crimpagem').reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0) +
      dados.filter(a => ['Máquina', 'Clivagem com Defeito'].includes(a.tipo_desperdicio)).reduce((s, a) => s + (a.quantidade_ml ?? 0), 0)

    const pecasRetrabalho =
      dados.filter(a => a.classificacao === 'retrabalho').reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0) +
      dados.filter(a => a.tipo_desperdicio === 'Máquina').reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0) +
      dados.filter(a => a.tipo_desperdicio === 'Clivagem com Defeito').reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)

    // ── Evolução diária ────────────────────────────────────────────────────
    type DiaE = { data: string; Perdas: number; Retrabalhos: number; Custo: number; Apontamentos: number }
    const mDia = new Map<string, DiaE>()
    ricos.forEach(a => {
      if (!mDia.has(a.diaFmt)) mDia.set(a.diaFmt, { data: a.diaFmt, Perdas: 0, Retrabalhos: 0, Custo: 0, Apontamentos: 0 })
      const e = mDia.get(a.diaFmt)!
      e.Apontamentos++
      e.Custo = Math.round((e.Custo + a.custo) * 100) / 100
      if (a.classificacao === 'perda') e.Perdas += a.quantidade_pecas ?? 0
      else if (a.classificacao === 'retrabalho') e.Retrabalhos += a.quantidade_pecas ?? 0
    })
    const evDia = Array.from(mDia.values())

    // ── Evolução de custo acumulado ────────────────────────────────────────
    let acum = 0
    const evCustoAcum = evDia.map(d => { acum += d.Custo; return { data: d.data, CustoAcumulado: Math.round(acum * 100) / 100, CustoDia: d.Custo } })

    // ── Por grupo ──────────────────────────────────────────────────────────
    type GrpE = { grupo: string; Apontamentos: number; Custo: number }
    const mGrp = new Map<string, GrpE>()
    ricos.forEach(a => {
      if (!mGrp.has(a.grupo)) mGrp.set(a.grupo, { grupo: a.grupo, Apontamentos: 0, Custo: 0 })
      const g = mGrp.get(a.grupo)!; g.Apontamentos++; g.Custo += a.custo
    })
    const porGrupo = Array.from(mGrp.values()).sort((a, b) => b.Custo - a.Custo)

    // ── Por tipo ───────────────────────────────────────────────────────────
    type TipoE = { nome: string; Apontamentos: number; Custo: number }
    const mTipo = new Map<string, TipoE>()
    ricos.forEach(a => {
      if (!mTipo.has(a.tipo_desperdicio)) mTipo.set(a.tipo_desperdicio, { nome: a.tipo_desperdicio, Apontamentos: 0, Custo: 0 })
      const t = mTipo.get(a.tipo_desperdicio)!; t.Apontamentos++; t.Custo += a.custo
    })
    const porTipo = Array.from(mTipo.values()).sort((a, b) => b.Custo - a.Custo)
    const paretoTipo = pareto(porTipo.map(t => ({ nome: t.nome, valor: Math.round(t.Custo * 100) / 100 })))

    // ── Por tipo — contagem para qualidade ────────────────────────────────
    const paretoOcorrencias = pareto(porTipo.map(t => ({ nome: t.nome, valor: t.Apontamentos })))

    // ── Por operadora ──────────────────────────────────────────────────────
    type OpE = { nome: string; Apontamentos: number; Custo: number }
    const mOp = new Map<string, OpE>()
    ricos.forEach(a => {
      const n = a.nome_operador || '—'
      if (!mOp.has(n)) mOp.set(n, { nome: n, Apontamentos: 0, Custo: 0 })
      const o = mOp.get(n)!; o.Apontamentos++; o.Custo += a.custo
    })
    const porOperadora = Array.from(mOp.values()).sort((a, b) => b.Apontamentos - a.Apontamentos)
    const porOperadoraCusto = [...porOperadora].sort((a, b) => b.Custo - a.Custo)

    // ── F272 vs F365 por grupo ─────────────────────────────────────────────
    type FGE = { grupo: string; 'Fibra 272': number; 'Fibra 365': number }
    const mFG = new Map<string, FGE>()
    ricos.forEach(a => {
      if (!mFG.has(a.grupo)) mFG.set(a.grupo, { grupo: a.grupo, 'Fibra 272': 0, 'Fibra 365': 0 })
      const fg = mFG.get(a.grupo)!
      if (a.fibra === 'F272') fg['Fibra 272'] = Math.round((fg['Fibra 272'] + a.custo) * 100) / 100
      else if (a.fibra === 'F365') fg['Fibra 365'] = Math.round((fg['Fibra 365'] + a.custo) * 100) / 100
    })
    const fibraGrupo = Array.from(mFG.values())

    // ── Por material ───────────────────────────────────────────────────────
    type MatE = { nome: string; Custo: number }
    const mMat = new Map<string, MatE>()
    ricos.forEach(a => {
      const fibra = a.fibra ?? 'F272'
      calcularPerdaMateriais(a.tipo_desperdicio, fibra, a.quantidade_pecas, a.quantidade_ml).forEach(item => {
        const k = item.material.nome
        if (!mMat.has(k)) mMat.set(k, { nome: k, Custo: 0 })
        mMat.get(k)!.Custo += item.material.custo * item.quantidade
      })
    })
    const porMaterial = Array.from(mMat.values()).sort((a, b) => b.Custo - a.Custo)

    // ── Top OPs ────────────────────────────────────────────────────────────
    type OPE = { numero: string; fibra: string; Apontamentos: number; Custo: number }
    const mOP = new Map<string, OPE>()
    ricos.forEach(a => {
      if (!mOP.has(a.numero_op)) mOP.set(a.numero_op, { numero: a.numero_op, fibra: a.fibra ?? '—', Apontamentos: 0, Custo: 0 })
      const op = mOP.get(a.numero_op)!; op.Apontamentos++; op.Custo += a.custo
    })
    const topOPs = Array.from(mOP.values()).sort((a, b) => b.Custo - a.Custo).slice(0, 5)

    // ── Últimos registros ──────────────────────────────────────────────────
    const ultimosReg = [...ricos].reverse().slice(0, 8)

    // ── Projeções ──────────────────────────────────────────────────────────
    const nDias = evDia.length || 1
    const custoDiaMedio = custoTotal / nDias
    const projecaoMensal = custoDiaMedio * 22

    // ── Taxa de perda (% de apontamentos com custo > 0) ────────────────────
    const apontamentosComCusto = ricos.filter(a => a.custo > 0).length
    const taxaImpacto = ricos.length > 0 ? Math.round((apontamentosComCusto / ricos.length) * 100) : 0

    return {
      ricos, custoTotal, totalPecas, totalTempo,
      operadoras, ops, pecasPerdidas, pecasRetrabalho,
      evDia, evCustoAcum, porGrupo, porTipo, paretoTipo, paretoOcorrencias,
      porOperadora, porOperadoraCusto, fibraGrupo, porMaterial,
      topOPs, ultimosReg, custoDiaMedio, projecaoMensal, taxaImpacto,
    }
  }, [dados])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F2F5F7] flex flex-col">
      <Navegacao />

      {/* Cabeçalho fixo: abas + período */}
      <div className="bg-white border-b border-[#DDE4EA] sticky top-0 z-20 shadow-sm">
        {/* Abas */}
        <div className="flex">
          {([
            { v: 'producao', label: 'Produção', icon: '🏭' },
            { v: 'qualidade', label: 'Qualidade', icon: '📊' },
            { v: 'financeiro', label: 'Financeiro', icon: '💰' },
          ] as { v: Aba; label: string; icon: string }[]).map(a => (
            <button
              key={a.v}
              onClick={() => setAba(a.v)}
              className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-sm font-bold border-b-2 transition-all ${
                aba === a.v ? 'text-[#1E9FAC] border-[#1E9FAC]' : 'text-[#8FA3B0] border-transparent hover:text-[#1A3344]'
              }`}
            >
              <span>{a.icon}</span><span className="hidden sm:inline">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2">
          {PERIODOS.map(p => (
            <button key={p.valor} onClick={() => setPeriodo(p.valor)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${periodo === p.valor ? 'bg-[#1E9FAC] text-white border-[#1E9FAC]' : 'bg-white text-[#8FA3B0] border-[#DDE4EA] hover:border-[#1E9FAC]'}`}>
              {p.label}
            </button>
          ))}
          {periodo === 'personalizado' && (
            <>
              <input type="date" value={ini} onChange={e => setIni(e.target.value)} className="text-xs px-2.5 py-1.5 rounded-lg border border-[#DDE4EA] text-[#1A3344] focus:border-[#1E9FAC] focus:outline-none" />
              <span className="text-[#8FA3B0] text-xs">→</span>
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="text-xs px-2.5 py-1.5 rounded-lg border border-[#DDE4EA] text-[#1A3344] focus:border-[#1E9FAC] focus:outline-none" />
            </>
          )}
          <button onClick={buscar} className="ml-auto text-[#8FA3B0] hover:text-[#1E9FAC] text-xs font-semibold flex items-center gap-1 transition-colors">
            {carregando ? '⏳' : '↻'} {carregando ? 'Carregando…' : 'Atualizar'}
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 max-w-6xl mx-auto w-full flex flex-col gap-4">

        {/* ════════════════════════════════════════════════════════════════
            ABA: PRODUÇÃO
        ════════════════════════════════════════════════════════════════ */}
        {aba === 'producao' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI label="Apontamentos" valor={dp.ricos.length} cor="text-[#1E9FAC]" borda="border-l-[#1E9FAC]" icon="📋" />
              <KPI label="Peças Registradas" valor={dp.totalPecas} cor="text-[#1A3344]" borda="border-l-[#1A3344]" icon="🔩" />
              <KPI label="Operadoras Ativas" valor={dp.operadoras.size} cor="text-[#8b5cf6]" borda="border-l-[#8b5cf6]" icon="👷" />
              <KPI label="OPs no Período" valor={dp.ops.size} cor="text-[#f97316]" borda="border-l-[#f97316]" icon="🏭" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Apontamentos por dia */}
              <Painel titulo="Volume de Apontamentos por Dia">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dp.evDia} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" />
                    <XAxis dataKey="data" tick={{ fill: '#8FA3B0', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8FA3B0', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip {...TT} />
                    <Bar dataKey="Apontamentos" fill="#1E9FAC" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Painel>

              {/* Ranking operadoras */}
              <Painel titulo="Apontamentos por Operadora">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dp.porOperadora} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#8FA3B0', fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fill: '#1A3344', fontSize: 11 }} width={80} />
                    <Tooltip {...TT} />
                    <Bar dataKey="Apontamentos" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Painel>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Distribuição por grupo (donut) */}
              <Painel titulo="Distribuição por Grupo de Desperdício">
                {dp.porGrupo.length === 0
                  ? <Vazio />
                  : <ResponsiveContainer width="100%" height={230}>
                      <PieChart>
                        <Pie data={dp.porGrupo} dataKey="Apontamentos" nameKey="grupo"
                          cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                          {dp.porGrupo.map((e, i) => <Cell key={e.grupo} fill={CORES_GRUPO[e.grupo] ?? PALETA[i]} />)}
                        </Pie>
                        <Tooltip {...TT} formatter={(v: unknown) => [`${v} apontamentos`]} />
                        <Legend wrapperStyle={{ fontSize: 12, color: '#8FA3B0' }} />
                      </PieChart>
                    </ResponsiveContainer>
                }
              </Painel>

              {/* Últimos apontamentos */}
              <Painel titulo="Últimos Registros">
                {dp.ultimosReg.length === 0 ? <Vazio /> : (
                  <div className="flex flex-col divide-y divide-[#F2F5F7]">
                    {dp.ultimosReg.map(a => (
                      <div key={a.id} className="flex items-center justify-between py-2.5 gap-3">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[#1A3344] text-xs font-semibold truncate">{a.tipo_desperdicio}</span>
                          <span className="text-[#8FA3B0] text-[10px]">{a.nome_operador} · {a.horaFmt} · OP {a.numero_op}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {a.fibra && (
                            <span className="text-[10px] bg-[#E6F6F8] text-[#1E9FAC] font-bold px-1.5 py-0.5 rounded-md">
                              {a.fibra === 'F272' ? '272' : '365'}
                            </span>
                          )}
                          {a.custo > 0 && <span className="text-red-500 text-xs font-bold tabular-nums">{R(a.custo)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Painel>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ABA: QUALIDADE
        ════════════════════════════════════════════════════════════════ */}
        {aba === 'qualidade' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI label="Peças Perdidas" valor={dp.pecasPerdidas} cor="text-red-500" borda="border-l-red-500" icon="❌" />
              <KPI label="Peças Retrabalhadas" valor={dp.pecasRetrabalho} cor="text-yellow-500" borda="border-l-yellow-500" icon="🔄" />
              <KPI label="Apontamentos c/ Impacto" valor={`${dp.taxaImpacto}%`} cor="text-[#f97316]" borda="border-l-[#f97316]" icon="📉" />
              <KPI label="Tempo Retrabalho" valor={`${dp.totalTempo} min`} cor="text-[#8b5cf6]" borda="border-l-[#8b5cf6]" icon="⏱️" />
            </div>

            {/* Evolução temporal */}
            <Painel titulo="Evolução de Perdas e Retrabalhos (peças/dia)">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={dp.evDia} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" />
                  <XAxis dataKey="data" tick={{ fill: '#8FA3B0', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#8FA3B0', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip {...TT} />
                  <Legend wrapperStyle={{ color: '#8FA3B0', fontSize: 12 }} />
                  <Line type="monotone" dataKey="Perdas" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: '#ef4444' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Retrabalhos" stroke="#eab308" strokeWidth={2.5} dot={{ r: 4, fill: '#eab308' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </Painel>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pareto por ocorrências */}
              <Painel titulo="Pareto — Frequência por Tipo (ocorrências)">
                <GraficoPareto dados={dp.paretoOcorrencias} corBarra="#1E9FAC" labelValor="Ocorrências" />
              </Painel>

              {/* Pareto por custo financeiro */}
              <Painel titulo="Pareto — Impacto Financeiro por Tipo (R$)">
                <GraficoPareto dados={dp.paretoTipo} corBarra="#ef4444" labelValor="Custo R$" />
              </Painel>
            </div>

            {/* Operadoras */}
            <Painel titulo="Apontamentos por Operadora — Visão de Qualidade">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={dp.porOperadora} layout="vertical" margin={{ top: 5, right: 50, left: 90, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#8FA3B0', fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" tick={{ fill: '#1A3344', fontSize: 11 }} width={90} />
                  <Tooltip {...TT} />
                  <Bar dataKey="Apontamentos" fill="#1E9FAC" radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fill: '#8FA3B0', fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
            </Painel>

            {/* F272 vs F365 por grupo */}
            <Painel titulo="Custo por Tipo de Fibra e Grupo — Fibra 272 vs Fibra 365">
              {dp.fibraGrupo.length === 0
                ? <Vazio />
                : <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={dp.fibraGrupo} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" />
                      <XAxis dataKey="grupo" tick={{ fill: '#8FA3B0', fontSize: 11 }} angle={-15} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: '#8FA3B0', fontSize: 11 }} tickFormatter={v => `R$${Number(v).toFixed(0)}`} />
                      <Tooltip {...TT} formatter={(v: unknown) => [R(v as number)]} />
                      <Legend wrapperStyle={{ color: '#8FA3B0', fontSize: 12 }} />
                      <Bar dataKey="Fibra 272" fill="#1E9FAC" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Fibra 365" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </Painel>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ABA: FINANCEIRO
        ════════════════════════════════════════════════════════════════ */}
        {aba === 'financeiro' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI label="Custo Total" valor={R(dp.custoTotal)} cor="text-red-500" borda="border-l-red-500" icon="💸" />
              <KPI label="Custo Médio / Dia" valor={R(dp.custoDiaMedio)} cor="text-[#f97316]" borda="border-l-[#f97316]" icon="📅" />
              <KPI label="Maior Fonte de Custo" valor={dp.porTipo[0]?.nome ?? '—'} cor="text-[#1A3344]" borda="border-l-[#1A3344]" icon="⚠️" />
              <KPI label="Projeção Mensal" valor={R(dp.projecaoMensal)} cor="text-[#8b5cf6]" borda="border-l-[#8b5cf6]" icon="📈" />
            </div>

            {/* Evolução custo: diário + acumulado */}
            <Painel titulo="Evolução do Custo — Diário e Acumulado (R$)">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={dp.evCustoAcum} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gAcum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" />
                  <XAxis dataKey="data" tick={{ fill: '#8FA3B0', fontSize: 11 }} />
                  <YAxis yAxisId="l" tick={{ fill: '#8FA3B0', fontSize: 10 }} tickFormatter={v => `R$${Number(v).toFixed(0)}`} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fill: '#8FA3B0', fontSize: 10 }} tickFormatter={v => `R$${Number(v).toFixed(0)}`} />
                  <Tooltip {...TT} formatter={(v: unknown) => [R(v as number)]} />
                  <Legend wrapperStyle={{ color: '#8FA3B0', fontSize: 12 }} />
                  <Bar yAxisId="l" dataKey="CustoDia" name="Custo do Dia" fill="#ef4444" opacity={0.7} radius={[3, 3, 0, 0]} />
                  <Area yAxisId="r" type="monotone" dataKey="CustoAcumulado" name="Acumulado" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#gAcum)" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Painel>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Custo por tipo (ranking) */}
              <Painel titulo="Custo por Tipo de Desperdício">
                {dp.porTipo.length === 0
                  ? <Vazio />
                  : <ResponsiveContainer width="100%" height={270}>
                      <BarChart data={dp.porTipo} layout="vertical" margin={{ top: 5, right: 80, left: 130, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#8FA3B0', fontSize: 10 }} tickFormatter={v => `R$${Number(v).toFixed(0)}`} />
                        <YAxis type="category" dataKey="nome" tick={{ fill: '#1A3344', fontSize: 10 }} width={130} />
                        <Tooltip {...TT} formatter={(v: unknown) => [R(v as number), 'Custo']} />
                        <Bar dataKey="Custo" radius={[0, 4, 4, 0]}
                          label={{ position: 'right', fill: '#8FA3B0', fontSize: 9, formatter: (v: unknown) => Number(v) > 0 ? R(Number(v)) : '' }}>
                          {dp.porTipo.map((e, i) => <Cell key={e.nome} fill={PALETA[i % PALETA.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                }
              </Painel>

              {/* Custo por operadora */}
              <Painel titulo="Custo Gerado por Operadora">
                {dp.porOperadoraCusto.length === 0
                  ? <Vazio />
                  : <ResponsiveContainer width="100%" height={270}>
                      <BarChart data={dp.porOperadoraCusto} layout="vertical" margin={{ top: 5, right: 80, left: 90, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#8FA3B0', fontSize: 10 }} tickFormatter={v => `R$${Number(v).toFixed(0)}`} />
                        <YAxis type="category" dataKey="nome" tick={{ fill: '#1A3344', fontSize: 10 }} width={90} />
                        <Tooltip {...TT} formatter={(v: unknown) => [R(v as number), 'Custo']} />
                        <Bar dataKey="Custo" fill="#10b981" radius={[0, 4, 4, 0]}
                          label={{ position: 'right', fill: '#8FA3B0', fontSize: 9, formatter: (v: unknown) => Number(v) > 0 ? R(Number(v)) : '' }} />
                      </BarChart>
                    </ResponsiveContainer>
                }
              </Painel>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Donut por material */}
              <Painel titulo="Distribuição de Custo por Material">
                {dp.porMaterial.length === 0
                  ? <Vazio />
                  : <ResponsiveContainer width="100%" height={270}>
                      <PieChart>
                        <Pie data={dp.porMaterial} dataKey="Custo" nameKey="nome"
                          cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                          {dp.porMaterial.map((e, i) => <Cell key={e.nome} fill={PALETA[i % PALETA.length]} />)}
                        </Pie>
                        <Tooltip {...TT} formatter={(v: unknown) => [R(v as number)]} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#8FA3B0' }}
                          formatter={(v: string) => v.length > 24 ? v.slice(0, 22) + '…' : v} />
                      </PieChart>
                    </ResponsiveContainer>
                }
              </Painel>

              {/* Ranking de OPs */}
              <Painel titulo="Top OPs — Custo Acumulado no Período">
                {dp.topOPs.length === 0
                  ? <Vazio />
                  : <div className="flex flex-col gap-2 mt-1">
                      {dp.topOPs.map((op, i) => {
                        const pct = dp.custoTotal > 0 ? (op.Custo / dp.custoTotal) * 100 : 0
                        return (
                          <div key={op.numero} className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <span className={`text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? 'bg-red-500 text-white' : i === 1 ? 'bg-orange-400 text-white' : i === 2 ? 'bg-yellow-400 text-white' : 'bg-[#DDE4EA] text-[#3D5568]'}`}>
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-[#1A3344] font-bold text-sm">{op.numero}</span>
                                  <span className="text-red-500 font-black text-sm tabular-nums">{R(op.Custo)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#8FA3B0] text-[10px]">Fibra {op.fibra === 'F272' ? '272' : op.fibra === 'F365' ? '365' : op.fibra} · {op.Apontamentos} apontamentos</span>
                                  <span className="text-[#8FA3B0] text-[10px]">{pct.toFixed(1)}% do total</span>
                                </div>
                              </div>
                            </div>
                            {/* Barra de progresso */}
                            <div className="h-1 bg-[#DDE4EA] rounded-full ml-8">
                              <div className="h-1 rounded-full bg-red-400 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                }
              </Painel>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KPI({ label, valor, cor, borda, icon }: { label: string; valor: string | number; cor: string; borda: string; icon: string }) {
  return (
    <div className={`bg-white border border-[#DDE4EA] border-l-4 ${borda} rounded-xl p-4 flex flex-col gap-1 shadow-sm`}>
      <p className="text-[#8FA3B0] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
        <span>{icon}</span>{label}
      </p>
      <p className={`text-2xl font-extrabold ${cor} leading-tight break-words`}>{valor}</p>
    </div>
  )
}

function Painel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#DDE4EA] rounded-xl p-4 flex flex-col gap-3 shadow-sm">
      <h3 className="text-[#1A3344] font-bold text-[11px] uppercase tracking-wider flex items-center gap-2">
        <span className="w-1 h-3.5 bg-[#1E9FAC] rounded-full inline-block shrink-0" />
        {titulo}
      </h3>
      {children}
    </div>
  )
}

function Vazio() {
  return <p className="text-[#8FA3B0] text-sm text-center py-10">Sem dados no período</p>
}
