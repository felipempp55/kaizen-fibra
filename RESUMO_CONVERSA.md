# Resumo da conversa — Kaizen Fibra
> Cole este arquivo no início do próximo chat para retomar o projeto.

---

## O que é o projeto

**Kaizen Fibra** é um sistema de apontamento de desperdícios industriais para uso no chão de fábrica de fibra óptica da empresa **MSB (Medical System do Brasil)**. O operador preenche um formulário em etapas no tablet, registrando o tipo de desperdício ocorrido. Os gestores acompanham os dados em um dashboard com gráficos e filtros de período.

Existe também um módulo de **CEP (Controle Estatístico de Processo)** para coleta de dados de qualidade (CTQs) e visualização de cartas de controle — atualmente **oculto da navegação** (em desenvolvimento), mas acessível via `/cep`.

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
- **Dev server na rede local:** `npm run dev -- --hostname 0.0.0.0` → http://192.168.0.103:3000

---

## Design — Paleta MSB

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
  Navegacao.tsx          — Header: logo | tabs | data/hora (CEP oculto, mas rota existe)
  FormularioApontamento.tsx — Formulário multi-etapas dinâmico
  FormularioCEP.tsx      — Formulário multi-etapas para coleta CEP (atributo/variável)
  CartasControle.tsx     — Cartas de controle (Carta p e Carta I-MR com Cp/Cpk)
  EtapaIndicador.tsx     — Barra de progresso (teal), label abaixo das bolinhas
  BotaoGrande.tsx        — Botão touch-friendly
  TecladoNumerico.tsx    — Teclado numérico on-screen + suporte a teclado físico
  GraficoPareto.tsx      — Gráfico Pareto reutilizável

lib/
  supabase.ts            — Cliente Supabase
  desperdicios.ts        — Estrutura de grupos e tipos de desperdício
  types.ts               — Interfaces TypeScript (incluindo tipos CEP)
  ctqs.ts                — Definição dos 4 CTQs com LSI/LSE

supabase/
  schema.sql             — Tabela apontamentos (já executado)
  migration_v2.sql       — Novos campos (já executado)
  migration_cep.sql      — Tabela cep_coletas (EXECUTAR no Supabase se ainda não fez)

public/
  Logo MSB-14.png        — Logo MSB azul
  Logo MSB-12.png        — Logo MSB branca
