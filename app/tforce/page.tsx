'use client'

import { useState, useEffect, useMemo } from 'react'
import FormularioApontamentoTForce from '@/components/FormularioApontamentoTForce'
import { salvarApontamento, cancelarOP, abrirOP, fecharOP } from '../actions'
import type { NovoApontamento, Apontamento } from '@/lib/types'
import Navegacao from '@/components/Navegacao'
import TecladoNumerico from '@/components/TecladoNumerico'
import { supabase } from '@/lib/supabase'
import { buscarPI } from '@/lib/tforce'

interface OP { numero: string; tamanho?: number }

const LINHA = 'tforce' as const

export default function TForcePage() {
  const [ops, setOps] = useState<OP[]>([])
  const [opAtiva, setOpAtiva] = useState<OP | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [abrindoNovaOp, setAbrindoNovaOp] = useState(false)
  const [novoNumeroOP, setNovoNumeroOP] = useState('')
  const [novoAnoOP, setNovoAnoOP] = useState(() => String(new Date().getFullYear()).slice(-2))
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

  const [dadosOP, setDadosOP] = useState<Apontamento[]>([])

  // ── Carrega OPs abertas da T-Force + realtime ─────────────────────────────
  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from('ops_abertas').select('*')
        .eq('linha', LINHA)
        .order('criada_em', { ascending: true })
      setOps((data ?? []).map(d => ({ numero: d.numero, tamanho: d.tamanho ?? undefined })))
      setCarregando(false)
    }
    carregar()

    const channel = supabase.channel('ops_abertas_tforce')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_abertas' }, payload => {
        if ((payload.new.linha ?? 'fibra') !== LINHA) return
        const nova: OP = { numero: payload.new.numero, tamanho: payload.new.tamanho ?? undefined }
        setOps(prev => prev.some(o => o.numero === nova.numero) ? prev : [...prev, nova])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ops_abertas' }, payload => {
        const removida = payload.old.numero as string
        setOps(prev => prev.filter(o => o.numero !== removida))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (ops.length === 0) { setOpAtiva(null); return }
    setOpAtiva(curr => (curr && ops.some(o => o.numero === curr.numero)) ? curr : ops[0])
  }, [ops])

  // ── Apontamentos da OP ativa ──────────────────────────────────────────────
  useEffect(() => {
    if (!opAtiva) { setDadosOP([]); return }
    supabase.from('apontamentos').select('*')
      .eq('linha', LINHA)
      .eq('numero_op', opAtiva.numero)
      .then(({ data }) => setDadosOP(data ?? []))
  }, [opAtiva])

  const metricas = useMemo(() => {
    const hojeStr = new Date().toDateString()
    const hoje = dadosOP.filter(a => new Date(a.created_at).toDateString() === hojeStr)
    const retrabalhos = dadosOP.reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)
    const perdas = dadosOP.reduce((s, a) => s + (a.quantidade_ml ?? 0), 0)
    return { hoje: hoje.length, total: dadosOP.length, retrabalhos, perdas }
  }, [dadosOP])

  // ── Ações de OP ───────────────────────────────────────────────────────────
  function montarNumeroOP() { return novoAnoOP + novoNumeroOP.padStart(6, '0') }
  function podeSalvarOp() { return novoAnoOP.length === 2 && novoNumeroOP.trim().length > 0 && parseInt(novoTamanhoOp || '0') > 0 }
  function ajustarAno(delta: number) {
    const n = parseInt(novoAnoOP || '0') + delta
    if (n < 0 || n > 99) return
    setNovoAnoOP(String(n).padStart(2, '0'))
  }
  function resetarFormOP() {
    setNovoNumeroOP('')
    setNovoAnoOP(String(new Date().getFullYear()).slice(-2))
    setNovoTamanhoOp('')
  }

  async function confirmarNovaOp() {
    if (!podeSalvarOp()) return
    setErro(null)
    const nova: OP = { numero: montarNumeroOP(), tamanho: parseInt(novoTamanhoOp) || undefined }
    const r = await abrirOP({ numero: nova.numero, fibra: null, tamanho: nova.tamanho, linha: LINHA })
      .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'Erro de rede' }))
    if (!r.ok) { setErro(`Erro ao abrir OP: ${r.error}`); return }
    setOps(prev => prev.some(o => o.numero === nova.numero) ? prev : [...prev, nova])
    setOpAtiva(nova)
    resetarFormOP(); setAbrindoNovaOp(false); setFormKey(k => k + 1)
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
    if (r.ok) removerOpLocal(numero); else setErro(`Erro ao fechar OP: ${r.error}`)
    setProcessando(false)
  }

  async function handleCancelarOP() {
    if (!verificarCredenciais()) return
    const numero = modalFecharOp!
    setProcessando(true)
    const r = await cancelarOP(numero).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'Erro de rede' }))
    if (r.ok) removerOpLocal(numero); else setErro(`Erro ao cancelar OP: ${r.error}`)
    setProcessando(false)
  }

  function fecharModal() { setModalFecharOp(null); setAuthErro(false); setAuthSenha(''); setAuthLogin('') }

  // ── Salvar apontamento ────────────────────────────────────────────────────
  async function handleSalvar(dados: NovoApontamento): Promise<boolean> {
    setErro(null)
    const resultado = await salvarApontamento(dados).catch((e: unknown) => ({
      ok: false as const, error: e instanceof Error ? e.message : 'Erro de rede',
    }))
    if (!resultado.ok) {
      const detalhe = 'detail' in resultado && resultado.detail ? ` (${resultado.detail})` : ''
      setErro(`Erro ao salvar: ${resultado.error}${detalhe}`)
      console.error('[tforce/handleSalvar] Falha no INSERT:', resultado)
      return false
    }
    try {
      setApontamentoOpen(false)
      setFormKey(k => k + 1)
      if (opAtiva) {
        const { data } = await supabase.from('apontamentos').select('*')
          .eq('linha', LINHA).eq('numero_op', opAtiva.numero)
        setDadosOP(data ?? [])
      }
    } catch (e) {
      console.warn('[tforce/handleSalvar] Pos-salvamento falhou (UI), mas o apontamento foi salvo:', e)
    }
    return true
  }

  if (carregando) return <div className="min-h-screen" style={{ background: 'var(--bg-page)' }} />

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-page)' }}>
      <Navegacao linha="tforce" onReset={() => { setErro(null); setApontamentoOpen(false) }} />

      <div className="flex-1 overflow-auto p-5 flex flex-col gap-4 max-w-5xl mx-auto w-full">

        {/* ── Card da OP ativa ───────────────────────────────────────────── */}
        <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid var(--line)' }}>
          {opAtiva === null ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <p className="text-base font-semibold text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                Nenhuma Ordem de Produção aberta
              </p>
              <button
                onClick={() => setAbrindoNovaOp(true)}
                className="font-bold text-lg px-8 py-4 rounded-xl transition-all active:scale-[0.97]"
                style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)', boxShadow: '0 4px 14px rgba(86,164,187,0.3)' }}
              >
                Abrir Ordem de Produção
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  ORDEM DE PRODUÇÃO ATIVA · T-FORCE
                </p>
                <p className="text-3xl font-black tabular-nums leading-tight" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>
                  {opAtiva.numero}
                </p>
                {opAtiva.tamanho != null && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Tamanho da OP: {opAtiva.tamanho.toLocaleString('pt-BR')} pç
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setApontamentoOpen(true)}
                  className="font-bold text-base px-6 py-3.5 rounded-xl transition-all active:scale-[0.97]"
                  style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)', boxShadow: '0 4px 14px rgba(86,164,187,0.3)' }}
                >
                  + Novo Apontamento
                </button>
                <button
                  onClick={() => { setModalFecharOp(opAtiva.numero); setAuthLogin(''); setAuthSenha(''); setAuthErro(false) }}
                  className="font-semibold text-sm px-4 py-3.5 rounded-xl transition-all active:scale-[0.97]"
                  style={{ background: '#fff', color: 'var(--text-body)', border: '1px solid var(--line)', fontFamily: 'var(--font-display)' }}
                >
                  Finalizar OP
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Outras OPs + abrir nova ────────────────────────────────────── */}
        {opAtiva !== null && (
          <div className="rounded-2xl p-4 flex flex-wrap items-center gap-2" style={{ background: '#fff', border: '1px solid var(--line)' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest mr-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              OPs abertas:
            </span>
            {ops.map(o => (
              <button
                key={o.numero}
                onClick={() => setOpAtiva(o)}
                className="text-xs font-bold tabular-nums px-3 py-1.5 rounded-full transition-all active:scale-[0.96]"
                style={{
                  background: o.numero === opAtiva.numero ? 'var(--brand-primary)' : '#fff',
                  color: o.numero === opAtiva.numero ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${o.numero === opAtiva.numero ? 'var(--brand-primary)' : 'var(--line)'}`,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {o.numero}
              </button>
            ))}
            <button
              onClick={() => setAbrindoNovaOp(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-[0.96] ml-auto"
              style={{ background: '#fff', color: 'var(--brand-primary-dark)', border: '1px dashed var(--brand-primary)', fontFamily: 'var(--font-display)' }}
            >
              + Abrir Nova OP
            </button>
          </div>
        )}

        {/* ── KPIs ────────────────────────────────────────────────────────── */}
        {opAtiva !== null && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Apontamentos · Hoje" valor={String(metricas.hoje)} cor="var(--brand-primary)" />
            <KPI label="Apontamentos · OP" valor={String(metricas.total)} cor="var(--brand-deep-2)" />
            <KPI label="Retrabalhos" valor={String(metricas.retrabalhos)} unidade="pç" cor="var(--signal-amber)" />
            <KPI label="Peças Perdidas" valor={String(metricas.perdas)} unidade="pç" cor="var(--signal-red)" />
          </div>
        )}

        {/* ── Linha do tempo ──────────────────────────────────────────────── */}
        {opAtiva !== null && (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid var(--line)' }}>
            <div className="px-5 pt-5 pb-3 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  LINHA DO TEMPO · OP {opAtiva.numero}
                </p>
                <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                  Apontamentos da OP
                </p>
              </div>
              <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {dadosOP.length} {dadosOP.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            {dadosOP.length === 0 ? (
              <p className="text-center py-10 text-sm" style={{ color: 'var(--text-faint)' }}>Nenhum apontamento ainda</p>
            ) : (
              <div className="overflow-auto" style={{ maxHeight: 420 }}>
                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead className="sticky top-0 z-10">
                    <tr style={{ background: 'var(--bg-page)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
                      <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Data/Hora</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PI</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Operação · Modo</th>
                      <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dadosOP]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((a, i) => {
                        const dt = new Date(a.created_at)
                        const dataFmt = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                        const horaFmt = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        const pi = buscarPI(a.grupo)
                        return (
                          <tr key={a.id ?? i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                            <td className="px-5 py-2.5 tabular-nums whitespace-nowrap" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {dataFmt} <span style={{ color: 'var(--text-strong)' }}>{horaFmt}</span>
                            </td>
                            <td className="px-3 py-2.5 font-bold tabular-nums whitespace-nowrap" style={{ color: 'var(--brand-primary-dark)', fontFamily: 'var(--font-mono)' }}>
                              {pi?.curto ?? a.grupo}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="font-semibold" style={{ color: 'var(--text-strong)' }}>{a.tipo_desperdicio}</span>
                              {a.modo_falha && <span style={{ color: 'var(--text-muted)' }}> · {a.modo_falha}</span>}
                              {a.observacao && (
                                <span className="block text-xs mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>
                                  &ldquo;{a.observacao}&rdquo;
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-2.5 text-right whitespace-nowrap font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                              {a.quantidade_pecas != null && a.quantidade_pecas > 0 && (
                                <span style={{ color: 'var(--signal-amber)' }}>
                                  {a.quantidade_pecas} <span className="text-[10px] uppercase">retr</span>
                                </span>
                              )}
                              {a.quantidade_pecas != null && a.quantidade_pecas > 0 && a.quantidade_ml != null && a.quantidade_ml > 0 && (
                                <span style={{ color: 'var(--text-faint)' }}> · </span>
                              )}
                              {a.quantidade_ml != null && a.quantidade_ml > 0 && (
                                <span style={{ color: 'var(--signal-red)' }}>
                                  {a.quantidade_ml} <span className="text-[10px] uppercase">perd</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {erro && (
          <div className="rounded-xl p-4 text-sm" style={{ background: 'var(--signal-red-soft)', border: '1px solid #f5d2d1', color: 'var(--signal-red)' }}>
            ⚠ {erro}
          </div>
        )}
      </div>

      {/* ── Sheet: abrir nova OP ────────────────────────────────────────────── */}
      {abrindoNovaOp && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'var(--bg-page)', animation: 'slideUp 350ms cubic-bezier(0.2,0.8,0.2,1)' }}>
          <div className="flex items-center gap-4 px-6 py-4 shrink-0" style={{ background: '#fff', borderBottom: '1px solid var(--line)' }}>
            <button
              onClick={() => { setAbrindoNovaOp(false); resetarFormOP() }}
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-[0.97]"
              style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--text-body)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            </button>
            <span className="font-extrabold text-xl" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              Nova OP · T-Force
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full flex flex-col gap-6">
            {/* Erro precisa aparecer AQUI dentro — o banner da página fica atrás deste overlay */}
            {erro && (
              <div className="rounded-xl p-4 text-sm" style={{ background: 'var(--signal-red-soft)', border: '1px solid #f5d2d1', color: 'var(--signal-red)' }}>
                ⚠ {erro}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-center" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
                Número da Ordem de Produção
              </p>
              <div className="w-full rounded-xl flex flex-col items-center gap-1 py-4" style={{ background: 'var(--brand-primary-tint)', border: '2px solid var(--brand-primary)' }}>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--brand-primary-dark)', fontFamily: 'var(--font-mono)' }}>
                  OP que será aberta
                </span>
                <div className="flex items-baseline">
                  <span className="text-4xl font-black tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary-dark)' }}>{novoAnoOP}</span>
                  <span className="text-4xl font-black tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: novoNumeroOP ? 'var(--text-strong)' : 'var(--text-faint)' }}>
                    {novoNumeroOP.padStart(6, '0')}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Ano</span>
                <button type="button" onClick={() => ajustarAno(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg transition-all active:scale-[0.94]" style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--text-body)' }}>−</button>
                <span className="text-base font-bold tabular-nums w-7 text-center" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{novoAnoOP}</span>
                <button type="button" onClick={() => ajustarAno(1)} className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg transition-all active:scale-[0.94]" style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--text-body)' }}>+</button>
              </div>
              <TecladoNumerico
                label="Digite os 6 dígitos finais"
                valor={novoNumeroOP}
                onChange={setNovoNumeroOP}
                placeholder="ex: 000801"
                maxLength={6}
                onEnter={() => { if (podeSalvarOp()) confirmarNovaOp() }}
              />
            </div>

            <div style={{ height: 1, background: 'var(--line)' }} />

            <TecladoNumerico
              label="Tamanho da OP (total de peças)"
              valor={novoTamanhoOp}
              onChange={setNovoTamanhoOp}
              placeholder="ex: 500"
              maxLength={7}
              onEnter={() => { if (podeSalvarOp()) confirmarNovaOp() }}
            />

            <button
              onClick={confirmarNovaOp}
              disabled={!podeSalvarOp()}
              className="font-bold text-xl py-5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40"
              style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)', boxShadow: podeSalvarOp() ? '0 4px 14px rgba(86,164,187,0.3)' : 'none' }}
            >
              Iniciar Apontamentos →
            </button>
          </div>
        </div>
      )}

      {/* ── Sheet: formulário de apontamento ────────────────────────────────── */}
      {apontamentoOpen && opAtiva && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'var(--bg-page)', animation: 'slideUp 350ms cubic-bezier(0.2,0.8,0.2,1)' }}>
          <div className="flex items-center gap-4 px-6 py-4 shrink-0" style={{ background: '#fff', borderBottom: '1px solid var(--line)' }}>
            <button
              onClick={() => { setApontamentoOpen(false); setFormKey(k => k + 1) }}
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-[0.97]"
              style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--text-body)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            </button>
            <div className="flex-1">
              <span className="font-extrabold text-xl" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                Novo Apontamento
              </span>
              <span className="block text-xs font-semibold tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                T-FORCE · OP {opAtiva.numero}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 max-w-lg mx-auto w-full">
            <FormularioApontamentoTForce
              key={formKey}
              op={opAtiva.numero}
              tamanho={opAtiva.tamanho}
              onSalvar={handleSalvar}
            />
          </div>
        </div>
      )}

      {/* ── Modal: finalizar/cancelar OP ────────────────────────────────────── */}
      {modalFecharOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: 'rgba(31,55,68,0.45)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: '#fff' }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                OP {modalFecharOp}
              </p>
              <h3 className="text-xl font-extrabold" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
                Encerrar Ordem de Produção
              </h3>
            </div>

            <div className="text-xs flex flex-col gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <p><strong style={{ color: 'var(--brand-primary-dark)' }}>Finalizar OP</strong> — remove da lista, mantém todos os apontamentos.</p>
              <p><strong style={{ color: 'var(--signal-red)' }}>Cancelar OP</strong> — remove a OP e <strong>apaga permanentemente</strong> todos os apontamentos.</p>
            </div>

            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={authLogin}
                onChange={e => { setAuthLogin(e.target.value); setAuthErro(false) }}
                placeholder="Login"
                autoComplete="off"
                className="w-full rounded-xl px-4 py-3 text-base"
                style={{ background: '#fff', border: `2px solid ${authErro ? 'var(--signal-red)' : 'var(--line)'}`, color: 'var(--text-strong)' }}
              />
              <input
                type="password"
                value={authSenha}
                onChange={e => { setAuthSenha(e.target.value); setAuthErro(false) }}
                placeholder="Senha"
                autoComplete="off"
                className="w-full rounded-xl px-4 py-3 text-base"
                style={{ background: '#fff', border: `2px solid ${authErro ? 'var(--signal-red)' : 'var(--line)'}`, color: 'var(--text-strong)' }}
              />
              {authErro && <p className="text-xs font-semibold" style={{ color: 'var(--signal-red)' }}>Credenciais inválidas</p>}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={finalizarOP}
                disabled={processando}
                className="w-full font-bold py-3.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40"
                style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)' }}
              >
                Finalizar OP
              </button>
              <button
                onClick={handleCancelarOP}
                disabled={processando}
                className="w-full font-bold py-3.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40"
                style={{ background: '#fff', color: 'var(--signal-red)', border: '1px solid var(--signal-red)', fontFamily: 'var(--font-display)' }}
              >
                Cancelar OP (apaga tudo)
              </button>
              <button
                onClick={fecharModal}
                className="w-full font-semibold py-3 rounded-xl transition-all active:scale-[0.97]"
                style={{ background: '#fff', color: 'var(--text-muted)', border: '1px solid var(--line)', fontFamily: 'var(--font-display)' }}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({ label, valor, unidade, cor }: { label: string; valor: string; unidade?: string; cor: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid var(--line)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </p>
      <p className="text-3xl font-black leading-tight mt-1" style={{ color: cor, fontFamily: 'var(--font-display)' }}>
        {valor}
        {unidade && <span className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>{unidade}</span>}
      </p>
    </div>
  )
}
