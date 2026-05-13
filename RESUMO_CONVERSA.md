# Resumo da conversa — Kaizen Fibra
> Cole este arquivo no início do próximo chat para retomar o projeto.

---

## O que é o projeto

**Kaizen Fibra** é um sistema de apontamento de desperdícios industriais para uso no chão de fábrica de fibra óptica da empresa **MSB (Medical System do Brasil)**. O operador preenche um formulário em etapas no tablet, registrando o tipo de desperdício ocorrido. Os gestores acompanham os dados em um dashboard com gráficos e filtros de período.

Existe também um módulo de **CEP (Controle Estatístico de Processo)** para coleta de dados de qualidade (CTQs) e visualização de cartas de controle.

---

## Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Backend/Banco:** Supabase (PostgreSQL na nuvem) — projeto chamado **Fibretto**
- **Estilo:** Tailwind CSS 4
- **Gráficos:** Recharts
- **Repositório:** https://github.com/felipempp55/kaizen-fibra
- **Pasta local:** `C:\Users\felipe.pereira\Documents\kaizen-fibra`
- **Deploy (produção):** Vercel — deploy automático a cada git push
- **Dev server local:** `npm run dev` → http://localhost:3000

---

## Design — Paleta MSB

O app usa o visual da MSB (Medical System do Brasil):
- **Fundo:** `#F2F5F7` (cinza claro)
- **Painéis:** `#FFFFFF` (branco) com borda `#DDE4EA`
- **Cor primária (teal):** `#1E9FAC`
- **Teal escuro (hover):** `#157A86`
- **Texto principal (navy):** `#1A3344`
- **Texto secundário:** `#8FA3B0`
- **Vermelho (perda):** `#D94F4F`
- **Amarelo (retrabalho):** `#E8A020`
- **Azul (tempo):** `#4A90D9`
- **Logo:** `Logo MSB-14.png` (azul) na pasta `/public`

---

## Estrutura de arquivos principais

