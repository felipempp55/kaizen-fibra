'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import type { Apontamento } from '@/lib/types'
import Navegacao from '@/components/Navegacao'
import GraficoPareto from '@/components/GraficoPareto'
import { calcularPerdaMateriais, calcularCustoTotal, formatarReal } from '@/lib/materiais'
import { formatarQtdApontamento } from '@/lib/formatadores'
import { TIPOS_DUPLO_RETRABALHO_PERDA } from '@/lib/desperdicios'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado'
type Aba = 'producao' | 'qualidade' | 'financeiro' | 'historico'

interface ApontamentoRico extends Apontamento {
  custo: number
  diaFmt: string
  horaFmt: string
}

// ─── Constantes visuais ───────────────────────────────────────────────────────

const CORES_GRUPO: Record<string, string> = {
  'Epóxi': '#8b5cf6',
  'Polimento': '#56A4BB',
  'Problemas Dimensionais': '#f97316',
  'Clivagem': '#ef4444',
  'Outros': '#64748b',
}

const PALETA = ['#56A4BB', '#ef4444', '#eab308', '#8b5cf6', '#f97316', '#06b6d4', '#10b981', '#f43f5e']

const TT = {
  contentStyle: { backgroundColor: '#1F3744', border: '1px solid #56A4BB', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#ffffff', fontWeight: 700 },
  itemStyle: { color: '#b3d4e0' },
}

const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: 'hoje',          label: 'Hoje'          },
  { valor: 'semana',        label: 'Semana'        },
  { valor: 'mes',           label: 'Mês'           },
  { valor: 'ano',           label: 'Ano'           },
  { valor: 'personalizado', label: 'Personalizado' },
]

// ─── Utilitários ──────────────────────────────────────────────────────────────

