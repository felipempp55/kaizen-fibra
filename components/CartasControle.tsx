'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { CTQS, type CTQ } from '@/lib/ctqs'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

// ─── Constantes I-MR (span = 2 observações consecutivas) ─────────────────────
const D2_IMR = 1.128  // d₂ para n=2
const D4_IMR = 3.267  // D₄ para n=2 (LIC_MR = 0, D₃=0)

function arred(v: number, dec = 4) { return Math.round(v * 10 ** dec) / 10 ** dec }

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AmostraRaw {
  numero: number
  resultado?: 'ok' | 'nok'
  valor?: number
}

interface ColetaDB {
  id: string
  created_at: string
  ctq_id: string
  numero_op: string
  data_coleta: string
  total_amostras: number
  amostras: AmostraRaw[]
}

// ─── Helpers visuais ──────────────────────────────────────────────────────────
const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#1A3344', border: '1px solid #1E9FAC', borderRadius: 6 },
  labelStyle: { color: '#fff', fontWeight: 700, fontSize: 11 },
  itemStyle: { color: '#b3d4e0', fontSize: 11 },
}

function xInterval(n: number) {
  if (n <= 15) return 0
  if (n <= 30) return 2
  if (n <= 60) return 4
  return Math.floor(n / 10)
}

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
  const bg   = cor === 'azul' ? 'bg-blue-50 border-blue-200'   : 'bg-red-50 border-red-200'
  const text = cor === 'azul' ? 'text-blue-700'                 : 'text-red-700'
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

// ─── Dot factory ──────────────────────────────────────────────────────────────
// Gera um renderer de dot: teal normal, vermelho se oocKey=true no payload
function makeDot(oocKey: string, cor = '#1E9FAC') {
  return function CustomDot(props: Record<string, unknown>) {
    const cx = props.cx as number | undefined
    const cy = props.cy as number | undefined
    const payload = props.payload as Record<string, unknown> | undefined
    if (cx == null || cy == null || payload == null) return null
    return (
      <circle
        cx={cx} cy={cy} r={4}
        fill={Boolean(payload[oocKey]) ? '#ef4444' : cor}
        stroke="white" strokeWidth={1.5}
      />
    )
  }
}

// Dot específico para atributo: teal=OK, vermelho=NOK
function dotAtributo(props: Record<string, unknown>) {
  const cx = props.cx as number | undefined
  const cy = props.cy as number | undefined
  const payload = props.payload as { resultado?: string } | undefined
  if (cx == null || cy == null || payload == null) return null
  return (
    <circle
      cx={cx} cy={cy} r={5}
      fill={payload.resultado === 'nok' ? '#ef4444' : '#1E9FAC'}
      stroke="white" strokeWidth={1.5}
    />
  )
}

