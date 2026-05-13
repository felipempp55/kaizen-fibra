'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { CTQS, type CTQ } from '@/lib/ctqs'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

// ─── Constantes SPC (Xbar-S) ─────────────────────────────────────────────────
// c4 = fator de correção de desvio padrão para amostra de tamanho n
function c4(n: number) { return (4 * (n - 1)) / (4 * n - 3) }
// Constantes para carta X̄-S (Montgomery, Introduction to Statistical Quality Control)
function A3(n: number) { return 3 / (c4(n) * Math.sqrt(n)) }
function B4(n: number) { const c = c4(n); return 1 + (3 * Math.sqrt(1 - c * c)) / c }
function B3(n: number) { const c = c4(n); return Math.max(0, 1 - (3 * Math.sqrt(1 - c * c)) / c) }

function arred(v: number, dec = 4) { return Math.round(v * 10 ** dec) / 10 ** dec }

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ColetaDB {
  id: string
  created_at: string
  ctq_id: string
  numero_op: string
  data_coleta: string
  total_amostras: number
  total_ok: number | null
  total_nok: number | null
  media: number | null
  desvio_padrao: number | null
}

// ─── Dot personalizado: vermelho se fora de controle ─────────────────────────
function makeDot(oocKey: string, cor = '#1E9FAC') {
  // eslint-disable-next-line react/display-name
  return function CustomDot(props: Record<string, unknown>) {
    const cx = props.cx as number | undefined
    const cy = props.cy as number | undefined
    const payload = props.payload as Record<string, unknown> | undefined
    if (cx == null || cy == null || payload == null) return null
    const isOOC = Boolean(payload[oocKey])
    return (
      <circle
        cx={cx} cy={cy} r={5}
        fill={isOOC ? '#ef4444' : cor}
        stroke="white" strokeWidth={1.5}
      />
    )
  }
}

const TOOLTIP = {
  contentStyle: { backgroundColor: '#1A3344', border: '1px solid #1E9FAC', borderRadius: 6 },
  labelStyle: { color: '#fff', fontWeight: 700, fontSize: 11 },
  itemStyle: { color: '#b3d4e0', fontSize: 11 },
}

