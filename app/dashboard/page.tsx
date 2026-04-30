'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Apontamento } from '@/lib/types'
import Navegacao from '@/components/Navegacao'
import GraficoPareto from '@/components/GraficoPareto'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

type Periodo = 'hoje' | 'semana' | 'mes' | 'personalizado'

function getIntervalo(periodo: Periodo, inicio: string, fim: string) {
  const agora = new Date()
  const startOf = (d: Date) => { d.setHours(0, 0, 0, 0); return d }

  switch (periodo) {
    case 'hoje':
      return { de: startOf(new Date()).toISOString(), ate: agora.toISOString() }
    case 'semana': {
      const d = new Date(); d.setDate(d.getDate() - 6)
      return { de: startOf(d).toISOString(), ate: agora.toISOString() }
    }
    case 'mes': {
      const d = new Date(); d.setDate(d.getDate() - 29)
      return { de: startOf(d).toISOString(), ate: agora.toISOString() }
    }
    case 'personalizado':
      return {
        de: inicio ? new Date(inicio + 'T00:00:00').toISOString() : startOf(new Date()).toISOString(),
        ate: fim ? new Date(fim + 'T23:59:59').toISOString() : agora.toISOString(),
      }
  }
}

function calcularPareto(itens: { nome: string; valor: number }[]) {
  const sorted = [...itens].sort((a, b) => b.valor - a.valor).filter(i => i.valor > 0)
  const total = sorted.reduce((s, i) => s + i.valor, 0)
  let acumulado = 0
  return sorted.map(item => {
    acumulado += item.valor
    return { ...item, percentualAcumulado: total > 0 ? Math.round((acumulado / total) * 100) : 0 }
  })
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
}

const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: 'hoje', label: 'Hoje' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'personalizado', label: 'Personalizado' },
]

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [dados, setDados] = useState<Apontamento[]>([])
  const [carregando, setCarregando] = useState(true)

  const buscarDados = useCallback(async () => {
    setCarregando(true)
    const { de, ate } = getIntervalo(periodo, dataInicio, dataFim)
    const { data } = await supabase
      .from('apontamentos')
      .select('*')
      .gte('created_at', de)
      .lte('created_at', ate)
      .order('created_at', { ascending: true })
    setDados(data ?? [])
    setCarregando(false)
  }, [periodo, dataInicio, dataFim])

  useEffect(() => { buscarDados() }, [buscarDados])

  // Totais
  const totais = {
    apontamentos: dados.length,
    perdas: dados.filter(a => a.classificacao === 'perda').length,
    retrabalhos: dados.filter(a => a.classificacao === 'retrabalho').length,
    tempoTotal: dados.reduce((s, a) => s + (a.tempo_minutos ?? 0), 0),
  }

  // Evolução por dia
  const evolucao = (() => {
    const mapa = new Map<string, { data: string; Perdas: number; Retrabalhos: number }>()
    dados.forEach(a => {
      const dia = new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      if (!mapa.has(dia)) mapa.set(dia, { data: dia, Perdas: 0, Retrabalhos: 0 })
      const entry = mapa.get(dia)!
      if (a.classificacao === 'perda') entry.Perdas++
      else if (a.classificacao === 'retrabalho') entry.Retrabalhos++
    })
    return Array.from(mapa.values())
  })()

  // Por grupo
  const porGrupo = (() => {
    const mapa = new Map<string, { grupo: string; Perdas: number; Retrabalhos: number }>()
    dados.forEach(a => {
      if (!mapa.has(a.grupo)) mapa.set(a.grupo, { grupo: a.grupo, Perdas: 0, Retrabalhos: 0 })
      const entry = mapa.get(a.grupo)!
      if (a.classificacao === 'perda') entry.Perdas++
      else if (a.classificacao === 'retrabalho') entry.Retrabalhos++
    })
    return Array.from(mapa.values())
  })()

  // Paretos
  const paretoPerdas = calcularPareto(
    Array.from(
      dados.filter(a => a.classificacao === 'perda')
        .reduce((m, a) => m.set(a.tipo_desperdicio, (m.get(a.tipo_desperdicio) ?? 0) + 1), new Map<string, number>())
        .entries()
    ).map(([nome, valor]) => ({ nome, valor }))
  )

  const paretoRetrabalhos = calcularPareto(
    Array.from(
      dados.filter(a => a.classificacao === 'retrabalho')
        .reduce((m, a) => m.set(a.tipo_desperdicio, (m.get(a.tipo_desperdicio) ?? 0) + 1), new Map<string, number>())
        .entries()
    ).map(([nome, valor]) => ({ nome, valor }))
  )

  const paretoTempo = calcularPareto(
    Array.from(
      dados.filter(a => a.classificacao === 'retrabalho' && a.tempo_minutos)
        .reduce((m, a) => m.set(a.tipo_desperdicio, (m.get(a.tipo_desperdicio) ?? 0) + (a.tempo_minutos ?? 0)), new Map<string, number>())
        .entries()
    ).map(([nome, valor]) => ({ nome, valor }))
  )

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Navegacao />

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">

        {/* Filtros de período */}
        <div className="flex flex-wrap items-center gap-3">
          {PERIODOS.map(p => (
            <button
              key={p.valor}
              onClick={() => setPeriodo(p.valor)}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                periodo === p.valor
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {p.label}
            </button>
          ))}

          {periodo === 'personalizado' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="bg-slate-700 text-slate-200 text-sm px-3 py-2 rounded-xl border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-slate-400 text-sm">→</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="bg-slate-700 text-slate-200 text-sm px-3 py-2 rounded-xl border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {carregando && <span className="text-slate-500 text-sm">Carregando…</span>}
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Cartao label="Apontamentos" valor={totais.apontamentos} cor="text-white" />
          <Cartao label="Perdas" valor={totais.perdas} cor="text-red-400" />
          <Cartao label="Retrabalhos" valor={totais.retrabalhos} cor="text-yellow-400" />
          <Cartao label="Tempo Retrabalho" valor={`${totais.tempoTotal} min`} cor="text-blue-400" />
        </div>

        {/* Evolução + Por grupo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Painel titulo="Evolução no Tempo">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={evolucao} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Line type="monotone" dataKey="Perdas" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Retrabalhos" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Painel>

          <Painel titulo="Apontamentos por Grupo">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={porGrupo} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="grupo" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Bar dataKey="Perdas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Retrabalhos" fill="#eab308" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Painel>
        </div>

        {/* Pareto perdas + retrabalhos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Painel titulo="Pareto — Número de Perdas">
            <GraficoPareto dados={paretoPerdas} corBarra="#ef4444" labelValor="Perdas" />
          </Painel>

          <Painel titulo="Pareto — Número de Retrabalhos">
            <GraficoPareto dados={paretoRetrabalhos} corBarra="#eab308" labelValor="Retrabalhos" />
          </Painel>
        </div>

        {/* Pareto tempo */}
        <Painel titulo="Pareto — Tempo de Retrabalho (minutos)">
          <GraficoPareto dados={paretoTempo} corBarra="#3b82f6" labelValor="Minutos" />
        </Painel>

      </main>
    </div>
  )
}

function Cartao({ label, valor, cor }: { label: string; valor: string | number; cor: string }) {
  return (
    <div className="bg-slate-800 rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${cor}`}>{valor}</p>
    </div>
  )
}

function Painel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-2xl p-4 flex flex-col gap-3">
      <h3 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">{titulo}</h3>
      {children}
    </div>
  )
}
