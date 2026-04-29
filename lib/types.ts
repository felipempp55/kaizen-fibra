export type Classificacao = 'perda' | 'retrabalho' | 'ajuste'

export interface Apontamento {
  id: string
  created_at: string
  grupo: string
  tipo_desperdicio: string
  numero_op: string
  quantidade_pecas: number
  classificacao: Classificacao
  tempo_minutos: number | null
  observacao: string | null
}

export interface NovoApontamento {
  grupo: string
  tipo_desperdicio: string
  numero_op: string
  quantidade_pecas: number
  classificacao: Classificacao
  tempo_minutos: number | null
  observacao: string | null
}

export interface GrupoDesperdicio {
  nome: string
  tipos: string[]
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
