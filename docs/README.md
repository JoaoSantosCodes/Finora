# Documentação do Finora

Índice da documentação do projeto. Ponto de entrada geral: [`../PROJECT.md`](../PROJECT.md).

## Contratos (spec)

- [Product Specification](../.kiro/specs/finora-saas/requirements.md) — requisitos, planos, regras de negócio
- [Tech Design](../.kiro/specs/finora-saas/design.md) — arquitetura, domínio, banco, RLS, API, billing
- [Task List](../.kiro/specs/finora-saas/tasks.md) — plano de implementação com dependências e waves

## Design

- [UX Design v1.0](ux/UX-DESIGN.md) — contrato visual: layout, hierarquia, cores, componentes
- [Arquitetura do monorepo](ARCHITECTURE.md) — estrutura de pastas e regra do Financial Core

## Operação

- [Status do projeto](STATUS.md) — progresso e próximos passos
- [Backend / Supabase](../supabase/README.md) — fluxo de migrações versionadas

## Estrutura de docs

```
docs/
├── README.md          (este índice)
├── STATUS.md          (progresso)
├── ARCHITECTURE.md    (monorepo + Financial Core)
└── ux/
    └── UX-DESIGN.md   (contrato visual)
```

> Documentos complementares de UX (`DESIGN-TOKENS.md`, `DASHBOARD.md`, `NAVIGATION.md`, `COMPONENTS.md`) podem ser criados conforme a necessidade — hoje o `UX-DESIGN.md` concentra o essencial.
