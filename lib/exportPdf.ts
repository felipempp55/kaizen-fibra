import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Apontamento } from './types'
import { calcularPerdaMateriais, calcularCustoTotal, formatarReal } from './materiais'
import { TIPOS_DUPLO_RETRABALHO_PERDA } from './desperdicios'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nomeDisplay(s: string) { return s.trim().replace(/\b\w/g, c => c.toUpperCase()) }
function pct(v: number, t: number) { return t > 0 ? `${((v / t) * 100).toFixed(1)}%` : 'N/D' }
function fmtDt(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}
function formatTempoMs(ms: number) {
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : m > 0 ? `${m}min` : `${Math.floor(ms / 1000)}s`
}

// Cores padrão
const COR_DEEP:   [number, number, number] = [31, 55, 68]
const COR_BRAND:  [number, number, number] = [86, 164, 187]
const COR_SOFT:   [number, number, number] = [245, 247, 249]
const COR_WHITE:  [number, number, number] = [255, 255, 255]
const COR_MUTED:  [number, number, number] = [96, 122, 137]
const COR_AMBER:  [number, number, number] = [212, 161, 85]
const COR_RED:    [number, number, number] = [200, 80, 79]
const COR_GREEN:  [number, number, number] = [34, 197, 94]

const PL = 14, PR = 14, PW = 210 - PL - PR

// Retorna nova posição Y. Se passar do limite da página, adiciona nova.
function checkPage(doc: jsPDF, y: number, needed = 12): number {
  if (y + needed > 280) { doc.addPage(); return 16 }
  return y
}

function sectionTitle(doc: jsPDF, texto: string, y: number): number {
  doc.setFillColor(...COR_BRAND)
  doc.rect(PL, y, 3, 5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COR_DEEP)
  doc.text(texto.toUpperCase(), PL + 6, y + 3.8)
  return y + 9
}

function barChart(
  doc: jsPDF,
  dados: { label: string; valor: number }[],
  x: number, y: number, w: number,
  cor: [number, number, number] = COR_BRAND
): number {
  const maxV = Math.max(...dados.map(d => d.valor), 1)
  const barH = 5, gap = 3
  dados.forEach(d => {
    const bw = Math.max((d.valor / maxV) * (w - 40), 1)
    // label
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COR_MUTED)
    doc.text(d.label.length > 18 ? d.label.slice(0, 17) + '…' : d.label, x, y + barH - 1)
    // barra
    doc.setFillColor(...COR_SOFT)
    doc.roundedRect(x + 40, y, w - 40, barH, 1, 1, 'F')
    doc.setFillColor(...cor)
    doc.roundedRect(x + 40, y, bw, barH, 1, 1, 'F')
    // valor
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COR_DEEP)
    doc.text(String(d.valor), x + w + 2, y + barH - 1)
    y += barH + gap
  })
  return y
}

