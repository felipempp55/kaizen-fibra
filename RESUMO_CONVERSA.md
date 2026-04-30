# Resumo da conversa — Kaizen Fibra
> Cole este arquivo no início do próximo chat para retomar o projeto.

---

## O que é o projeto

**Kaizen Fibra** é um sistema de apontamento de desperdícios industriais para uso no chão de fábrica da empresa de fibra óptica. O operador preenche um formulário em etapas no tablet, registrando o tipo de desperdício ocorrido. Os gestores acompanham os dados em um dashboard com gráficos e filtros de período.

---

## Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Backend/Banco:** Supabase (PostgreSQL na nuvem) — projeto chamado **Fibretto**
- **Estilo:** Tailwind CSS 4
- **Gráficos:** Recharts
- **Repositório:** https://github.com/felipempp55/kaizen-fibra
- **Pasta local:** `C:\Users\felipe.pereira\Documents\kaizen-fibra`
- **Dev server:** `npm run dev` → http://localhost:3000

---

## Estrutura de arquivos principais

```
app/
  page.tsx               — Formulário de apontamento (página principal)
  dashboard/page.tsx     — Dashboard com gráficos e filtros
  actions.ts             — Server action: salvarApontamento()
  layout.tsx             — Layout raiz

components/
  Navegacao.tsx          — Header compartilhado com tabs (Apontamento / Dashboard)
  FormularioApontamento.tsx — Formulário multi-etapas dinâmico
  EtapaIndicador.tsx     — Barra de progresso das etapas
  BotaoGrande.tsx        — Botão touch-friendly
  TecladoNumerico.tsx    — Teclado numérico customizado
  GraficoPareto.tsx      — Gráfico Pareto reutilizável (barras + linha acumulada)

lib/
  supabase.ts            — Cliente Supabase
  desperdicios.ts        — Estrutura de grupos e tipos de desperdício
  types.ts               — Interfaces TypeScript

supabase/
  schema.sql             — Script de criação da tabela (já executado)
  migration_v2.sql       — Migration com novos campos (já executado)
```

---

## Banco de dados — tabela `apontamentos`

| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID | PK auto |
| created_at | TIMESTAMPTZ | Default NOW() |
| grupo | TEXT | Ex: "Epóxi", "Polimento" |
| tipo_desperdicio | TEXT | Ex: "Entupimento do Ferrule" |
| nome_operador | TEXT | Campo adicionado na v2 |
| numero_op | TEXT | Ordem de produção |
| quantidade_pecas | INTEGER | Nullable (epóxi usa ml) |
| quantidade_ml | NUMERIC | Nullable (só para epóxi) |
| classificacao | TEXT | 'perda' ou 'retrabalho' (nullable) |
| tempo_minutos | INTEGER | Nullable |
| observacao | TEXT | Nullable, não usado no form ainda |

Também existe a **view `resumo_desperdicio`** para analytics.

---

## Grupos e tipos de desperdício (lib/desperdicios.ts)

| Grupo | Tipo | Unidade | Classificação | Tempo |
|---|---|---|---|---|
| Epóxi | Entupimento do Ferrule | peças | Perda/Retrabalho | Nunca |
| Epóxi | Quantidade desperdiçada de Epóxi | ml | Nenhuma | Nunca |
| Problemas Dimensionais | Recuo de Fibra | peças | Perda/Retrabalho | Nunca |
| Problemas Dimensionais | Polimento do Recartilhado do SMA | peças | Nenhuma | Sempre |
| Problemas Dimensionais | União Hub x SMA | peças | Perda/Retrabalho | Nunca |
| Polimento | Manual | peças | Nenhuma | Nunca |
| Polimento | Máquina | peças | Perda/Retrabalho | Se Retrabalho |
| Clivagem | Clivagem com Defeito | peças | Perda/Retrabalho | Nunca |

---

## Fluxo do formulário

Etapas dinâmicas baseadas no tipo selecionado:

1. **Grupo** — 4 opções em grade 2x2
2. **Tipo** — lista dos tipos do grupo
3. **OP + Operador** — teclado numérico (OP) + input de texto (nome)
4. **Quantidade** — em peças ou ml conforme o tipo
5. **Classificação** *(se o tipo exigir)* — Perda / Retrabalho + tempo inline se Retrabalho
6. **Tempo** *(se o tipo exigir sempre)* — step separado
7. **Confirmar** — revisão + botão salvar

---

## Dashboard (app/dashboard/page.tsx)

- Filtros: **Hoje / Semana / Mês / Personalizado** (padrão: Semana)
- Cards de resumo: Total apontamentos, Perdas, Retrabalhos, Tempo total
- Gráficos:
  - Evolução no tempo (linha: perdas vs retrabalhos por dia)
  - Apontamentos por grupo (barras agrupadas)
  - Pareto: número de perdas por tipo
  - Pareto: número de retrabalhos por tipo
  - Pareto: tempo de retrabalho por tipo (minutos)

---

## Próximos passos planejados (não implementados)

1. **Autenticação** — login com Supabase Auth para proteger o sistema
2. **Histórico/listagem** — tela para ver e filtrar apontamentos passados
3. **Exportação** — relatório em Excel ou PDF
4. **Valores em reais** — adicionar custo por desperdício (futuro)
5. **Campo observação** — existe no banco, não está no formulário ainda

---

## Variáveis de ambiente (.env.local — NÃO está no git)

```
NEXT_PUBLIC_SUPABASE_URL=https://nogmekfeerhfuobxjmkv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Se precisar recriar o `.env.local`, os valores estão no painel do Supabase em:
**Project Settings → API Keys → Legacy anon, service_role API keys**