// ─── Carta p (atributo) ───────────────────────────────────────────────────────
function CartaP({ coletas }: { coletas: ColetaDB[] }) {
  const pontos = coletas
    .filter(d => d.total_nok != null && d.total_amostras > 0)
    .map(d => ({
      label: `OP ${d.numero_op}`,
      p: arred((d.total_nok! / d.total_amostras) * 100, 2),
      n: d.total_amostras,
    }))

  if (pontos.length === 0) return <SemDados />

  // Limites — com n constante, UCL/LCL são fixos
  const pBar = arred(pontos.reduce((s, p) => s + p.p, 0) / pontos.length, 2)
  const n = pontos[0].n
  // Fórmula: p̄ ± 3√(p̄(1-p̄)/n)   onde p é em %
  const sigma = Math.sqrt((pBar * (100 - pBar)) / n)
  const ucl = arred(Math.min(100, pBar + 3 * sigma), 2)
  const lcl = arred(Math.max(0, pBar - 3 * sigma), 2)

  const pontosFinal = pontos.map(p => ({ ...p, ooc: p.p > ucl || (lcl > 0 && p.p < lcl) }))
  const oocCount = pontosFinal.filter(p => p.ooc).length
  const maxY = arred(Math.max(...pontos.map(p => p.p), ucl) * 1.2, 2)

  return (
    <div className="flex flex-col gap-4">
      <AlertaOOC count={oocCount} />
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="p̄ (linha central)" valor={`${pBar}%`} cor="text-[#1E9FAC]" />
        <StatBox label="LSC" valor={`${ucl}%`} cor="text-red-500" />
        <StatBox label="LIC" valor={`${lcl}%`} cor="text-red-500" />
      </div>
      <div className="text-[10px] text-[#8FA3B0] -mt-2">
        Método: Carta p · n={n} · {pontos.length} subgrupo{pontos.length !== 1 ? 's' : ''}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={pontosFinal} margin={{ top: 8, right: 40, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" />
          <XAxis dataKey="label" tick={{ fill: '#8FA3B0', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#8FA3B0', fontSize: 10 }} unit="%" domain={[0, maxY]} />
          <Tooltip {...TOOLTIP} formatter={(v) => [`${v}%`, 'Prop. NOK']} />
          <ReferenceLine y={ucl} stroke="#ef4444" strokeDasharray="5 3"
            label={{ value: `LSC ${ucl}%`, fill: '#ef4444', fontSize: 9, position: 'right' }} />
          <ReferenceLine y={pBar} stroke="#1E9FAC" strokeDasharray="4 4"
            label={{ value: `p̄`, fill: '#1E9FAC', fontSize: 9, position: 'right' }} />
          {lcl > 0 && (
            <ReferenceLine y={lcl} stroke="#ef4444" strokeDasharray="5 3"
              label={{ value: `LIC ${lcl}%`, fill: '#ef4444', fontSize: 9, position: 'right' }} />
          )}
          <Line type="linear" dataKey="p" stroke="#1E9FAC" strokeWidth={2}
            dot={makeDot('ooc', '#1E9FAC')} activeDot={{ r: 6 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Painel Cp/Cpk ───────────────────────────────────────────────────────────
function PainelCapabilidade({ cp, cpk, lse, lsi }: { cp: number; cpk: number; lse: number; lsi: number }) {
  function classCpk(v: number) {
    if (v >= 1.67) return { cor: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Excelente' }
    if (v >= 1.33) return { cor: 'text-[#1E9FAC]',  bg: 'bg-[#E6F6F8] border-[#1E9FAC]/30',  label: 'Capaz' }
    if (v >= 1.00) return { cor: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',        label: 'Marginal' }
    return              { cor: 'text-red-600',        bg: 'bg-red-50 border-red-200',            label: 'Incapaz' }
  }
  const { cor, bg, label } = classCpk(cpk)

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${bg}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-[#1A3344] font-bold text-xs uppercase tracking-wider">Índices de Capacidade</h4>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cor} bg-white border`}>{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg p-3 text-center border border-[#DDE4EA]">
          <p className="text-[#8FA3B0] text-[9px] font-bold uppercase tracking-wider mb-0.5">Cp</p>
          <p className="text-2xl font-black text-[#1A3344] font-mono">{arred(cp, 2)}</p>
          <p className="text-[9px] text-[#8FA3B0] mt-0.5">Capacidade potencial</p>
        </div>
        <div className={`rounded-lg p-3 text-center border ${bg}`}>
          <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${cor}`}>Cpk</p>
          <p className={`text-2xl font-black font-mono ${cor}`}>{arred(cpk, 2)}</p>
          <p className="text-[9px] text-[#8FA3B0] mt-0.5">Capacidade real</p>
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-[#8FA3B0]">
        <span>LSI = {lsi} mm</span>
        <span>LSE = {lse} mm</span>
        <span>Tol = {arred((lse - lsi) * 1000, 1)} µm</span>
      </div>
      <p className="text-[10px] text-[#8FA3B0] leading-snug">
        Meta: Cpk ≥ 1,33 (capaz) · ≥ 1,67 (excelente) · σ̂ estimado por S̄/c₄(n)
      </p>
    </div>
  )
}

// ─── Carta X̄-S (variável) ────────────────────────────────────────────────────
function CartaXbarS({ coletas, n, lse, lsi }: { coletas: ColetaDB[]; n: number; lse?: number; lsi?: number }) {
  const pontos = coletas
    .filter(d => d.media != null && d.desvio_padrao != null)
    .map(d => ({
      label: `OP ${d.numero_op}`,
      media: arred(d.media!, 4),
      s: arred(d.desvio_padrao!, 4),
    }))

  if (pontos.length === 0) return <SemDados />

  const xBarBar = arred(pontos.reduce((s, p) => s + p.media, 0) / pontos.length, 4)
  const sBar    = arred(pontos.reduce((s, p) => s + p.s, 0) / pontos.length, 4)

  // Limites de controle — constantes Montgomery
  const xUCL = arred(xBarBar + A3(n) * sBar, 4)
  const xLCL = arred(xBarBar - A3(n) * sBar, 4)
  const sUCL  = arred(B4(n) * sBar, 4)
  const sLCL  = arred(B3(n) * sBar, 4)

  const pontosFinal = pontos.map(p => ({
    ...p,
    xOOC: p.media > xUCL || p.media < xLCL,
    sOOC: p.s > sUCL || (sLCL > 0 && p.s < sLCL),
  }))

  const xOOC = pontosFinal.filter(p => p.xOOC).length
  const sOOC = pontosFinal.filter(p => p.sOOC).length

  // Cp / Cpk — σ̂ = S̄ / c4(n) (estimativa não viesada do desvio padrão do processo)
  const sigmaHat = sBar / c4(n)
  const temEspec = lse != null && lsi != null
  const cp  = temEspec ? (lse! - lsi!) / (6 * sigmaHat) : null
  const cpk = temEspec
    ? Math.min((lse! - xBarBar) / (3 * sigmaHat), (xBarBar - lsi!) / (3 * sigmaHat))
    : null

  // Domínio do eixo Y da carta X̄ — inclui spec limits se existirem
  const xValores  = pontosFinal.map(p => p.media)
  const yMin = lsi != null ? Math.min(...xValores, xLCL, lsi) : Math.min(...xValores, xLCL)
  const yMax = lse != null ? Math.max(...xValores, xUCL, lse) : Math.max(...xValores, xUCL)
  const margem = (yMax - yMin) * 0.15 || 0.0002
  const xDomMin = arred(yMin - margem, 5)
  const xDomMax = arred(yMax + margem, 5)

  const sValores = pontosFinal.map(p => p.s)
  const sMax     = arred(Math.max(...sValores, sUCL) * 1.15, 4)

  return (
    <div className="flex flex-col gap-6">

      {/* ── Cp / Cpk ── */}
      {temEspec && cp != null && cpk != null && (
        <PainelCapabilidade cp={cp} cpk={cpk} lse={lse!} lsi={lsi!} />
      )}

      {/* ── Carta X̄ ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#1E9FAC] rounded-full" />
          <h4 className="text-[#1A3344] font-bold text-xs uppercase tracking-wider">Carta X̄ — Média por Coleta</h4>
        </div>
        <AlertaOOC count={xOOC} />
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="X̄̄ (centro)" valor={xBarBar.toString()} cor="text-[#1E9FAC]" />
          <StatBox label="LSC controle" valor={xUCL.toString()} cor="text-red-500" />
          <StatBox label="LIC controle" valor={xLCL.toString()} cor="text-red-500" />
        </div>
        {temEspec && (
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="LSE espec." valor={`${lse} mm`} cor="text-orange-600" />
            <StatBox label="LSI espec." valor={`${lsi} mm`} cor="text-orange-600" />
          </div>
        )}
        <div className="text-[10px] text-[#8FA3B0] -mt-1">
          A3={arred(A3(n), 3)} · n={n} · {pontos.length} subgrupo{pontos.length !== 1 ? 's' : ''} · σ̂={arred(sigmaHat, 5)} mm
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={pontosFinal} margin={{ top: 8, right: 50, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" />
            <XAxis dataKey="label" tick={{ fill: '#8FA3B0', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#8FA3B0', fontSize: 10 }} domain={[xDomMin, xDomMax]} />
            <Tooltip {...TOOLTIP} formatter={(v) => [`${v} mm`, 'Média']} />
            {/* Limites de especificação (laranja — mais externos) */}
            {lse != null && (
              <ReferenceLine y={lse} stroke="#f97316" strokeWidth={1.5}
                label={{ value: `LSE ${lse}`, fill: '#f97316', fontSize: 9, position: 'right' }} />
            )}
            {lsi != null && (
              <ReferenceLine y={lsi} stroke="#f97316" strokeWidth={1.5}
                label={{ value: `LSI ${lsi}`, fill: '#f97316', fontSize: 9, position: 'right' }} />
            )}
            {/* Limites de controle (vermelho tracejado — mais internos) */}
            <ReferenceLine y={xUCL} stroke="#ef4444" strokeDasharray="5 3"
              label={{ value: `LSC`, fill: '#ef4444', fontSize: 9, position: 'right' }} />
            <ReferenceLine y={xBarBar} stroke="#1E9FAC" strokeDasharray="4 4"
              label={{ value: `X̄̄`, fill: '#1E9FAC', fontSize: 9, position: 'right' }} />
            <ReferenceLine y={xLCL} stroke="#ef4444" strokeDasharray="5 3"
              label={{ value: `LIC`, fill: '#ef4444', fontSize: 9, position: 'right' }} />
            <Line type="linear" dataKey="media" stroke="#1E9FAC" strokeWidth={2}
              dot={makeDot('xOOC', '#1E9FAC')} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="border-t border-[#F2F5F7]" />

      {/* ── Carta S ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#4A90D9] rounded-full" />
          <h4 className="text-[#1A3344] font-bold text-xs uppercase tracking-wider">Carta S — Desvio Padrão por Coleta</h4>
        </div>
        <AlertaOOC count={sOOC} cor="azul" />
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="S̄ (centro)" valor={sBar.toString()} cor="text-[#4A90D9]" />
          <StatBox label="LSC" valor={sUCL.toString()} cor="text-red-500" />
          <StatBox label="LIC" valor={sLCL > 0 ? sLCL.toString() : '0'} cor="text-red-500" />
        </div>
        <div className="text-[10px] text-[#8FA3B0] -mt-1">
          B3={arred(B3(n), 3)} · B4={arred(B4(n), 3)} · n={n}
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={pontosFinal} margin={{ top: 8, right: 40, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" />
            <XAxis dataKey="label" tick={{ fill: '#8FA3B0', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#8FA3B0', fontSize: 10 }} domain={[0, sMax]} />
            <Tooltip {...TOOLTIP} formatter={(v) => [String(v), 'Desvio Padrão']} />
            <ReferenceLine y={sUCL} stroke="#ef4444" strokeDasharray="5 3"
              label={{ value: `LSC`, fill: '#ef4444', fontSize: 9, position: 'right' }} />
            <ReferenceLine y={sBar} stroke="#4A90D9" strokeDasharray="4 4"
              label={{ value: `S̄`, fill: '#4A90D9', fontSize: 9, position: 'right' }} />
            {sLCL > 0 && (
              <ReferenceLine y={sLCL} stroke="#ef4444" strokeDasharray="5 3"
                label={{ value: `LIC`, fill: '#ef4444', fontSize: 9, position: 'right' }} />
            )}
            <Line type="linear" dataKey="s" stroke="#4A90D9" strokeWidth={2}
              dot={makeDot('sOOC', '#4A90D9')} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Sub-componentes auxiliares ───────────────────────────────────────────────
function StatBox({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="bg-[#F2F5F7] rounded-lg px-3 py-2 flex flex-col gap-0.5 text-center">
      <p className="text-[#8FA3B0] text-[9px] font-bold uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-sm font-extrabold font-mono ${cor}`}>{valor}</p>
    </div>
  )
}

function AlertaOOC({ count, cor }: { count: number; cor?: string }) {
  if (count === 0) return null
  const bg = cor === 'azul' ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
  const text = cor === 'azul' ? 'text-blue-700' : 'text-red-700'
  return (
    <div className={`flex items-center gap-2 ${bg} border rounded-lg px-3 py-2`}>
      <span className="text-sm">⚠️</span>
      <span className={`${text} text-xs font-semibold`}>
        {count} ponto{count > 1 ? 's' : ''} fora de controle
      </span>
    </div>
  )
}

function SemDados() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#8FA3B0]">
      <span className="text-4xl">📊</span>
      <p className="text-sm font-medium">Nenhuma coleta finalizada</p>
      <p className="text-xs text-center">Finalize coletas CEP para visualizar as cartas</p>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CartasControle() {
  const [ctq, setCtq] = useState<CTQ | null>(null)
  const [coletas, setColetas] = useState<ColetaDB[]>([])
  const [carregando, setCarregando] = useState(false)
  const [ultima, setUltima] = useState<Date | null>(null)

  const buscar = useCallback(async (ctqId: string) => {
    setCarregando(true)
    try {
      const { data } = await supabase
        .from('cep_coletas')
        .select('id, created_at, ctq_id, numero_op, data_coleta, total_amostras, total_ok, total_nok, media, desvio_padrao')
        .eq('ctq_id', ctqId)
        .eq('status', 'finalizado')
        .order('data_coleta', { ascending: true })
        .order('created_at', { ascending: true })
      setColetas((data ?? []) as ColetaDB[])
      setUltima(new Date())
    } catch {
      setColetas([])
    } finally {
      setCarregando(false)
    }
  }, [])

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    if (!ctq) return
    buscar(ctq.id)
    const timer = setInterval(() => buscar(ctq.id), 30000)
    return () => clearInterval(timer)
  }, [ctq, buscar])

  return (
    <div className="flex flex-col gap-4">

      {/* Seletor de CTQ */}
      <div className="grid grid-cols-2 gap-2">
        {CTQS.map(c => (
          <button
            key={c.id}
            onClick={() => { setCtq(c); setColetas([]) }}
            className={`rounded-xl border-2 px-3 py-3 text-left transition-all active:scale-[0.99] ${
              ctq?.id === c.id
                ? 'bg-[#1E9FAC] border-[#1E9FAC] text-white'
                : 'bg-white border-[#DDE4EA] text-[#1A3344] hover:border-[#1E9FAC]'
            }`}
          >
            <p className="font-bold text-xs leading-tight">{c.nome}</p>
            <span className={`text-[10px] font-bold mt-1 inline-block px-1.5 py-0.5 rounded ${
              ctq?.id === c.id
                ? 'bg-white/20 text-white'
                : c.tipo === 'atributo' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {c.tipo === 'atributo' ? '📊 Carta p' : '📈 Carta X̄-S'}
            </span>
          </button>
        ))}
      </div>

      {/* Área das cartas */}
      {ctq ? (
        <div className="bg-white border border-[#DDE4EA] rounded-xl p-4 flex flex-col gap-4 shadow-sm">

          {/* Cabeçalho */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-[#1A3344] font-bold text-sm">{ctq.nome}</h3>
              <p className="text-[#8FA3B0] text-[10px]">
                {ctq.tipo === 'atributo' ? 'Carta p — Proporção de NOK' : 'Cartas X̄-S — Média e Desvio Padrão'} · n={ctq.totalAmostras}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {ultima && (
                <span className="text-[#8FA3B0] text-[10px]">
                  ↺ {ultima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
              <button
                onClick={() => buscar(ctq.id)}
                disabled={carregando}
                className="text-[#1E9FAC] hover:text-[#157A86] text-xs font-bold px-3 py-1.5 rounded-lg border border-[#DDE4EA] hover:border-[#1E9FAC] transition-all disabled:opacity-40"
              >
                {carregando ? 'Carregando…' : 'Atualizar'}
              </button>
            </div>
          </div>

          {/* Alerta de dados insuficientes */}
          {!carregando && coletas.length > 0 && coletas.length < 10 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
              <p className="text-amber-800 text-xs">
                <strong>{coletas.length}</strong> coleta{coletas.length !== 1 ? 's' : ''} — recomenda-se mínimo de <strong>20–25</strong> subgrupos para limites de controle confiáveis. Continue coletando dados.
              </p>
            </div>
          )}

          {carregando && (
            <div className="py-12 text-center text-[#8FA3B0] text-sm animate-pulse">Carregando dados...</div>
          )}

          {!carregando && ctq.tipo === 'atributo' && <CartaP coletas={coletas} />}
          {!carregando && ctq.tipo === 'variavel' && (
            <CartaXbarS coletas={coletas} n={ctq.totalAmostras} lse={ctq.lse} lsi={ctq.lsi} />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-[#8FA3B0]">
          <span className="text-5xl">📈</span>
          <p className="text-sm font-semibold text-[#1A3344]">Selecione um CTQ acima</p>
          <p className="text-xs text-center">para visualizar as cartas de controle correspondentes</p>
        </div>
      )}
    </div>
  )
}
