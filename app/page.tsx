'use client'

import { useState } from 'react'
import FormularioApontamento from '@/components/FormularioApontamento'
import { salvarApontamento } from './actions'
import type { NovoApontamento } from '@/lib/types'

export default function Home() {
  const [erro, setErro] = useState<string | null>(null)

  async function handleSalvar(dados: NovoApontamento) {
    setErro(null)
    try {
      await salvarApontamento(dados)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar. Tente novamente.')
      throw e
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">Kaizen Fibra</h1>
          <p className="text-slate-400 text-xs">Apontamento de Desperdícios</p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-xs">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
            })}
          </p>
          <p className="text-slate-300 text-sm font-mono">
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto p-4">
        {erro && (
          <div className="bg-red-900/50 border border-red-500 text-red-300 rounded-xl p-4 mb-4 text-sm">
            ⚠️ {erro}
          </div>
        )}
        <FormularioApontamento onSalvar={handleSalvar} />
      </main>
    </div>
  )
}