```

---

## Banco de dados — tabela `apontamentos`

| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID | PK auto |
| created_at | TIMESTAMPTZ | Default NOW() |
| grupo | TEXT | Ex: "Epóxi", "Polimento" |
| tipo_desperdicio | TEXT | Ex: "Entupimento do Ferrule" |
| nome_operador | TEXT | |
| numero_op | TEXT | Ordem de produção |
| quantidade_pecas | INTEGER | Nullable |
| quantidade_ml | NUMERIC | Nullable (só epóxi) |
| classificacao | TEXT | 'perda' ou 'retrabalho' (nullable) |
| tempo_minutos | INTEGER | Nullable |
| observacao | TEXT | Nullable, não usado no form ainda |

View `resumo_desperdicio` existe para analytics.

---

## Banco de dados — tabela `cep_coletas`

⚠️ **Executar `supabase/migration_cep.sql` no SQL Editor do Supabase se ainda não foi feito.**

| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID | PK auto |
| created_at | TIMESTAMPTZ | |
| ctq_id | TEXT | Ex: 'comprimento_ferrule' |
| ctq_nome | TEXT | |
| tipo | TEXT | 'atributo' ou 'variavel' |
| instrumento | TEXT | |
| data_coleta | DATE | |
| numero_op | TEXT | |
| nome_operador | TEXT | |
| total_amostras | INTEGER | |
| total_ok | INTEGER | Nullable |
| total_nok | INTEGER | Nullable |
| media | NUMERIC | Nullable |
| desvio_padrao | NUMERIC | Nullable |
| valor_minimo | NUMERIC | Nullable |
| valor_maximo | NUMERIC | Nullable |
| amostras | JSONB | Array de amostras individuais brutas |
| status | TEXT | 'rascunho' ou 'finalizado' |

---

## Módulo CEP — Os 4 CTQs (`lib/ctqs.ts`)

| ID | Nome | Tipo | Instrumento | Total Amostras | LSI | LSE |
|---|---|---|---|---|---|---|
| `superficie_polida` | Superfície do Ferrule Polida | atributo | Microscópio | 56 | — | — |
| `comprimento_ferrule` | Comprimento do Ferrule | variável | Relógio Comparador | 56 | 0,3895 mm | 0,3905 mm |
| `corte_uniforme` | Corte Uniforme da Ponta Distal | atributo | Microscópio | 57 | — | — |
| `dimensao_ferrule` | Dimensão do Ferrule — Pós Máquina | variável | Relógio Comparador | 56 | 0,3855 mm | 0,3865 mm |

---

## Módulo CEP — Fluxo do FormularioCEP

4 etapas: **CTQ → Dados → Amostras → Confirmar**

- **Atributo**: botões OK/NOK por amostra, avança automaticamente
- **Variável**: teclado decimal on-screen (+ teclado físico), navega prev/next
- **Pause/Resume**: status='rascunho' no banco. Retomada inicia direto na etapa Amostras com amostras pré-preenchidas
- Botão **⏸ Pausar** salva rascunho; botão **Finalizar →** avança para confirmação com qualquer nº de amostras

---

## Módulo CEP — Cartas de Controle (`CartasControle.tsx`)

**Arquitetura:** 1 ponto por amostra individual (não por coleta). O componente achata o array `amostras` JSONB de todas as coletas.

**Carta p (atributo):**
- 1 ponto = 1 peça (OK=0, NOK=1)
- p̄ = total NOK / total inspecionado; σ = √(p̄(1-p̄)) para n=1
- UCL = p̄ + 3σ, LCL = max(0, p̄ - 3σ)
- Dot verde = OK, vermelho = NOK

**Carta I-MR (variável) — dois gráficos:**
- Carta I: cada medição individual; UCL = X̄ + 2,66·MR̄; LCL = X̄ − 2,66·MR̄
- Carta MR: amplitude móvel |Xᵢ − Xᵢ₋₁|; UCL_MR = 3,267·MR̄
- Constantes: d₂=1,128; D₄=3,267

**Cp/Cpk:** σ̂ = MR̄/d₂ · Cp = (LSE−LSI)/6σ̂ · Cpk = min[(LSE−X̄)/3σ̂, (X̄−LSI)/3σ̂]

**Visual:**
- Dot sólido = coleta finalizada
- Dot oco = coleta em andamento (rascunho) — atualiza a cada 30s automaticamente
- Dot vermelho = fora de controle (OOC)
- Linhas laranja sólidas = limites de especificação (LSI/LSE)
- Linhas vermelhas tracejadas = limites de controle

**Comportamento da aba:**
- `CartasControle` fica **sempre montado** (CSS `hidden` ao trocar de aba) — preserva CTQ selecionado e auto-refresh de 30s
- Query inclui rascunhos + finalizados (sem filtro de status) para atualização em tempo real

---

## Suporte a teclado físico (`TecladoNumerico.tsx`)

- Input oculto com `inputMode="none"` captura teclado físico sem abrir teclado virtual no tablet
- Dígitos 0–9 e Backspace funcionam com teclado físico
- Prop `onEnter?: () => void` — pai passa função para avançar etapa com Enter
- Prop `autoFocus?: boolean` — foca automaticamente ao montar (usado em etapas onde é o único campo)
- Visor clicável para focar o input oculto
- Botões on-screen re-focam o input oculto após cada clique

**Onde está ativo:**
- Apontamento: OP (Enter avança), Quantidade (autoFocus + Enter), Tempo (autoFocus + Enter)
- CEP: OP (Enter avança), teclado decimal das amostras variável (dígitos + `.`/`,` + Enter = próxima amostra)
- Campos de texto (nome, instrumento, data): Enter avança etapa se todos os campos estiverem preenchidos

---

## Grupos e tipos de desperdício (`lib/desperdicios.ts`)

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

## Decisões técnicas importantes

### Server vs Client fetch no Next.js
- **NUNCA** chame server actions (`'use server'`) a partir de `useEffect` em client components
- Para leituras em client components: `supabase.from(...).select(...)` diretamente
- Server actions são apenas para escrita (INSERT, UPDATE)

### Error boundaries no React
- Handlers assíncronos em client components **NUNCA** devem relançar erros (`throw e`)
- Capturar silenciosamente + exibir via estado local
- Re-throws causam "An error occurred in the Server Components render"

### CEP — aba preservada com CSS hidden
- `{abaHome === 'cartas' && <CartasControle />}` foi substituído por `<div className={hidden}>`
- Componente fica montado ao trocar de aba → CTQ selecionado e timer de refresh persistem

### EtapaIndicador
- Label abaixo da barra de bolinhas (flex-col) — evita overflow com labels longos

---

## Deploy

- **Vercel** — deploy automático a cada `git push`
- Variáveis configuradas na Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL=https://nogmekfeerhfuobxjmkv.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...`

---

## Como rodar / fazer deploy

```powershell
# Dev local
cd "C:\Users\felipe.pereira\Documents\kaizen-fibra"
npm run dev

# Dev acessível na rede local (para mostrar para alguém sem subir pro Vercel)
npm run dev -- --hostname 0.0.0.0
# → http://192.168.0.103:3000

# Deploy
git add .
git commit -m "descrição"
git push   # Vercel publica em ~2 minutos
```

---

## Próximos passos planejados (não implementados)

1. **Auto-refresh no dashboard** — atualizar a cada 30s/1min para TV na produção
2. **Tela de histórico** — listar e filtrar apontamentos e coletas CEP passados
3. **Autenticação** — login com Supabase Auth
4. **Exportação** — relatório em Excel ou PDF
5. **Campo observação** — existe no banco, não está no formulário de apontamento
6. **Bug a investigar** — botões não avançam no browser de colegas via rede local (JS não dispara via IP — possível problema de hidratação Next.js)
7. **Carta p com índice de capabilidade** — quando % máximo de NOK for definido como especificação
8. **Western Electric Rules** — detecção de padrões OOC avançados
9. **Reativar aba CEP na navegação** — quando o módulo estiver pronto para produção (só descomentar o `<Link>` em `Navegacao.tsx`)
