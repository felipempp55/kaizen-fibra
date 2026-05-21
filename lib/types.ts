export type Classificacao = 'perda' | 'retrabalho'
export type UnidadeMedida = 'pecas' | 'ml'
export type OpcaoClassificacao = 'perda_retrabalho' | 'nenhum'
export type OpcaoTempo = 'sempre' | 'nunca' | 'se_retrabalho'

export type OpcaoInput = 'teclado' | 'contador' | 'contador_duplo'

export interface TipoDesperdicio {
  nome: string
  unidade: UnidadeMedida
  classificacao: OpcaoClassificacao
  tempo: OpcaoTempo
  /** Quando definido, salva essa classificação automaticamente sem perguntar */
  classificacao_fixa?: Classificacao
  /** Label customizado para o campo de quantidade principal */
  label_quantidade?: string
  /** Quando definido, coleta uma segunda quantidade (armazenada em quantidade_ml) */
  segunda_quantidade?: { label: string }
  /** Forma de entrada da quantidade principal: teclado numérico (padrão) ou contador +1 */
  input?: OpcaoInput
}

export interface GrupoDesperdicio {
  nome: string
  tipos: TipoDesperdicio[]
}

export interface Apontamento {
  id: string
  created_at: string
  grupo: string
  tipo_desperdicio: string
  nome_operador: string
  numero_op: string
  quantidade_pecas: number | null
  quantidade_ml: number | null
  classificacao: Classificacao | null
  tempo_minutos: number | null
  observacao: string | null
}

export interface NovoApontamento {
  grupo: string
  tipo_desperdicio: string
  nome_operador: string
  numero_op: string
  quantidade_pecas: number | null
  quantidade_ml: number | null
  classificacao: Classificacao | null
  tempo_minutos: number | null
  observacao: string | null
}

// ─── CEP ───────────────────────────────────────────────────────────────────

export interface AmostraCEP {
  numero: number
  resultado?: 'ok' | 'nok'
  valor?: number
}

export interface NovaCEPColeta {
  ctq_id: string
  ctq_nome: string
  tipo: 'atributo' | 'variavel'
  instrumento: string
  data_coleta: string
  numero_op: string
  nome_operador: string
  total_amostras: number
  total_ok: number | null
  total_nok: number | null
  media: number | null
  desvio_padrao: number | null
  valor_minimo: number | null
  valor_maximo: number | null
  amostras: AmostraCEP[]
  status: 'finalizado' | 'rascunho'
}

export interface RascunhoCEP {
  id: string
  created_at: string
  ctq_id: string
  ctq_nome: string
  tipo: 'atributo' | 'variavel'
  instrumento: string
  data_coleta: string
  numero_op: string
  nome_operador: string
  total_amostras: number
  total_ok: number | null
  total_nok: number | null
  amostras: AmostraCEP[]
  status: 'rascunho'
}

export interface DadosIniciaisCEP {
  rascunhoId: string
  ctq_id: string
  ctq_nome: string
  tipo: 'atributo' | 'variavel'
  instrumento: string
  dataColeta: string
  numeroOP: string
  nomeOperador: string
  amostrasPreenchidas: AmostraCEP[]
  totalAmostras: number
}

export type Database = {
  public: {
    Tables: {
      apontamentos: {
        Row: Apontamento
        Insert: NovoApontamento & { id?: string; created_at?: string }
        Update: Partial<NovoApontamento>
      }
    }
    Views: {
      [key: string]: {
        Row: Record<string, unknown>
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
