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
        input: 'contador',
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
        input: 'contador',
      },
      {
        nome: 'Máquina',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'nunca',
        label_quantidade: 'Peças enviadas ao retrabalho manual',
        segunda_quantidade: { label: 'Peças perdidas no retrabalho' },
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
        nome: 'Clivagem com Defeito',
        unidade: 'pecas',
        classificacao: 'nenhum',
        tempo: 'nunca',
        label_quantidade: 'Retrabalhos',
        segunda_quantidade: { label: 'Peças perdidas' },
        input: 'contador_duplo',
      },
    ],
  },
]
