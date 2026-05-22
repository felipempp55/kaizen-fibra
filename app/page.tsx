'use client'

import { useState, useEffect, useRef } from 'react'
import FormularioApontamento from '@/components/FormularioApontamento'
import { salvarApontamento, cancelarOP } from './actions'
import type { NovoApontamento, TipoFibra } from '@/lib/types'
import Navegacao from '@/components/Navegacao'
import TecladoNumerico from '@/components/TecladoNumerico'

const STORAGE_KEY = 'kaizen-ops-abertas'

interface OP {
  numero: string
  fibra: TipoFibra
}

function carregarDoStorage(): { ops: OP[]; opAtiva: OP | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ops: [], opAtiva: null }
    const parsed = JSON.parse(raw)
    const ops: OP[] = (Array.isArray(parsed?.ops) ? parsed.ops : [])
      .filter((o: unknown) =>
        o !== null &&
        typeof o === 'object' &&
        typeof (o as Record<string, unknown>).numero === 'string' &&
        ((o as Record<string, unknown>).fibra === 'F272' || (o as Record<string, unknown>).fibra === 'F365')
      )
    if (ops.length === 0) return { ops: [], opAtiva: null }
    const savedAtiva: OP | null = parsed?.opAtiva ?? null
    const opAtiva = savedAtiva && ops.some(o => o.numero === savedAtiva.numero)
      ? savedAtiva
      : ops[0]
    return { ops, opAtiva }
  } catch {
    return { ops: [], opAtiva: null }
  }
}

