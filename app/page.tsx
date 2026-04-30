'use client'

import { useState } from 'react'
import FormularioApontamento from '@/components/FormularioApontamento'
import { salvarApontamento } from './actions'
import type { NovoApontamento } from '@/lib/types'
import Navegacao from '@/components/Navegacao'

export default function Home() {
  const [erro, setErro] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  function voltarInicio() {
    setErro(null)
    setFormKey((k) => k + 1)
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

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Navegacao onReset={voltarInicio} />

      <main className="flex-1 overflow-y-auto p-4">
        {erro && (
          <div className="bg-red-900/50 border border-red-500 text-red-300 rounded-xl p-4 mb-4 text-sm">
            ⚠️ {erro}
          </div>
        )}
        <FormularioApontamento key={formKey} onSalvar={handleSalvar} />
      </main>
    </div>
  )
}
