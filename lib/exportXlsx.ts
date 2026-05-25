import * as XLSX from 'xlsx'
import type { Apontamento } from './types'
import { calcularPerdaMateriais, calcularCustoTotal } from './materiais'

function nomeDisplay(s: string) {
  return s.trim().replace(/\b\w/g, c => c.toUpperCase())
}

export function exportarXlsx(apontamentos: Apontamento[]) {
  if (apontamentos.length === 0) {
    alert('Nenhum dado encontrado para exportar.')
    return
  }

  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Dados brutos ─────────────────────────────────────────────────
  const sheet1 = apontamentos.map(a => {
    const itens = calcularPerdaMateriais(a.tipo_desperdicio, a.fibra ?? 'F272', a.quantidade_pecas, a.quantidade_ml)
    const custo = calcularCustoTotal(itens)
    const dt = new Date(a.created_at)
    return {
      'Data':                    dt.toLocaleDateString('pt-BR'),
      'Hora':                    dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      'OP':                      a.numero_op,
      'Fibra':                   a.fibra ?? '',
      'Tamanho OP (pç)':         a.tamanho_op ?? '',
      'Grupo':                   a.grupo,
      'Tipo de Desperdício':     a.tipo_desperdicio,
      'Operadora':               nomeDisplay(a.nome_operador),
      'Qtd Peças':               a.quantidade_pecas ?? 0,
      'Qtd ML':                  a.quantidade_ml ?? 0,
      'Classificação':           a.classificacao ?? '',
      'Tempo Retrabalho (min)':  a.tempo_minutos ?? 0,
      'Custo Estimado (R$)':     parseFloat(custo.toFixed(2)),
    }
  })
  const ws1 = XLSX.utils.json_to_sheet(sheet1)
  ws1['!cols'] = [10, 8, 12, 8, 14, 16, 26, 18, 10, 8, 14, 20, 18].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws1, 'Apontamentos')

  // ── Sheet 2: Resumo por tipo ──────────────────────────────────────────────
  const mTipo = new Map<string, { oc: number; pecas: number; custo: number; tempo: number }>()
  apontamentos.forEach(a => {
    const itens = calcularPerdaMateriais(a.tipo_desperdicio, a.fibra ?? 'F272', a.quantidade_pecas, a.quantidade_ml)
    const custo = calcularCustoTotal(itens)
    const prev = mTipo.get(a.tipo_desperdicio) ?? { oc: 0, pecas: 0, custo: 0, tempo: 0 }
    mTipo.set(a.tipo_desperdicio, {
      oc:    prev.oc + 1,
      pecas: prev.pecas + (a.quantidade_pecas ?? 0),
      custo: prev.custo + custo,
      tempo: prev.tempo + (a.tempo_minutos ?? 0),
    })
  })
  const total = apontamentos.length
  const sheet2 = Array.from(mTipo.entries())
    .sort((a, b) => b[1].oc - a[1].oc)
    .map(([tipo, v]) => ({
      'Tipo de Desperdício':    tipo,
      'Ocorrências':            v.oc,
      '% do Total':             `${((v.oc / total) * 100).toFixed(1)}%`,
      'Total Peças':            v.pecas,
      'Tempo Total (min)':      v.tempo,
      'Custo Estimado (R$)':    parseFloat(v.custo.toFixed(2)),
    }))
  const ws2 = XLSX.utils.json_to_sheet(sheet2)
  ws2['!cols'] = [28, 12, 10, 12, 16, 18].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws2, 'Por Tipo')

  // ── Sheet 3: Por operadora ────────────────────────────────────────────────
  const mOp = new Map<string, { oc: number; perdas: number; retrabalhos: number }>()
  apontamentos.forEach(a => {
    const key = a.nome_operador.trim().toLowerCase()
    const prev = mOp.get(key) ?? { oc: 0, perdas: 0, retrabalhos: 0 }
    mOp.set(key, {
      oc:          prev.oc + 1,
      perdas:      prev.perdas + (a.classificacao === 'perda' ? 1 : 0),
      retrabalhos: prev.retrabalhos + (a.classificacao === 'retrabalho' ? 1 : 0),
    })
  })
  const sheet3 = Array.from(mOp.entries())
    .sort((a, b) => b[1].oc - a[1].oc)
    .map(([op, v]) => ({
      'Operadora':       nomeDisplay(op),
      'Apontamentos':    v.oc,
      'Perdas':          v.perdas,
      'Retrabalhos':     v.retrabalhos,
    }))
  const ws3 = XLSX.utils.json_to_sheet(sheet3)
  ws3['!cols'] = [20, 14, 10, 14].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws3, 'Por Operadora')

  // ── Sheet 4: Por OP ───────────────────────────────────────────────────────
  const mOP = new Map<string, { oc: number; perdas: number; retrabalhos: number; custo: number; tamanho: number | null }>()
  apontamentos.forEach(a => {
    const itens = calcularPerdaMateriais(a.tipo_desperdicio, a.fibra ?? 'F272', a.quantidade_pecas, a.quantidade_ml)
    const custo = calcularCustoTotal(itens)
    const prev = mOP.get(a.numero_op) ?? { oc: 0, perdas: 0, retrabalhos: 0, custo: 0, tamanho: a.tamanho_op }
    mOP.set(a.numero_op, {
      oc:          prev.oc + 1,
      perdas:      prev.perdas + (a.classificacao === 'perda' ? (a.quantidade_pecas ?? 0) : 0),
      retrabalhos: prev.retrabalhos + (a.classificacao === 'retrabalho' ? (a.quantidade_pecas ?? 0) : 0),
      custo:       prev.custo + custo,
      tamanho:     prev.tamanho ?? a.tamanho_op,
    })
  })
  const sheet4 = Array.from(mOP.entries())
    .sort((a, b) => b[1].oc - a[1].oc)
    .map(([op, v]) => ({
      'Número OP':            op,
      'Apontamentos':         v.oc,
      'Peças Perdidas':       v.perdas,
      'Peças Retrabalho':     v.retrabalhos,
      'Tamanho OP (pç)':      v.tamanho ?? '',
      'Taxa Refugo':          v.tamanho ? `${((v.perdas / v.tamanho) * 100).toFixed(2)}%` : 'N/D',
      'Custo Estimado (R$)':  parseFloat(v.custo.toFixed(2)),
    }))
  const ws4 = XLSX.utils.json_to_sheet(sheet4)
  ws4['!cols'] = [14, 14, 14, 16, 14, 12, 18].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws4, 'Por OP')

  const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
  XLSX.writeFile(wb, `MSB_Fibra_Export_${dataHoje}.xlsx`)
}
