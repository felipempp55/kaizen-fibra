'use client'

import { useState } from 'react'
import FormularioApontamento from '@/components/FormularioApontamento'
import { salvarApontamento } from './actions'
import type { NovoApontamento } from '@/lib/types'
import Navegacao from '@/components/Navegacao'
import TecladoNumerico from '@/components/TecladoNumerico'

interface OP {
  numero: string
  operador: string
}

export default function Home() {
  const [ops, setOps] = useState<OP[]>([])
  const [opAtiva, setOpAtiva] = useState<OP | null>(null)
  const [abrindoNovaOp, setAbrindoNovaOp] = useState(false)
  const [novoNumeroOP, setNovoNumeroOP] = useState('')
  const [novoOperador, setNovoOperador] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  function podeSalvarOp() {
    return novoNumeroOP.trim().length > 0 && novoOperador.trim().length > 0
  }

  function confirmarNovaOp() {
    if (!podeSalvarOp()) return
    const nova: OP = {
      numero: novoNumeroOP.trim().toUpperCase(),
      operador: novoOperador.trim(),
    }
    setOps(prev => [...prev.filter(o => o.numero !== nova.numero), nova])
    setOpAtiva(nova)
    setNovoNumeroOP('')
    setNovoOperador('')
    setAbrindoNovaOp(false)
    setFormKey(k => k + 1)
  }

  function fecharOp(numero: string) {
    const restantes = ops.filter(o => o.numero !== numero)
    setOps(restantes)
    if (opAtiva?.numero === numero) {
      setOpAtiva(restantes[0] ?? null)
      setFormKey(k => k + 1)
    }
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

  // ── Tela: abrir OP ──────────────────────────────────────────────────────────
  if (ops.length === 0 || abrindoNovaOp) {
    return (
      <div className="min-h-screen bg-[#F2F5F7] flex flex-col">
        <Navegacao />

        <main className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full flex flex-col gap-4 mt-4">
          {abrindoNovaOp && (
            <button
              onClick={() => { setAbrindoNovaOp(false); setNovoNumeroOP(''); setNovoOperador('') }}
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
                Informe a OP e o operador para começar os apontamentos
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[#1A3344] text-base font-semibold">Nome do Operador</label>
              <input
                type="text"
                value={novoOperador}
                onChange={e => setNovoOperador(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && podeSalvarOp()) confirmarNovaOp() }}
                placeholder="Digite o nome do operador"
                autoFocus
                className="bg-white border-2 border-[#DDE4EA] text-[#1A3344] text-lg px-4 py-4 rounded-xl focus:border-[#1E9FAC] focus:outline-none placeholder:text-[#DDE4EA]"
              />
            </div>

            <TecladoNumerico
              label="Número da Ordem de Produção (OP)"
              valor={novoNumeroOP}
              onChange={setNovoNumeroOP}
              placeholder="ex: 000123456"
              maxLength={9}
              onEnter={() => { if (podeSalvarOp()) confirmarNovaOp() }}
            />

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
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                opAtiva?.numero === op.numero
                  ? 'bg-[#1E9FAC] text-white'
                  : 'bg-[#F2F5F7] text-[#1A3344] hover:bg-[#E6F6F8] border border-[#DDE4EA]'
              }`}
            >
              {op.numero} · {op.operador}
            </button>
            <button
              onClick={() => fecharOp(op.numero)}
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
              operador={opAtiva.operador}
              onSalvar={handleSalvar}
            />
          )}
        </div>
      </main>
    </div>
  )
}