```
app/
  page.tsx               — Formulário de apontamento (página principal)
  dashboard/page.tsx     — Dashboard com gráficos e filtros
  cep/page.tsx           — Página CEP com tabs: Coletas | Cartas de Controle
  actions.ts             — Server actions: salvarApontamento(), salvarCEP(), etc.
  globals.css            — Estilos base (fundo claro MSB)
  layout.tsx             — Layout raiz

components/
  Navegacao.tsx          — Header com 3 colunas: logo | tabs centralizados | data/hora
  FormularioApontamento.tsx — Formulário multi-etapas dinâmico
  FormularioCEP.tsx      — Formulário multi-etapas para coleta CEP (atributo/variável)
  CartasControle.tsx     — Cartas de controle (Carta p e Carta X̄-S com Cp/Cpk)
  EtapaIndicador.tsx     — Barra de progresso (teal), label abaixo das bolinhas
  BotaoGrande.tsx        — Botão touch-friendly (branco com hover teal)
  TecladoNumerico.tsx    — Teclado numérico customizado (tema claro)
  GraficoPareto.tsx      — Gráfico Pareto reutilizável (barras + linha acumulada)

lib/
  supabase.ts            — Cliente Supabase
  desperdicios.ts        — Estrutura de grupos e tipos de desperdício
  types.ts               — Interfaces TypeScript (incluindo tipos CEP)
  ctqs.ts                — Definição dos 4 CTQs com LSI/LSE

supabase/
  schema.sql             — Script de criação da tabela apontamentos (já executado)
  migration_v2.sql       — Migration com novos campos (já executado)
  migration_cep.sql      — Migration para tabela cep_coletas (EXECUTAR no Supabase)

public/
  Logo MSB-14.png        — Logo MSB azul (usada no header)
  Logo MSB-12.png        — Logo MSB branca

dashboard-mockup.html   — Mockup visual do dashboard (referência de design)
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

## Banco de dados — tabela `cep_coletas`

⚠️ **ATENÇÃO**: Esta tabela precisa ser criada no Supabase executando `supabase/migration_cep.sql` no SQL Editor.

| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID | PK auto |
| created_at | TIMESTAMPTZ | Default NOW() |
| ctq_id | TEXT | Ex: 'comprimento_ferrule' |
| ctq_nome | TEXT | Nome legível do CTQ |
| tipo | TEXT | 'atributo' ou 'variavel' |
| instrumento | TEXT | Ex: 'Relógio Comparador' |
| data_coleta | DATE | Data da coleta |
| numero_op | TEXT | Ordem de produção |
| nome_operador | TEXT | Nome da operadora |
| total_amostras | INTEGER | Total esperado de amostras |
| total_ok | INTEGER | Nullable (só atributo) |
| total_nok | INTEGER | Nullable (só atributo) |
| media | NUMERIC | Nullable (só variável) |
| desvio_padrao | NUMERIC | Nullable (só variável) |
| valor_minimo | NUMERIC | Nullable (só variável) |
| valor_maximo | NUMERIC | Nullable (só variável) |
| amostras | JSONB | Array de amostras brutas |
| status | TEXT | 'rascunho' ou 'finalizado' |

SQL completo para criar a tabela:
```sql
CREATE TABLE IF NOT EXISTS cep_coletas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ctq_id TEXT NOT NULL, ctq_nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('atributo', 'variavel')),
  instrumento TEXT, data_coleta DATE NOT NULL,
  numero_op TEXT NOT NULL, nome_operador TEXT NOT NULL,
  total_amostras INTEGER NOT NULL,
  total_ok INTEGER, total_nok INTEGER,
  media NUMERIC, desvio_padrao NUMERIC, valor_minimo NUMERIC, valor_maximo NUMERIC,
  amostras JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'finalizado' CHECK (status IN ('rascunho', 'finalizado'))
);
ALTER TABLE cep_coletas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso público cep_coletas" ON cep_coletas FOR ALL USING (true) WITH CHECK (true);
```

---

## Módulo CEP — Os 4 CTQs

Definidos em `lib/ctqs.ts`:

| ID | Nome | Tipo | Instrumento | Total Amostras | LSI | LSE |
|---|---|---|---|---|---|---|
| `superficie_polida` | Superfície do Ferrule Polida | atributo | Microscópio | 56 | — | — |
| `comprimento_ferrule` | Comprimento do Ferrule | variável | Relógio Comparador | 56 | 0,3895 mm | 0,3905 mm |
| `corte_uniforme` | Corte Uniforme da Ponta Distal | atributo | Microscópio | 57 | — | — |
| `dimensao_ferrule` | Dimensão do Ferrule — Pós Máquina | variável | Relógio Comparador | 56 | 0,3855 mm | 0,3865 mm |

---

## Módulo CEP — Fluxo do FormularioCEP

O componente `components/FormularioCEP.tsx` tem 4 etapas:

1. **CTQ** — Seleção do CTQ (grade de 4 botões)
2. **Dados** — Data, nº OP, nome do operador
3. **Amostras** — Coleta das amostras:
   - **Atributo**: grade de botões OK (teal) / NOK (vermelho), avança automaticamente
   - **Variável**: teclado decimal + navegação prev/next, permite editar qualquer amostra
   - Grid visual 7 colunas mostrando status de preenchimento
   - Botão **⏸ Pausar Coleta** salva rascunho no banco e mostra tela de confirmação
   - Botão **Finalizar →** avança para confirmação independente de quantas amostras preenchidas
4. **Confirmar** — Revisão dos dados + botão Salvar

**Pause/Resume**: status='rascunho' no banco. Ao retomar, `DadosIniciaisCEP` é passado ao FormularioCEP que inicia direto na etapa de amostras, com as amostras já preenchidas.

---

## Módulo CEP — Cartas de Controle (CartasControle.tsx)

### Para CTQs de Atributo: Carta p
- UCL_i = p̄ + 3√(p̄(1-p̄)/nᵢ) por subgrupo
- LCL_i = max(0, p̄ - 3√(p̄(1-p̄)/nᵢ))
- Pontos fora de controle (OOC) marcados em vermelho

### Para CTQs de Variável: Carta X̄-S (dois gráficos)
- Constantes de Montgomery: c₄(n), A₃, B₃, B₄
- X̄̄ ± A₃ × S̄ (limites do gráfico de médias)
- B₃ × S̄ e B₄ × S̄ (limites do gráfico de desvios)
- **Linhas laranja sólidas** = limites de especificação (LSI/LSE)
- **Linhas vermelhas tracejadas** = limites de controle
- Pontos OOC em vermelho

### Cp/Cpk — Índices de Capabilidade (PainelCapabilidade)
Calculados com estimativa σ̂ = S̄/c₄(n):
- **Cp** = (LSE - LSI) / (6σ̂)
- **Cpk** = min[(LSE - X̄̄) / (3σ̂), (X̄̄ - LSI) / (3σ̂)]
- Cores: verde ≥ 1,67 | teal ≥ 1,33 | âmbar ≥ 1,00 | vermelho < 1,00
- Auto-refresh a cada 30s

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

## Fluxo do formulário de Apontamento

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
- Cards de resumo com borda colorida lateral (estilo MSB)
- Charts:
  - Evolução no tempo (linha)
  - Apontamentos por grupo (barras)
  - Pareto: número de perdas por tipo
  - Pareto: número de retrabalhos por tipo
  - Pareto: tempo de retrabalho por tipo (minutos)

---

## Navegação (Navegacao.tsx)

- Header com **3 colunas**: logo/título | tabs centralizados | data/hora
- Tabs: **📋 Apontamento** | **📈 CEP** | **📊 Dashboard**
- Relógio atualiza a cada minuto em tempo real
- Logo MSB no canto esquerdo

---

## Decisões técnicas importantes

### Server vs Client fetch no Next.js
- **NUNCA** chame server actions (`'use server'`) a partir de `useEffect` em client components
- Para leituras em client components, use diretamente o cliente Supabase: `supabase.from(...).select(...)`
- Server actions são usadas apenas para escrita (INSERT, UPDATE)

### Error boundaries no React
- Handlers assíncronos em client components **NUNCA** devem relançar erros (`throw e`)
- Capturar silenciosamente e exibir mensagem de erro via estado local
- Re-throws causam o erro "An error occurred in the Server Components render"

### EtapaIndicador
- Label da etapa atual fica **abaixo** da barra de bolinhas (flex-col), não ao lado
- Resolve overflow com labels longos como "OP / Operador"

### TecladoNumerico
- Placeholder exibido em `text-lg` font-normal
- Valor digitado em `text-4xl` monospace
- Container com `overflow-hidden` para evitar transbordamento

---

## Deploy

- App publicado na **Vercel** com deploy automático a cada `git push`
- Variáveis de ambiente configuradas na Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL=https://nogmekfeerhfuobxjmkv.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...`

