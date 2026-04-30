-- Migração v2 — Execute no SQL Editor do Supabase

-- 1. Adicionar coluna nome_operador
ALTER TABLE apontamentos
  ADD COLUMN IF NOT EXISTS nome_operador TEXT NOT NULL DEFAULT '';

-- 2. Adicionar coluna quantidade_ml (para desperdício de epóxi em ml)
ALTER TABLE apontamentos
  ADD COLUMN IF NOT EXISTS quantidade_ml NUMERIC CHECK (quantidade_ml IS NULL OR quantidade_ml > 0);

-- 3. Tornar quantidade_pecas opcional (epóxi usa ml em vez de peças)
ALTER TABLE apontamentos
  ALTER COLUMN quantidade_pecas DROP NOT NULL;

-- 4. Tornar classificacao opcional (alguns tipos não têm classificação)
ALTER TABLE apontamentos
  ALTER COLUMN classificacao DROP NOT NULL;

-- 5. Atualizar constraint de classificacao para aceitar NULL e remover 'ajuste'
ALTER TABLE apontamentos
  DROP CONSTRAINT IF EXISTS apontamentos_classificacao_check;

ALTER TABLE apontamentos
  ADD CONSTRAINT apontamentos_classificacao_check
  CHECK (classificacao IS NULL OR classificacao IN ('perda', 'retrabalho'));

-- 6. Índice para busca por operador
CREATE INDEX IF NOT EXISTS idx_apontamentos_nome_operador ON apontamentos(nome_operador);
