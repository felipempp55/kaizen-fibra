export type Classificacao = 'perda' | 'retrabalho'
export type UnidadeMedida = 'pecas' | 'ml'
export type OpcaoClassificacao = 'perda_retrabalho' | 'nenhum'
export type OpcaoTempo = 'sempre' | 'nunca' | 'se_retrabalho'

export interface TipoDesperdicio {
  nome: string
  unidade: UnidadeMedida
  classificacao: OpcaoClassificacao
  tempo: OpcaoTempo
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
