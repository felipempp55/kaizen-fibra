'use server'

import { supabase } from '@/lib/supabase'
import type { NovoApontamento, NovaCEPColeta, RascunhoCEP, TipoFibra } from '@/lib/types'

// ── Resultado padrão das Server Actions ─────────────────────────────────────
// Padrão Next 16: nunca usar throw em Server Actions. Sempre retornar valor.
// Isso impede o erro genérico "Server Components render error" e permite que
// o cliente trate o erro de forma controlada (mostra mensagem, retry, etc.).
export type ResultadoAction = { ok: true } | { ok: false; error: string; detail?: string }
export type ResultadoActionData<T> = { ok: true; data: T } | { ok: false; error: string; detail?: string }

function falha(error: { message: string; code?: string; hint?: string | null; details?: string | null }, contexto: string): { ok: false; error: string; detail: string } {
  console.error(`[${contexto}] erro Supabase:`, error)
  return {
    ok: false,
    error: error.message,
    detail: JSON.stringify({ code: error.code, hint: error.hint, details: error.details }),
  }
}

function falhaExcecao(e: unknown, contexto: string): { ok: false; error: string } {
  console.error(`[${contexto}] excecao:`, e)
  const msg = e instanceof Error ? e.message : 'Erro desconhecido'
  return { ok: false, error: msg }
}

// ── Apontamentos ────────────────────────────────────────────────────────────

export async function salvarApontamento(dados: NovoApontamento): Promise<ResultadoAction> {
  console.log('[salvarApontamento] dados recebidos:', JSON.stringify(dados))
  try {
    const { error } = await supabase.from('apontamentos').insert(dados)
    if (error) return falha(error, 'salvarApontamento')
    return { ok: true }
  } catch (e) {
    return falhaExcecao(e, 'salvarApontamento')
  }
}

// ── Ordens de Produção ──────────────────────────────────────────────────────

export async function abrirOP(dados: { numero: string; fibra: TipoFibra; tamanho?: number }): Promise<ResultadoAction> {
  try {
    const { error } = await supabase.from('ops_abertas').upsert({
      numero: dados.numero,
      fibra: dados.fibra,
      tamanho: dados.tamanho ?? null,
    })
    if (error) return falha(error, 'abrirOP')
    return { ok: true }
  } catch (e) {
    return falhaExcecao(e, 'abrirOP')
  }
}

export async function fecharOP(numero: string): Promise<ResultadoAction> {
  try {
    const { error } = await supabase.from('ops_abertas').delete().eq('numero', numero)
    if (error) return falha(error, 'fecharOP')
    return { ok: true }
  } catch (e) {
    return falhaExcecao(e, 'fecharOP')
  }
}

export async function cancelarOP(numero_op: string): Promise<ResultadoAction> {
  try {
    const { error } = await supabase.from('apontamentos').delete().eq('numero_op', numero_op)
    if (error) return falha(error, 'cancelarOP/apontamentos')
    const { error: e2 } = await supabase.from('ops_abertas').delete().eq('numero', numero_op)
    if (e2) return falha(e2, 'cancelarOP/ops_abertas')
    return { ok: true }
  } catch (e) {
    return falhaExcecao(e, 'cancelarOP')
  }
}

// ── Cronômetro de retrabalho ────────────────────────────────────────────────

export async function salvarTempoRetrabalhoPolimento(dados: {
  numero_op: string
  tempo_ms: number
  tempo_minutos: number
  custo_hh: number
}): Promise<ResultadoAction> {
  try {
    const { error } = await supabase.from('tempos_retrabalho_polimento').insert(dados)
    if (error) return falha(error, 'salvarTempoRetrabalhoPolimento')
    return { ok: true }
  } catch (e) {
    return falhaExcecao(e, 'salvarTempoRetrabalhoPolimento')
  }
}

// ── CEP ────────────────────────────────────────────────────────────────────

export async function salvarCEP(dados: NovaCEPColeta, rascunhoId?: string): Promise<ResultadoAction> {
  try {
    if (rascunhoId) {
      const { error } = await supabase
        .from('cep_coletas')
        .update({ ...dados, status: 'finalizado' })
        .eq('id', rascunhoId)
      if (error) return falha(error, 'salvarCEP/update')
    } else {
      const { error } = await supabase.from('cep_coletas').insert([{ ...dados, status: 'finalizado' }])
      if (error) return falha(error, 'salvarCEP/insert')
    }
    return { ok: true }
  } catch (e) {
    return falhaExcecao(e, 'salvarCEP')
  }
}

export async function salvarRascunhoCEP(dados: NovaCEPColeta): Promise<ResultadoActionData<string>> {
  try {
    const { data, error } = await supabase
      .from('cep_coletas')
      .insert([{ ...dados, status: 'rascunho' }])
      .select('id')
      .single()
    if (error) return falha(error, 'salvarRascunhoCEP')
    return { ok: true, data: (data as { id: string }).id }
  } catch (e) {
    return falhaExcecao(e, 'salvarRascunhoCEP')
  }
}

export async function atualizarRascunhoCEP(id: string, dados: Partial<NovaCEPColeta>): Promise<ResultadoAction> {
  try {
    const { error } = await supabase.from('cep_coletas').update(dados).eq('id', id)
    if (error) return falha(error, 'atualizarRascunhoCEP')
    return { ok: true }
  } catch (e) {
    return falhaExcecao(e, 'atualizarRascunhoCEP')
  }
}

export async function buscarRascunhosCEP(): Promise<ResultadoActionData<RascunhoCEP[]>> {
  try {
    const { data, error } = await supabase
      .from('cep_coletas')
      .select('*')
      .eq('status', 'rascunho')
      .order('created_at', { ascending: false })
    if (error) return falha(error, 'buscarRascunhosCEP')
    return { ok: true, data: (data ?? []) as RascunhoCEP[] }
  } catch (e) {
    return falhaExcecao(e, 'buscarRascunhosCEP')
  }
}

export async function excluirColetaCEP(id: string): Promise<ResultadoAction> {
  try {
    const { error } = await supabase.from('cep_coletas').delete().eq('id', id)
    if (error) return falha(error, 'excluirColetaCEP')
    return { ok: true }
  } catch (e) {
    return falhaExcecao(e, 'excluirColetaCEP')
  }
}
