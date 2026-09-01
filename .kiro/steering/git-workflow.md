# Git Workflow — Regra do projeto Finora

## Regra: commitar e fazer push ao concluir um passo

Ao finalizar uma unidade de trabalho coerente (uma tarefa da spec, uma migração validada, um redesign, um conjunto de documentos), **sempre**:

1. Fazer `git add` dos arquivos relevantes.
2. Criar um commit com mensagem descritiva.
3. Fazer `git push origin main`.

Não é preciso pedir confirmação para esse fluxo — ele é a regra padrão deste projeto.

## Como agrupar commits

- **Um commit por unidade lógica.** Separar implementação de documentação (ex.: `feat:`/redesign em um commit, `docs(ux):` em outro).
- Mensagens em português, imperativas e específicas (o quê e por quê).
- Preferir `git add` de arquivos específicos a `git add .` quando houver mudanças não relacionadas.

## Segurança (inegociável)

- **Nunca** commitar segredos: `.env`, `.env.local`, chaves do Supabase (secret/service role), tokens. Só `.env.example` com placeholders.
- Antes do push, se houver dúvida, conferir `git status --short` para garantir que nenhum secret entrou.
- Push direto em `main` é aceito neste projeto (fluxo solo). Operações destrutivas (force push, reset --hard) continuam exigindo confirmação explícita.

## Marcação de tarefas

- Ao concluir uma tarefa da spec, atualizar seu checkbox em `.kiro/specs/finora-saas/tasks.md` e refletir em `docs/STATUS.md` quando fizer sentido, incluindo essas mudanças no commit.
