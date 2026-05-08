# Resumo da conversa — Kaizen Fibra
> Cole este arquivo no início do próximo chat para retomar o projeto.

---

## O que é o projeto

**Kaizen Fibra** é um sistema de apontamento de desperdícios industriais para uso no chão de fábrica de fibra óptica da empresa **MSB (Medical System do Brasil)**. O operador preenche um formulário em etapas no tablet, registrando o tipo de desperdício ocorrido. Os gestores acompanham os dados em um dashboard com gráficos e filtros de período.

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
  actions.ts             — Server action: salvarApontamento()
  globals.css            — Estilos base (fundo claro MSB)
  layout.tsx             — Layout raiz

components/
  Navegacao.tsx          — Header com 3 colunas: logo | tabs centralizados | data/hora
  FormularioApontamento.tsx — Formulário multi-etapas dinâmico
  EtapaIndicador.tsx     — Barra de progresso (teal)
  BotaoGrande.tsx        — Botão touch-friendly (branco com hover teal)
  TecladoNumerico.tsx    — Teclado numérico customizado (tema claro)
  GraficoPareto.tsx      — Gráfico Pareto reutilizável (barras + linha acumulada)

lib/
  supabase.ts            — Cliente Supabase
  desperdicios.ts        — Estrutura de grupos e tipos de desperdício
  types.ts               — Interfaces TypeScript

supabase/
  schema.sql             — Script de criação da tabela (já executado)
  migration_v2.sql       — Migration com novos campos (já executado)

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
- Cards de resumo com borda colorida lateral (estilo MSB)
- Gráficos com cores e grid no estilo MSB
- Charts:
  - Evolução no tempo (linha)
  - Apontamentos por grupo (barras)
  - Pareto: número de perdas por tipo
  - Pareto: número de retrabalhos por tipo
  - Pareto: tempo de retrabalho por tipo (minutos)

---

## Navegação (Navegacao.tsx)

- Header com **3 colunas**: logo/título | tabs centralizados | data/hora
- Botão 🏠 aparece só na página do formulário — reseta o formulário
- Tabs: **📋 Apontamento** | **📊 Dashboard**
- Relógio atualiza a cada minuto em tempo real
- Logo MSB no canto esquerdo (`/public/Logo MSB-14.png`)

---

## Deploy

- App publicado na **Vercel** com deploy automático a cada `git push`
- Variáveis de ambiente configuradas na Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL=https://nogmekfeerhfuobxjmkv.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...`

---

## Próximos passos planejados (não implementados)

1. **Auto-refresh no dashboard** — atualizar automaticamente a cada 30s/1min para TV na produção
2. **Tela de histórico** — listar, filtrar e conferir apontamentos passados
3. **Autenticação** — login com Supabase Auth para proteger o sistema
4. **Exportação** — relatório em Excel ou PDF
5. **Valores em reais** — custo por desperdício (futuro)
6. **Campo observação** — existe no banco, não está no formulário ainda
7. **Bug a investigar** — botões não avançam no browser de colegas via rede local (CSS funciona, JS não — possível problema de hidratação do Next.js em acesso via IP)

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