export default function Home() {
  const [ops, setOps] = useState<OP[]>([])
  const [opAtiva, setOpAtiva] = useState<OP | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [abrindoNovaOp, setAbrindoNovaOp] = useState(false)
  const [novoNumeroOP, setNovoNumeroOP] = useState('')
  const [novaFibra, setNovaFibra] = useState<TipoFibra | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  const [modalFecharOp, setModalFecharOp] = useState<string | null>(null)
  const [authLogin, setAuthLogin] = useState('')
  const [authSenha, setAuthSenha] = useState('')
  const [authErro, setAuthErro] = useState(false)
  const [processando, setProcessando] = useState(false)

  const persistindoAtivo = useRef(false)

  useEffect(() => {
    const { ops: savedOps, opAtiva: savedAtiva } = carregarDoStorage()
    setOps(savedOps)
    setOpAtiva(savedAtiva)
    setCarregando(false)
    persistindoAtivo.current = true
  }, [])

  useEffect(() => {
    if (!persistindoAtivo.current) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ops, opAtiva }))
  }, [ops, opAtiva])

  function podeSalvarOp() {
    return novoNumeroOP.trim().length > 0 && novaFibra !== null
  }

  function confirmarNovaOp() {
    if (!podeSalvarOp() || !novaFibra) return
    const nova: OP = { numero: novoNumeroOP.trim().toUpperCase(), fibra: novaFibra }
    setOps(prev => [...prev.filter(o => o.numero !== nova.numero), nova])
    setOpAtiva(nova)
    setNovoNumeroOP('')
    setNovaFibra(null)
    setAbrindoNovaOp(false)
    setFormKey(k => k + 1)
  }

  function solicitarFechamentoOp(numero: string) {
    setModalFecharOp(numero)
    setAuthLogin('')
    setAuthSenha('')
    setAuthErro(false)
  }

  function verificarCredenciais(): boolean {
    const login = authLogin.trim().toLowerCase()
    const valido =
      (login === 'qualidade' && authSenha === 'pareto') ||
      (login === 'janete'    && authSenha === 'fibra')
    if (!valido) { setAuthErro(true); setAuthSenha(''); return false }
    return true
  }

  function removerOpLocal(numero: string) {
    const restantes = ops.filter(o => o.numero !== numero)
    setOps(restantes)
    if (opAtiva?.numero === numero) {
      setOpAtiva(restantes[0] ?? null)
      setFormKey(k => k + 1)
    }
    setModalFecharOp(null)
  }

  function finalizarOP() {
    if (!verificarCredenciais()) return
    removerOpLocal(modalFecharOp!)
  }

  async function handleCancelarOP() {
    if (!verificarCredenciais()) return
    const numero = modalFecharOp!
    setProcessando(true)
    try {
      await cancelarOP(numero)
      removerOpLocal(numero)
    } catch {
      setAuthErro(false)
    } finally {
      setProcessando(false)
    }
  }

  function fecharModal() {
    setModalFecharOp(null)
    setAuthErro(false)
    setAuthSenha('')
    setAuthLogin('')
  }

  function selecionarOp(op: OP) {
    if (opAtiva?.numero === op.numero) return
    setOpAtiva(op)
    setFormKey(k => k + 1)
  }

  function voltarInicio() {
    setErro(null)
    setFormKey(k => k + 1)
  }

  async function handleSalvar(dados: NovoApontamento) {
    setErro(null)
    try {
      await salvarApontamento(dados)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar. Tente novamente.')
      throw e
    }
  }

  if (carregando) {
    return <div className="min-h-screen" style={{ background: 'var(--bg-page)' }} />
  }

  // ── Tela: abrir OP ─────────────────────────────────────────────────────────
  if (ops.length === 0 || abrindoNovaOp) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-page)' }}>
        <Navegacao />

        <main className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full flex flex-col gap-4 mt-4">
          {abrindoNovaOp && (
            <button
              onClick={() => { setAbrindoNovaOp(false); setNovoNumeroOP(''); setNovaFibra(null) }}
              className="text-sm self-start flex items-center gap-1 transition-colors"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
            >
              ← Cancelar
            </button>
          )}

          <div
            className="rounded-2xl p-6 flex flex-col gap-6"
            style={{ background: '#fff', border: '1px solid var(--line)', boxShadow: '0 1px 4px rgba(31,55,68,0.06)' }}
          >
            {/* Ícone + título */}
            <div className="text-center">
              <div
                className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--brand-primary-soft)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 20V11l5 3V11l5 3V7l8 5v8H3z" />
                </svg>
              </div>
              <h2
                className="text-xl font-extrabold"
                style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
              >
                {abrindoNovaOp ? 'Nova Ordem de Produção' : 'Abrir Ordem de Produção'}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Informe o número da OP para começar os apontamentos
              </p>
            </div>

            <TecladoNumerico
              label="Número da Ordem de Produção (OP)"
              valor={novoNumeroOP}
              onChange={setNovoNumeroOP}
              placeholder="ex: 000123456"
              maxLength={9}
              onEnter={() => { if (podeSalvarOp()) confirmarNovaOp() }}
            />

            {/* Tipo de fibra */}
            <div className="flex flex-col gap-3">
              <p
                className="text-sm font-semibold text-center"
                style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}
              >
                Tipo de Fibra
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(['F272', 'F365'] as TipoFibra[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setNovaFibra(f)}
                    className="py-5 rounded-xl font-bold text-lg transition-all active:scale-[0.97]"
                    style={{
                      background: novaFibra === f ? 'var(--brand-primary)' : '#fff',
                      color: novaFibra === f ? '#fff' : 'var(--text-strong)',
                      border: `2px solid ${novaFibra === f ? 'var(--brand-primary)' : 'var(--line)'}`,
                      fontFamily: 'var(--font-display)',
                      boxShadow: novaFibra === f ? '0 4px 14px rgba(86,164,187,0.3)' : 'none',
                    }}
                  >
                    Fibra {f === 'F272' ? '272' : '365'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={confirmarNovaOp}
              disabled={!podeSalvarOp()}
              className="font-bold text-xl py-5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40"
              style={{
                background: 'var(--brand-primary)',
                color: '#fff',
                fontFamily: 'var(--font-display)',
                boxShadow: podeSalvarOp() ? '0 4px 14px rgba(86,164,187,0.3)' : 'none',
              }}
            >
              Iniciar Apontamentos →
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Tela principal: com OP ativa ───────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-page)' }}>
      <Navegacao onReset={voltarInicio} />

      {/* ── Barra de OPs ────────────────────────────────────────────── */}
      <div
        className="px-4 py-2.5 flex items-center gap-2 flex-wrap"
        style={{ background: '#fff', borderBottom: '1px solid var(--line)', boxShadow: '0 1px 3px rgba(31,55,68,0.04)' }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-widest shrink-0"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          OP:
        </span>

        {ops.map(op => (
          <div key={op.numero} className="flex items-center gap-0.5">
            <button
              onClick={() => selecionarOp(op)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-[0.97]"
              style={{
                background: opAtiva?.numero === op.numero ? 'var(--brand-primary)' : 'var(--bg-page)',
                color: opAtiva?.numero === op.numero ? '#fff' : 'var(--text-strong)',
                border: `1px solid ${opAtiva?.numero === op.numero ? 'var(--brand-primary)' : 'var(--line)'}`,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {op.numero}
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: opAtiva?.numero === op.numero ? 'rgba(255,255,255,0.2)' : 'var(--line)',
                  color: opAtiva?.numero === op.numero ? '#fff' : 'var(--text-muted)',
                }}
              >
                {op.fibra === 'F272' ? '272' : '365'}
              </span>
            </button>
            <button
              onClick={() => solicitarFechamentoOp(op.numero)}
              title="Encerrar OP"
              className="p-1.5 rounded transition-colors text-xs"
              style={{ color: 'var(--line-strong)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--signal-red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--line-strong)')}
            >
              ✕
            </button>
          </div>
        ))}

        <button
          onClick={() => setAbrindoNovaOp(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]"
          style={{
            color: 'var(--brand-primary)',
            border: '1px solid rgba(86,164,187,0.4)',
            background: 'transparent',
            fontFamily: 'var(--font-display)',
          }}
        >
          + Nova OP
        </button>
      </div>

      {/* ── Conteúdo principal ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        {erro && (
          <div
            className="rounded-xl p-4 mb-4 text-sm"
            style={{
              background: 'var(--signal-red-soft)',
              border: '1px solid #f5d2d1',
              color: 'var(--signal-red)',
            }}
          >
            ⚠ {erro}
          </div>
        )}

        {opAtiva && (
          <div
            className="rounded-2xl overflow-hidden mt-2"
            style={{ border: '1px solid var(--line)', boxShadow: '0 1px 4px rgba(31,55,68,0.06)' }}
          >
            {/* Cabeçalho escuro da OP ativa */}
            <div
              className="px-5 py-4 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-deep-2) 100%)' }}
            >
              <svg
                style={{ position: 'absolute', right: -30, top: -30, opacity: 0.06 }}
                width="140" height="140" viewBox="0 0 140 140"
              >
                <circle cx="70" cy="70" r="68" stroke="#fff" strokeWidth="1" fill="none" />
                <circle cx="70" cy="70" r="50" stroke="#fff" strokeWidth="1" fill="none" />
                <circle cx="70" cy="70" r="32" stroke="#fff" strokeWidth="1" fill="none" />
              </svg>

              <div className="relative flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                      style={{ background: 'rgba(156,229,238,0.16)', color: 'var(--brand-tecno)', fontFamily: 'var(--font-mono)' }}
                    >
                      OP ATIVA
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span
                      className="text-2xl font-bold text-white"
                      style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}
                    >
                      {opAtiva.numero}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                      Fibra{' '}
                      <strong style={{ color: 'var(--brand-tecno)' }}>
                        {opAtiva.fibra === 'F272' ? '272' : '365'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <div className="p-4" style={{ background: '#fff' }}>
              <FormularioApontamento
                key={formKey}
                op={opAtiva.numero}
                fibra={opAtiva.fibra}
                operador=""
                onSalvar={handleSalvar}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── Modal: autorização para encerrar OP ────────────────────── */}
      {modalFecharOp && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(31,55,68,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-sm flex flex-col gap-5 p-6 rounded-2xl"
            style={{ background: '#fff', boxShadow: '0 30px 80px -10px rgba(15,35,50,0.4)' }}
          >
            <div className="flex justify-between items-start">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--brand-primary-soft)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary-dark)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  <circle cx="12" cy="16" r="1" fill="var(--brand-primary-dark)" stroke="none" />
                </svg>
              </div>
              <button
                onClick={fecharModal}
                disabled={processando}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors text-sm"
                style={{ background: 'var(--bg-page)', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                OP {modalFecharOp}
              </p>
              <h2
                className="text-xl font-extrabold"
                style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
              >
                Autenticação de Qualidade
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Para finalizar ou cancelar a OP, informe as credenciais.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <CampoAuth label="Login" value={authLogin} onChange={v => { setAuthLogin(v); setAuthErro(false) }} placeholder="qualidade" />
              <CampoAuth label="Senha" type="password" value={authSenha} onChange={v => { setAuthSenha(v); setAuthErro(false) }} placeholder="••••••" />
              {authErro && (
                <p className="text-sm text-center font-semibold" style={{ color: 'var(--signal-red)' }}>
                  Login ou senha incorretos
                </p>
              )}
            </div>

            <div className="rounded-xl p-3 text-xs flex flex-col gap-1.5" style={{ background: 'var(--bg-page)', color: 'var(--text-body)' }}>
              <p>
                <strong style={{ color: 'var(--brand-primary-dark)' }}>Finalizar OP</strong>
                {' '}— encerra a OP e mantém todos os dados registrados.
              </p>
              <p>
                <strong style={{ color: 'var(--signal-red)' }}>Cancelar OP</strong>
                {' '}— remove a OP e <strong>apaga permanentemente</strong> todos os apontamentos dela.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={finalizarOP}
                disabled={processando}
                className="w-full font-bold py-3.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4.5 4.5L19 7" /></svg>
                Finalizar OP
              </button>
              <button
                onClick={handleCancelarOP}
                disabled={processando}
                className="w-full font-bold py-3.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40"
                style={{
                  background: 'transparent',
                  color: 'var(--signal-red)',
                  border: '1px solid rgba(200,80,79,0.35)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {processando ? 'Cancelando…' : 'Cancelar OP (apagar dados)'}
              </button>
              <button
                onClick={fecharModal}
                disabled={processando}
                className="w-full font-semibold py-3 rounded-xl transition-all active:scale-[0.97]"
                style={{
                  background: '#fff',
                  color: 'var(--text-body)',
                  border: '1px solid var(--line)',
                  fontFamily: 'var(--font-display)',
                }}
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

function CampoAuth({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-sm font-semibold"
        style={{ color: 'var(--text-body)', fontFamily: 'var(--font-display)' }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full h-12 px-3.5 rounded-xl text-base outline-none"
        style={{
          background: '#fff',
          border: focused ? '2px solid var(--brand-primary)' : '1.5px solid var(--line)',
          color: 'var(--text-strong)',
          fontFamily: 'var(--font-body)',
          transition: 'border-color 150ms ease',
        }}
      />
    </div>
  )
}