function getIntervalo(p: Periodo, ini: string, fim: string) {
  const agora = new Date()
  const sod = (d: Date) => { d.setHours(0, 0, 0, 0); return d }
  if (p === 'hoje') return { de: sod(new Date()).toISOString(), ate: agora.toISOString() }
  if (p === 'semana') {
    // Segunda-feira da semana atual (getDay: dom=0 … sáb=6)
    const seg = new Date(); const dow = seg.getDay()
    seg.setDate(seg.getDate() + (dow === 0 ? -6 : 1 - dow))
    // Sexta-feira da mesma semana (segunda + 4 dias), fim do dia
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

const fmtDia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const R = (v: number) => formatarReal(v)

function formatTempoMs(ms: number): string {
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}min`
  if (totalMin > 0) return `${totalMin}min`
  return `${Math.floor(ms / 1000)}s`
}

// ─── Tela de login ────────────────────────────────────────────────────────────

function LoginDashboard({ onSuccess }: { onSuccess: () => void }) {
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(false)

  function tentar() {
    if (login.trim().toLowerCase() === 'qualidade' && senha === 'pareto') {
      onSuccess()
    } else {
      setErro(true)
      setSenha('')
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-page)' }}>
      <Navegacao />
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className="w-full max-w-sm flex flex-col gap-6 p-8 rounded-2xl"
          style={{ background: '#fff', border: '1px solid var(--line)', boxShadow: '0 1px 4px rgba(31,55,68,0.06)' }}
        >
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/Logo MSB-14.png"
                alt="MSB"
                width={96}
                height={42}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <h2
              className="text-xl font-extrabold"
              style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
            >
              Acesso ao Dashboard
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Área restrita — informe suas credenciais
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                className="text-sm font-semibold"
                style={{ color: 'var(--text-body)', fontFamily: 'var(--font-display)' }}
              >
                Login
              </label>
              <input
                type="text"
                value={login}
                onChange={e => { setLogin(e.target.value); setErro(false) }}
                onKeyDown={e => { if (e.key === 'Enter') tentar() }}
                placeholder="login"
                autoFocus
                className="w-full h-12 px-3.5 rounded-xl text-base outline-none transition-colors"
                style={{
                  border: '1.5px solid var(--line)',
                  color: 'var(--text-strong)',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={e => (e.target.style.border = '2px solid var(--brand-primary)')}
                onBlur={e => (e.target.style.border = '1.5px solid var(--line)')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                className="text-sm font-semibold"
                style={{ color: 'var(--text-body)', fontFamily: 'var(--font-display)' }}
              >
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={e => { setSenha(e.target.value); setErro(false) }}
                onKeyDown={e => { if (e.key === 'Enter') tentar() }}
                placeholder="••••••"
                className="w-full h-12 px-3.5 rounded-xl text-base outline-none transition-colors"
                style={{
                  border: '1.5px solid var(--line)',
                  color: 'var(--text-strong)',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={e => (e.target.style.border = '2px solid var(--brand-primary)')}
                onBlur={e => (e.target.style.border = '1.5px solid var(--line)')}
              />
            </div>
            {erro && (
              <p className="text-sm text-center font-semibold" style={{ color: 'var(--signal-red)' }}>
                Login ou senha incorretos
              </p>
            )}
          </div>

          <button
            onClick={tentar}
            className="font-bold text-lg py-4 rounded-xl transition-all active:scale-[0.97]"
            style={{
              background: 'var(--brand-primary)',
              color: '#fff',
              fontFamily: 'var(--font-display)',
              boxShadow: '0 4px 14px rgba(86,164,187,0.3)',
            }}
          >
            Entrar →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const [autenticado, setAutenticado] = useState(false)
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [ini, setIni] = useState('')
  const [fim, setFim] = useState('')
  const [dados, setDados] = useState<Apontamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<Aba>('producao')
  const [filtroOp, setFiltroOp] = useState<'atual' | 'anterior' | null>(null)
  const [opsRecentes, setOpsRecentes] = useState<string[]>([])
  // Filtro de modo de falha (tipo de desperdício) — afeta só os gráficos de Perdas/Retrabalhos
  const [modosFalhaExcluidos, setModosFalhaExcluidos] = useState<Set<string>>(new Set())
  function toggleModoFalha(nome: string) {
    setModosFalhaExcluidos(prev => {
      const next = new Set(prev)
      if (next.has(nome)) next.delete(nome); else next.add(nome)
      return next
    })
  }

  const carregarOpsRecentes = useCallback(async () => {
    const desde = new Date(); desde.setDate(desde.getDate() - 90)
    const { data } = await supabase
      .from('apontamentos').select('numero_op, created_at')
      .eq('linha', 'fibra')
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: false })
    if (!data) return
    const seen = new Set<string>(); const ops: string[] = []
    for (const row of data) {
      if (row.numero_op && !seen.has(row.numero_op)) { seen.add(row.numero_op); ops.push(row.numero_op) }
    }
    setOpsRecentes(ops.slice(0, 5))
  }, [])

  const buscar = useCallback(async () => {
    setCarregando(true)
    // Fase 1: dashboard fixo na linha fibra. O seletor de linha entra na Fase 2.
    let query = supabase.from('apontamentos').select('*').eq('linha', 'fibra').order('created_at', { ascending: true })
    if (filtroOp !== null && opsRecentes.length > 0) {
      const opNumero = filtroOp === 'atual' ? opsRecentes[0] : opsRecentes[1]
      if (opNumero) {
        query = query.eq('numero_op', opNumero)
      } else { setDados([]); setCarregando(false); return }
    } else {
      const { de, ate } = getIntervalo(periodo, ini, fim)
      query = query.gte('created_at', de).lte('created_at', ate)
    }
    const { data } = await query
    setDados(data ?? [])
    setCarregando(false)
  }, [periodo, ini, fim, filtroOp, opsRecentes])

  useEffect(() => { if (autenticado) carregarOpsRecentes() }, [autenticado, carregarOpsRecentes])
  useEffect(() => { buscar() }, [buscar])

  // ── Processamento único de todos os dados ──────────────────────────────────
  const dp = useMemo(() => {
    // Enriquecer cada apontamento com custo calculado
    const ricos: ApontamentoRico[] = dados.map(a => {
      const fibra = a.fibra ?? 'F272'
      const itens = calcularPerdaMateriais(a.tipo_desperdicio, fibra, a.quantidade_pecas, a.quantidade_ml, a.materiais_perdidos?.split(',') ?? null)
      return { ...a, custo: calcularCustoTotal(itens), diaFmt: fmtDia(a.created_at), horaFmt: fmtHora(a.created_at) }
    })

    // ── Totais gerais ──────────────────────────────────────────────────────
    const custoTotal = ricos.reduce((s, a) => s + a.custo, 0)
    const totalPecas = dados.reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)
    const totalTempo = dados.reduce((s, a) => s + (a.tempo_minutos ?? 0), 0)
    const operadoras = new Set(dados.map(a => a.nome_operador.trim().toLowerCase()))
    const ops = new Set(dados.map(a => a.numero_op))

    // Peças efetivamente perdidas (por tipo)
    const pecasPerdidas =
      dados.filter(a => a.classificacao === 'perda').reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0) +
      dados.filter(a => a.tipo_desperdicio === 'Crimpagem').reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0) +
      dados.filter(a => TIPOS_DUPLO_RETRABALHO_PERDA.includes(a.tipo_desperdicio)).reduce((s, a) => s + (a.quantidade_ml ?? 0), 0)

    const pecasRetrabalho =
      dados.filter(a => a.classificacao === 'retrabalho').reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0) +
      dados.filter(a => TIPOS_DUPLO_RETRABALHO_PERDA.includes(a.tipo_desperdicio)).reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)

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

    // ── Perdas e Retrabalhos por modo de falha (tipo) ──────────────────────
    // "Retrabalho" só existe de fato para os tipos com 1º campo = retrabalho.
    const TIPOS_RETRABALHO = ['Máquina', 'Clivagem Proximal', 'Clivagem Distal', 'Clivagem com Defeito']
    const mPerdaTipo = new Map<string, number>()
    const mRetrabalhoTipo = new Map<string, number>()
    ricos.forEach(a => {
      let perda = 0
      if (a.tipo_desperdicio === 'Manual' || a.tipo_desperdicio === 'Quantidade desperdiçada de Epóxi') {
        perda = 0   // Manual não conta como perda/retrabalho; Epóxi é em ml (unidade diferente)
      } else if (a.tipo_desperdicio === 'Crimpagem') {
        perda = a.quantidade_pecas ?? 0   // 1º campo = peças perdidas
      } else if (TIPOS_DUPLO_RETRABALHO_PERDA.includes(a.tipo_desperdicio)) {
        perda = a.quantidade_ml ?? 0      // 2º campo = perda
      } else {
        perda = a.quantidade_pecas ?? 0   // tipos de valor único = perda direta
      }
      if (perda > 0) mPerdaTipo.set(a.tipo_desperdicio, (mPerdaTipo.get(a.tipo_desperdicio) ?? 0) + perda)

      if (TIPOS_RETRABALHO.includes(a.tipo_desperdicio)) {
        const retr = a.quantidade_pecas ?? 0   // 1º campo = retrabalho
        if (retr > 0) mRetrabalhoTipo.set(a.tipo_desperdicio, (mRetrabalhoTipo.get(a.tipo_desperdicio) ?? 0) + retr)
      }
    })
    const mapaPerdaTipo = Array.from(mPerdaTipo.entries()).map(([nome, valor]) => ({ nome, valor }))
    const mapaRetrabalhoTipo = Array.from(mRetrabalhoTipo.entries()).map(([nome, valor]) => ({ nome, valor }))
    const modosFalhaDisponiveis = Array.from(new Set([...mapaPerdaTipo.map(p => p.nome), ...mapaRetrabalhoTipo.map(p => p.nome)])).sort()

    // ── Por operadora ──────────────────────────────────────────────────────
    const nomeDisplay = (s: string) => s.trim().replace(/\b\w/g, c => c.toUpperCase())
    type OpE = { nome: string; Apontamentos: number; Custo: number }
    const mOp = new Map<string, OpE>()
    ricos.forEach(a => {
      const key = (a.nome_operador || '—').trim().toLowerCase()
      const display = a.nome_operador ? nomeDisplay(a.nome_operador) : '—'
      if (!mOp.has(key)) mOp.set(key, { nome: display, Apontamentos: 0, Custo: 0 })
      const o = mOp.get(key)!; o.Apontamentos++; o.Custo += a.custo
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
      calcularPerdaMateriais(a.tipo_desperdicio, fibra, a.quantidade_pecas, a.quantidade_ml, a.materiais_perdidos?.split(',') ?? null).forEach(item => {
        const k = item.material.nome
        if (!mMat.has(k)) mMat.set(k, { nome: k, Custo: 0 })
        mMat.get(k)!.Custo += item.material.custo * item.quantidade
      })
    })
    const porMaterial = Array.from(mMat.values()).sort((a, b) => b.Custo - a.Custo)

    // ── Top OPs ────────────────────────────────────────────────────────────
    type OPE = { numero: string; fibra: string; Apontamentos: number; Custo: number; tamanho: number | null; perda: number; retrabalho: number }
    const mOP = new Map<string, OPE>()
    ricos.forEach(a => {
      if (!mOP.has(a.numero_op)) mOP.set(a.numero_op, { numero: a.numero_op, fibra: a.fibra ?? '—', Apontamentos: 0, Custo: 0, tamanho: a.tamanho_op ?? null, perda: 0, retrabalho: 0 })
      const op = mOP.get(a.numero_op)!
      op.Apontamentos++; op.Custo += a.custo
      if (!op.tamanho && a.tamanho_op) op.tamanho = a.tamanho_op
      if (a.classificacao === 'perda') op.perda += a.quantidade_pecas ?? 0
      else if (a.classificacao === 'retrabalho') op.retrabalho += a.quantidade_pecas ?? 0
    })
    const topOPs = Array.from(mOP.values()).map(op => ({
      ...op,
      taxaRefugo: (op.tamanho && op.tamanho > 0) ? Math.round((op.perda / op.tamanho) * 1000) / 10 : null,
      taxaRetrabalho: (op.tamanho && op.tamanho > 0) ? Math.round((op.retrabalho / op.tamanho) * 1000) / 10 : null,
    })).sort((a, b) => b.Custo - a.Custo).slice(0, 5)

    // ── Por turno (dia da semana) ──────────────────────────────────────────
    const mTurno = new Map<number, number>()
    ricos.forEach(a => {
      const dow = new Date(a.created_at).getDay() // 0=DOM
      mTurno.set(dow, (mTurno.get(dow) ?? 0) + 1)
    })
    // Ordenar SEG→DOM  (dow 1,2,3,4,5,6,0)
    const porTurno = [
      { dia: 'SEG', v: mTurno.get(1) ?? 0 },
      { dia: 'TER', v: mTurno.get(2) ?? 0 },
      { dia: 'QUA', v: mTurno.get(3) ?? 0 },
      { dia: 'QUI', v: mTurno.get(4) ?? 0 },
      { dia: 'SEX', v: mTurno.get(5) ?? 0 },
      { dia: 'SAB', v: mTurno.get(6) ?? 0 },
    ]

    // ── Sparklines (últimos N dias, contagem de apontamentos) ──────────────
    const sparkApontamentos = evDia.map(d => d.Apontamentos)
    const sparkPecas        = evDia.map(d => d.Perdas + d.Retrabalhos)
    const sparkCusto        = evDia.map(d => d.Custo)

    // ── Métricas de qualidade ──────────────────────────────────────────────
    // Tamanho real de cada OP única no período (1 valor por OP, não soma de apontamentos)
    const opTamanhoMap = new Map<string, number>()
    ricos.forEach(a => { if (a.tamanho_op && !opTamanhoMap.has(a.numero_op)) opTamanhoMap.set(a.numero_op, a.tamanho_op) })
    const totalTamanhoOp = Array.from(opTamanhoMap.values()).reduce((s, v) => s + v, 0)

    const taxaRefugo     = totalTamanhoOp > 0 ? (pecasPerdidas    / totalTamanhoOp) * 100 : 0
    const taxaRetrabalho = totalTamanhoOp > 0 ? (pecasRetrabalho  / totalTamanhoOp) * 100 : 0

    // ── Mapa de defeitos — dados de hoje ──────────────────────────────────
    const hojeStr      = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const ricosHoje    = ricos.filter(a => a.diaFmt === hojeStr)
    const gruposGrid   = Array.from(new Set(ricos.map(a => a.grupo))).slice(0, 5)
    const horasGrid    = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
    const mapaDefeitos = gruposGrid.map(grupo => ({
      grupo,
      total: ricosHoje.filter(a => a.grupo === grupo).length,
      horas: horasGrid.map(h => ({
        hora: h,
        count: ricosHoje.filter(a => new Date(a.created_at).getHours() === h && a.grupo === grupo).length,
      })),
    }))

    // ── Tendência de refugo por dia ────────────────────────────────────────
    const tendenciaRefugo = evDia.map(d => ({ data: d.data, Perdas: d.Perdas, Retrabalhos: d.Retrabalhos }))

    // ── Últimos registros ──────────────────────────────────────────────────
    const ultimosReg = [...ricos].reverse().slice(0, 8)

    // ── Projeções ──────────────────────────────────────────────────────────
    const nDias = evDia.length || 1
    const custoDiaMedio = custoTotal / nDias
    const projecaoMensal = custoDiaMedio * 22

    // ── Métricas financeiras extras (depende de custoDiaMedio) ────────────
    const projecaoAnual  = Math.round(custoDiaMedio * 365)

    // ── Taxa de perda (% de apontamentos com custo > 0) ────────────────────
    const apontamentosComCusto = ricos.filter(a => a.custo > 0).length
    const taxaImpacto = ricos.length > 0 ? Math.round((apontamentosComCusto / ricos.length) * 100) : 0

    return {
      ricos, custoTotal, totalPecas, totalTempo,
      operadoras, ops, pecasPerdidas, pecasRetrabalho,
      evDia, evCustoAcum, porGrupo, porTipo, paretoTipo,
      mapaPerdaTipo, mapaRetrabalhoTipo, modosFalhaDisponiveis,
      porOperadora, porOperadoraCusto, fibraGrupo, porMaterial,
      topOPs, ultimosReg, custoDiaMedio, projecaoMensal, taxaImpacto,
      porTurno, sparkApontamentos, sparkPecas, sparkCusto,
      taxaRefugo, taxaRetrabalho, totalTamanhoOp, mapaDefeitos, tendenciaRefugo,
      projecaoAnual,
    }
  }, [dados])

  // Pareto de Perdas/Retrabalhos filtrado pelo modo de falha selecionado (chips)
  const paretoPerdas = useMemo(
    () => pareto(dp.mapaPerdaTipo.filter(p => !modosFalhaExcluidos.has(p.nome))),
    [dp.mapaPerdaTipo, modosFalhaExcluidos]
  )
  const paretoRetrabalhos = useMemo(
    () => pareto(dp.mapaRetrabalhoTipo.filter(p => !modosFalhaExcluidos.has(p.nome))),
    [dp.mapaRetrabalhoTipo, modosFalhaExcluidos]
  )

  // ── Tendência de Taxa de Retrabalho — granularidade e janela seguem o filtro de período ──
  const [tendRetrabalhoDados, setTendRetrabalhoDados] = useState<Apontamento[]>([])
  const [modoFalhaTendencia, setModoFalhaTendencia] = useState<string>(TIPOS_DUPLO_RETRABALHO_PERDA[0])

  useEffect(() => {
    if (!autenticado) return
    let de: Date
    if (periodo === 'hoje') {
      de = new Date(); de.setDate(de.getDate() - 7); de.setHours(0, 0, 0, 0)
    } else if (periodo === 'semana') {
      de = new Date(); de.setDate(de.getDate() - 7 * 7); de.setHours(0, 0, 0, 0)
    } else if (periodo === 'mes' || periodo === 'ano') {
      const hoje = new Date(); de = new Date(hoje.getFullYear(), hoje.getMonth() - 7, 1)
    } else {
      const { de: deStr } = getIntervalo(periodo, ini, fim)
      de = new Date(deStr)
    }
    supabase.from('apontamentos').select('*')
      .eq('linha', 'fibra')
      .gte('created_at', de.toISOString())
      .order('created_at', { ascending: true })
      .then(({ data }) => setTendRetrabalhoDados(data ?? []))
  }, [autenticado, periodo, ini, fim])

  const tendenciaRetrabalho = useMemo(() => {
    const fmtDiaMes = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    const fmtMesAno = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')

    type Bucket = { inicio: Date; fim: Date; label: string }
    const buckets: Bucket[] = []

    if (periodo === 'hoje') {
      // Últimos 8 dias, granularidade diária
      for (let i = 7; i >= 0; i--) {
        const inicio = new Date(); inicio.setDate(inicio.getDate() - i); inicio.setHours(0, 0, 0, 0)
        const fim = new Date(inicio); fim.setDate(fim.getDate() + 1)
        buckets.push({ inicio, fim, label: fmtDiaMes(inicio) })
      }
    } else if (periodo === 'semana') {
      // Últimas 8 semanas, granularidade semanal (seg–dom)
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
      // Últimos 8 meses, granularidade mensal
      const hoje = new Date()
      for (let i = 7; i >= 0; i--) {
        const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
        const fim = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 1)
        buckets.push({ inicio, fim, label: fmtMesAno(inicio) })
      }
    } else {
      // Personalizado: granularidade diária, cobrindo exatamente o intervalo escolhido
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
      const doBucket = tendRetrabalhoDados.filter(a => {
        const dt = new Date(a.created_at)
        return dt >= inicio && dt < fim
      })
      // Base de peças: tamanho de cada OP distinta com atividade no bucket (não soma por apontamento)
      const opTamanhoMapBucket = new Map<string, number>()
      doBucket.forEach(a => { if (a.tamanho_op && !opTamanhoMapBucket.has(a.numero_op)) opTamanhoMapBucket.set(a.numero_op, a.tamanho_op) })
      const baseBucket = Array.from(opTamanhoMapBucket.values()).reduce((s, v) => s + v, 0)
      const retrabalhosBucket = doBucket
        .filter(a => a.tipo_desperdicio === modoFalhaTendencia)
        .reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)
      const taxa = baseBucket > 0 ? Math.round((retrabalhosBucket / baseBucket) * 1000) / 10 : 0
      return { periodo: label, TaxaRetrabalho: taxa, retrabalhos: retrabalhosBucket, base: baseBucket }
    })
  }, [tendRetrabalhoDados, modoFalhaTendencia, periodo, ini, fim])

  const labelJanelaTendencia = periodo === 'hoje' ? 'ÚLTIMOS 8 DIAS'
    : periodo === 'semana' ? 'ÚLTIMAS 8 SEMANAS'
    : (periodo === 'mes' || periodo === 'ano') ? 'ÚLTIMOS 8 MESES'
    : 'PERÍODO SELECIONADO'

  // ── Guard de autenticação ──────────────────────────────────────────────────
  if (!autenticado) return <LoginDashboard onSuccess={() => setAutenticado(true)} />

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#EEF3F5] flex flex-col">
      <Navegacao />

      {/* ── Cabeçalho fixo ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--line)', boxShadow: '0 1px 6px rgba(31,55,68,0.07)' }}>
        {/* Título + controles de topo */}
        <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              DASHBOARD · KAIZEN FIBRA
            </p>
            <h1 className="text-xl font-extrabold leading-tight mt-0.5" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {filtroOp !== null
                ? `OP ${filtroOp === 'atual' ? opsRecentes[0] : opsRecentes[1]}`
                : 'Indicadores da Linha'}
            </h1>
          </div>

          {/* Pills de período + botão atualizar */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-page)' }}>
              {PERIODOS.filter(p => p.valor !== 'personalizado').map(p => (
                <button
                  key={p.valor}
                  onClick={() => { setFiltroOp(null); setPeriodo(p.valor) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={filtroOp === null && periodo === p.valor
                    ? { background: 'var(--brand-primary)', color: '#fff', boxShadow: '0 2px 8px rgba(86,164,187,0.3)' }
                    : { background: 'transparent', color: 'var(--text-muted)' }}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => { setFiltroOp(null); setPeriodo('personalizado') }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={filtroOp === null && periodo === 'personalizado'
                  ? { background: 'var(--brand-primary)', color: '#fff', boxShadow: '0 2px 8px rgba(86,164,187,0.3)' }
                  : { background: 'transparent', color: 'var(--text-muted)' }}
              >
                ···
              </button>

              {/* Separador */}
              {opsRecentes.length > 0 && (
                <div className="h-4 w-px mx-1" style={{ background: 'var(--line)' }} />
              )}

              {/* OP Atual */}
              {opsRecentes[0] && (
                <button
                  onClick={() => setFiltroOp('atual')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  title={`OP ${opsRecentes[0]}`}
                  style={filtroOp === 'atual'
                    ? { background: '#8b5cf6', color: '#fff', boxShadow: '0 2px 8px rgba(139,92,246,0.3)' }
                    : { background: 'transparent', color: 'var(--text-muted)' }}
                >
                  OP Atual
                </button>
              )}

              {/* OP Anterior */}
              {opsRecentes[1] && (
                <button
                  onClick={() => setFiltroOp('anterior')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  title={`OP ${opsRecentes[1]}`}
                  style={filtroOp === 'anterior'
                    ? { background: '#8b5cf6', color: '#fff', boxShadow: '0 2px 8px rgba(139,92,246,0.3)' }
                    : { background: 'transparent', color: 'var(--text-muted)' }}
                >
                  OP Anterior
                </button>
              )}
            </div>

            {filtroOp === null && periodo === 'personalizado' && (
              <div className="flex items-center gap-1.5">
                <input type="date" value={ini} onChange={e => setIni(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg outline-none"
                  style={{ border: '1.5px solid var(--line)', color: 'var(--text-strong)' }} />
                <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>→</span>
                <input type="date" value={fim} onChange={e => setFim(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg outline-none"
                  style={{ border: '1.5px solid var(--line)', color: 'var(--text-strong)' }} />
              </div>
            )}

            <button
              onClick={buscar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ border: '1.5px solid var(--line)', color: 'var(--text-muted)', background: '#fff' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                className={carregando ? 'animate-spin' : ''}>
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {carregando ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pb-0">
          {([
            { v: 'producao',  label: 'Produção'   },
            { v: 'qualidade', label: 'Qualidade'  },
            { v: 'financeiro',label: 'Financeiro' },
            { v: 'historico', label: 'Histórico'  },
          ] as { v: Aba; label: string }[]).map(a => (
            <button
              key={a.v}
              onClick={() => setAba(a.v)}
              className="px-4 py-2.5 text-sm font-bold transition-all border-b-2"
              style={aba === a.v
                ? { color: 'var(--brand-primary)', borderBottomColor: 'var(--brand-primary)', fontFamily: 'var(--font-display)' }
                : { color: 'var(--text-muted)', borderBottomColor: 'transparent', fontFamily: 'var(--font-display)' }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 max-w-6xl mx-auto w-full flex flex-col gap-4">

        {/* ════════════════════════════════════════════════════════════════
            ABA: PRODUÇÃO
        ════════════════════════════════════════════════════════════════ */}
        {aba === 'producao' && (
          <>
            {/* ── KPI Cards com sparklines ─────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard
                label="Apontamentos"
                valor={dp.ricos.length}
                sparkData={dp.sparkApontamentos}
                cor="var(--brand-primary)"
              />
              <KPICard
                label="OPs no Período"
                valor={dp.ops.size}
                sparkData={dp.sparkApontamentos.map(() => dp.ops.size)}
                cor="#8b5cf6"
              />
              <KPICard
                label="Peças Retrabalhadas"
                valor={dp.pecasRetrabalho}
                unidade="pç"
                sparkData={dp.sparkPecas}
                cor="var(--signal-amber)"
              />
              <KPICard
                label="Operadoras Ativas"
                valor={dp.operadoras.size}
                sparkData={dp.sparkApontamentos.map(() => dp.operadoras.size)}
                cor="var(--signal-green)"
              />
            </div>

            {/* ── Card: Retrabalho na Máquina · Polimento ─────────────────── */}
            {(() => {
              // Estimativa fixa: 1min20s (80s) por apontamento de Polimento → Máquina
              // (cada apontamento = 1 evento de retrabalho, independente da qtd de peças).
              const SEG_POR_RETRABALHO = 80
              const totalApontamentosMaquina = dados.filter(a => a.tipo_desperdicio === 'Máquina').length
              const totalMs = totalApontamentosMaquina * SEG_POR_RETRABALHO * 1000
              const totalCusto = (totalMs / 3600000) * 17
              const sessoes = totalApontamentosMaquina
              return (
                <div
                  className="rounded-2xl p-5 flex flex-col gap-4"
                  style={{
                    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                    border: '1.5px solid #fcd34d',
                    boxShadow: '0 1px 4px rgba(180,130,0,0.08)',
                  }}
                >
                  {/* Cabeçalho */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#fcd34d' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#92400e', fontFamily: 'var(--font-mono)' }}>
                          RETRABALHO NA MÁQUINA · POLIMENTO
                        </p>
                        <p className="text-[10px]" style={{ color: '#b45309' }}>
                          {sessoes === 0 ? 'Nenhum apontamento no período' : `${sessoes} apontamento${sessoes !== 1 ? 's' : ''} de Máquina · 1min20s cada`}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontFamily: 'var(--font-mono)' }}>
                      R$ 17,00 / h · HH
                    </span>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.7)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#92400e', fontFamily: 'var(--font-mono)' }}>
                        ⏱ Tempo Total
                      </p>
                      <p className="text-3xl font-extrabold leading-none" style={{ color: '#78350f', fontFamily: 'var(--font-display)' }}>
                        {sessoes === 0 ? '—' : formatTempoMs(totalMs)}
                      </p>
                      {sessoes > 0 && (
                        <p className="text-[10px]" style={{ color: '#b45309' }}>
                          ≈ {(totalMs / 3600000).toFixed(2)} horas
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.7)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#92400e', fontFamily: 'var(--font-mono)' }}>
                        💰 Custo Hora Homem
                      </p>
                      <p className="text-3xl font-extrabold leading-none" style={{ color: '#78350f', fontFamily: 'var(--font-display)' }}>
                        {sessoes === 0 ? '—' : R(totalCusto)}
                      </p>
                      {sessoes > 0 && (
                        <p className="text-[10px]" style={{ color: '#b45309' }}>
                          {sessoes} × 1min20s a R$ 17,00/h
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── Linha 2: Área + Top Operadoras ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Área chart — Apontamentos por dia */}
              <div className="lg:col-span-2">
                <Painel titulo="Apontamentos por Dia">
                  {dp.evDia.length === 0 ? <Vazio /> : (
                    <ResponsiveContainer width="100%" height={230}>
                      <AreaChart data={dp.evDia} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradProd" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#56A4BB" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#56A4BB" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" vertical={false} />
                        <XAxis dataKey="data" tick={{ fill: '#607A89', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#607A89', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip {...TT} />
                        <Area
                          type="monotone"
                          dataKey="Apontamentos"
                          stroke="#56A4BB"
                          strokeWidth={2.5}
                          fill="url(#gradProd)"
                          dot={{ r: 4, fill: '#56A4BB', stroke: '#fff', strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </Painel>
              </div>

              {/* Top Operadoras — barras horizontais */}
              <Painel titulo="Top Operadoras">
                {dp.porOperadora.length === 0 ? <Vazio /> : (
                  <div className="flex flex-col gap-3 mt-1">
                    {dp.porOperadora.slice(0, 6).map((op, i) => {
                      const maxV = dp.porOperadora[0]?.Apontamentos ?? 1
                      const pct  = Math.round((op.Apontamentos / maxV) * 100)
                      return (
                        <div key={op.nome} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="text-xs font-semibold truncate"
                              style={{ color: 'var(--text-body)', maxWidth: 130 }}
                            >
                              {op.nome}
                            </span>
                            <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: 'var(--text-strong)' }}>
                              {op.Apontamentos}
                            </span>
                          </div>
                          <div className="h-2 rounded-full" style={{ background: 'var(--line)' }}>
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{ width: `${pct}%`, background: PALETA[i % PALETA.length] }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Painel>
            </div>

            {/* ── Linha 3: Donut + Por Turno + Meta OP ────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Donut — Por Grupo */}
              <Painel titulo="Por Grupo">
                {dp.porGrupo.length === 0 ? <Vazio /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={dp.porGrupo}
                        dataKey="Apontamentos"
                        nameKey="grupo"
                        cx="50%" cy="50%"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={3}
                      >
                        {dp.porGrupo.map((e, i) => (
                          <Cell key={e.grupo} fill={CORES_GRUPO[e.grupo] ?? PALETA[i]} />
                        ))}
                      </Pie>
                      <Tooltip {...TT} formatter={(v: unknown) => [`${v} apt.`]} />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: '#607A89' }}
                        formatter={(v: string) => v.length > 18 ? v.slice(0, 16) + '…' : v}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Painel>

              {/* Barras verticais — Por Turno (dia da semana) */}
              <Painel titulo="Por Dia da Semana">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dp.porTurno} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fill: '#607A89', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#607A89', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...TT} formatter={(v: unknown) => [`${v} apontamentos`]} />
                    <Bar dataKey="v" name="Apontamentos" fill="#56A4BB" radius={[4, 4, 0, 0]}>
                      {dp.porTurno.map((entry, i) => {
                        const maxV = Math.max(...dp.porTurno.map(t => t.v), 1)
                        const intensity = 0.35 + (entry.v / maxV) * 0.65
                        return <Cell key={entry.dia} fill={`rgba(86,164,187,${intensity.toFixed(2)})`} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Painel>

              {/* Radial — Meta da OP Ativa */}
              <Painel titulo="OP em Destaque">
                {dp.topOPs.length === 0 ? <Vazio /> : (() => {
                  const top  = dp.topOPs[0]
                  const pct  = top.taxaRefugo ?? Math.round((top.Apontamentos / (dp.ricos.length || 1)) * 100)
                  const cor  = top.taxaRefugo !== null
                    ? (pct > 10 ? 'var(--signal-red)' : pct > 5 ? 'var(--signal-amber)' : 'var(--signal-green)')
                    : 'var(--brand-primary)'
                  const r    = 46
                  const circ = 2 * Math.PI * r
                  const dash = (Math.min(pct, 100) / 100) * circ
                  return (
                    <div className="flex flex-col items-center gap-3 pt-2">
                      {/* Anel radial */}
                      <div className="relative">
                        <svg width="116" height="116" viewBox="0 0 116 116">
                          <circle cx="58" cy="58" r={r} stroke="var(--line)" strokeWidth="10" fill="none" />
                          <circle
                            cx="58" cy="58" r={r}
                            stroke={cor} strokeWidth="10" fill="none"
                            strokeDasharray={`${dash} ${circ}`}
                            strokeLinecap="round"
                            transform="rotate(-90 58 58)"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span
                            className="text-2xl font-extrabold leading-none"
                            style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}
                          >
                            {pct.toFixed(top.taxaRefugo !== null ? 1 : 0)}%
                          </span>
                          <span className="text-[9px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {top.taxaRefugo !== null ? 'refugo' : 'apt.'}
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="text-center">
                        <p
                          className="text-base font-extrabold"
                          style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}
                        >
                          OP {top.numero}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {top.tamanho ? `${top.tamanho.toLocaleString('pt-BR')} pç` : `${top.Apontamentos} apontamentos`}
                        </p>
                      </div>

                      {/* Mini stats row */}
                      <div className="flex items-center gap-4 w-full justify-center">
                        <div className="text-center">
                          <p className="text-xs font-bold" style={{ color: 'var(--brand-primary)' }}>{top.Apontamentos}</p>
                          <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>apontamentos</p>
                        </div>
                        <div className="w-px h-6" style={{ background: 'var(--line)' }} />
                        <div className="text-center">
                          <p className="text-xs font-bold" style={{ color: 'var(--text-body)' }}>{dp.ricos.length - top.Apontamentos}</p>
                          <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>demais</p>
                        </div>
                        <div className="w-px h-6" style={{ background: 'var(--line)' }} />
                        <div className="text-center">
                          <p className="text-xs font-bold" style={{ color: 'var(--text-body)' }}>{dp.ops.size}</p>
                          <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>total OPs</p>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </Painel>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ABA: QUALIDADE
        ════════════════════════════════════════════════════════════════ */}
        {aba === 'qualidade' && (
          <>
            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <KPICard
                label="Taxa de Refugo"
                valor={dp.taxaRefugo.toFixed(2)}
                unidade="%"
                sparkData={dp.sparkPecas}
                cor="var(--signal-red)"
                sub={dp.totalTamanhoOp > 0 ? `base: ${dp.totalTamanhoOp.toLocaleString('pt-BR')} pç` : 'sem tamanho de OP'}
              />
              <KPICard
                label="Taxa de Retrabalho"
                valor={dp.taxaRetrabalho.toFixed(2)}
                unidade="%"
                sparkData={dp.sparkPecas}
                cor="var(--signal-amber)"
                sub={dp.totalTamanhoOp > 0 ? `base: ${dp.totalTamanhoOp.toLocaleString('pt-BR')} pç` : 'sem tamanho de OP'}
              />
              <KPICard
                label="Peças Perdidas"
                valor={dp.pecasPerdidas}
                unidade="pç"
                sparkData={dp.sparkPecas}
                cor="var(--signal-red)"
              />
            </div>

            {/* ── Linha 2: Mapa de Defeitos + Tendência ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Mapa de Defeitos */}
              <div className="lg:col-span-2">
                <Painel titulo="">
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                      POR HORA E TIPO
                    </p>
                    <h3 className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
                      Mapa de Defeitos · Hoje
                    </h3>
                  </div>

                  {dp.mapaDefeitos.length === 0 || dp.mapaDefeitos.every(r => r.total === 0)
                    ? <Vazio />
                    : <MapaDefeitos dados={dp.mapaDefeitos} />
                  }
                </Painel>
              </div>

              {/* Tendência de Refugo */}
              <Painel titulo="">
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                    ÚLTIMOS {dp.tendenciaRefugo.length} DIAS
                  </p>
                  <h3 className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
                    Tendência de Refugo
                  </h3>
                </div>
                {dp.tendenciaRefugo.length === 0 ? <Vazio /> : (
                  <ResponsiveContainer width="100%" height={230}>
                    <AreaChart data={dp.tendenciaRefugo} margin={{ top: 10, right: 10, left: -22, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradRefugo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#5BA67E" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#5BA67E" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" vertical={false} />
                      <XAxis dataKey="data" tick={{ fill: '#607A89', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#607A89', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...TT} />
                      <Area
                        type="monotone"
                        dataKey="Perdas"
                        stroke="#5BA67E"
                        strokeWidth={2.5}
                        fill="url(#gradRefugo)"
                        dot={{ r: 3.5, fill: '#5BA67E', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Painel>
            </div>

            {/* ── Filtro por Modo de Falha (afeta os 2 gráficos abaixo) ─────── */}
            {dp.modosFalhaDisponiveis.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Modo de Falha:
                </span>
                {dp.modosFalhaDisponiveis.map(nome => {
                  const ativo = !modosFalhaExcluidos.has(nome)
                  return (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => toggleModoFalha(nome)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-[0.96]"
                      style={{
                        background: ativo ? '#1F3744' : '#fff',
                        color: ativo ? '#fff' : '#607A89',
                        border: `1px solid ${ativo ? '#1F3744' : '#DDE6EB'}`,
                      }}
                    >
                      {nome}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── Pareto de Perdas e Retrabalhos por Modo de Falha ──────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Painel titulo="Pareto — Perdas por Modo de Falha (peças)">
                <GraficoPareto dados={paretoPerdas} corBarra="#ef4444" labelValor="Perdas (pç)" />
              </Painel>
              <Painel titulo="Pareto — Retrabalhos por Modo de Falha (peças)">
                <GraficoPareto dados={paretoRetrabalhos} corBarra="#D4A155" labelValor="Retrabalhos (pç)" />
              </Painel>
            </div>

            {/* ── Tendência de Taxa de Retrabalho (segue o filtro de período) ─── */}
            <Painel titulo="">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                    {labelJanelaTendencia}
                  </p>
                  <h3 className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
                    Tendência de Taxa de Retrabalho (%)
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_DUPLO_RETRABALHO_PERDA.map(nome => {
                    const ativo = modoFalhaTendencia === nome
                    return (
                      <button
                        key={nome}
                        type="button"
                        onClick={() => setModoFalhaTendencia(nome)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-[0.96]"
                        style={{
                          background: ativo ? '#D4A155' : '#fff',
                          color: ativo ? '#fff' : '#607A89',
                          border: `1px solid ${ativo ? '#D4A155' : '#DDE6EB'}`,
                        }}
                      >
                        {nome}
                      </button>
                    )
                  })}
                </div>
              </div>
              {tendenciaRetrabalho.every(p => p.TaxaRetrabalho === 0) ? <Vazio /> : (
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={tendenciaRetrabalho} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradTendRetrabalho" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#D4A155" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#D4A155" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" vertical={false} />
                    <XAxis dataKey="periodo" tick={{ fill: '#607A89', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#607A89', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip {...TT} formatter={(v: unknown, n: unknown, p: { payload?: { retrabalhos: number; base: number } }) => [
                      `${v}% (${p?.payload?.retrabalhos ?? 0} retr. / ${p?.payload?.base ?? 0} pç)`, 'Taxa de Retrabalho'
                    ]} />
                    <Area
                      type="monotone"
                      dataKey="TaxaRetrabalho"
                      stroke="#D4A155"
                      strokeWidth={2.5}
                      fill="url(#gradTendRetrabalho)"
                      dot={{ r: 4, fill: '#D4A155', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Painel>

            {/* ── Pareto — Impacto Financeiro (mantido) ─────────────────────── */}
            <Painel titulo="Pareto — Impacto Financeiro por Tipo (R$)">
              <GraficoPareto dados={dp.paretoTipo} corBarra="#ef4444" labelValor="Custo R$" />
            </Painel>

            <Painel titulo="Custo por Tipo de Fibra e Grupo — Fibra 272 vs Fibra 365">
              {dp.fibraGrupo.length === 0
                ? <Vazio />
                : <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={dp.fibraGrupo} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" />
                      <XAxis dataKey="grupo" tick={{ fill: '#607A89', fontSize: 11 }} angle={-15} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: '#607A89', fontSize: 11 }} tickFormatter={v => `R$${Number(v).toFixed(0)}`} />
                      <Tooltip {...TT} formatter={(v: unknown) => [R(v as number)]} />
                      <Legend wrapperStyle={{ color: '#607A89', fontSize: 12 }} />
                      <Bar dataKey="Fibra 272" fill="#56A4BB" radius={[3, 3, 0, 0]} />
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
            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <KPICard
                label="Custo Total · Período"
                valor={fmtBRL(dp.custoTotal).num}
                unidade={fmtBRL(dp.custoTotal).suf}
                sparkData={dp.sparkCusto}
                cor="var(--signal-amber)"
              />
              <KPICard
                label="Custo Médio / OP"
                valor={fmtBRL(dp.custoTotal / Math.max(dp.ops.size, 1)).num}
                unidade={fmtBRL(dp.custoTotal / Math.max(dp.ops.size, 1)).suf}
                sparkData={dp.sparkCusto}
                cor="var(--signal-amber)"
              />
              <KPICard
                label="Projeção Anual"
                valor={fmtBRL(dp.projecaoAnual).num}
                unidade={fmtBRL(dp.projecaoAnual).suf}
                sparkData={dp.sparkCusto}
                cor="var(--signal-red)"
              />
            </div>

            {/* ── Linha 2: Custo diário + Custo por Categoria ──────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Área — Custo de Desperdício */}
              <div className="lg:col-span-2">
                <Painel titulo="">
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                      EVOLUÇÃO DIÁRIA
                    </p>
                    <h3 className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
                      Custo de Desperdício · {dp.evDia.length} Dias
                    </h3>
                  </div>
                  {dp.evDia.length === 0 ? <Vazio /> : (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={dp.evDia} margin={{ top: 10, right: 10, left: -5, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradCustoD" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#D4A155" stopOpacity={0.38} />
                            <stop offset="95%" stopColor="#D4A155" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" vertical={false} />
                        <XAxis dataKey="data" tick={{ fill: '#607A89', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#607A89', fontSize: 10 }} axisLine={false} tickLine={false}
                          tickFormatter={v => `R$${Number(v).toFixed(0)}`} />
                        <Tooltip {...TT} formatter={(v: unknown) => [R(v as number)]} />
                        <Area
                          type="monotone"
                          dataKey="Custo"
                          name="Custo do Dia"
                          stroke="#D4A155"
                          strokeWidth={2.5}
                          fill="url(#gradCustoD)"
                          dot={{ r: 3.5, fill: '#D4A155', stroke: '#fff', strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </Painel>
              </div>

              {/* Custo por Categoria (top materiais) */}
              <Painel titulo="">
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                    MÊS · TOP MATERIAIS
                  </p>
                  <h3 className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
                    Custo por Categoria
                  </h3>
                </div>
                {dp.porMaterial.length === 0 ? <Vazio /> : (
                  <div className="flex flex-col gap-3.5">
                    {dp.porMaterial.slice(0, 5).map((mat, i) => {
                      const maxV  = dp.porMaterial[0]?.Custo ?? 1
                      const pct   = Math.round((mat.Custo / maxV) * 100)
                      const cores = ['var(--brand-primary)', '#8b5cf6', 'var(--brand-primary-dark)', 'var(--signal-amber)', '#94ACBA']
                      return (
                        <div key={mat.nome} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-body)', maxWidth: 130 }}>
                              {mat.nome}
                            </span>
                            <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: 'var(--text-strong)' }}>
                              {Math.round(mat.Custo)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full" style={{ background: 'var(--line)' }}>
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{ width: `${pct}%`, background: cores[i % cores.length] }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Painel>
            </div>

            {/* ── Materiais Consumidos — donut + ranking ────────────────────── */}
            <Painel titulo="">
              <div className="mb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                  COMPOSIÇÃO DO CUSTO
                </p>
                <h3 className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
                  Custo por Material
                </h3>
              </div>

              {dp.porMaterial.length === 0 ? <Vazio /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center mt-2">

                  {/* Donut com total no centro */}
                  <div className="relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={230}>
                      <PieChart>
                        <Pie
                          data={dp.porMaterial}
                          dataKey="Custo"
                          nameKey="nome"
                          cx="50%" cy="50%"
                          innerRadius={68}
                          outerRadius={100}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {dp.porMaterial.map((e, i) => (
                            <Cell key={e.nome} fill={PALETA[i % PALETA.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          {...TT}
                          formatter={(v: unknown) => [R(v as number), 'Custo']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Total no centro */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-display)' }}>
                        TOTAL
                      </p>
                      <p className="text-2xl font-extrabold leading-tight" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
                        {fmtBRL(dp.custoTotal).num}
                      </p>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {fmtBRL(dp.custoTotal).suf}
                      </p>
                    </div>
                  </div>

                  {/* Ranking de materiais */}
                  <div className="flex flex-col gap-3">
                    {dp.porMaterial.slice(0, 6).map((mat, i) => {
                      const pct = dp.custoTotal > 0 ? (mat.Custo / dp.custoTotal) * 100 : 0
                      return (
                        <div key={mat.nome} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: PALETA[i % PALETA.length] }}
                              />
                              <span
                                className="text-xs font-semibold truncate"
                                style={{ color: 'var(--text-body)' }}
                              >
                                {mat.nome}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ background: 'var(--bg-page)', color: 'var(--text-muted)' }}
                              >
                                {pct.toFixed(1)}%
                              </span>
                              <span
                                className="text-xs font-bold tabular-nums"
                                style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}
                              >
                                {R(mat.Custo)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: 'var(--line)' }}>
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{ width: `${pct}%`, background: PALETA[i % PALETA.length] }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Painel>

            {/* ── Detalhes (mantidos) ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Painel titulo="Custo por Tipo de Desperdício">
                {dp.porTipo.length === 0 ? <Vazio /> : (
                  <ResponsiveContainer width="100%" height={270}>
                    <BarChart data={dp.porTipo} layout="vertical" margin={{ top: 5, right: 80, left: 130, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#607A89', fontSize: 10 }} tickFormatter={v => `R$${Number(v).toFixed(0)}`} />
                      <YAxis type="category" dataKey="nome" tick={{ fill: '#1F3744', fontSize: 10 }} width={130} />
                      <Tooltip {...TT} formatter={(v: unknown) => [R(v as number), 'Custo']} />
                      <Bar dataKey="Custo" radius={[0, 4, 4, 0]}
                        label={{ position: 'right', fill: '#607A89', fontSize: 9, formatter: (v: unknown) => Number(v) > 0 ? R(Number(v)) : '' }}>
                        {dp.porTipo.map((e, i) => <Cell key={e.nome} fill={PALETA[i % PALETA.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Painel>

              <Painel titulo="Top OPs — Custo Acumulado no Período">
                {dp.topOPs.length === 0 ? <Vazio /> : (
                  <div className="flex flex-col gap-2 mt-1">
                    {dp.topOPs.map((op, i) => {
                      const pctCusto = dp.custoTotal > 0 ? (op.Custo / dp.custoTotal) * 100 : 0
                      return (
                        <div key={op.numero} className="flex flex-col gap-1">
                          <div className="flex items-center gap-3">
                            <span className={`text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? 'bg-red-500 text-white' : i === 1 ? 'bg-orange-400 text-white' : i === 2 ? 'bg-yellow-400 text-white' : 'bg-[#DDE6EB] text-[#3D5568]'}`}>
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-[#1F3744] font-bold text-sm">{op.numero}</span>
                                <span className="text-red-500 font-black text-sm tabular-nums">{R(op.Custo)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[#607A89] text-[10px]">
                                  Fibra {op.fibra === 'F272' ? '272' : op.fibra === 'F365' ? '365' : op.fibra} · {op.Apontamentos} apt
                                  {op.tamanho ? ` · ${op.tamanho.toLocaleString('pt-BR')} pç` : ''}
                                </span>
                                <span className="text-[10px] font-semibold tabular-nums" style={{ color: '#607A89' }}>
                                  {op.taxaRefugo !== null ? `⬇ ${op.taxaRefugo.toFixed(1)}% refugo` : `${pctCusto.toFixed(1)}% custo`}
                                  {op.taxaRetrabalho !== null && op.taxaRetrabalho > 0 ? ` · ↻ ${op.taxaRetrabalho.toFixed(1)}% ret.` : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="h-1 rounded-full ml-8" style={{ background: 'var(--line)' }}>
                            <div className="h-1 rounded-full bg-red-400 transition-all" style={{ width: `${pctCusto}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Painel>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ABA: HISTÓRICO — Linha do tempo de todos os apontamentos
        ════════════════════════════════════════════════════════════════ */}
        {aba === 'historico' && (
          <Painel
            titulo={`LINHA DO TEMPO · ${dados.length} ${dados.length === 1 ? 'APONTAMENTO' : 'APONTAMENTOS'}`}
          >
            {dados.length === 0 ? (
              <p className="text-center py-10 text-sm" style={{ color: 'var(--text-faint)' }}>
                Nenhum apontamento no período selecionado
              </p>
            ) : (
              <div className="overflow-auto -mx-4" style={{ maxHeight: 600 }}>
                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead className="sticky top-0 z-10">
                    <tr style={{ background: 'var(--bg-page)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
                      <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Data/Hora</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>OP</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Tipo</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Operadora</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Qtd</th>
                      <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dados]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((a, i) => {
                        const dt = new Date(a.created_at)
                        const dataFmt = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                        const horaFmt = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        const operadoraDisplay = (a.nome_operador || '').trim().replace(/\b\w/g, c => c.toUpperCase())
                        return (
                          <tr key={a.id ?? i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                            <td className="px-5 py-2.5 tabular-nums whitespace-nowrap" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {dataFmt} <span style={{ color: 'var(--text-strong)' }}>{horaFmt}</span>
                            </td>
                            <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-body)', fontFamily: 'var(--font-mono)' }}>{a.numero_op}</td>
                            <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--text-strong)' }}>{a.tipo_desperdicio}</td>
                            <td className="px-3 py-2.5" style={{ color: 'var(--text-body)' }}>{operadoraDisplay}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatarQtdApontamento(a)}</td>
                            <td className="px-5 py-2.5" style={{ color: 'var(--text-body)', maxWidth: 280 }}>{a.observacao ?? ''}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
        )}
      </main>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KPI({ label, valor, cor, borda, icon }: { label: string; valor: string | number; cor: string; borda: string; icon: string }) {
  return (
    <div className={`bg-white border border-[#DDE6EB] border-l-4 ${borda} rounded-xl p-4 flex flex-col gap-1 shadow-sm`}>
      <p className="text-[#607A89] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
        <span>{icon}</span>{label}
      </p>
      <p className={`text-2xl font-extrabold ${cor} leading-tight break-words`}>{valor}</p>
    </div>
  )
}

// ─── Sparkline SVG inline ─────────────────────────────────────────────────────

function SparklineSVG({ data, color = '#56A4BB' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const W = 72, H = 28
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" style={{ flexShrink: 0 }}>
      <polyline points={pts} stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * W
        const y = H - ((v - min) / range) * (H - 4) - 2
        return i === data.length - 1
          ? <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
          : null
      })}
    </svg>
  )
}

// ─── KPI Card moderno (Produção) ──────────────────────────────────────────────

function KPICard({
  label, valor, unidade, sparkData, cor = 'var(--brand-primary)', sub,
}: {
  label: string
  valor: string | number
  unidade?: string
  sparkData?: number[]
  cor?: string
  sub?: string
}) {
  return (
    <div
      className="rounded-2xl flex flex-col gap-2.5 p-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        boxShadow: '0 1px 4px rgba(31,55,68,0.06)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-[10px] font-bold uppercase tracking-wider leading-snug"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
        >
          {label}
        </p>
        {sparkData && sparkData.length >= 2 && (
          <SparklineSVG data={sparkData} color={cor} />
        )}
      </div>
      <div className="flex items-end gap-1.5">
        <span
          className="text-3xl font-extrabold leading-none tabular-nums"
          style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}
        >
          {valor}
        </span>
        {unidade && (
          <span className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>
            {unidade}
          </span>
        )}
      </div>
      {sub && (
        <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{sub}</p>
      )}
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

// ─── fmtBRL ───────────────────────────────────────────────────────────────────
// Formata valor financeiro no estilo "48.214 BRL" / "612k BRL"

function fmtBRL(v: number): { num: string; suf: string } {
  if (!isFinite(v) || v === 0) return { num: '0', suf: 'BRL' }
  if (v >= 1_000_000) return { num: `${(v / 1_000_000).toFixed(1)}M`, suf: 'BRL' }
  if (v >= 100_000)   return { num: `${Math.round(v / 1_000)}k`,       suf: 'BRL' }
  if (v >= 10_000)    return { num: `${(v / 1_000).toFixed(1)}k`,      suf: 'BRL' }
  return { num: v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), suf: 'BRL' }
}

// ─── MapaDefeitos ─────────────────────────────────────────────────────────────

type MapaRow = { grupo: string; total: number; horas: { hora: number; count: number }[] }

function MapaDefeitos({ dados }: { dados: MapaRow[] }) {
  const HORAS  = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
  const LABELS = [7, 10, 13, 16, 19]

  if (dados.every(r => r.total === 0)) return <Vazio />

  return (
    <div>
      {/* Grade de bolhas */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 460 }}>
          {/* Header: horas */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `88px repeat(${HORAS.length}, 1fr)`,
              gap: '4px 0',
              marginBottom: 4,
            }}
          >
            <div />
            {HORAS.map(h => (
              <div
                key={h}
                className="text-center"
                style={{ fontSize: 9, color: '#94ACBA', fontFamily: 'var(--font-mono)' }}
              >
                {LABELS.includes(h) ? `${h}h` : ''}
              </div>
            ))}
          </div>

          {/* Linhas por grupo */}
          {dados.map((row, ri) => (
            <div
              key={row.grupo}
              style={{
                display: 'grid',
                gridTemplateColumns: `88px repeat(${HORAS.length}, 1fr)`,
                gap: '4px 0',
                marginBottom: 6,
                alignItems: 'center',
              }}
            >
              <div
                className="text-right pr-2.5 truncate"
                style={{ fontSize: 10, color: '#607A89', lineHeight: 1 }}
              >
                {row.grupo.length > 13 ? row.grupo.slice(0, 11) + '…' : row.grupo}
              </div>
              {row.horas.map(cell => {
                const has  = cell.count > 0
                const size = has ? Math.min(20, 9 + cell.count * 4) : 9
                return (
                  <div key={cell.hora} className="flex items-center justify-center" style={{ height: 26 }}>
                    <div
                      style={{
                        width: size, height: size,
                        borderRadius: '50%',
                        background: has ? (PALETA[ri % PALETA.length]) : '#DDE6EB',
                        opacity: has ? Math.min(1, 0.45 + cell.count * 0.12) : 0.4,
                        transition: 'all 0.15s',
                      }}
                      title={`${cell.hora}h · ${row.grupo} · ${cell.count}`}
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div
        className="mt-3 pt-3 flex flex-col gap-1.5"
        style={{ borderTop: '1px solid var(--line)' }}
      >
        {dados.map((row, i) => (
          <div key={row.grupo} className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: PALETA[i % PALETA.length] }}>
              {row.grupo}
            </span>
            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {row.total} {row.total === 1 ? 'defeito' : 'defeitos'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
