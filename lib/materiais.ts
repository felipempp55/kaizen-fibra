import type { TipoFibra } from './types'

// ─── Cadastro de materiais ────────────────────────────────────────────────────

export interface Material {
  codigo: string
  nome: string
  custo: number   // R$ por unidade
}

export const MATERIAIS = {
  PARTE_A:     { codigo: 'MP0000380', nome: 'Conector SMA Parte A',     custo: 32.24 } as Material,
  PARTE_B_272: { codigo: 'MP0000381', nome: 'Conector SMA Parte B 272', custo:  7.35 } as Material,
  PARTE_B_365: { codigo: 'MP0000382', nome: 'Conector SMA Parte B 365', custo:  7.35 } as Material,
  FERRULE_272: { codigo: 'MP0000375', nome: 'Ferrule 272',              custo: 19.61 } as Material,
  FERRULE_365: { codigo: 'MP0000376', nome: 'Ferrule 365',              custo: 32.92 } as Material,
  HUB:         { codigo: 'MP0000389', nome: 'Hub para Conector SMA',    custo:  5.72 } as Material,
  CANULA:      { codigo: 'MP0000374', nome: 'Cânula de Fibra Óptica',   custo: 26.49 } as Material,
}

// ─── Item de perda ────────────────────────────────────────────────────────────

export interface ItemPerda {
  material: Material
  quantidade: number
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function parteB(fibra: TipoFibra): Material {
  return fibra === 'F272' ? MATERIAIS.PARTE_B_272 : MATERIAIS.PARTE_B_365
}

function ferrule(fibra: TipoFibra): Material {
  return fibra === 'F272' ? MATERIAIS.FERRULE_272 : MATERIAIS.FERRULE_365
}

/** Parte A + Parte B + Ferrule (montagem SMA completa) */
function smaCompleto(fibra: TipoFibra, qty: number): ItemPerda[] {
  if (qty <= 0) return []
  return [
    { material: MATERIAIS.PARTE_A, quantidade: qty },
    { material: parteB(fibra),     quantidade: qty },
    { material: ferrule(fibra),    quantidade: qty },
  ]
}

/** Parte A + Ferrule (sem Parte B — entupimento de ferrule) */
function smaBasico(fibra: TipoFibra, qty: number): ItemPerda[] {
  if (qty <= 0) return []
  return [
    { material: MATERIAIS.PARTE_A, quantidade: qty },
    { material: ferrule(fibra),    quantidade: qty },
  ]
}

/** Agrupa itens repetidos pelo código do material */
function consolidar(itens: ItemPerda[]): ItemPerda[] {
  const mapa = new Map<string, ItemPerda>()
  for (const item of itens) {
    const chave = item.material.codigo
    if (mapa.has(chave)) {
      mapa.get(chave)!.quantidade += item.quantidade
    } else {
      mapa.set(chave, { ...item })
    }
  }
  return Array.from(mapa.values())
}

// ─── Regras de perda por tipo de desperdício ──────────────────────────────────
//
// Mapeamento:
//   Entupimento do Ferrule        qPecas  →  Parte A + Ferrule
//   Máquina (Polimento)           qMl     →  Parte A + Parte B + Ferrule  (peças perdidas no retrabalho)
//   Recuo de Fibra                qPecas  →  Parte A + Parte B + Ferrule
//   Polimento do Recartilhado SMA qPecas  →  Parte A + Parte B + Ferrule
//   Crimpagem                     qPecas  →  Parte A + Parte B + Ferrule + Hub
//                                 qMl     →  Hub  (peças que foram para manutenção)
//   Clivagem com Defeito          qMl     →  Cânula  (peças perdidas)
//
//   Observação: "Quantidade desperdiçada de Epóxi" ainda não tem custo cadastrado.

export function calcularPerdaMateriais(
  tipo_desperdicio: string,
  fibra: TipoFibra,
  quantidade_pecas: number | null,
  quantidade_ml: number | null,
): ItemPerda[] {
  const qP = quantidade_pecas ?? 0
  const qM = quantidade_ml   ?? 0

  switch (tipo_desperdicio) {

    case 'Entupimento do Ferrule':
      return smaBasico(fibra, qP)

    case 'Máquina':
      // qMl = peças perdidas no retrabalho
      return smaCompleto(fibra, qM)

    case 'Recuo de Fibra':
      return smaCompleto(fibra, qP)

    case 'Polimento do Recartilhado do SMA':
      return smaCompleto(fibra, qP)

    case 'Crimpagem': {
      // qP = peças perdidas → SMA completo + Hub
      // qM = peças para manutenção → Hub apenas
      const itens: ItemPerda[] = [
        ...smaCompleto(fibra, qP),
        ...(qP > 0 ? [{ material: MATERIAIS.HUB, quantidade: qP }] : []),
        ...(qM > 0 ? [{ material: MATERIAIS.HUB, quantidade: qM }] : []),
      ]
      return consolidar(itens)
    }

    case 'Clivagem com Defeito':   // tipo legado (mantido p/ histórico)
    case 'Clivagem Distal':
      // qM = peças perdidas → Cânula (MP374, "Fibra")
      return qM > 0 ? [{ material: MATERIAIS.CANULA, quantidade: qM }] : []

    case 'Clivagem Proximal':
      // Sem material atrelado ainda (aguardando informações)
      return []

    default:
      return []
  }
}

// ─── Utilidade ────────────────────────────────────────────────────────────────

export function calcularCustoTotal(itens: ItemPerda[]): number {
  return itens.reduce((soma, i) => soma + i.material.custo * i.quantidade, 0)
}

export function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
