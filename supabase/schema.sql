-- Kaizen Fibra - Schema do Banco de Dados
-- Execute este script no SQL Editor do Supabase

-- Tabela principal de registros de desperdício
CREATE TABLE IF NOT EXISTS apontamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Identificação do desperdício
  grupo TEXT NOT NULL,
  tipo_desperdicio TEXT NOT NULL,

  -- Dados da produção
  numero_op TEXT NOT NULL,
  quantidade_pecas INTEGER NOT NULL CHECK (quantidade_pecas > 0),

  -- Classificação
  classificacao TEXT NOT NULL CHECK (classificacao IN ('perda', 'retrabalho', 'ajuste')),

  -- Tempo gasto (opcional)
  tempo_minutos INTEGER CHECK (tempo_minutos IS NULL OR tempo_minutos > 0),

  -- Observações opcionais
  observacao TEXT
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_apontamentos_created_at ON apontamentos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apontamentos_grupo ON apontamentos(grupo);
CREATE INDEX IF NOT EXISTS idx_apontamentos_numero_op ON apontamentos(numero_op);
CREATE INDEX IF NOT EXISTS idx_apontamentos_classificacao ON apontamentos(classificacao);

-- Habilitar Row Level Security
ALTER TABLE apontamentos ENABLE ROW LEVEL SECURITY;

-- Política: leitura e escrita pública (ajuste conforme necessário para autenticação)
CREATE POLICY "Permitir leitura pública" ON apontamentos
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserção pública" ON apontamentos
  FOR INSERT WITH CHECK (true);

-- View para resumo por grupo e tipo
CREATE OR REPLACE VIEW resumo_desperdicio AS
SELECT
  grupo,
  tipo_desperdicio,
  classificacao,
  COUNT(*) AS total_registros,
  SUM(quantidade_pecas) AS total_pecas,
  SUM(COALESCE(tempo_minutos, 0)) AS total_minutos,
  DATE_TRUNC('day', created_at) AS data
FROM apontamentos
GROUP BY grupo, tipo_desperdicio, classificacao, DATE_TRUNC('day', created_at)
ORDER BY data DESC, total_pecas DESC;
