'use client'

import { useState, useEffect, useCallback } from 'react'
import FormularioCEP from '@/components/FormularioCEP'
import CartasControle from '@/components/CartasControle'
import { salvarCEP, salvarRascunhoCEP, atualizarRascunhoCEP } from '../actions'
import type { NovaCEPColeta, RascunhoCEP, DadosIniciaisCEP } from '@/lib/types'
import { CTQS } from '@/lib/ctqs'
import { supabase } from '@/lib/supabase'
import Navegacao from '@/components/Navegacao'

type Tela = 'home' | 'nova-coleta' | 'continuar-coleta'
type AbaHome = 'coletas' | 'cartas'

export default function CEPPage() {
  const [tela, setTela] = useState<Tela>('home')
  const [abaHome, setAbaHome] = useState<AbaHome>('coletas')
  const [rascunhos, setRascunhos] = useState<RascunhoCEP[]>([])
  const [rascunhoAtivo, setRascunhoAtivo] = useState<DadosIniciaisCEP | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  // Busca rascunhos diretamente pelo cliente Supabase (mais seguro em client components)
  const carregarRascunhos = useCallback(async () => {
    setCarregando(true)
    try {
      const { data } = await supabase
        .from('cep_coletas')
        .select('*')
        .eq('status', 'rascunho')
        .order('created_at', { ascending: false })
      setRascunhos((data ?? []) as RascunhoCEP[])
    } catch {
      // tabela pode não existir ainda — falha silenciosa
      setRascunhos([])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregarRascunhos() }, [carregarRascunhos])

  function voltar() {
    setTela('home')
    setRascunhoAtivo(null)
    setFormKey(k => k + 1)
    setErro(null)
    carregarRascunhos()
  }

  function iniciarNovaColeta() {
    setRascunhoAtivo(null)
    setFormKey(k => k + 1)
    setTela('nova-coleta')
    setErro(null)
  }

  function continuarRascunho(r: RascunhoCEP) {
    const ctqObj = CTQS.find(c => c.id === r.ctq_id)
    if (!ctqObj) return
    setRascunhoAtivo({
      rascunhoId: r.id,
      ctq_id: r.ctq_id,
      ctq_nome: r.ctq_nome,
      tipo: r.tipo,
      instrumento: r.instrumento,
      dataColeta: r.data_coleta,
      numeroOP: r.numero_op,
      nomeOperador: r.nome_operador,
      amostrasPreenchidas: r.amostras,
      totalAmostras: r.total_amostras,
    })
    setFormKey(k => k + 1)
    setTela('continuar-coleta')
    setErro(null)
  }

  async function handleSalvar(dados: NovaCEPColeta, rascunhoId?: string) {
    setErro(null)
    try {
      await salvarCEP(dados, rascunhoId)
      voltar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar. Tente novamente.')
      // não relança — o FormularioCEP mostra o erro da página
    }
  }

  async function handlePausar(dados: NovaCEPColeta, rascunhoId?: string) {
    setErro(null)
    try {
      if (rascunhoId) {
        await atualizarRascunhoCEP(rascunhoId, dados)
      } else {
        await salvarRascunhoCEP(dados)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao pausar.')
      // não relança — o FormularioCEP cuida do estado interno
    }
  }

  // ── Tela inicial ──────────────────────────────────────────────────────────
  if (tela === 'home') {
    return (
      <div className="min-h-screen bg-[#F2F5F7] flex flex-col">
        <Navegacao />
        <main className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full flex flex-col gap-4 mt-2">

          {/* Abas: Coletas | Cartas de Controle */}
          <div className="flex gap-2 bg-white border border-[#DDE4EA] rounded-xl p-1.5 shadow-sm">
            {([
              { id: 'coletas', label: '📋 Coletas' },
              { id: 'cartas', label: '📈 Cartas de Controle' },
            ] as { id: AbaHome; label: string }[]).map(aba => (
              <button
                key={aba.id}
                onClick={() => setAbaHome(aba.id)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all active:scale-95 ${
                  abaHome === aba.id
                    ? 'bg-[#1E9FAC] text-white'
                    : 'text-[#8FA3B0] hover:text-[#1E9FAC]'
                }`}
              >
                {aba.label}
              </button>
            ))}
          </div>

          {/* Conteúdo da aba Cartas — sempre montado para preservar estado e auto-refresh */}
          <div className={abaHome === 'cartas' ? '' : 'hidden'}>
            <CartasControle />
          </div>

          {/* Conteúdo da aba Coletas */}
          {abaHome === 'coletas' && <>

          {/* Rascunhos em aberto */}
          {!carregando && rascunhos.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-1 h-3.5 bg-amber-400 rounded-full inline-block" />
                <h2 className="text-[#1A3344] font-bold text-xs uppercase tracking-wider">
                  Coletas Pausadas ({rascunhos.length})
                </h2>
              </div>

              {rascunhos.map(r => {
                const preenchidas = r.amostras?.length ?? 0
                const pct = r.total_amostras > 0 ? Math.round((preenchidas / r.total_amostras) * 100) : 0
                return (
                  <div key={r.id} className="bg-white border border-[#DDE4EA] rounded-xl p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-[#1A3344] font-bold text-sm leading-tight">{r.ctq_nome}</p>
                        <p className="text-[#8FA3B0] text-xs mt-0.5">
                          OP {r.numero_op} · {r.nome_operador} · {new Date(r.data_coleta + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md ${
                        r.tipo === 'atributo' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {r.tipo === 'atributo' ? 'Atributo' : 'Variável'}
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-[#8FA3B0] mb-1">
                        <span>{preenchidas} de {r.total_amostras} amostras</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-[#F2F5F7] rounded-full h-2">
                        <div className="bg-[#1E9FAC] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <button
                      onClick={() => continuarRascunho(r)}
                      className="w-full bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm"
                    >
                      🔄 Continuar Coleta
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Nova Coleta */}
          <div className="flex flex-col gap-3">
            {rascunhos.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-1 h-3.5 bg-[#1E9FAC] rounded-full inline-block" />
                <h2 className="text-[#1A3344] font-bold text-xs uppercase tracking-wider">Nova Coleta</h2>
              </div>
            )}
            <button
              onClick={iniciarNovaColeta}
              className="w-full bg-white border-2 border-[#DDE4EA] hover:border-[#1E9FAC] hover:text-[#1E9FAC] active:scale-95 text-[#1A3344] font-bold text-lg py-6 rounded-xl transition-all shadow-sm"
            >
              + Iniciar Nova Coleta CEP
            </button>
          </div>

          {carregando && (
            <p className="text-center text-[#8FA3B0] text-sm">Carregando...</p>
          )}

          </>}
        </main>
      </div>
    )
  }

  // ── Tela de formulário ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F2F5F7] flex flex-col">
      <Navegacao />
      <main className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        <button
          onClick={voltar}
          className="mb-3 flex items-center gap-1.5 text-[#8FA3B0] hover:text-[#1E9FAC] text-sm font-medium transition-colors"
        >
          ← Voltar
        </button>

        {erro && (
          <div className="bg-red-50 border border-red-300 text-red-600 rounded-xl p-4 mb-4 text-sm">
            ⚠️ {erro}
          </div>
        )}

        <div className="bg-white border border-[#DDE4EA] rounded-2xl p-4 shadow-sm">
          <FormularioCEP
            key={formKey}
            dadosIniciais={rascunhoAtivo ?? undefined}
            onSalvar={handleSalvar}
            onPausar={handlePausar}
          />
        </div>
      </main>
    </div>
  )
}
