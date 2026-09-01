# Finora — UX Design v1.0

Contrato visual do Finora. Junto com os demais artefatos da spec, forma o conjunto:

- **Product Specification** → contrato do produto (`.kiro/specs/finora-saas/requirements.md`)
- **Tech Design** → contrato técnico (`.kiro/specs/finora-saas/design.md`)
- **Task List** → contrato de execução (`.kiro/specs/finora-saas/tasks.md`)
- **UX Design** → contrato visual (este documento)

Quando as telas reais forem implementadas (WEB-004A–H), este documento é a referência de layout, hierarquia e componentes. Reflete o redesign do V0 (commit `da50edb`).

## 1. Design Principles

1. **Financial OS, não app de gastos.** A interface comunica "entenda e controle toda a sua vida financeira", não apenas "registre despesas".
2. **Saldo em primeiro lugar.** A informação mais importante de um app financeiro é quanto se tem; o dashboard começa pelo saldo.
3. **Clareza sobre densidade.** Hierarquia visual clara; evitar telas vazias e desperdício de espaço.
4. **Semântica consistente.** Cada cor tem um significado fixo (ver §5); o usuário aprende a "ler" a interface.
5. **Evolução incremental.** O layout cresce com o produto sem quebrar o que existe; módulos futuros são sinalizados, não simulados.
6. **Acessível por padrão.** Cor nunca é o único indicador de estado (ver §13).

## 2. Financial OS Navigation

Navegação em sidebar, organizada por domínios do produto:

```
🟧 FINORA
   Controle financeiro
──────────────────────
◉ Visão geral

FINANCEIRO
  Lançamentos
  Contas        (em breve)
  Cartões       (em breve)
  Faturas       (em breve)

PLANEJAMENTO
  Orçamentos    (em breve)
  Metas         (em breve)

ANÁLISES
  Relatórios    (em breve)
  Insights      (em breve)
──────────────────────
⚙ Configurações
[JS] João Santos · Plano Pro
```

**Regra dos módulos "Em breve":** itens não implementados aparecem desabilitados, com selo "breve", **apenas como navegação visual**. Não criam rotas falsas, telas placeholder navegáveis nem lógica fake. Servem para comunicar a direção do produto.

**Regra de expansão:**

```
V0:  Dashboard · Lançamentos · Configurações
        ↓
V1 SaaS: Dashboard · Lançamentos · Contas · Cartões · Faturas ·
         Orçamentos · Metas · Relatórios · Insights · Configurações
```

Cada item "Em breve" só vira navegação real quando sua tarefa correspondente (WEB-004A–H) entrega a tela.

## 3. Dashboard Layout

Arquitetura visual geral:

```
┌─────────────────────────────────────────────┐
│                 HEADER                        │  saudação + período
├────────────┬────────────────────────────────┤
│            │                                 │
│  SIDEBAR   │         DASHBOARD               │
│            │                                 │
│ Financeiro │   KPI  →  Charts  →  Data        │
│ Planej.    │                                 │
│ Análises   │                                 │
│            │                                 │
└────────────┴────────────────────────────────┘
```

Fluxo de leitura do dashboard: **KPIs → Gráficos → Dados detalhados**.

```
[ Saldo ] [ Receitas ] [ Despesas ] [ Contas a pagar ]

[ Evolução financeira (2/3) ] [ Gastos por categoria (1/3) ]

[ Últimos lançamentos ................................. ]

                                   ( + Novo lançamento )  ← CTA flutuante
```

## 4. Information Hierarchy

1. **Primário:** Saldo disponível (card de maior destaque, fundo escuro).
2. **Secundário:** Receitas, Despesas, Contas a pagar (KPIs de apoio).
3. **Terciário:** Evolução financeira (tendência) e distribuição por categoria.
4. **Detalhe:** Últimos lançamentos.
5. **Ação:** CTA "Novo lançamento" sempre acessível.

## 5. Color Semantics

Significado fixo de cada cor. Tokens definidos em `tailwind.config.js`.

