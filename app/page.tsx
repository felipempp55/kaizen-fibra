'use client'

import { useState, useEffect, useMemo } from 'react'
import FormularioApontamento from '@/components/FormularioApontamento'
import { salvarApontamento, cancelarOP, abrirOP, fecharOP } from './actions'
import type { NovoApontamento, TipoFibra, Apontamento } from '@/lib/types'
import Navegacao from '@/components/Navegacao'
import TecladoNumerico from '@/components/TecladoNumerico'
import { supabase } from '@/lib/supabase'
import { exportarXlsx } from '@/lib/exportXlsx'
import { gerarRelatorioPDF } from '@/lib/exportPdf'

interface OP { numero: string; fibra: TipoFibra; tamanho?: number }

// ─── Helpers de gráfico (curva Catmull-Rom) ───────────────────────────────────
function catmullRom(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

function Sparkline({ data, color, w = 80, h = 26 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (!data.length) return null
  const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1
  const sx = w / Math.max(data.length - 1, 1)
  const pts: [number, number][] = data.map((v, i) => [i * sx, h - 2 - ((v - mn) / range) * (h - 4)])
  const path = catmullRom(pts)
  const id = `sp-${Math.random().toString(36).slice(2)}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${w},${h} L 0,${h} Z`} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
    </svg>
  )
}

function AreaChartSVG({ data, labels, color = 'var(--brand-primary)' }: { data: number[]; labels?: string[]; color?: string }) {
  if (!data.length) return null
  const W = 560, H = 160, padL = 36, padR = 16, padT = 12, padB = 28
  const w = W - padL - padR, h = H - padT - padB
  const mx = Math.max(...data) * 1.15 || 1
  const sx = w / Math.max(data.length - 1, 1)
  const pts: [number, number][] = data.map((v, i) => [padL + i * sx, padT + h - (v / mx) * h])
  const path = catmullRom(pts)
  const id = `area-${Math.random().toString(36).slice(2)}`
  const ticks = [0, mx * 0.25, mx * 0.5, mx * 0.75, mx].map(Math.round)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => {
        const y = padT + h - (t / mx) * h
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line-soft)" strokeWidth="1" strokeDasharray={i === 0 ? '' : '3 5'} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-faint)" fontWeight="600">{t}</text>
          </g>
        )
      })}
      {labels && labels.map((lab, i) =>
        i % Math.ceil(labels.length / 8) === 0
          ? <text key={i} x={padL + i * sx} y={H - 6} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-faint)" fontWeight="600">{lab}</text>
          : null
      )}
      <path d={`${path} L ${pts[pts.length - 1][0]},${padT + h} L ${pts[0][0]},${padT + h} Z`} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]}
          r={i === pts.length - 1 ? 4 : 2}
          fill={i === pts.length - 1 ? color : '#fff'}
          stroke={color} strokeWidth="1.5"
        />
      ))}
      {pts.length > 0 && (() => {
        const last = pts[pts.length - 1]
        const val = data[data.length - 1]
        const bx = Math.min(last[0] - 20, W - padR - 44)
        return (
          <>
            <line x1={last[0]} y1={padT} x2={last[0]} y2={padT + h} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
            <rect x={bx} y={last[1] - 24} width="40" height="18" rx="4" fill="var(--brand-deep)" />
            <text x={bx + 20} y={last[1] - 11} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700" fill="#fff">{val}</text>
          </>
        )
      })()}
    </svg>
  )
}

