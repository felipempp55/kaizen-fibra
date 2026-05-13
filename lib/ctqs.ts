export type TipoCTQ = 'atributo' | 'variavel'

export interface CTQ {
  id: string
  nome: string
  tipo: TipoCTQ
  instrucao: string
  instrumento: string
  totalAmostras: number
}

export const CTQS: CTQ[] = [
  {
    id: 'superficie_polida',
    nome: 'Superfície do Ferrule Polida',
    tipo: 'atributo',
    instrucao: 'Verificação no microscópio depois da máquina. I-PC-23, ITEM 4.6.13',
    instrumento: 'Microscópio',
    totalAmostras: 56,
  },
  {
    id: 'comprimento_ferrule',
    nome: 'Comprimento do Ferrule',
    tipo: 'variavel',
    instrucao: 'Medição com relógio comparador pós etapa manual de polimento. I-PC-23, ITEM 4.6.7 — Antes de ir para a máquina.',
    instrumento: 'Relógio Comparador',
    totalAmostras: 56,
  },
  {
    id: 'corte_uniforme',
    nome: 'Corte Uniforme da Ponta Distal',
    tipo: 'atributo',
    instrucao: 'Inspeção em microscópio e verificação da intensidade e formato da luz transmitida após etapa de clivagem da ponta distal. I-PC-23, ITEM 4.6.19',
    instrumento: 'Microscópio',
    totalAmostras: 57,
  },
  {
    id: 'dimensao_ferrule',
    nome: 'Dimensão do Ferrule — Pós Máquina',
    tipo: 'variavel',
    instrucao: 'Medição com relógio comparador conforme I-PC-23, ITEM 4.6.13.',
    instrumento: 'Relógio Comparador',
    totalAmostras: 56,
  },
]
