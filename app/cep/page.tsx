'use client'

import { useState } from 'react'
import FormularioCEP from '@/components/FormularioCEP'
import { salvarCEP } from '../actions'
import type { NovaCEPColeta } from '@/lib/types'
import Navegacao from '@/components/Navegacao'

export default function CEPPage() {
  const [erro, setErro] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  async function handleSalvar(dados: NovaCEPColeta) {
    setErro(null)
    try {
      await salvarCEP(dados)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar. Tente novamente.')
      throw e
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F5F7] flex flex-col">
      <Navegacao />

      <main className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        {erro && (
          <div className="bg-red-50 border border-red-300 text-red-600 rounded-xl p-4 mb-4 text-sm">
            ⚠️ {erro}
          </div>
        )}
        <div className="bg-white border border-[#DDE4EA] rounded-2xl p-4 shadow-sm mt-2">
          <FormularioCEP key={formKey} onSalvar={handleSalvar} />
        </div>
      </main>
    </div>
  )
}
