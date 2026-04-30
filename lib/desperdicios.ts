import type { GrupoDesperdicio } from './types'

export const GRUPOS_DESPERDICIO: GrupoDesperdicio[] = [
  {
    nome: 'Epóxi',
    tipos: [
      {
        nome: 'Entupimento do Ferrule',
        unidade: 'pecas',
        classificacao: 'perda_retrabalho',
        tempo: 'nunca',
      },
      {
        nome: 'Quantidade desperdiçada de Epóxi',
        unidade: 'ml',
        classificacao: 'nenhum',
        tempo: 'nunca',
      },
    ],
  },
  {
    nome: 'Problemas Dimensionais',
    tipos: [
      {
        nome: 'Recuo de Fibra',
        unidade: 'pecas',
        classificacao: 'perda_retrabalho',
        tempo: 'nunca',
      },
      {
        nome: 'Polimento do Recartilhado do SMA',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'sempre',
      },
      {
        nome: 'União Hub x SMA',
        unidade: 'pecas',
        classificacao: 'perda_retrabalho',
        tempo: 'nunca',
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
      },
      {
        nome: 'Máquina',
        unidade: 'pecas',
        classificacao: 'perda_retrabalho',
        tempo: 'se_retrabalho',
      },
    ],
  },
  {
    nome: 'Clivagem',
    tipos: [
      {
        nome: 'Clivagem com Defeito',
        unidade: 'pecas',
        classificacao: 'perda_retrabalho',
        tempo: 'nunca',
      },
    ],
  },
]