---

## Próximos passos planejados (não implementados)

1. **⚠️ URGENTE: Executar migration_cep.sql** no Supabase SQL Editor para criar a tabela `cep_coletas`
2. **Auto-refresh no dashboard** — atualizar automaticamente a cada 30s/1min para TV na produção
3. **Tela de histórico** — listar, filtrar e conferir apontamentos e coletas CEP passados
4. **Autenticação** — login com Supabase Auth para proteger o sistema
5. **Exportação** — relatório em Excel ou PDF
6. **Campo observação** — existe no banco, não está no formulário de apontamento ainda
7. **Bug a investigar** — botões não avançam no browser de colegas via rede local (CSS funciona, JS não — possível problema de hidratação do Next.js em acesso via IP)
8. **Carta p com índice de capabilidade** — quando % máximo de NOK for definido como especificação
9. **Western Electric Rules** — detecção de padrões OOC avançados nas cartas de controle

---

## Como rodar localmente

```powershell
cd "C:\Users\felipe.pereira\Documents\kaizen-fibra"
npm run dev
# Acesse http://localhost:3000
```

## Como fazer deploy

```powershell
cd "C:\Users\felipe.pereira\Documents\kaizen-fibra"
git add .
git commit -m "descrição"
git push
# Vercel faz deploy automático em ~2 minutos
```

## Variáveis de ambiente (.env.local — NÃO está no git)

```
NEXT_PUBLIC_SUPABASE_URL=https://nogmekfeerhfuobxjmkv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