// ─── Carta p — 1 ponto por amostra individual (atributo) ─────────────────────
function CartaP({ coletas }: { coletas: ColetaDB[] }) {
  // Achatar todas as amostras de todas as coletas, em ordem cronológica
  type Ponto = { seq: number; label: string; y: number; resultado: 'ok' | 'nok'; op: string }
  const pontos: Ponto[] = []
  let seq = 0
  coletas.forEach(col => {
    ;(col.amostras ?? []).forEach(a => {
      if (a.resultado) {
        seq++
        pontos.push({
          seq,
          label: `#${seq}`,
          y: a.resultado === 'nok' ? 1 : 0,
          resultado: a.resultado,
          op: col.numero_op,
        })
      }
    })
  })

  if (pontos.length === 0) return <SemDados />

  const totalNOK = pontos.filter(p => p.resultado === 'nok').length
  const pBar     = totalNOK / pontos.length               // proporção 0–1
  const sigmaP   = Math.sqrt(pBar * (1 - pBar))           // desvio binomial n=1
  const ucl      = Math.min(1, pBar + 3 * sigmaP)
  const lcl      = Math.max(0, pBar - 3 * sigmaP)

  const pontosFinal = pontos.map(p => ({
    ...p,
    ooc: p.resultado === 'nok' && ucl < 1,  // NOK é OOC quando UCL < 100%
  }))
  const oocCount = pontosFinal.filter(p => p.ooc).length

  const iv = xInterval(pontos.length)

  return (
    <div className="flex flex-col gap-4">
      <AlertaOOC count={oocCount} />
      <div className="grid grid-cols-4 gap-2">
        <StatBox label="p̄ (média NOK)" valor={`${arred(pBar * 100, 2)}%`}  cor="text-[#1E9FAC]"    />
        <StatBox label="LSC"            valor={`${arred(ucl * 100, 2)}%`}   cor="text-red-500"      />
        <StatBox label="Total OK"       valor={String(pontos.length - totalNOK)} cor="text-emerald-600" />
        <StatBox label="Total NOK"      valor={String(totalNOK)}             cor="text-red-500"      />
      </div>
      <div className="text-[10px] text-[#8FA3B0] -mt-2">
        Carta p · 1 ponto por amostra individual · {pontos.length} amostra{pontos.length !== 1 ? 's' : ''}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={pontosFinal} margin={{ top: 8, right: 60, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#8FA3B0', fontSize: 9 }}
            interval={iv}
          />
          <YAxis
            tick={{ fill: '#8FA3B0', fontSize: 9 }}
            domain={[-0.15, 1.25]}
            ticks={[0, 1]}
            tickFormatter={v => v === 0 ? 'OK' : v === 1 ? 'NOK' : ''}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const d = payload[0].payload as Ponto
              return (
                <div style={{ backgroundColor: '#1A3344', border: '1px solid #1E9FAC', borderRadius: 6, padding: '6px 10px' }}>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 11, margin: 0 }}>{d.label} · OP {d.op}</p>
                  <p style={{ color: d.resultado === 'nok' ? '#ef4444' : '#34d399', fontSize: 11, margin: '2px 0 0' }}>
                    {d.resultado.toUpperCase()}
                  </p>
                </div>
              )
            }}
          />
          <ReferenceLine y={ucl} stroke="#ef4444" strokeDasharray="5 3"
            label={{ value: `LSC ${arred(ucl * 100, 1)}%`, fill: '#ef4444', fontSize: 9, position: 'right' }} />
          <ReferenceLine y={pBar} stroke="#1E9FAC" strokeDasharray="4 4"
            label={{ value: `p̄ ${arred(pBar * 100, 1)}%`, fill: '#1E9FAC', fontSize: 9, position: 'right' }} />
          {lcl > 0 && (
            <ReferenceLine y={lcl} stroke="#ef4444" strokeDasharray="5 3"
              label={{ value: `LIC ${arred(lcl * 100, 1)}%`, fill: '#ef4444', fontSize: 9, position: 'right' }} />
          )}
          <Line
            type="linear" dataKey="y"
            stroke="#1E9FAC" strokeWidth={1} strokeOpacity={0.25}
            dot={dotAtributo as unknown as boolean}
            activeDot={{ r: 7 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Painel Cp/Cpk ────────────────────────────────────────────────────────────
function PainelCapabilidade({
  cp, cpk, lse, lsi, sigmaHat,
}: { cp: number; cpk: number; lse: number; lsi: number; sigmaHat: number }) {
  function classCpk(v: number) {
    if (v >= 1.67) return { cor: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Excelente' }
    if (v >= 1.33) return { cor: 'text-[#1E9FAC]',  bg: 'bg-[#E6F6F8] border-[#1E9FAC]/30',  label: 'Capaz'     }
    if (v >= 1.00) return { cor: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',        label: 'Marginal'  }
    return              { cor: 'text-red-600',        bg: 'bg-red-50 border-red-200',            label: 'Incapaz'   }
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
        Carta I-MR · σ̂ = MR̄/d₂ = {arred(sigmaHat, 5)} mm · Meta: Cpk ≥ 1,33
      </p>
    </div>
  )
}

// ─── Carta I-MR — medições individuais (variável) ─────────────────────────────
function CartaIMR({ coletas, lse, lsi }: { coletas: ColetaDB[]; lse?: number; lsi?: number }) {
  // Achatar todas as medições individuais de todas as coletas, em ordem
  type Medicao = { seq: number; label: string; x: number; op: string }
  const medicoes: Medicao[] = []
  let seq = 0
  coletas.forEach(col => {
    ;(col.amostras ?? []).forEach(a => {
      if (a.valor != null) {
        seq++
        medicoes.push({ seq, label: `#${seq}`, x: a.valor, op: col.numero_op })
      }
    })
  })

  if (medicoes.length === 0) return <SemDados />

  // ── Grand mean (X̄) ────────────────────────────────────────────────────────
  const xBar = arred(medicoes.reduce((s, m) => s + m.x, 0) / medicoes.length, 5)

  // ── Amplitude Móvel MRᵢ = |Xᵢ − Xᵢ₋₁| ────────────────────────────────────
  const mrArray = medicoes.slice(1).map((m, i) =>
    arred(Math.abs(m.x - medicoes[i].x), 5)
  )
  const mrBar = mrArray.length > 0
    ? arred(mrArray.reduce((s, mr) => s + mr, 0) / mrArray.length, 5)
    : 0

  // ── σ̂ e limites Carta I ──────────────────────────────────────────────────
  const sigmaHat = arred(mrBar / D2_IMR, 5)
  const iUCL = arred(xBar + 3 * sigmaHat, 5)   // = X̄ + 2.66·MR̄
  const iLCL = arred(xBar - 3 * sigmaHat, 5)

  // ── Limites Carta MR (D₃=0, LIC=0) ──────────────────────────────────────
  const mrUCL = arred(D4_IMR * mrBar, 5)

  // ── Cp / Cpk ──────────────────────────────────────────────────────────────
  const temEspec = lse != null && lsi != null
  const cp  = temEspec ? arred((lse! - lsi!) / (6 * sigmaHat), 3) : null
  const cpk = temEspec
    ? arred(Math.min((lse! - xBar) / (3 * sigmaHat), (xBar - lsi!) / (3 * sigmaHat)), 3)
    : null

  // ── Pontos Carta I ────────────────────────────────────────────────────────
  const iPontos = medicoes.map(m => ({
    ...m,
    iOOC: m.x > iUCL || m.x < iLCL,
  }))
  const iOOC = iPontos.filter(p => p.iOOC).length

  // ── Pontos Carta MR ───────────────────────────────────────────────────────
  const mrPontos = medicoes.slice(1).map((m, i) => ({
    seq: m.seq,
    label: m.label,
    op: m.op,
    mr: mrArray[i],
    mrOOC: mrArray[i] > mrUCL,
  }))
  const mrOOC = mrPontos.filter(p => p.mrOOC).length

  // ── Domínio Carta I — inclui limites de especificação ────────────────────
  const xVals = iPontos.map(p => p.x)
  const rawMin = lsi != null ? Math.min(...xVals, iLCL, lsi) : Math.min(...xVals, iLCL)
  const rawMax = lse != null ? Math.max(...xVals, iUCL, lse) : Math.max(...xVals, iUCL)
  const margem  = (rawMax - rawMin) * 0.15 || 0.0002
  const iDomMin = arred(rawMin - margem, 5)
  const iDomMax = arred(rawMax + margem, 5)
  const mrDomMax = arred(Math.max(...mrArray, mrUCL, 0) * 1.20 || 0.001, 5)

  const iv = xInterval(medicoes.length)

  type IPayload  = { label: string; op: string; x: number;  iOOC: boolean }
  type MRPayload = { label: string; op: string; mr: number; mrOOC: boolean }

  return (
    <div className="flex flex-col gap-6">

      {/* Cp / Cpk */}
      {temEspec && cp != null && cpk != null && (
        <PainelCapabilidade cp={cp} cpk={cpk} lse={lse!} lsi={lsi!} sigmaHat={sigmaHat} />
      )}

      {/* ── Carta I ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#1E9FAC] rounded-full" />
          <h4 className="text-[#1A3344] font-bold text-xs uppercase tracking-wider">
            Carta I — Medições Individuais
          </h4>
        </div>
        <AlertaOOC count={iOOC} />
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="X̄ (centro)"   valor={xBar.toString()}  cor="text-[#1E9FAC]" />
          <StatBox label="LSC controle" valor={iUCL.toString()}  cor="text-red-500"   />
          <StatBox label="LIC controle" valor={iLCL.toString()}  cor="text-red-500"   />
        </div>
        {temEspec && (
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="LSE espec." valor={`${lse} mm`} cor="text-orange-600" />
            <StatBox label="LSI espec." valor={`${lsi} mm`} cor="text-orange-600" />
          </div>
        )}
        <div className="text-[10px] text-[#8FA3B0] -mt-1">
          Carta I-MR · d₂={D2_IMR} · MR̄={mrBar} · σ̂={sigmaHat} mm · {medicoes.length} medição{medicoes.length !== 1 ? 'ões' : ''}
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={iPontos} margin={{ top: 8, right: 60, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" />
            <XAxis dataKey="label" tick={{ fill: '#8FA3B0', fontSize: 9 }} interval={iv} />
            <YAxis
              tick={{ fill: '#8FA3B0', fontSize: 9 }}
              domain={[iDomMin, iDomMax]}
              tickFormatter={v => (v as number).toFixed(4)}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload as IPayload
                return (
                  <div style={{ backgroundColor: '#1A3344', border: '1px solid #1E9FAC', borderRadius: 6, padding: '6px 10px' }}>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: 11, margin: 0 }}>{d.label} · OP {d.op}</p>
                    <p style={{ color: d.iOOC ? '#ef4444' : '#b3d4e0', fontSize: 11, margin: '2px 0 0' }}>
                      {d.x.toFixed(4)} mm{d.iOOC ? ' ⚠️ OOC' : ''}
                    </p>
                  </div>
                )
              }}
            />
            {/* Limites de especificação — laranja sólido */}
            {lse != null && (
              <ReferenceLine y={lse} stroke="#f97316" strokeWidth={1.5}
                label={{ value: `LSE ${lse}`, fill: '#f97316', fontSize: 9, position: 'right' }} />
            )}
            {lsi != null && (
              <ReferenceLine y={lsi} stroke="#f97316" strokeWidth={1.5}
                label={{ value: `LSI ${lsi}`, fill: '#f97316', fontSize: 9, position: 'right' }} />
            )}
            {/* Limites de controle — vermelho tracejado */}
            <ReferenceLine y={iUCL} stroke="#ef4444" strokeDasharray="5 3"
              label={{ value: 'LSC', fill: '#ef4444', fontSize: 9, position: 'right' }} />
            <ReferenceLine y={xBar} stroke="#1E9FAC" strokeDasharray="4 4"
              label={{ value: 'X̄', fill: '#1E9FAC', fontSize: 9, position: 'right' }} />
            <ReferenceLine y={iLCL} stroke="#ef4444" strokeDasharray="5 3"
              label={{ value: 'LIC', fill: '#ef4444', fontSize: 9, position: 'right' }} />
            <Line
              type="linear" dataKey="x"
              stroke="#1E9FAC" strokeWidth={2}
              dot={makeDot('iOOC', '#1E9FAC')}
              activeDot={{ r: 6 }} connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="border-t border-[#F2F5F7]" />

      {/* ── Carta MR ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#4A90D9] rounded-full" />
          <h4 className="text-[#1A3344] font-bold text-xs uppercase tracking-wider">
            Carta MR — Amplitude Móvel
          </h4>
        </div>
        <AlertaOOC count={mrOOC} cor="azul" />
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="MR̄ (centro)"  valor={mrBar.toString()}  cor="text-[#4A90D9]" />
          <StatBox label="LSC (D₄·MR̄)" valor={mrUCL.toString()} cor="text-red-500"   />
          <StatBox label="LIC"           valor="0"                 cor="text-red-500"   />
        </div>
        <div className="text-[10px] text-[#8FA3B0] -mt-1">
          D₄={D4_IMR} · {mrPontos.length} amplitude{mrPontos.length !== 1 ? 's' : ''} móve{mrPontos.length !== 1 ? 'is' : 'l'}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={mrPontos} margin={{ top: 8, right: 40, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" />
            <XAxis dataKey="label" tick={{ fill: '#8FA3B0', fontSize: 9 }} interval={iv} />
            <YAxis
              tick={{ fill: '#8FA3B0', fontSize: 9 }}
              domain={[0, mrDomMax]}
              tickFormatter={v => (v as number).toFixed(4)}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload as MRPayload
                return (
                  <div style={{ backgroundColor: '#1A3344', border: '1px solid #1E9FAC', borderRadius: 6, padding: '6px 10px' }}>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: 11, margin: 0 }}>{d.label} · OP {d.op}</p>
                    <p style={{ color: d.mrOOC ? '#ef4444' : '#b3d4e0', fontSize: 11, margin: '2px 0 0' }}>
                      MR = {d.mr.toFixed(4)} mm{d.mrOOC ? ' ⚠️ OOC' : ''}
                    </p>
                  </div>
                )
              }}
            />
            <ReferenceLine y={mrUCL} stroke="#ef4444" strokeDasharray="5 3"
              label={{ value: 'LSC', fill: '#ef4444', fontSize: 9, position: 'right' }} />
            <ReferenceLine y={mrBar} stroke="#4A90D9" strokeDasharray="4 4"
              label={{ value: 'MR̄', fill: '#4A90D9', fontSize: 9, position: 'right' }} />
            <Line
              type="linear" dataKey="mr"
              stroke="#4A90D9" strokeWidth={2}
              dot={makeDot('mrOOC', '#4A90D9')}
              activeDot={{ r: 6 }} connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CartasControle() {
  const [ctq, setCtq]         = useState<CTQ | null>(null)
  const [coletas, setColetas] = useState<ColetaDB[]>([])
  const [carregando, setCarregando] = useState(false)
  const [ultima, setUltima]   = useState<Date | null>(null)

  const buscar = useCallback(async (ctqId: string) => {
    setCarregando(true)
    try {
      const { data } = await supabase
        .from('cep_coletas')
        // Agora buscamos 'amostras' (JSONB) para plotar 1 ponto por amostra individual
        .select('id, created_at, ctq_id, numero_op, data_coleta, total_amostras, amostras')
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

  // Auto-refresh a cada 30 s
  useEffect(() => {
    if (!ctq) return
    buscar(ctq.id)
    const timer = setInterval(() => buscar(ctq.id), 30000)
    return () => clearInterval(timer)
  }, [ctq, buscar])

  // Conta amostras individuais (para a barra de progresso no header)
  const totalColetado = coletas.reduce((s, c) => {
    return s + (c.amostras ?? []).filter(a => a.resultado != null || a.valor != null).length
  }, 0)

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
              {c.tipo === 'atributo' ? '📊 Carta p' : '📈 Carta I-MR'}
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
                {ctq.tipo === 'atributo'
                  ? 'Carta p — 1 ponto por amostra individual'
                  : 'Carta I-MR — 1 ponto por medição individual'}
                {totalColetado > 0 && ` · ${totalColetado} / ${ctq.totalAmostras} amostras`}
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

          {/* Barra de progresso das amostras */}
          {totalColetado > 0 && (
            <div>
              <div className="flex justify-between text-[10px] text-[#8FA3B0] mb-1">
                <span>Amostras coletadas</span>
                <span>{Math.round((totalColetado / ctq.totalAmostras) * 100)}%</span>
              </div>
              <div className="w-full bg-[#F2F5F7] rounded-full h-1.5">
                <div
                  className="bg-[#1E9FAC] h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((totalColetado / ctq.totalAmostras) * 100))}%` }}
                />
              </div>
            </div>
          )}

          {/* Alerta dados insuficientes */}
          {!carregando && totalColetado > 0 && totalColetado < 20 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
              <p className="text-amber-800 text-xs">
                <strong>{totalColetado}</strong> amostra{totalColetado !== 1 ? 's' : ''} — recomenda-se mínimo de{' '}
                <strong>20–25 pontos</strong> para limites de controle confiáveis.
              </p>
            </div>
          )}

          {carregando && (
            <div className="py-12 text-center text-[#8FA3B0] text-sm animate-pulse">
              Carregando dados…
            </div>
          )}

          {!carregando && ctq.tipo === 'atributo' && <CartaP coletas={coletas} />}
          {!carregando && ctq.tipo === 'variavel'  && (
            <CartaIMR coletas={coletas} lse={ctq.lse} lsi={ctq.lsi} />
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
