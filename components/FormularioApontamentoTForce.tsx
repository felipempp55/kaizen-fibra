'use client'

import { useState } from 'react'

import { PIS_TFORCE, rotuloPI, OPERADOR_NAO_INFORMADO, type PITForce, type OperacaoTForce } from '@/lib/tforce'
import type { NovoApontamento } from '@/lib/types'
import EtapaIndicador from './EtapaIndicador'

type TipoEtapa = 'falha' | 'quantidade' | 'confirmar'

const LABELS_ETAPA: Record<TipoEtapa, string> = {
  falha: 'Onde',
  quantidade: 'Quantidade',
  confirmar: 'Confirmar',
}

const SEQUENCIA: TipoEtapa[] = ['falha', 'quantidade', 'confirmar']

interface Selecao {
  pi: PITForce
  operacao: OperacaoTForce
  modo: string | null
}

interface Props {
  op: string
  tamanho?: number
  onSalvar: (dados: NovoApontamento) => Promise<boolean | void>
}

export default function FormularioApontamentoTForce({ op, tamanho, onSalvar }: Props) {
  const [etapa, setEtapa] = useState(0)
  const [piAberto, setPiAberto] = useState<string | null>(null)
  const [selecao, setSelecao] = useState<Selecao | null>(null)
  const [retrabalhos, setRetrabalhos] = useState('')
  const [perdas, setPerdas] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const etapaAtual = SEQUENCIA[etapa]
  const labels = SEQUENCIA.map(s => LABELS_ETAPA[s])

  function avancar() { setEtapa(e => Math.min(e + 1, SEQUENCIA.length - 1)) }
  function voltar()  { setEtapa(e => Math.max(e - 1, 0)) }

  function resetar() {
    setEtapa(0)
    setPiAberto(null)
    setSelecao(null)
    setRetrabalhos('')
    setPerdas('')
    setObservacao('')
    setSucesso(false)
  }

  function escolher(pi: PITForce, operacao: OperacaoTForce, modo: string | null) {
    setSelecao({ pi, operacao, modo })
    setRetrabalhos('')
    setPerdas('')
    avancar()
  }

  function podeContinuar(): boolean {
    switch (etapaAtual) {
      case 'falha': return !!selecao
      // Basta um dos contadores ter valor (permite só perda, ou só retrabalho)
      case 'quantidade': return parseInt(retrabalhos || '0') > 0 || parseInt(perdas || '0') > 0
      default: return true
    }
  }

  async function confirmar() {
    if (!selecao) return
    setSalvando(true)
    try {
      const toIntOuNull = (s: string): number | null => {
        if (!s || s.trim() === '') return null
        const n = parseInt(s, 10)
        return Number.isFinite(n) && n > 0 ? n : null
      }
      const qRetrabalhos = toIntOuNull(retrabalhos)
      const qPerdas = toIntOuNull(perdas)
      if (qRetrabalhos === null && qPerdas === null) { setSalvando(false); return }

      const obsTrim = observacao.trim()
      const ok = await onSalvar({
        grupo: selecao.pi.codigo,               // PI (nível 1)
        tipo_desperdicio: selecao.operacao.nome, // Operação (nível 2)
        modo_falha: selecao.modo,                // Modo de falha (nível 3)
        nome_operador: OPERADOR_NAO_INFORMADO,   // etapa de operadora ainda não habilitada
        numero_op: op.toUpperCase(),
        fibra: null,                             // campo exclusivo da linha fibra
        quantidade_pecas: qRetrabalhos,          // 1º campo = retrabalhos
        quantidade_ml: qPerdas,                  // 2º campo = perdas
        classificacao: null,
        tempo_minutos: null,
        observacao: obsTrim !== '' ? obsTrim : null,
        tamanho_op: tamanho ?? null,
        materiais_perdidos: null,                // custo fora da Fase 1
        linha: 'tforce',
      })
      if (ok !== false) setSucesso(true)
    } catch (e) {
      console.error('[FormularioApontamentoTForce.confirmar]', e)
    } finally {
      setSalvando(false)
    }
  }

  // ─── Tela de sucesso ────────────────────────────────────────────────────────
  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-10">
        <svg width="108" height="108" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="60" fill="var(--signal-green-soft)" />
          <circle cx="64" cy="64" r="60" fill="none" stroke="var(--signal-green)" strokeWidth="2" opacity="0.3" />
          <circle cx="64" cy="64" r="40" fill="var(--signal-green)" />
          <path d="M48 64 L60 76 L82 54" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div className="text-center">
          <h2 className="text-3xl font-extrabold" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            Apontamento Salvo
          </h2>
          <p className="mt-2 text-sm font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {selecao?.pi.curto} · {selecao?.operacao.nome} · OP {op}
          </p>
        </div>

        <button
          onClick={resetar}
          className="mt-2 font-bold text-lg px-8 py-4 rounded-xl transition-all active:scale-[0.97]"
          style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)', boxShadow: '0 4px 14px rgba(86,164,187,0.3)' }}
        >
          + Novo Apontamento
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <EtapaIndicador etapaAtual={etapa} totalEtapas={SEQUENCIA.length} labels={labels} />

      {/* ── ETAPA 1: PI → Operação → Modo (sanfona) ─────────────────────── */}
      {etapaAtual === 'falha' && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}>
            ETAPA 1 — Onde foi o problema?
          </p>

          <div className="flex flex-col gap-2">
            {PIS_TFORCE.map(pi => {
              const aberto = piAberto === pi.codigo
              return (
                <div key={pi.codigo} className="rounded-xl overflow-hidden" style={{ border: `2px solid ${aberto ? 'var(--brand-primary)' : 'var(--line)'}` }}>
                  {/* Cabeçalho do PI */}
                  <button
                    type="button"
                    onClick={() => setPiAberto(aberto ? null : pi.codigo)}
                    className="w-full px-4 py-4 flex items-center gap-3 text-left transition-all active:scale-[0.99]"
                    style={{
                      background: aberto ? 'var(--brand-primary-tint)' : '#fff',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    <span
                      className="text-sm font-black tabular-nums shrink-0 px-2 py-1 rounded"
                      style={{
                        background: aberto ? 'var(--brand-primary)' : 'var(--brand-primary-soft)',
                        color: aberto ? '#fff' : 'var(--brand-primary-dark)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {pi.curto}
                    </span>
                    <span className="flex-1 font-bold text-sm leading-tight" style={{ color: 'var(--text-strong)' }}>
                      {pi.descricao}
                    </span>
                    <svg
                      width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke={aberto ? 'var(--brand-primary)' : 'var(--text-faint)'}
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {/* Operações + modos */}
                  {aberto && (
                    <div className="px-4 py-3 flex flex-col gap-3" style={{ background: 'var(--bg-page)', borderTop: '1px solid var(--line)' }}>
                      {pi.operacoes.map(operacao => (
                        <div key={operacao.nome} className="flex flex-col gap-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {operacao.nome}
                            {operacao.somentePerda && (
                              <span className="ml-1.5 normal-case font-semibold" style={{ color: 'var(--signal-red)' }}>· só perda</span>
                            )}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {operacao.modos.length === 0 ? (
                              <button
                                type="button"
                                onClick={() => escolher(pi, operacao, null)}
                                className="text-sm font-semibold px-3.5 py-2.5 rounded-lg transition-all active:scale-[0.96]"
                                style={{ background: '#fff', color: 'var(--text-strong)', border: '1.5px solid var(--line-strong)', fontFamily: 'var(--font-display)' }}
                              >
                                Registrar
                              </button>
                            ) : operacao.modos.map(modo => (
                              <button
                                key={modo}
                                type="button"
                                onClick={() => escolher(pi, operacao, modo)}
                                className="text-sm font-semibold px-3.5 py-2.5 rounded-lg transition-all active:scale-[0.96]"
                                style={{ background: '#fff', color: 'var(--text-strong)', border: '1.5px solid var(--line-strong)', fontFamily: 'var(--font-display)' }}
                              >
                                {modo}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ETAPA 2: quantidade + observação ────────────────────────────── */}
      {etapaAtual === 'quantidade' && selecao && (
        <div className="flex flex-col gap-5">
          {/* Resumo do que foi selecionado */}
          <div className="rounded-xl px-4 py-3" style={{ background: 'var(--brand-primary-tint)', border: '1px solid var(--brand-soft)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--brand-primary-dark)', fontFamily: 'var(--font-mono)' }}>
              {selecao.pi.curto} · {selecao.operacao.nome}
            </p>
            {selecao.modo && (
              <p className="text-base font-bold mt-0.5" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
                {selecao.modo}
              </p>
            )}
          </div>

          {!selecao.operacao.somentePerda && (
            <>
              <Contador label="Retrabalhos" valor={retrabalhos} setValor={setRetrabalhos} cor="var(--signal-amber)" />
              <div className="border-t" style={{ borderColor: 'var(--line)' }} />
            </>
          )}

          <Contador label="Peças perdidas" valor={perdas} setValor={setPerdas} cor="var(--signal-red)" />

          <div className="border-t" style={{ borderColor: 'var(--line)' }} />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-center" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
              Observação
            </label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Descreva o que aconteceu… (opcional)"
              rows={3}
              maxLength={500}
              className="w-full rounded-xl px-4 py-3 text-base resize-none"
              style={{ background: '#fff', border: '2px solid var(--line)', color: 'var(--text-strong)', fontFamily: 'var(--font-body)' }}
            />
          </div>
        </div>
      )}

      {/* ── ETAPA 3: confirmar ──────────────────────────────────────────── */}
      {etapaAtual === 'confirmar' && selecao && (
        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-extrabold text-center" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            Confirmar apontamento
          </h3>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--line)' }}>
            <div className="px-5 py-3" style={{ background: 'var(--brand-primary-tint)', borderBottom: '1px solid var(--line)' }}>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                style={{ background: 'var(--brand-primary-soft)', color: 'var(--brand-primary-dark)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
              >
                OP {op}
              </span>
            </div>
            <div className="px-5 py-1" style={{ background: '#fff' }}>
              <Linha label="PI" valor={rotuloPI(selecao.pi)} />
              <Linha label="Operação" valor={selecao.operacao.nome} />
              {selecao.modo && <Linha label="Modo de falha" valor={selecao.modo} />}
              {!selecao.operacao.somentePerda && <Linha label="Retrabalhos" valor={retrabalhos || '0'} mono />}
              <Linha label="Peças perdidas" valor={perdas || '0'} mono />
              {observacao.trim() !== '' && <Linha label="Observação" valor={observacao.trim()} />}
              <Linha label="Horário" valor={new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} mono last />
            </div>
          </div>

          <button
            onClick={confirmar}
            disabled={salvando}
            className="font-bold text-xl py-5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 mt-1 flex items-center justify-center gap-2"
            style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)', boxShadow: '0 4px 14px rgba(86,164,187,0.3)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l4.5 4.5L19 7" />
            </svg>
            {salvando ? 'Salvando…' : 'Salvar Apontamento'}
          </button>
        </div>
      )}

      {/* ── Navegação ───────────────────────────────────────────────────── */}
      <div className="flex gap-3 mt-2">
        {etapa > 0 && <BtnNav label="← Voltar" onClick={voltar} variante="secundario" />}
        {etapaAtual === 'quantidade' && (
          <BtnNav label="Continuar →" onClick={avancar} variante="primario" disabled={!podeContinuar()} />
        )}
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Contador({ label, valor, setValor, cor }: { label: string; valor: string; setValor: (v: string) => void; cor: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-semibold text-center" style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>
        {label}
      </p>
      <div className="w-full py-4 flex items-center justify-center rounded-xl" style={{ background: 'var(--bg-page)', border: '2px solid var(--line)' }}>
        <span className="text-6xl font-black tabular-nums w-24 text-center" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>
          {valor === '' ? '0' : valor}
        </span>
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={() => { const a = parseInt(valor || '0'); if (a > 0) setValor(a > 1 ? String(a - 1) : '') }}
          className="font-bold text-xl px-5 py-4 rounded-xl transition-all active:scale-[0.97]"
          style={{ background: '#fff', color: 'var(--text-muted)', border: '1px solid var(--line)', fontFamily: 'var(--font-display)' }}
        >
          −1
        </button>
        <button
          onClick={() => { const a = parseInt(valor || '0'); if (a < 9999) setValor(String(a + 1)) }}
          className="flex-1 font-black text-4xl py-4 rounded-xl transition-all active:scale-[0.97] shadow-md select-none"
          style={{ background: cor, color: '#fff', fontFamily: 'var(--font-display)' }}
        >
          +1
        </button>
      </div>
    </div>
  )
}

function BtnNav({ label, onClick, variante, disabled }: { label: string; onClick: () => void; variante: 'primario' | 'secundario'; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 font-bold text-base py-4 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40"
      style={{
        background: variante === 'primario' ? 'var(--brand-primary)' : '#fff',
        color: variante === 'primario' ? '#fff' : 'var(--text-body)',
        border: variante === 'primario' ? 'none' : '1px solid var(--line)',
        fontFamily: 'var(--font-display)',
        boxShadow: variante === 'primario' ? '0 2px 8px rgba(86,164,187,0.25)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

function Linha({ label, valor, mono, last }: { label: string; valor: string; mono?: boolean; last?: boolean }) {
  return (
    <div className="flex justify-between items-center py-3 gap-4" style={{ borderBottom: last ? 'none' : '1px solid var(--line-soft)' }}>
      <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{label}</span>
      <span className="font-bold text-sm text-right" style={{ color: 'var(--text-strong)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)' }}>
        {valor || '—'}
      </span>
    </div>
  )
}
