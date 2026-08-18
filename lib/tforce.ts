// ─── Taxonomia de retrabalhos da linha Sonda Extratora T-Force ────────────────
//
// Estrutura em 3 níveis (a fibra tem 2):
//   PI (Produto Intermediário) → Operação → Modo de falha
//
// Mapeamento conforme "RETRABALHOS TFORCE" (jun/2026).
// PIs marcados "X" no documento NÃO têm retrabalho e ficam fora desta lista:
//   PI36, PI66, PI62, PI63, PI58, PI57
//   e as operações "Forma" e "Abertura/Fechamento cesta" do PI45.
//
// Código no Dynamics = PI + 7 dígitos. Na tela usamos a forma curta (PI45).

export interface OperacaoTForce {
  nome: string
  /** Modos de falha da operação. Vazio = operação sem detalhamento (seleção direta). */
  modos: string[]
  /** Operação sem retrabalho, registra apenas perda (ex: Solda no PI42). */
  somentePerda?: boolean
}

export interface PITForce {
  /** Código canônico do Dynamics (PI + 7 dígitos) — é o que vai para o banco */
  codigo: string
  /** Forma curta exibida na tela */
  curto: string
  /** Descrição das operações do PI */
  descricao: string
  operacoes: OperacaoTForce[]
}

const PIS_TFORCE_BASE: PITForce[] = [
  {
    codigo: 'PI0000001',
    curto: 'PI1',
    descricao: 'Printagem',
    operacoes: [
      { nome: 'Printagem', modos: ['Falha', 'Fraca', 'Manchada'] },
    ],
  },
  {
    codigo: 'PI0000037',
    curto: 'PI37',
    descricao: 'Moldagem cônica',
    operacoes: [
      { nome: 'Moldagem cônica', modos: ['Ponteira abre', 'Enruga', 'Amassa'] },
    ],
  },
  {
    codigo: 'PI0000083',
    curto: 'PI83',
    descricao: 'Colagem da ponteira',
    operacoes: [
      { nome: 'Colagem do tubo de reforço na ponteira', modos: ['Entupimento do tubo de reforço'] },
      { nome: 'Colagem da ponteira PVC na bainha', modos: ['Encaixe da bainha na ponteira'] },
    ],
  },
  {
    codigo: 'PI0000064',
    curto: 'PI64',
    descricao: 'Moldagem laço',
    operacoes: [
      {
        nome: 'Moldagem laço',
        modos: [
          'Laço aberto',
          'Laço com ondulação',
          'Alteração de temperatura',
          'Troca do fio central (vincar)',
          'Troca do fio central (estourar)',
        ],
      },
    ],
  },
  {
    codigo: 'PI0000065',
    curto: 'PI65',
    descricao: 'Moldagem laço',
    operacoes: [
      {
        nome: 'Moldagem laço',
        modos: [
          'Laço aberto',
          'Laço com ondulação',
          'Alteração de temperatura na moldagem',
          'Troca do fio central (vincar)',
          'Troca do fio central (estourar)',
        ],
      },
    ],
  },
  {
    codigo: 'PI0000042',
    curto: 'PI42',
    descricao: 'Laço no laço · Microtubo · Solda',
    operacoes: [
      { nome: 'Laço no laço', modos: ['Laço A com laço A', 'Abertura do laço', 'Encaixe incompleto'] },
      { nome: 'Microtubo', modos: ['Encaixe incorreto (fio entrelaçado)'] },
      { nome: 'Solda', modos: [], somentePerda: true },
    ],
  },
  {
    codigo: 'PI0000045',
    curto: 'PI45',
    descricao: 'Trança · Pião · Corte dos fios',
    operacoes: [
      { nome: 'Trança incorreta', modos: ['Com defeito', 'Folgada'] },
      { nome: 'Pião', modos: ['Encaixe nas fresas incorreto', 'Sentido incorreto (direita)', 'Sentido incorreto (esquerda)'] },
      { nome: 'Corte dos fios', modos: ['Rebarbas (alicate cego)'] },
    ],
  },
  {
    codigo: 'PI0000046',
    curto: 'PI46',
    descricao: 'Crimpagem · Microtubo · Laser',
    operacoes: [
      { nome: 'Crimpagem', modos: ['Microtubo folgado', 'Microtubo apertado', 'Microtubo torto'] },
      { nome: 'Microtubo', modos: ['Incompatibilidade fio/microtubo (rebarbas)'] },
      { nome: 'Laser', modos: ['Fura a solda'] },
    ],
  },
  {
    codigo: 'PI0000067',
    curto: 'PI67',
    descricao: 'Manopla · Basket · Termorretráteis · Blister',
    operacoes: [
      { nome: 'Manopla', modos: ['Desbaste do corpo branco', 'Incompatibilidade da bucha com parafuso'] },
      { nome: 'Basket na Manopla', modos: ['Acabamento do microtubo (solda com elevação)', 'Crimpagem torta'] },
      { nome: 'Termorretráteis IN', modos: ['Encolhimento', 'Falha no encaixe'] },
      { nome: 'Termorretráteis OUT', modos: ['Encolhimento', 'Falha no encaixe'] },
      { nome: 'Acomodação no blister', modos: ['Blister com defeito'] },
    ],
  },
]

// "Outros" entra automaticamente em todo PI: leva direto para observação + contadores
// de perda/retrabalho, sem materiais (mesmo comportamento inicial do "Outros" da fibra).
export const PIS_TFORCE: PITForce[] = PIS_TFORCE_BASE.map(pi => ({
  ...pi,
  operacoes: [...pi.operacoes, { nome: 'Outros', modos: [] }],
}))

/** Rótulo de exibição do PI: "PI45 · Trança · Pião · Corte dos fios" */
export function rotuloPI(pi: PITForce): string {
  return `${pi.curto} · ${pi.descricao}`
}

export function buscarPI(codigo: string): PITForce | undefined {
  return PIS_TFORCE.find(p => p.codigo === codigo)
}

export const OPERADORAS_TFORCE = [
  'Bruna Silva', 'Bruna Nascimento', 'Edilcélia Jesus', 'Alice Cruz', 'Poliana Vieira',
  'Ana Beatriz', 'Yasmin Batista', 'Leildes Bonfim', 'Silvana Santos', 'Joice Santos',
  'Janete Jesus', 'Lucia Maria', 'Michele Santana', 'Taisa Cruz', 'Elaine Jabaly',
]
