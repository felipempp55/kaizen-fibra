import type { GrupoDesperdicio } from './types'

// Tipos contador_duplo cujo 1º campo (quantidade_pecas) = retrabalho e 2º (quantidade_ml) = perda.
// Inclui o tipo legado 'Clivagem com Defeito' para manter o histórico nos cálculos.
export const TIPOS_DUPLO_RETRABALHO_PERDA = ['Máquina', 'Clivagem com Defeito', 'Clivagem Proximal', 'Clivagem Distal']

export const GRUPOS_DESPERDICIO: GrupoDesperdicio[] = [
  {
    nome: 'Epóxi',
    tipos: [
      {
        nome: 'Entupimento do Ferrule',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'nunca',
        classificacao_fixa: 'perda',
        label_quantidade: 'Quantidade perdida (peças)',
        input: 'contador',
      },
      {
        nome: 'Quantidade desperdiçada de Epóxi',
        unidade: 'ml',
        classificacao: 'nenhum',
        tempo: 'nunca',
        decimal: true,
        semExtras: true,   // líquido (ml) — não tem materiais para marcar
      },
    ],
  },
  {
    nome: 'Polimento',
    tipos: [
      {
        nome: 'Manual',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'nunca',
        label_quantidade: 'Quantidade atingida (peças)',
        input: 'contador',
      },
      {
        nome: 'Máquina',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'nunca',
        label_quantidade: 'Quantidade de retrabalhos (Máquina e Manual)',
        segunda_quantidade: { label: 'Peças perdidas na máquina ou no retrabalho' },
        input: 'contador_duplo',
      },
    ],
  },
  {
    nome: 'Problemas Dimensionais',
    tipos: [
      {
        nome: 'Recuo de Fibra',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'nunca',
        classificacao_fixa: 'perda',
        label_quantidade: 'Unidades perdidas',
        input: 'contador',
      },
      {
        nome: 'Polimento do Recartilhado do SMA',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'sempre',
      },
      {
        nome: 'Crimpagem',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'nunca',
        label_quantidade: 'Peças perdidas',
        segunda_quantidade: { label: 'Quantidade que foi para a manutenção' },
        input: 'contador_duplo',
      },
    ],
  },
  {
    nome: 'Clivagem',
    tipos: [
      {
        nome: 'Clivagem Proximal',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'nunca',
        label_quantidade: 'Retrabalhos',
        segunda_quantidade: { label: 'Peças perdidas' },
        input: 'contador_duplo',
      },
      {
        nome: 'Clivagem Distal',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'nunca',
        label_quantidade: 'Retrabalhos',
        segunda_quantidade: { label: 'Peças perdidas' },
        input: 'contador_duplo',
      },
    ],
  },
  {
    nome: 'Outros',
    tipos: [
      {
        nome: 'Outros',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'nunca',
        classificacao_fixa: 'perda',
        label_quantidade: 'Quantidade perdida (peças)',
        input: 'outros',
      },
    ],
  },
]

// Nome do grupo especial que recebe tratamento próprio na UI (fora da grade de grupos)
export const GRUPO_OUTROS = 'Outros'
