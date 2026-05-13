'use server'

import { supabase } from '@/lib/supabase'
import type { NovoApontamento, NovaCEPColeta } from '@/lib/types'

export async function salvarApontamento(dados: NovoApontamento) {
  const { error } = await supabase.from('apontamentos').insert(dados)
  if (error) throw new Error(error.message)
}

export async function salvarCEP(dados: NovaCEPColeta) {
  const { error } = await supabase.from('cep_coletas').insert([dados])
  if (error) throw new Error(error.message)
}
