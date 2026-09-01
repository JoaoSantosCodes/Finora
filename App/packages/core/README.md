# @finora/core — Financial Core

Regras financeiras do Finora em **TypeScript puro**. Este pacote é a fonte única de verdade das regras de domínio e é reutilizado por Web, backend e Android.

## Regra de pureza (fitness function)

Este pacote **não pode importar**:

- ❌ React / React DOM
- ❌ Vite / APIs de bundler
- ❌ Supabase SDK
- ❌ Stripe SDK
- ❌ `fetch` / clientes HTTP
- ❌ `localStorage`, `window`, `document`, DOM ou qualquer browser API
- ❌ clientes de banco de dados

Toda I/O é injetada pelas camadas superiores (Application Services no backend, hooks no cliente). O pacote opera apenas sobre tipos e funções puras e determinísticas.

A regra é imposta por:
- `tsconfig.json` sem `lib: ["dom"]` (sem tipos de browser disponíveis).
- Lint de import boundaries na CI (a ser configurado em DEP-001), que falha o build se qualquer import proibido aparecer aqui.

## Convenção de dinheiro

Valores monetários são **inteiros em centavos** (`number` inteiro ou `bigint`), nunca float. R$ 99,90 → `9990`. A formatação para exibição ocorre apenas nas camadas de apresentação.

## Conteúdo (semente — Tarefa 1)

- `money.ts` — helpers de dinheiro em centavos.
- `analytics.ts` — consolidações puras (indicadores, por categoria, por mês), migradas de `src/lib/calc.ts` do V0 e adaptadas para centavos.

O Financial Core completo (transações, saldo, fatura, parcelas) é implementado em CORE-001.
