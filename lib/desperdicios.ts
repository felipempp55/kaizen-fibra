import type { GrupoDesperdicio } from './types'

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
    nome: 'Polimento',
    tipos: [
      {
        nome: 'Manual',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'nunca',
        label_quantidade: 'Quantidade atingida (peças)',
      },
      {
        nome: 'Máquina',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'sempre',
        label_quantidade: 'Peças enviadas ao retrabalho manual',
        segunda_quantidade: { label: 'Peças perdidas no retrabalho' },
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
        classificacao: 'nenhum',
        tempo: 'nunca',
        label_quantidade: 'Peças perdidas',
        segunda_quantidade: { label: 'Peças retrabalhadas' },
      },
    ],
  },
  {
    nome: 'Clivagem',
    tipos: [
      {
        nome: 'Clivagem com Defeito',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'sempre',
        label_quantidade: 'Peças perdidas',
        segunda_quantidade: { label: 'Peças retrabalhadas' },
      },
    ],
  },
]