function DonutChartSVG({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const size = 130, thickness = 16, r = (size - thickness) / 2, c = 2 * Math.PI * r
  let acc = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-soft)" strokeWidth={thickness} />
      {data.map((d, i) => {
        if (!d.value) return null
        const frac = d.value / total
        const dash = frac * c
        const offset = -acc * c
        acc += frac
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="butt" />
        )
      })}
      <text x={size / 2} y={size / 2 - 5} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="22" fontWeight="700" fill="var(--text-strong)" letterSpacing="-1">{total}</text>
      <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fontWeight="700" fill="var(--text-muted)" letterSpacing="0.14em">TOTAL</text>
    </svg>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Home() {
  const [ops, setOps] = useState<OP[]>([])
  const [opAtiva, setOpAtiva] = useState<OP | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [abrindoNovaOp, setAbrindoNovaOp] = useState(false)
  const [novoNumeroOP, setNovoNumeroOP] = useState('')
  const [novaFibra, setNovaFibra] = useState<TipoFibra | null>(null)
  const [novoTamanhoOp, setNovoTamanhoOp] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [apontamentoOpen, setApontamentoOpen] = useState(false)

  // Modal finalizar/cancelar
  const [modalFecharOp, setModalFecharOp] = useState<string | null>(null)
  const [authLogin, setAuthLogin] = useState('')
  const [authSenha, setAuthSenha] = useState('')
  const [authErro, setAuthErro] = useState(false)
  const [processando, setProcessando] = useState(false)

  // Dados do cockpit (hoje)
  const [dadosHoje, setDadosHoje] = useState<Apontamento[]>([])
  const [carregandoDados, setCarregandoDados] = useState(false)

  // Modal de exportação (xlsx / pdf)
  type AcaoExport = 'xlsx' | 'pdf'
  const [modalExport, setModalExport] = useState<AcaoExport | null>(null)
  const [exportLogin, setExportLogin] = useState('')
  const [exportSenha, setExportSenha] = useState('')
  const [exportErro, setExportErro] = useState(false)
  const [exportEtapa, setExportEtapa] = useState<'auth' | 'op'>('auth')
  const [opRelatorio, setOpRelatorio] = useState('')
  const [gerandoExport, setGerandoExport] = useState(false)
  const [exportMensagem, setExportMensagem] = useState<string | null>(null)

  // Carrega OPs abertas do Supabase e escuta mudanças em tempo real
  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from('ops_abertas').select('*').order('criada_em', { ascending: true })
      const lista: OP[] = (data ?? []).map(d => ({ numero: d.numero, fibra: d.fibra as TipoFibra, tamanho: d.tamanho ?? undefined }))
      setOps(lista)
      setCarregando(false)
    }
    carregar()

    const channel = supabase.channel('ops_abertas_sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_abertas' }, payload => {
        const nova: OP = { numero: payload.new.numero, fibra: payload.new.fibra as TipoFibra, tamanho: payload.new.tamanho ?? undefined }
        setOps(prev => prev.some(o => o.numero === nova.numero) ? prev : [...prev, nova])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ops_abertas' }, payload => {
        const removida = payload.old.numero as string
        setOps(prev => prev.filter(o => o.numero !== removida))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Garante que opAtiva sempre aponta para uma OP existente
  useEffect(() => {
    if (ops.length === 0) { setOpAtiva(null); return }
    setOpAtiva(curr => (curr && ops.some(o => o.numero === curr.numero)) ? curr : ops[0])
  }, [ops])

  // Busca apontamentos de hoje para o cockpit
  useEffect(() => {
    if (!opAtiva) { setDadosHoje([]); return }
    setCarregandoDados(true)
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    supabase.from('apontamentos').select('*')
      .gte('created_at', hoje.toISOString())
      .eq('numero_op', opAtiva.numero)
      .then(({ data }) => { setDadosHoje(data ?? []); setCarregandoDados(false) })
  }, [opAtiva])

  // Métricas derivadas
  const metricas = useMemo(() => {
    const total = dadosHoje.length
    const tempoTotal = dadosHoje.reduce((acc, a) => acc + (a.tempo_minutos ?? 0), 0)
    const porGrupo = dadosHoje.reduce((acc, a) => { acc[a.grupo] = (acc[a.grupo] ?? 0) + 1; return acc }, {} as Record<string, number>)
    const porHora = Array(14).fill(0)
    dadosHoje.forEach(a => {
      const h = new Date(a.created_at).getHours()
      if (h >= 7 && h <= 20) porHora[h - 7]++
    })
    const ultimosApontamentos = [...dadosHoje].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6)
    return { total, tempoTotal, porGrupo, porHora, ultimosApontamentos }
  }, [dadosHoje])

  function podeSalvarOp() { return novoNumeroOP.trim().length > 0 && novaFibra !== null && parseInt(novoTamanhoOp || '0') > 0 }

  async function confirmarNovaOp() {
    if (!podeSalvarOp() || !novaFibra) return
    const nova: OP = { numero: novoNumeroOP.trim().toUpperCase(), fibra: novaFibra, tamanho: parseInt(novoTamanhoOp) || undefined }
    const r = await abrirOP({ numero: nova.numero, fibra: nova.fibra, tamanho: nova.tamanho })
      .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'Erro de rede' }))
    if (!r.ok) {
      setErro(`Erro ao abrir OP: ${r.error}`)
      return
    }
    // Atualização otimista: não espera o evento realtime para selecionar neste dispositivo
    setOps(prev => prev.some(o => o.numero === nova.numero) ? prev : [...prev, nova])
    setOpAtiva(nova)
    setNovoNumeroOP(''); setNovaFibra(null); setNovoTamanhoOp(''); setAbrindoNovaOp(false); setFormKey(k => k + 1)
  }

  function solicitarFechamentoOp(numero: string) {
    setModalFecharOp(numero); setAuthLogin(''); setAuthSenha(''); setAuthErro(false)
  }

  function verificarCredenciais(): boolean {
    const login = authLogin.trim().toLowerCase()
    const valido = (login === 'qualidade' && authSenha === 'pareto') || (login === 'janete' && authSenha === 'fibra')
    if (!valido) { setAuthErro(true); setAuthSenha(''); return false }
    return true
  }

  function removerOpLocal(numero: string) {
    const restantes = ops.filter(o => o.numero !== numero)
    setOps(restantes)
    if (opAtiva?.numero === numero) { setOpAtiva(restantes[0] ?? null); setFormKey(k => k + 1) }
    setModalFecharOp(null)
  }

  async function finalizarOP() {
    if (!verificarCredenciais()) return
    const numero = modalFecharOp!
    setProcessando(true)
    const r = await fecharOP(numero).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'Erro de rede' }))
    if (r.ok) removerOpLocal(numero)
    else setErro(`Erro ao fechar OP: ${r.error}`)
    setProcessando(false)
  }

  async function handleCancelarOP() {
    if (!verificarCredenciais()) return
    const numero = modalFecharOp!
    setProcessando(true)
    const r = await cancelarOP(numero).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'Erro de rede' }))
    if (r.ok) removerOpLocal(numero)
    else setErro(`Erro ao cancelar OP: ${r.error}`)
    setProcessando(false)
  }

  function fecharModal() { setModalFecharOp(null); setAuthErro(false); setAuthSenha(''); setAuthLogin('') }

  function fecharModalExport() {
    setModalExport(null); setExportLogin(''); setExportSenha(''); setExportErro(false)
    setExportEtapa('auth'); setOpRelatorio(''); setExportMensagem(null)
  }

  function verificarCredenciaisExport(): boolean {
    const login = exportLogin.trim().toLowerCase()
    if (login === 'qualidade' && exportSenha === 'pareto') return true
    setExportErro(true); setExportSenha(''); return false
  }

  async function confirmarExport() {
    if (!verificarCredenciaisExport()) return
    if (modalExport === 'xlsx') {
      setGerandoExport(true)
      setExportMensagem('Buscando dados…')
      try {
        const { data } = await supabase.from('apontamentos').select('*').order('created_at', { ascending: true })
        exportarXlsx(data ?? [])
        fecharModalExport()
      } catch { setExportMensagem('Erro ao exportar. Tente novamente.') }
      finally { setGerandoExport(false) }
    } else {
      // PDF: vai para etapa de informar a OP
      setExportEtapa('op')
    }
  }

  async function gerarPDF() {
    const numero = opRelatorio.trim().toUpperCase()
    if (!numero) { setExportMensagem('Informe o número da OP.'); return }
    setGerandoExport(true)
    setExportMensagem('Buscando dados da OP…')
    try {
      const [{ data: aps }, { data: tempos }] = await Promise.all([
        supabase.from('apontamentos').select('*').eq('numero_op', numero).order('created_at', { ascending: true }),
        supabase.from('tempos_retrabalho_polimento').select('tempo_ms, custo_hh').eq('numero_op', numero),
      ])
      if (!aps || aps.length === 0) { setExportMensagem(`Nenhum apontamento encontrado para a OP ${numero}.`); return }
      setExportMensagem('Gerando PDF…')
      await gerarRelatorioPDF(aps, tempos ?? [], numero)
      fecharModalExport()
    } catch (e) { setExportMensagem(e instanceof Error ? e.message : 'Erro ao gerar PDF.') }
    finally { setGerandoExport(false) }
  }

  function selecionarOp(op: OP) {
    if (opAtiva?.numero === op.numero) return
    setOpAtiva(op); setFormKey(k => k + 1); setApontamentoOpen(false)
  }

  async function handleSalvar(dados: NovoApontamento): Promise<boolean> {
    setErro(null)
    // 1) INSERT: a Server Action agora RETORNA { ok, error } em vez de throw.
    const resultado = await salvarApontamento(dados).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Erro de rede'
      return { ok: false as const, error: msg }
    })
    if (!resultado.ok) {
      const detalhe = 'detail' in resultado && resultado.detail ? ` (${resultado.detail})` : ''
      setErro(`Erro ao salvar: ${resultado.error}${detalhe}`)
      console.error('[handleSalvar] Falha no INSERT:', resultado)
      return false
    }
    // 2) Pós-sucesso: atualizar a UI. Falhas aqui não invalidam o salvamento.
    try {
      setApontamentoOpen(false)
      setFormKey(k => k + 1)
      if (opAtiva) {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
        const { data } = await supabase.from('apontamentos').select('*')
          .gte('created_at', hoje.toISOString()).eq('numero_op', opAtiva.numero)
        setDadosHoje(data ?? [])
      }
    } catch (e) {
      // Não bloqueia o sucesso — o INSERT já passou. Só loga.
      console.warn('[handleSalvar] Pos-salvamento falhou (UI), mas o apontamento foi salvo:', e)
    }
    return true
  }

  if (carregando) return <div className="min-h-screen" style={{ background: 'var(--bg-page)' }} />

  // ── Cockpit ────────────────────────────────────────────────────────────────
  const CORES_GRUPO: Record<string, string> = {
    'Polimento': 'var(--brand-primary)',
    'Epóxi': '#8b5cf6',
    'Clivagem': 'var(--brand-tecno-deep)',
    'Problemas Dimensionais': 'var(--brand-soft)',
  }

  const donutData = Object.entries(metricas.porGrupo).map(([label, value]) => ({
    label, value, color: CORES_GRUPO[label] ?? '#aaa',
  }))

  const horaLabels = ['07','08','09','10','11','12','13','14','15','16','17','18','19','20']

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-page)' }}>
      <Navegacao onReset={() => { setErro(null); setApontamentoOpen(false) }} />

      <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">

        {/* ── Linha 1: OP ativa + Outras OPs ──────────────────────────────── */}
        <div className="flex gap-4 items-stretch">

          {/* Card OP ativa */}
          <div className="flex-1 rounded-2xl p-6 relative overflow-hidden flex flex-col gap-4"
            style={{ background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-deep-2) 100%)' }}>
            {/* Anéis decorativos de fibra óptica */}
            <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.06 }} width="220" height="220" viewBox="0 0 220 220">
              <circle cx="110" cy="110" r="108" stroke="#fff" strokeWidth="1" fill="none" />
              <circle cx="110" cy="110" r="82" stroke="#fff" strokeWidth="1" fill="none" />
              <circle cx="110" cy="110" r="56" stroke="#fff" strokeWidth="1" fill="none" />
              <circle cx="110" cy="110" r="30" stroke="#fff" strokeWidth="1" fill="none" />
            </svg>

            {opAtiva === null ? (
              <div className="relative flex flex-col items-center justify-center flex-1 gap-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                  style={{ background: 'rgba(156,229,238,0.16)', color: 'var(--brand-tecno)', fontFamily: 'var(--font-mono)' }}>
                  NENHUMA OP EM ANDAMENTO
                </span>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Abra uma Ordem de Produção para começar
                </p>
                <button onClick={() => setAbrindoNovaOp(true)}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl font-bold transition-all active:scale-[0.97] mt-1"
                  style={{
                    background: 'var(--brand-tecno)', color: 'var(--brand-deep)',
                    fontFamily: 'var(--font-display)', fontSize: 14,
                    boxShadow: '0 4px 14px rgba(156,229,238,0.25)',
                  }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                  Abrir Ordem de Produção
                </button>
              </div>
            ) : (
              <div className="relative flex gap-6">
                {/* Esquerda: identidade + métricas */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                      style={{ background: 'rgba(156,229,238,0.16)', color: 'var(--brand-tecno)', fontFamily: 'var(--font-mono)' }}>
                      OP ATIVA
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
                      HOJE: {metricas.total} APONTAMENTO{metricas.total !== 1 ? 'S' : ''}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-4">
                    <span className="font-bold text-white"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 32, letterSpacing: '-0.03em' }}>
                      {opAtiva.numero}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                      Fibra{' '}
                      <strong style={{ color: 'var(--brand-tecno)', fontWeight: 700 }}>
                        {opAtiva.fibra === 'F272' ? '272' : '365'}
                      </strong>
                    </span>
                  </div>
                  <div className="flex gap-7 mt-4">
                    <MetricaMini label="Apontamentos" valor={String(metricas.total)} />
                    <MetricaMini label="Tempo Retrabalho"
                      valor={metricas.tempoTotal > 0 ? `${metricas.tempoTotal} min` : '—'} />
                    {opAtiva.tamanho && (
                      <MetricaMini label="Tamanho da OP" valor={opAtiva.tamanho.toLocaleString('pt-BR') + ' pç'} />
                    )}
                  </div>
                </div>

                {/* Direita: botões de ação */}
                <div className="flex flex-col gap-2 w-52 shrink-0">
                  <button onClick={() => setApontamentoOpen(true)}
                    className="flex items-center justify-between px-4 py-4 rounded-xl font-bold transition-all active:scale-[0.97]"
                    style={{
                      background: 'var(--brand-tecno)', color: 'var(--brand-deep)',
                      fontFamily: 'var(--font-display)', fontSize: 14,
                      boxShadow: '0 4px 14px rgba(156,229,238,0.25), 0 1px 0 rgba(255,255,255,0.5) inset',
                    }}>
                    <span>+ Novo Apontamento</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </button>
                  <button onClick={() => solicitarFechamentoOp(opAtiva.numero)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl font-semibold transition-all active:scale-[0.97]"
                    style={{
                      background: 'transparent', color: 'rgba(255,255,255,0.55)',
                      border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-display)', fontSize: 13,
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
                    </svg>
                    <span>Finalizar / Cancelar OP</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Painel: Outras OPs */}
          <div className="flex flex-col gap-2.5 w-52 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Outras OPs
            </span>

            {ops.filter(o => o.numero !== opAtiva?.numero).map(op => (
              <button key={op.numero} onClick={() => selecionarOp(op)}
                className="rounded-xl p-3.5 flex flex-col gap-2 text-left transition-all active:scale-[0.97]"
                style={{ background: '#fff', border: '1px solid var(--line)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)', fontFamily: 'var(--font-mono)' }}>
                    FIBRA {op.fibra === 'F272' ? '272' : '365'}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </div>
                <span className="font-bold" style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-strong)', letterSpacing: '-0.02em' }}>
                  {op.numero}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); solicitarFechamentoOp(op.numero) }}
                    className="text-[10px] font-semibold transition-colors"
                    style={{ color: 'var(--text-faint)' }}>
                    Encerrar
                  </button>
                </div>
              </button>
            ))}

            <button onClick={() => setAbrindoNovaOp(true)}
              className="rounded-xl p-3.5 flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-[0.97]"
              style={{
                color: 'var(--brand-primary)', border: '1.5px dashed var(--line-strong)',
                background: 'transparent', fontFamily: 'var(--font-display)',
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Abrir Nova OP
            </button>

            {/* Separador */}
            <div style={{ height: 1, background: 'var(--line)', margin: '2px 0' }} />

            {/* Botão XLSX */}
            <button onClick={() => { setModalExport('xlsx'); setExportEtapa('auth') }}
              className="rounded-xl p-3 flex items-center gap-2.5 font-semibold text-sm transition-all active:scale-[0.97]"
              style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--text-body)', fontFamily: 'var(--font-display)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /><line x1="8" y1="9" x2="10" y2="9" />
              </svg>
              <span>Exportar .xlsx</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="ml-auto">
                <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </button>

            {/* Botão PDF */}
            <button onClick={() => { setModalExport('pdf'); setExportEtapa('auth') }}
              className="rounded-xl p-3 flex items-center gap-2.5 font-semibold text-sm transition-all active:scale-[0.97]"
              style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--text-body)', fontFamily: 'var(--font-display)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                <path d="M9 15v-4h6v4" /><line x1="9" y1="11" x2="15" y2="11" />
              </svg>
              <span>Relatório PDF</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="ml-auto">
                <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Linha 2: KPI cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Apontamentos · Hoje" valor={String(metricas.total)}
            spark={<Sparkline data={metricas.porHora} color="var(--brand-primary)" />}
            cor="var(--brand-primary)" />
          <KPICard label="Tempo Retrabalho" valor={String(metricas.tempoTotal)} unidade="min"
            spark={<Sparkline data={metricas.porHora.map((_, i) => i % 3 === 0 ? 8 : 3)} color="var(--brand-deep-2)" />}
            cor="var(--brand-deep-2)" />
          <KPICard label="Grupos com Ocorrência" valor={String(Object.keys(metricas.porGrupo).length)} unidade="grupos"
            spark={<Sparkline data={[1, 2, 2, 3, 3, 3, Object.keys(metricas.porGrupo).length]} color="var(--signal-green)" />}
            cor="var(--signal-green)" />
        </div>

        {/* ── Linha 3: Gráficos ───────────────────────────────────────────── */}
        <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>

          {/* Área: apontamentos por hora */}
          <div className="rounded-2xl p-5 flex flex-col"
            style={{ background: '#fff', border: '1px solid var(--line)' }}>
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ATIVIDADE EM TEMPO REAL</p>
                <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>Apontamentos por Hora</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: 'var(--brand-tecno)' }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>AO VIVO</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {carregandoDados
                ? <div className="h-40 flex items-center justify-center" style={{ color: 'var(--text-faint)', fontSize: 13 }}>Carregando…</div>
                : <AreaChartSVG data={metricas.porHora} labels={horaLabels} color="var(--brand-primary)" />
              }
            </div>
          </div>

          {/* Donut: distribuição por grupo */}
          <div className="rounded-2xl p-5 flex flex-col"
            style={{ background: '#fff', border: '1px solid var(--line)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>POR GRUPO</p>
            <p className="text-lg font-bold mb-4" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>Distribuição</p>
            <div className="flex flex-col items-center gap-4 flex-1 justify-center">
              <DonutChartSVG data={donutData.length ? donutData : [{ label: '—', value: 1, color: 'var(--line)' }]} />
              <div className="flex flex-col gap-1.5 w-full">
                {donutData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.color }} />
                    <span className="flex-1 truncate" style={{ color: 'var(--text-body)' }}>{d.label}</span>
                    <span className="font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feed: últimos apontamentos */}
          <div className="rounded-2xl flex flex-col overflow-hidden"
            style={{ background: '#fff', border: '1px solid var(--line)' }}>
            <div className="px-5 pt-5 pb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ÚLTIMOS APONTAMENTOS</p>
              <p className="text-lg font-bold" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>Recentes</p>
            </div>
            <div className="flex-1 overflow-auto px-2 pb-4">
              {metricas.ultimosApontamentos.length === 0
                ? <p className="text-center py-8 text-sm" style={{ color: 'var(--text-faint)' }}>Nenhum apontamento ainda</p>
                : metricas.ultimosApontamentos.map((a, i) => (
                  <div key={a.id ?? i} className="px-3 py-2.5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CORES_GRUPO[a.grupo] ?? 'var(--brand-primary)' }} />
                      <span className="font-bold text-sm" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>{a.grupo}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {a.tipo_desperdicio}</span>
                      <span className="text-[10px] font-semibold ml-auto" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-4 mt-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.nome_operador}</span>
                      {a.classificacao && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                          style={{
                            background: a.classificacao === 'perda' ? 'var(--signal-red-soft)' : 'var(--signal-amber-soft)',
                            color: a.classificacao === 'perda' ? 'var(--signal-red)' : 'var(--signal-amber)',
                            fontFamily: 'var(--font-mono)',
                          }}>
                          {a.classificacao}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* ── Linha do Tempo — apontamentos do dia desta OP ───────────────── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid var(--line)' }}>
          <div className="px-5 pt-5 pb-3 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>LINHA DO TEMPO · OP {opAtiva?.numero ?? ''}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>Apontamentos de Hoje</p>
            </div>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {dadosHoje.length} {dadosHoje.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>
          {dadosHoje.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: 'var(--text-faint)' }}>Nenhum apontamento ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-page)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
                    <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Hora</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Tipo</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Operadora</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dadosHoje]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((a, i) => {
                      const hora = new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      const qtd = a.quantidade_pecas != null
                        ? `${a.quantidade_pecas} pç`
                        : a.quantidade_ml != null
                          ? `${a.quantidade_ml} ml`
                          : '—'
                      const operadoraDisplay = (a.nome_operador || '').trim().replace(/\b\w/g, c => c.toUpperCase())
                      return (
                        <tr key={a.id ?? i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                          <td className="px-5 py-2.5 tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{hora}</td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CORES_GRUPO[a.grupo] ?? 'var(--brand-primary)' }} />
                              <span className="font-semibold" style={{ color: 'var(--text-strong)' }}>{a.tipo_desperdicio}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5" style={{ color: 'var(--text-body)' }}>{operadoraDisplay}</td>
                          <td className="px-5 py-2.5 text-right font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{qtd}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {erro && (
          <div className="rounded-xl p-4 text-sm"
            style={{ background: 'var(--signal-red-soft)', border: '1px solid #f5d2d1', color: 'var(--signal-red)' }}>
            ⚠ {erro}
          </div>
        )}
      </div>

      {/* ── Sheet: abrir nova OP ─────────────────────────────────────────── */}
      {abrindoNovaOp && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'var(--bg-page)', animation: 'slideUp 350ms cubic-bezier(0.2,0.8,0.2,1)' }}>
          <div className="flex items-center gap-4 px-6 py-4 shrink-0"
            style={{ background: '#fff', borderBottom: '1px solid var(--line)' }}>
            <button onClick={() => { setAbrindoNovaOp(false); setNovoNumeroOP(''); setNovaFibra(null); setNovoTamanhoOp('') }}
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-[0.97]"
              style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--text-body)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            </button>
            <span className="font-extrabold text-xl" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              Nova Ordem de Produção
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full flex flex-col gap-6">
            <TecladoNumerico label="Número da Ordem de Produção (OP)" valor={novoNumeroOP} onChange={setNovoNumeroOP}
              placeholder="ex: 000123456" maxLength={9} onEnter={() => { if (podeSalvarOp()) confirmarNovaOp() }} />
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-center" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
                Tipo de Fibra
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(['F272', 'F365'] as TipoFibra[]).map(f => (
                  <button key={f} type="button" onClick={() => setNovaFibra(f)}
                    className="py-5 rounded-xl font-bold text-lg transition-all active:scale-[0.97]"
                    style={{
                      background: novaFibra === f ? 'var(--brand-primary)' : '#fff',
                      color: novaFibra === f ? '#fff' : 'var(--text-strong)',
                      border: `2px solid ${novaFibra === f ? 'var(--brand-primary)' : 'var(--line)'}`,
                      fontFamily: 'var(--font-display)',
                      boxShadow: novaFibra === f ? '0 4px 14px rgba(86,164,187,0.3)' : 'none',
                    }}>
                    Fibra {f === 'F272' ? '272' : '365'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--line)' }} />
            <TecladoNumerico label="Tamanho da OP (total de peças)" valor={novoTamanhoOp} onChange={setNovoTamanhoOp}
              placeholder="ex: 5000" maxLength={7} onEnter={() => { if (podeSalvarOp()) confirmarNovaOp() }} />
            <button onClick={confirmarNovaOp} disabled={!podeSalvarOp()}
              className="font-bold text-xl py-5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40"
              style={{
                background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)',
                boxShadow: podeSalvarOp() ? '0 4px 14px rgba(86,164,187,0.3)' : 'none',
              }}>
              Iniciar Apontamentos →
            </button>
          </div>
        </div>
      )}

      {/* ── Sheet: formulário de apontamento ─────────────────────────────── */}
      {apontamentoOpen && opAtiva && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'var(--bg-page)', animation: 'slideUp 350ms cubic-bezier(0.2,0.8,0.2,1)' }}>
          {/* Header da sheet */}
          <div className="flex items-center gap-4 px-6 py-4 shrink-0"
            style={{ background: '#fff', borderBottom: '1px solid var(--line)' }}>
            <button onClick={() => { setApontamentoOpen(false); setFormKey(k => k + 1) }}
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-[0.97]"
              style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--text-body)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            </button>
            <div className="flex-1">
              <span className="font-extrabold text-xl" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                Novo Apontamento
              </span>
              <span className="ml-3 text-sm font-semibold" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                · OP {opAtiva?.numero} · FIBRA {opAtiva?.fibra === 'F272' ? '272' : '365'}
              </span>
            </div>
            <button onClick={() => { setApontamentoOpen(false); setFormKey(k => k + 1) }}
              className="h-10 px-4 rounded-xl flex items-center gap-2 font-semibold text-sm transition-all active:scale-[0.97]"
              style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              Cancelar
            </button>
          </div>

          {/* Conteúdo do formulário */}
          <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid var(--line)' }}>
              <FormularioApontamento
                key={formKey}
                op={opAtiva.numero}
                fibra={opAtiva.fibra}
                operador=""
                tamanho={opAtiva.tamanho}
                onSalvar={handleSalvar}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: exportação (xlsx / pdf) ───────────────────────────────── */}
      {modalExport && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(31,55,68,0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm flex flex-col gap-5 p-6 rounded-2xl"
            style={{ background: '#fff', boxShadow: '0 30px 80px -10px rgba(15,35,50,0.4)' }}>

            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: modalExport === 'xlsx' ? '#dcfce7' : '#fee2e2' }}>
                  {modalExport === 'xlsx'
                    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  }
                </div>
                <div>
                  <h2 className="text-lg font-extrabold" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                    {modalExport === 'xlsx' ? 'Exportar XLSX' : 'Relatório PDF'}
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {exportEtapa === 'auth' ? 'Autenticação necessária' : 'Informe o número da OP'}
                  </p>
                </div>
              </div>
              <button onClick={fecharModalExport} disabled={gerandoExport}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-page)', color: 'var(--text-muted)' }}>✕</button>
            </div>

            {/* Etapa: autenticação */}
            {exportEtapa === 'auth' && (
              <div className="flex flex-col gap-3">
                <CampoAuth label="Login" value={exportLogin} onChange={v => { setExportLogin(v); setExportErro(false) }} placeholder="qualidade" />
                <CampoAuth label="Senha" type="password" value={exportSenha} onChange={v => { setExportSenha(v); setExportErro(false) }} placeholder="••••••" />
                {exportErro && <p className="text-sm text-center font-semibold" style={{ color: 'var(--signal-red)' }}>Login ou senha incorretos</p>}
                {exportMensagem && <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>{exportMensagem}</p>}
                <button onClick={confirmarExport} disabled={gerandoExport}
                  className="w-full font-bold py-3.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 mt-1"
                  style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)' }}>
                  {gerandoExport ? 'Aguarde…' : 'Confirmar →'}
                </button>
              </div>
            )}

            {/* Etapa: número da OP (só PDF) */}
            {exportEtapa === 'op' && (
              <div className="flex flex-col gap-3">
                <TecladoNumerico
                  label="Número da OP para o relatório"
                  valor={opRelatorio}
                  onChange={v => { setOpRelatorio(v); setExportMensagem(null) }}
                  placeholder="ex: 26000369"
                  maxLength={9}
                  onEnter={gerarPDF}
                />
                {exportMensagem && <p className="text-sm text-center font-semibold" style={{ color: exportMensagem.startsWith('Nenhum') ? 'var(--signal-red)' : 'var(--text-muted)' }}>{exportMensagem}</p>}
                <button onClick={gerarPDF} disabled={gerandoExport || !opRelatorio.trim()}
                  className="w-full font-bold py-3.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50"
                  style={{ background: '#ef4444', color: '#fff', fontFamily: 'var(--font-display)' }}>
                  {gerandoExport ? 'Gerando PDF…' : 'Gerar Relatório PDF'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: autenticação finalizar/cancelar ───────────────────────── */}
      {modalFecharOp && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(31,55,68,0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm flex flex-col gap-5 p-6 rounded-2xl"
            style={{ background: '#fff', boxShadow: '0 30px 80px -10px rgba(15,35,50,0.4)' }}>
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-primary-soft)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary-dark)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  <circle cx="12" cy="16" r="1" fill="var(--brand-primary-dark)" stroke="none" />
                </svg>
              </div>
              <button onClick={fecharModal} disabled={processando}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm"
                style={{ background: 'var(--bg-page)', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>OP {modalFecharOp}</p>
              <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                Autenticação de Qualidade
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Para finalizar ou cancelar a OP, informe as credenciais.</p>
            </div>
            <div className="flex flex-col gap-3">
              <CampoAuth label="Login" value={authLogin} onChange={v => { setAuthLogin(v); setAuthErro(false) }} placeholder="qualidade" />
              <CampoAuth label="Senha" type="password" value={authSenha} onChange={v => { setAuthSenha(v); setAuthErro(false) }} placeholder="••••••" />
              {authErro && <p className="text-sm text-center font-semibold" style={{ color: 'var(--signal-red)' }}>Login ou senha incorretos</p>}
            </div>
            <div className="rounded-xl p-3 text-xs flex flex-col gap-1.5" style={{ background: 'var(--bg-page)', color: 'var(--text-body)' }}>
              <p><strong style={{ color: 'var(--brand-primary-dark)' }}>Finalizar OP</strong> — encerra a OP e mantém todos os dados registrados.</p>
              <p><strong style={{ color: 'var(--signal-red)' }}>Cancelar OP</strong> — remove a OP e <strong>apaga permanentemente</strong> todos os apontamentos.</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={finalizarOP} disabled={processando}
                className="w-full font-bold py-3.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4.5 4.5L19 7" /></svg>
                Finalizar OP
              </button>
              <button onClick={handleCancelarOP} disabled={processando}
                className="w-full font-bold py-3.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40"
                style={{ background: 'transparent', color: 'var(--signal-red)', border: '1px solid rgba(200,80,79,0.35)', fontFamily: 'var(--font-display)' }}>
                {processando ? 'Cancelando…' : 'Cancelar OP (apagar dados)'}
              </button>
              <button onClick={fecharModal} disabled={processando}
                className="w-full font-semibold py-3 rounded-xl transition-all active:scale-[0.97]"
                style={{ background: '#fff', color: 'var(--text-body)', border: '1px solid var(--line)', fontFamily: 'var(--font-display)' }}>
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componentes locais ───────────────────────────────────────────────────────

function MetricaMini({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-widest mb-1"
        style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
      <div className="font-bold" style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: cor ?? '#fff', letterSpacing: '-0.01em' }}>
        {valor}
      </div>
    </div>
  )
}

function KPICard({ label, valor, unidade, spark, cor }: {
  label: string; valor: string; unidade?: string; spark?: React.ReactNode; cor: string
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1 relative overflow-hidden"
      style={{ background: '#fff', border: '1px solid var(--line)' }}>
      <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: cor }} />
      <p className="text-[9.5px] font-bold uppercase tracking-widest pl-1"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="font-bold" style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--text-strong)', letterSpacing: '-0.025em', lineHeight: 1 }}>
          {valor}
        </span>
        {unidade && <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{unidade}</span>}
      </div>
      {spark && <div className="mt-2 opacity-85">{spark}</div>}
    </div>
  )
}

function CampoAuth({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold" style={{ color: 'var(--text-body)', fontFamily: 'var(--font-display)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full h-12 px-3.5 rounded-xl text-base outline-none"
        style={{
          background: '#fff', color: 'var(--text-strong)', fontFamily: 'var(--font-body)',
          border: focused ? '2px solid var(--brand-primary)' : '1.5px solid var(--line)',
          transition: 'border-color 150ms ease',
        }}
      />
    </div>
  )
}
