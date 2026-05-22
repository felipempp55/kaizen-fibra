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
    // Filtra OPs que tenham todos os campos obrigatórios (migração segura)
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

  // Modal de confirmação para encerrar OP
  const [modalFecharOp, setModalFecharOp] = useState<string | null>(null)
  const [authLogin, setAuthLogin] = useState('')
  const [authSenha, setAuthSenha] = useState('')
  const [authErro, setAuthErro] = useState(false)
  const [processando, setProcessando] = useState(false)

  // Evita gravar no localStorage antes de ter carregado
  const persistindoAtivo = useRef(false)

  // ── Carregar OPs do localStorage ao montar ───────────────────────────────────
  useEffect(() => {
    const { ops: savedOps, opAtiva: savedAtiva } = carregarDoStorage()
    setOps(savedOps)
    setOpAtiva(savedAtiva)
    setCarregando(false)
    persistindoAtivo.current = true
  }, [])

  // ── Salvar OPs no localStorage sempre que mudar ──────────────────────────────
  useEffect(() => {
    if (!persistindoAtivo.current) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ops, opAtiva }))
  }, [ops, opAtiva])

  function podeSalvarOp() {
    return novoNumeroOP.trim().length > 0 && novaFibra !== null
  }

  function confirmarNovaOp() {
    if (!podeSalvarOp() || !novaFibra) return
    const nova: OP = {
      numero: novoNumeroOP.trim().toUpperCase(),
      fibra: novaFibra,
    }
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
    if (authLogin.trim().toLowerCase() !== 'qualidade' || authSenha !== 'pareto') {
      setAuthErro(true)
      setAuthSenha('')
      return false
    }
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

  // Finalizar: mantém dados no banco, só remove a OP da tela
  function finalizarOP() {
    if (!verificarCredenciais()) return
    removerOpLocal(modalFecharOp!)
  }

  // Cancelar: apaga todos os apontamentos da OP no banco + remove da tela
  async function handleCancelarOP() {
    if (!verificarCredenciais()) return
    const numero = modalFecharOp!
    setProcessando(true)
    try {
      await cancelarOP(numero)
      removerOpLocal(numero)
    } catch {
      setAuthErro(false)
      // mantém modal aberto para o usuário tentar novamente
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

  // ── Loading: evita flash de tela errada antes de carregar o localStorage ─────
  if (carregando) {
    return <div className="min-h-screen bg-[#F2F5F7]" />
  }

  // ── Tela: abrir OP ──────────────────────────────────────────────────────────
  if (ops.length === 0 || abrindoNovaOp) {
    return (
      <div className="min-h-screen bg-[#F2F5F7] flex flex-col">
        <Navegacao />

        <main className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full flex flex-col gap-4 mt-4">
          {abrindoNovaOp && (
            <button
              onClick={() => { setAbrindoNovaOp(false); setNovoNumeroOP(''); setNovaFibra(null) }}
              className="text-[#8FA3B0] text-sm self-start flex items-center gap-1 hover:text-[#1A3344] transition-colors"
            >
              ← Cancelar
            </button>
          )}

          <div className="bg-white border border-[#DDE4EA] rounded-2xl p-6 shadow-sm flex flex-col gap-6">
            <div className="text-center">
              <div className="text-5xl mb-3">🏭</div>
              <h2 className="text-xl font-bold text-[#1A3344]">
                {abrindoNovaOp ? 'Nova Ordem de Produção' : 'Abrir Ordem de Produção'}
              </h2>
              <p className="text-[#8FA3B0] text-sm mt-1">
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

            {/* Seleção de tipo de fibra */}
            <div className="flex flex-col gap-3">
              <p className="text-[#1A3344] text-base font-semibold text-center">Tipo de Fibra</p>
              <div className="grid grid-cols-2 gap-3">
                {(['F272', 'F365'] as TipoFibra[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setNovaFibra(f)}
                    className={`py-5 rounded-xl border-2 font-bold text-lg transition-all active:scale-95 ${
                      novaFibra === f
                        ? 'bg-[#1E9FAC] border-[#1E9FAC] text-white shadow-md'
                        : 'bg-white border-[#DDE4EA] text-[#1A3344] hover:border-[#1E9FAC]'
                    }`}
                  >
                    Fibra {f === 'F272' ? '272' : '365'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={confirmarNovaOp}
              disabled={!podeSalvarOp()}
              className="bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 disabled:opacity-40 text-white font-bold text-xl py-5 rounded-xl transition-all"
            >
              Iniciar Apontamentos →
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Tela principal: com OP ativa ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F2F5F7] flex flex-col">
      <Navegacao onReset={voltarInicio} />

      {/* Barra de OPs */}
      <div className="bg-white border-b border-[#DDE4EA] px-4 py-2.5 flex items-center gap-2 flex-wrap shadow-sm">
        <span className="text-[#8FA3B0] text-xs font-semibold shrink-0 uppercase tracking-wide">OP:</span>
        {ops.map(op => (
          <div key={op.numero} className="flex items-center gap-0.5">
            <button
              onClick={() => selecionarOp(op)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 flex items-center gap-1.5 ${
                opAtiva?.numero === op.numero
                  ? 'bg-[#1E9FAC] text-white'
                  : 'bg-[#F2F5F7] text-[#1A3344] hover:bg-[#E6F6F8] border border-[#DDE4EA]'
              }`}
            >
              {op.numero}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                opAtiva?.numero === op.numero
                  ? 'bg-white/20 text-white'
                  : 'bg-[#DDE4EA] text-[#3D5568]'
              }`}>
                {op.fibra === 'F272' ? '272' : '365'}
              </span>
            </button>
            <button
              onClick={() => solicitarFechamentoOp(op.numero)}
              title="Encerrar OP"
              className="text-[#C4D0DA] hover:text-red-400 text-xs p-1.5 rounded transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={() => setAbrindoNovaOp(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold text-[#1E9FAC] border border-[#1E9FAC]/50 hover:bg-[#E6F6F8] active:scale-95 transition-all"
        >
          + Nova OP
        </button>
      </div>

      <main className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        {erro && (
          <div className="bg-red-50 border border-red-300 text-red-600 rounded-xl p-4 mb-4 text-sm">
            ⚠️ {erro}
          </div>
        )}
        <div className="bg-white border border-[#DDE4EA] rounded-2xl p-4 shadow-sm mt-2">
          {opAtiva && (
            <FormularioApontamento
              key={formKey}
              op={opAtiva.numero}
              fibra={opAtiva.fibra}
              operador=""
              onSalvar={handleSalvar}
            />
          )}
        </div>
      </main>

      {/* Modal: autorização para encerrar OP */}
      {modalFecharOp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-5 p-6">
            <div className="text-center">
              <div className="text-4xl mb-2">🔒</div>
              <h2 className="text-lg font-bold text-[#1A3344]">OP {modalFecharOp}</h2>
              <p className="text-[#8FA3B0] text-sm mt-1">Informe as credenciais de qualidade para continuar</p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[#1A3344] text-sm font-semibold">Login</label>
                <input
                  type="text"
                  value={authLogin}
                  onChange={e => { setAuthLogin(e.target.value); setAuthErro(false) }}
                  placeholder="login"
                  autoFocus
                  className="border-2 border-[#DDE4EA] rounded-xl px-4 py-3 text-[#1A3344] text-base focus:border-[#1E9FAC] focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[#1A3344] text-sm font-semibold">Senha</label>
                <input
                  type="password"
                  value={authSenha}
                  onChange={e => { setAuthSenha(e.target.value); setAuthErro(false) }}
                  placeholder="••••••"
                  className="border-2 border-[#DDE4EA] rounded-xl px-4 py-3 text-[#1A3344] text-base focus:border-[#1E9FAC] focus:outline-none"
                />
              </div>
              {authErro && (
                <p className="text-red-500 text-sm text-center font-medium">Login ou senha incorretos</p>
              )}
            </div>

            {/* Explicação das duas ações */}
            <div className="bg-[#F2F5F7] rounded-xl p-3 flex flex-col gap-2 text-xs text-[#3D5568]">
              <p><span className="font-bold text-[#1E9FAC]">Finalizar OP</span> — encerra a OP e mantém todos os dados registrados.</p>
              <p><span className="font-bold text-red-500">Cancelar OP</span> — remove a OP e <span className="font-bold">apaga permanentemente</span> todos os apontamentos dela.</p>
            </div>

            {/* Botões de ação */}
            <div className="flex flex-col gap-2">
              <button
                onClick={finalizarOP}
                disabled={processando}
                className="w-full bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-all"
              >
                ✓ Finalizar OP
              </button>
              <button
                onClick={handleCancelarOP}
                disabled={processando}
                className="w-full bg-red-500 hover:bg-red-600 active:scale-95 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-all"
              >
                {processando ? 'Cancelando…' : '🗑️ Cancelar OP (apagar dados)'}
              </button>
              <button
                onClick={fecharModal}
                disabled={processando}
                className="w-full bg-white border border-[#DDE4EA] hover:border-[#1E9FAC] text-[#3D5568] font-semibold py-3 rounded-xl transition-all active:scale-95"
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
