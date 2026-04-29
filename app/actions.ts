'use server'

import { supabase } from '@/lib/supabase'
import type { NovoApontamento } from '@/lib/types'

export async function salvarApontamento(dados: NovoApontamento) {
  const { error } = await supabase.from('apontamentos').insert(dados)
  if (error) throw new Error(error.message)
}
