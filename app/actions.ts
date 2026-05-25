'use server'

import { supabase } from '@/lib/supabase'
import type { NovoApontamento, NovaCEPColeta, RascunhoCEP, TipoFibra } from '@/lib/types'

export async function salvarApontamento(dados: NovoApontamento) {
  const { error } = await supabase.from('apontamentos').insert(dados)
  if (error) throw new Error(error.message)
}

export async function abrirOP(dados: { numero: string; fibra: TipoFibra; tamanho?: number }) {
  const { error } = await supabase.from('ops_abertas').upsert({
    numero: dados.numero,
    fibra: dados.fibra,
    tamanho: dados.tamanho ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function fecharOP(numero: string) {
  const { error } = await supabase.from('ops_abertas').delete().eq('numero', numero)
  if (error) throw new Error(error.message)
}

export async function salvarTempoRetrabalhoPolimento(dados: {
  numero_op: string
  tempo_ms: number
  tempo_minutos: number
  custo_hh: number
}) {
  const { error } = await supabase.from('tempos_retrabalho_polimento').insert(dados)
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

// Cancela uma OP: apaga todos os apontamentos e remove da lista de OPs abertas
export async function cancelarOP(numero_op: string) {
  const { error } = await supabase.from('apontamentos').delete().eq('numero_op', numero_op)
  if (error) throw new Error(error.message)
  const { error: e2 } = await supabase.from('ops_abertas').delete().eq('numero', numero_op)
  if (e2) throw new Error(e2.message)
}

// Exclui uma coleta (rascunho ou finalizada) pelo ID
export async function excluirColetaCEP(id: string) {
  const { error } = await supabase
    .from('cep_coletas')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
