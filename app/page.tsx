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
    <div className="min-h-screen bg-[#F2F5F7] flex flex-col">
      <Navegacao onReset={voltarInicio} />

      <main className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        {erro && (
          <div className="bg-red-50 border border-red-300 text-red-600 rounded-xl p-4 mb-4 text-sm">
            ⚠️ {erro}
          </div>
        )}
        <div className="bg-white border border-[#DDE4EA] rounded-2xl p-5 shadow-sm mt-2">
          <FormularioApontamento key={formKey} onSalvar={handleSalvar} />
        </div>
      </main>
    </div>
  )
}