// ─── Função principal ─────────────────────────────────────────────────────────
export async function gerarRelatorioPDF(
  apontamentos: Apontamento[],
  temposRetrabalho: { tempo_ms: number; custo_hh: number }[],
  numeroOP: string
) {
  if (apontamentos.length === 0) throw new Error('Nenhum apontamento encontrado para a OP ' + numeroOP)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = 0

  // ── CABEÇALHO ─────────────────────────────────────────────────────────────
  doc.setFillColor(...COR_DEEP)
  doc.rect(0, 0, 210, 45, 'F')

  // Faixa de acento
  doc.setFillColor(...COR_BRAND)
  doc.rect(0, 42, 210, 3, 'F')

  doc.setTextColor(...COR_WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('MSB · MEDICAL SYSTEM DO BRASIL · FIBRA ÓPTICA', PL, 12)

  doc.setFontSize(18)
  doc.text('RELATÓRIO DE ORDEM DE PRODUÇÃO', PL, 24)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COR_BRAND)
  doc.text(`Gerado em ${fmtDt(new Date().toISOString())}`, PL, 35)

  // Badge OP no canto direito
  const opLabel = `OP ${numeroOP}`
  doc.setFillColor(...COR_BRAND)
  doc.roundedRect(210 - PR - 42, 10, 44, 14, 3, 3, 'F')
  doc.setTextColor(...COR_DEEP)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(opLabel, 210 - PR - 40, 19)

  y = 52

  // ── DADOS PARA PROCESSAMENTO ───────────────────────────────────────────────
  const sorted = [...apontamentos].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const fibra = sorted[0].fibra ?? 'F272'
  const tamanhoOp = sorted.find(a => a.tamanho_op)?.tamanho_op ?? null
  const dataInicio = sorted[0].created_at
  const dataFim = sorted[sorted.length - 1].created_at

  // Operadoras únicas
  const opSet = new Map<string, number>()
  sorted.forEach(a => {
    const k = a.nome_operador.trim().toLowerCase()
    opSet.set(k, (opSet.get(k) ?? 0) + 1)
  })
  const operadorasStr = [...opSet.keys()].map(nomeDisplay).join(', ')

  // Cálculos gerais
  const ricos = sorted.map(a => {
    const itens = calcularPerdaMateriais(a.tipo_desperdicio, fibra, a.quantidade_pecas, a.quantidade_ml)
    return { ...a, custo: calcularCustoTotal(itens) }
  })
  const custoTotal = ricos.reduce((s, a) => s + a.custo, 0)
  const pecasPerdidas = sorted.filter(a => a.classificacao === 'perda').reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)
    + sorted.filter(a => a.tipo_desperdicio === 'Crimpagem').reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)
    + sorted.filter(a => TIPOS_DUPLO_RETRABALHO_PERDA.includes(a.tipo_desperdicio)).reduce((s, a) => s + (a.quantidade_ml ?? 0), 0)
  // Nº total de retrabalhos apontados (soma de quantidades, não contagem de apontamentos).
  // Máquina e Clivagens guardam os retrabalhos no 1º campo (quantidade_pecas).
  // Soma-se também apontamentos explicitamente classificados como 'retrabalho'.
  const numRetrabalhos = sorted.filter(a => TIPOS_DUPLO_RETRABALHO_PERDA.includes(a.tipo_desperdicio)).reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)
    + sorted.filter(a => a.classificacao === 'retrabalho').reduce((s, a) => s + (a.quantidade_pecas ?? 0), 0)
  const tempoRetMin = sorted.reduce((s, a) => s + (a.tempo_minutos ?? 0), 0)
  const totalTempoMs = temposRetrabalho.reduce((s, t) => s + t.tempo_ms, 0)

  // Por tipo
  const mTipo = new Map<string, { oc: number; pecas: number; custo: number }>()
  ricos.forEach(a => {
    const prev = mTipo.get(a.tipo_desperdicio) ?? { oc: 0, pecas: 0, custo: 0 }
    mTipo.set(a.tipo_desperdicio, { oc: prev.oc + 1, pecas: prev.pecas + (a.quantidade_pecas ?? 0), custo: prev.custo + a.custo })
  })
  const porTipoOc  = [...mTipo.entries()].sort((a, b) => b[1].oc - a[1].oc)
  const porTipoCusto = [...mTipo.entries()].sort((a, b) => b[1].custo - a[1].custo)

  // Por grupo
  const mGrupo = new Map<string, { oc: number; custo: number }>()
  ricos.forEach(a => {
    const prev = mGrupo.get(a.grupo) ?? { oc: 0, custo: 0 }
    mGrupo.set(a.grupo, { oc: prev.oc + 1, custo: prev.custo + a.custo })
  })
  const porGrupo = [...mGrupo.entries()].sort((a, b) => b[1].oc - a[1].oc)

  // ── RASTREABILIDADE ────────────────────────────────────────────────────────
  y = sectionTitle(doc, 'Rastreabilidade', y)

  const rastrRows: [string, string][] = [
    ['Número da OP',          numeroOP],
    ['Tipo de Fibra',         fibra === 'F272' ? 'Fibra 272' : 'Fibra 365'],
    ['Tamanho da OP',         tamanhoOp ? `${tamanhoOp.toLocaleString('pt-BR')} peças` : 'Não informado'],
    ['Data de Início',        fmtDt(dataInicio)],
    ['Último Registro',       fmtDt(dataFim)],
    ['Operadoras Envolvidas', operadorasStr],
    ['Total de Apontamentos', String(sorted.length)],
  ]

  autoTable(doc, {
    startY: y,
    body: rastrRows,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: COR_MUTED, cellWidth: 58 },
      1: { textColor: COR_DEEP },
    },
    margin: { left: PL, right: PR },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ── RESUMO EXECUTIVO ───────────────────────────────────────────────────────
  y = checkPage(doc, y, 40)
  y = sectionTitle(doc, 'Resumo Executivo', y)

  const cellW = PW / 3 - 1.5
  const kpis = [
    { label: 'Peças Perdidas',      valor: String(pecasPerdidas),       cor: pecasPerdidas > 0 ? COR_RED : COR_DEEP },
    { label: 'Nº de Retrabalhos',   valor: String(numRetrabalhos),       cor: COR_AMBER },
    { label: 'Taxa de Refugo',      valor: tamanhoOp ? `${((pecasPerdidas / tamanhoOp) * 100).toFixed(2)}%` : 'N/D', cor: COR_RED },
    { label: 'Custo Material',      valor: formatarReal(custoTotal),    cor: COR_DEEP },
    { label: '% de Retrabalho',     valor: tamanhoOp ? `${((numRetrabalhos / tamanhoOp) * 100).toFixed(2)}%` : 'N/D', cor: COR_AMBER },
    { label: 'Tempo Manual (crôn.)',valor: totalTempoMs > 0 ? formatTempoMs(totalTempoMs) : `${tempoRetMin}min`, cor: COR_BRAND },
  ]

  kpis.forEach((kpi, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const kx = PL + col * (cellW + 1.5)
    const ky = y + row * 22
    doc.setFillColor(...COR_SOFT)
    doc.roundedRect(kx, ky, cellW, 18, 2, 2, 'F')
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COR_MUTED)
    doc.text(kpi.label.toUpperCase(), kx + 3, ky + 6)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...kpi.cor)
    doc.text(kpi.valor, kx + 3, ky + 14)
  })
  y += 46

  // ── TOP DESPERDÍCIOS POR OCORRÊNCIA ────────────────────────────────────────
  y = checkPage(doc, y, 50)
  y = sectionTitle(doc, 'Ranking por Ocorrência', y)

  autoTable(doc, {
    startY: y,
    head: [['#', 'Tipo de Desperdício', 'Ocorrências', '% Total', 'Custo Estimado']],
    body: porTipoOc.map(([tipo, v], i) => [
      String(i + 1), tipo, String(v.oc), pct(v.oc, sorted.length), formatarReal(v.custo),
    ]),
    theme: 'striped',
    headStyles: { fillColor: COR_DEEP, fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'right' },
    },
    margin: { left: PL, right: PR },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ── TOP DESPERDÍCIOS POR CUSTO ─────────────────────────────────────────────
  y = checkPage(doc, y, 50)
  y = sectionTitle(doc, 'Ranking por Custo de Material', y)

  autoTable(doc, {
    startY: y,
    head: [['#', 'Tipo de Desperdício', 'Ocorrências', 'Custo Estimado', '% Custo Total']],
    body: porTipoCusto.slice(0, 8).map(([tipo, v], i) => [
      String(i + 1), tipo, String(v.oc), formatarReal(v.custo),
      pct(v.custo, custoTotal),
    ]),
    theme: 'striped',
    headStyles: { fillColor: COR_AMBER, textColor: COR_DEEP, fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'center' },
    },
    margin: { left: PL, right: PR },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ── POR GRUPO (tabela + mini gráfico) ─────────────────────────────────────
  y = checkPage(doc, y, 50)
  y = sectionTitle(doc, 'Por Grupo de Desperdício', y)

  autoTable(doc, {
    startY: y,
    head: [['Grupo', 'Ocorrências', '% Total', 'Custo Estimado']],
    body: porGrupo.map(([grupo, v]) => [
      grupo, String(v.oc), pct(v.oc, sorted.length), formatarReal(v.custo),
    ]),
    theme: 'striped',
    headStyles: { fillColor: COR_BRAND, textColor: COR_DEEP, fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
    },
    margin: { left: PL, right: PR },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // Mini barchart de grupos
  y = checkPage(doc, y, (porGrupo.length * 9) + 4)
  y = barChart(doc, porGrupo.map(([g, v]) => ({ label: g, valor: v.oc })), PL, y, PW * 0.6, COR_BRAND)
  y += 8

  // ── POR OPERADORA ─────────────────────────────────────────────────────────
  y = checkPage(doc, y, 50)
  y = sectionTitle(doc, 'Por Operadora', y)

  autoTable(doc, {
    startY: y,
    head: [['Operadora', 'Apontamentos', '% Total', 'Perdas', 'Retrabalhos']],
    body: [...opSet.entries()].sort((a, b) => b[1] - a[1]).map(([op, oc]) => {
      const perdas = sorted.filter(a => a.nome_operador.trim().toLowerCase() === op && a.classificacao === 'perda').length
      const ret = sorted.filter(a => a.nome_operador.trim().toLowerCase() === op && a.classificacao === 'retrabalho').length
      return [nomeDisplay(op), String(oc), pct(oc, sorted.length), String(perdas), String(ret)]
    }),
    theme: 'striped',
    headStyles: { fillColor: [139, 92, 246] as [number, number, number], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
    margin: { left: PL, right: PR },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ── LINHA DO TEMPO COMPLETA ───────────────────────────────────────────────
  y = checkPage(doc, y, 20)
  y = sectionTitle(doc, 'Linha do Tempo — Todos os Apontamentos', y)

  autoTable(doc, {
    startY: y,
    head: [['Data/Hora', 'Grupo', 'Tipo', 'Operadora', 'Qtd', 'Class.', 'R$']],
    body: sorted.map(a => {
      const itens = calcularPerdaMateriais(a.tipo_desperdicio, fibra, a.quantidade_pecas, a.quantidade_ml)
      const custo = calcularCustoTotal(itens)
      return [
        fmtDt(a.created_at),
        a.grupo,
        a.tipo_desperdicio,
        nomeDisplay(a.nome_operador),
        String(a.quantidade_pecas ?? a.quantidade_ml ?? 0),
        a.classificacao ?? '—',
        custo > 0 ? formatarReal(custo) : '—',
      ]
    }),
    theme: 'striped',
    headStyles: { fillColor: COR_DEEP, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 6.5 },
    columnStyles: {
      0: { cellWidth: 30 },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'right' },
    },
    margin: { left: PL, right: PR },
  })

  // ── RODAPÉ em todas as páginas ────────────────────────────────────────────
  const totalPags = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= totalPags; i++) {
    doc.setPage(i)
    doc.setFillColor(...COR_DEEP)
    doc.rect(0, 290, 210, 10, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...COR_BRAND)
    doc.text('MSB · Kaizen Fibra Óptica · Documento gerado automaticamente', PL, 296)
    doc.setTextColor(150, 170, 180)
    doc.text(`Página ${i} de ${totalPags}`, 210 - PR, 296, { align: 'right' })
  }

  doc.save(`Relatorio_OP_${numeroOP}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`)
}
