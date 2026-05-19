'use server'

import { supabase } from '@/lib/supabase'
import type { NovoApontamento, NovaCEPColeta, RascunhoCEP } from '@/lib/types'

export async function salvarApontamento(dados: NovoApontamento) {
  const { error } = await supabase.from('apontamentos').insert(dados)
  if (error) throw new Error(error.message)
}

// Salva coleta finalizada (nova ou atualizando um rascunho existente)
export async function salvarCEP(dados: NovaCEPColeta, rascunhoId?: string) {
  if (rascunhoId) {
    const { error } = await supabase
      .from('cep_coletas')
      .update({ ...dados, status: 'finalizado' })
      .eq('id', rascunhoId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('cep_coletas').insert([{ ...dados, status: 'finalizado' }])
    if (error) throw new Error(error.message)
  }
}

// Salva rascunho (coleta pausada) — retorna o ID gerado
export async function salvarRascunhoCEP(dados: NovaCEPColeta): Promise<string> {
  const { data, error } = await supabase
    .from('cep_coletas')
    .insert([{ ...dados, status: 'rascunho' }])
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

// Atualiza um rascunho existente com mais amostras
export async function atualizarRascunhoCEP(id: string, dados: Partial<NovaCEPColeta>) {
  const { error } = await supabase
    .from('cep_coletas')
    .update(dados)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// Busca todos os rascunhos em aberto
export async function buscarRascunhosCEP(): Promise<RascunhoCEP[]> {
  const { data, error } = await supabase
    .from('cep_coletas')
    .select('*')
    .eq('status', 'rascunho')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as RascunhoCEP[]
}

// Exclui uma coleta (rascunho ou finalizada) pelo ID
export async function excluirColetaCEP(id: string) {
  const { error } = await supabase
    .from('cep_coletas')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