| Papel | Token | Uso |
|---|---|---|
| Marca / ações / CTA | **Brand Orange** (`brand-500` #F97316) | Logo, botões primários, item ativo, CTA |
| Receitas / saldo positivo | **Income Green** (`income-500` #10B981) | Valores de receita, saldo positivo, tendência de alta favorável |
| Despesas | **Expense Red** (`expense-500` #EF4444) | Valores de despesa, saídas |
| Pendências / atenção | **Pending Amber** (`pending-500` #F59E0B) | Contas a pagar, alertas de orçamento |
| Informação / estrutura | **Neutral** (slate) | Texto, bordas, fundos, dados neutros |

**Regras:**

- O **laranja é da marca/ação** e não deve competir com os dados financeiros. Um valor monetário nunca é laranja.
- Verde = positivo/receita; vermelho = despesa; âmbar = pendência. Essa associação é consistente em toda a interface.
- **Acessibilidade (crítico):** a cor **nunca** é o único indicador de estado financeiro. Sempre acompanhar de rótulo, sinal (+/−) ou ícone (ver §13).

## 6. Typography

- **Família:** Inter (fallback: system-ui, Segoe UI, Roboto, sans-serif).
- **Escala:**
  - Título de página (h1): `text-2xl font-bold` (saudação, nome da seção).
  - Título de card (h2): `font-semibold` (~16px).
  - Valor de KPI: `text-2xl font-bold`.
  - Corpo/labels: `text-sm`.
  - Metadados/legendas: `text-xs`, `text-slate-400`.
- **Peso:** valores monetários e títulos em bold; rótulos em medium; texto de apoio em regular.
- **Números:** valores monetários formatados em pt-BR (`R$ 1.234,56`). Em gráficos, usar formato compacto (`R$ 1,2 mil`).

## 7. Cards

- **Container:** `rounded-2xl`, borda sutil (`border-slate-200/80`), sombra leve (`shadow-card`), fundo branco.
- **KPI cards:** fundo em gradiente conforme a semântica (Saldo = slate escuro; Receitas = verde; Despesas = vermelho; Pendente = âmbar), ícone em "pill" translúcida, valor em destaque, rodapé com contexto.
- **Animações:** entrada com `animate-scale-in` (KPIs) e `animate-fade-in` (cards de conteúdo); transições suaves em hover.
- **Espaçamento:** padding interno `p-5`; gap entre cards `gap-4`.

## 8. Charts

- **Biblioteca:** Recharts (isolada em chunk próprio, carregada sob demanda).
- **Gráfico principal — Evolução financeira:** linha, **Receitas (verde) × Despesas (vermelho)**, ocupa 2/3 da largura. Grid horizontal suave, eixos sem linha, tooltip formatado em BRL, legenda.
- **Gráfico secundário — Gastos por categoria:** donut (`innerRadius`), com total no centro e legenda com valores compactos, ocupa 1/3.
- **Cores dos gráficos:** receitas/despesas seguem a semântica; categorias usam a cor própria de cada categoria.
- **Tooltip:** cantos arredondados, sombra, fonte 13px.

## 9. Empty States

Todo estado vazio deve ser útil e orientar a próxima ação.

- **Sem lançamentos no período:** ícone 💰, título "Tudo tranquilo por aqui", texto de apoio e CTA "Adicionar lançamento".
- **Primeiro uso:** mensagem de onboarding orientando o primeiro registro (evolui para "configure sua primeira conta" quando o módulo Contas existir).
- Nunca deixar grandes áreas em branco sem orientação.

## 10. Forms

- **Inputs:** classe `.input` — `rounded-xl`, borda slate, foco com anel `brand-500`.
- **Novo lançamento:** seletor de tipo no topo (Despesa / Receita; Transferência quando houver Contas), com cor semântica no estado ativo (despesa=vermelho, receita=verde). Campos: descrição, categoria, conta (futuro), valor, data. Opções de parcelamento e "pago" só para despesa.
- **Validação:** valor > 0; feedback claro; erros não destroem o que o usuário digitou.
- **Ações do form:** primário à direita (`btn-primary`), cancelar como `btn-ghost`.

## 11. Actions / CTA

- **CTA principal:** "Novo lançamento" — botão flutuante fixo (bottom-right) no dashboard, sempre acessível.
- **Hierarquia de botões:** `btn-primary` (laranja, ação principal) → `btn-ghost` (secundária) → links de texto (`Ver todos →`).
- Um CTA primário por contexto; evitar competição de ações.

## 12. Responsive Behavior

- **Desktop (≥ lg):** grid `[260px_1fr]` — sidebar fixa + conteúdo. KPIs em 4 colunas; gráficos 2/3 + 1/3.
- **Tablet/mobile (< lg):** sidebar vira topbar com abas; KPIs empilham (1–2 colunas); gráficos empilham em largura total.
- **Máximo de conteúdo:** `max-w-6xl` centralizado.
- **CTA flutuante:** permanece acessível em todas as larguras.

## 13. Accessibility

- **Cor nunca é o único indicador.** Estados financeiros sempre acompanham rótulo textual, sinal (+/−) e/ou ícone (ex.: receita = verde **+ sinal "+"** + seta para cima; despesa = vermelho **+ "−"** + seta para baixo; pendência = âmbar **+ texto "pendente"**).
- **Contraste:** texto sobre KPIs em gradiente mantém contraste adequado (branco sobre cores 500/600).
- **Foco visível:** inputs e botões com anel de foco (`focus:ring`).
- **Alvos de toque:** botões com área mínima confortável.
- **Semântica:** usar elementos nativos (`button`, `label`, `table`) e `title`/aria onde aplicável.
- Metas WCAG AA como norte; validação completa exige teste com tecnologias assistivas.

## 14. Component Guidelines

- **NavButton / NavDisabled:** item de navegação ativo (laranja) vs desabilitado ("Em breve", sem rota).
- **CardSaldo / CardResumo:** KPIs; Saldo em destaque escuro, demais por semântica.
- **Badge de status:** pago (verde), pendente (âmbar) — sempre com rótulo textual.
- **Linha de lançamento:** ícone +/− colorido, descrição + categoria, valor colorido com sinal, data.
- **EstadoVazio:** ícone + título + apoio + CTA.
- Reutilizar tokens e classes utilitárias (`.card`, `.input`, `.btn-primary`, `.btn-ghost`) em vez de estilos ad-hoc.

## 15. Future Modules

Quando implementados (WEB-004A–H), seguem este contrato visual:

- **Contas:** cards por conta com saldo; usa semântica de saldo positivo/negativo.
- **Cartões / Faturas:** visão de fatura por ciclo; total derivado; status open/closed/paid com rótulo.
- **Orçamentos:** barras de progresso com âmbar (perto do limite) e vermelho (estouro), sempre com percentual textual.
- **Metas:** progresso acumulado/alvo com percentual.
- **Relatórios / Insights:** reutilizam os padrões de charts e hierarquia do dashboard.
- **Header completo (futuro):** saudação + seletor de período rico (Hoje/Semana/Mês/etc.) + sino de notificações + avatar. O sino só aparece quando o módulo de Notificações existir (sem ícone decorativo sem função).
- **Perfil/Plano:** "João Santos / Plano Pro" no rodapé da sidebar passa a refletir dados reais quando Auth e Billing existirem.

---

_Documentos complementares (opcionais, a criar conforme necessidade): `DESIGN-TOKENS.md`, `DASHBOARD.md`, `NAVIGATION.md`, `COMPONENTS.md`._
