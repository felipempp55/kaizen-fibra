-- Tabela de coletas CEP (Controle Estatístico de Processo)
CREATE TABLE IF NOT EXISTS cep_coletas (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Identificação do CTQ
  ctq_id          TEXT        NOT NULL,
  ctq_nome        TEXT        NOT NULL,
  tipo            TEXT        NOT NULL CHECK (tipo IN ('atributo', 'variavel')),

  -- Dados gerais da coleta
  instrumento     TEXT,
  data_coleta     DATE        NOT NULL,
  numero_op       TEXT        NOT NULL,
  nome_operador   TEXT        NOT NULL,
  total_amostras  INTEGER     NOT NULL,

  -- Estatísticas atributo
  total_ok        INTEGER,
  total_nok       INTEGER,

  -- Estatísticas variável
  media           NUMERIC,
  desvio_padrao   NUMERIC,
  valor_minimo    NUMERIC,
  valor_maximo    NUMERIC,

  -- Dados brutos (array JSON)
  amostras        JSONB       NOT NULL
);

-- Segurança: acesso público (mesma política do resto do app)
ALTER TABLE cep_coletas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso público cep_coletas"
  ON cep_coletas FOR ALL
  USING (true)
  WITH CHECK (true);
