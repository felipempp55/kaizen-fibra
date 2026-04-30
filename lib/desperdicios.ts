import type { GrupoDesperdicio } from './types'

export const GRUPOS_DESPERDICIO: GrupoDesperdicio[] = [
  {
    nome: 'Epóxi',
    tipos: [
      'Mistura incorreta de epóxi',
      'Tempo de cura inadequado',
      'Contaminação química',
      'Dosagem incorreta',
    ],
  },
  {
    nome: 'Problemas Dimensionais',
    tipos: [
      'Fora de tolerância dimensional',
      'Desvio de concentricidade',
      'Comprimento incorreto',
      'Diâmetro fora de especificação',
    ],
  },
  {
    nome: 'Processos Manuais / Variabilidade',
    tipos: [
      'Variabilidade no processo manual',
      'Erro de operador',
      'Falta de padronização',
    ],
  },
  {
    nome: 'Polimento Automático',
    tipos: [
      'Polimento inadequado',
      'Falha no ciclo automático',
    ],
  },
  {
    nome: 'Medição / Controle',
    tipos: [
      'Desvio de medição / controle',
    ],
  },
  {
    nome: 'Corte / Desencape / Inserção',
    tipos: [
      'Corte incorreto',
      'Desencape inadequado',
      'Inserção com falha',
    ],
  },
  {
    nome: 'Clivagem',
    tipos: [
      'Clivagem com defeito',
    ],
  },
  {
    nome: 'Preparação de Material',
    tipos: [
      'Preparação de material inadequada',
    ],
  },
]

export const CLASSIFICACOES = [
  { valor: 'perda', label: 'Perda', cor: 'bg-red-500 hover:bg-red-600 active:bg-red-700' },
  { valor: 'retrabalho', label: 'Retrabalho', cor: 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700' },
  { valor: 'ajuste', label: 'Ajuste', cor: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700' },
] as const
