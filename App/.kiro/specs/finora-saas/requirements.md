# Requirements Document

## Introduction

Este documento é a Product Specification v1.0 do **Finora**, definindo os requisitos para a evolução de um aplicativo de controle financeiro pessoal (V0: React + Vite + TypeScript + Tailwind + Recharts, com dados apenas em LocalStorage, sem autenticação) para uma **plataforma SaaS multi-plataforma** de controle financeiro pessoal e familiar.

A V0 atual oferece três telas (Dashboard, Lançamentos e Configurações) com CRUD de despesas, categorias com classificação e cor, e indicadores consolidados (Total de Gastos, Pago, Pendente), persistidos localmente. A visão SaaS expande esse domínio com autenticação, grupos familiares (households), contas financeiras, transações de receita/despesa/transferência, cartões de crédito e faturas, parcelamentos, recorrências, orçamentos, metas, análises, notificações e monetização por planos (Free, Pro, Family).

Os requisitos são organizados por módulo, expressos em padrões EARS, com user stories por papel (Owner, Admin, Member, Visitante, Assinante), critérios de aceitação testáveis, uma seção de regras de negócio financeiras, uma matriz de funcionalidades por plano, e requisitos não funcionais.

Escopo é priorizado por fases:

- **MVP (V1.0):** Autenticação (Email + Google), Contas, Receitas/Despesas/Transferências, Categorias, Pago/Pendente, Cartões + Faturas + Parcelamento, Dashboard, Metas, e SaaS com planos Free e Pro.
- **Fases posteriores:** V1.1 Recorrências, V1.2 Orçamentos, V1.3 Family, V1.4 Importação/Exportação, V1.5 Android, V2 Finora Intelligence (IA).

A stack alvo (Cloudflare para web/CDN/DNS/edge; backend com API + PostgreSQL, possivelmente Supabase) é considerada apenas contexto. Os requisitos focam em comportamento e regras de negócio, não em implementação.

## Glossary

- **Finora**: A plataforma SaaS de controle financeiro descrita neste documento.
- **System**: Termo genérico para a plataforma Finora quando o comportamento não é específico de um subsistema.
- **Auth_Service**: Subsistema responsável por autenticação e emissão/validação de sessões.
- **Account_Service**: Subsistema que gerencia contas financeiras.
- **Transaction_Service**: Subsistema que gerencia transações (receita, despesa, transferência).
- **Category_Service**: Subsistema que gerencia categorias.
- **Card_Service**: Subsistema que gerencia cartões de crédito e faturas.
- **Installment_Service**: Subsistema que gerencia parcelamentos.
- **Recurrence_Service**: Subsistema que gerencia transações recorrentes.
- **Budget_Service**: Subsistema que gerencia orçamentos.
- **Goal_Service**: Subsistema que gerencia metas financeiras e contribuições.
- **Analytics_Service**: Subsistema que consolida dados e produz indicadores e relatórios.
- **Notification_Service**: Subsistema que gera e entrega notificações.
- **Billing_Service**: Subsistema que gerencia planos, assinaturas, trial, upgrade/downgrade e cobrança.
- **Household_Service**: Subsistema que gerencia grupos familiares, membros e papéis.
- **User**: Pessoa autenticada com uma conta no Finora.
- **Visitante**: Pessoa não autenticada que acessa páginas públicas.
- **Assinante**: User cuja Household possui uma assinatura ativa em um plano pago.
- **Household**: Grupo financeiro que compartilha dados (contas, transações, etc.). Todo User pertence a pelo menos uma Household.
- **Owner**: Papel do criador/proprietário da Household; possui todos os privilégios, incluindo billing e exclusão da Household.
- **Admin**: Papel com privilégios de gestão de dados e membros da Household, exceto billing e exclusão da Household.
- **Member**: Papel com acesso de leitura/escrita a dados financeiros conforme permissões, sem gestão de membros nem billing.
- **Account (Conta)**: Fonte de recursos financeiros (ex.: corrente, poupança, carteira, cartão de crédito).
- **Transaction (Transação/Lançamento)**: Registro financeiro do tipo receita (income), despesa (expense) ou transferência (transfer).
- **Income (Receita)**: Transação que aumenta o patrimônio e conta nos totais de receita.
- **Expense (Despesa)**: Transação que reduz o patrimônio e conta nos totais de despesa.
- **Transfer (Transferência)**: Movimentação entre duas contas da mesma Household que não é receita nem despesa.
- **Competência (Accrual_Date)**: Data do fato gerador da transação.
- **Pagamento (Payment)**: Data e status de efetivação financeira da transação (pago ou pendente).
- **Payment_Status**: Estado de efetivação de uma transação: `paid` (pago) ou `pending` (pendente).
- **Category (Categoria)**: Rótulo classificatório de transações, com nome, cor e classificação.
- **Classificacao**: Atributo de categoria: Essencial, Fixo, Variável ou Supérfluo.
- **Credit_Card (Cartão de Crédito)**: Conta especial com limite, dia de fechamento e dia de vencimento de fatura.
- **Invoice (Fatura)**: Conjunto de transações de um cartão em um ciclo, com valor total e data de vencimento.
- **Installment_Plan (Parcelamento)**: Plano que distribui um valor total em N parcelas em meses/faturas subsequentes.
- **Installment (Parcela)**: Uma das N frações de um Installment_Plan.
- **Recurring_Transaction (Recorrência)**: Modelo que gera transações futuras conforme periodicidade.
- **Budget (Orçamento)**: Limite de gasto planejado por categoria em um período.
- **Goal (Meta)**: Objetivo financeiro com valor alvo, ao qual o User adiciona contribuições.
- **Contribution (Contribuição)**: Aporte de valor associado a uma Goal.
- **Plan (Plano)**: Nível de assinatura: Free, Pro ou Family.
- **Subscription (Assinatura)**: Vínculo de uma Household a um Plan, com estado (trial, active, past_due, canceled, expired).
- **Trial**: Período de avaliação gratuita de um plano pago.
- **RLS (Row-Level Security)**: Isolamento de dados por Household, garantindo que Users só acessem dados de suas Households.
- **PWA**: Progressive Web App instalável e com capacidade offline.
- **Base_Currency**: Moeda padrão da Household usada em consolidações (padrão BRL).

---

## Requirements

### Requirement 1: Autenticação por E-mail e Senha

**User Story:** Como Visitante, quero criar uma conta e entrar com e-mail e senha, para acessar meus dados financeiros com segurança.

#### Acceptance Criteria

1. WHEN um Visitante submete cadastro com e-mail válido e senha que atende à política de senha, THE Auth_Service SHALL criar um User, criar uma Household padrão com esse User como Owner, e iniciar uma sessão autenticada.
2. IF um Visitante submete cadastro com e-mail já registrado, THEN THE Auth_Service SHALL rejeitar o cadastro e retornar mensagem informando que o e-mail já está em uso.
3. IF um Visitante submete senha com menos de 8 caracteres ou sem ao menos uma letra e um dígito, THEN THE Auth_Service SHALL rejeitar o cadastro e retornar os requisitos de senha não atendidos.
4. WHEN um User submete login com e-mail e senha corretos, THE Auth_Service SHALL iniciar uma sessão autenticada e retornar um token de sessão válido por no máximo 24 horas.
5. IF um User submete login com credenciais inválidas, THEN THE Auth_Service SHALL rejeitar o login e retornar mensagem genérica de credenciais inválidas sem indicar qual campo falhou.
6. WHERE um e-mail está temporariamente bloqueado por excesso de tentativas, WHEN um User submete credenciais corretas para esse e-mail, THE Auth_Service SHALL sobrepor imediatamente o bloqueio e iniciar uma sessão autenticada.
7. IF um User submete credenciais incorretas, THEN THE Auth_Service SHALL rejeitar o login independentemente de o e-mail estar ou não bloqueado.
8. WHEN um User solicita redefinição de senha para um e-mail registrado, THE Auth_Service SHALL enviar um link de redefinição válido por no máximo 60 minutos ao e-mail informado.
9. WHEN um User define nova senha por meio de um link de redefinição válido, THE Auth_Service SHALL atualizar a senha e invalidar todas as sessões ativas anteriores do User.
10. WHEN um User solicita logout, THE Auth_Service SHALL invalidar o token de sessão atual.
11. IF um User submete 5 tentativas de login inválidas para o mesmo e-mail em 15 minutos, THEN THE Auth_Service SHALL bloquear novas tentativas para esse e-mail por 15 minutos.

### Requirement 2: Autenticação via Google (OAuth)

**User Story:** Como Visitante, quero entrar usando minha conta Google, para acessar o Finora sem criar uma senha.

#### Acceptance Criteria

1. WHEN um Visitante conclui o fluxo OAuth do Google com sucesso e o e-mail Google não está registrado, THE Auth_Service SHALL criar um User associado a esse e-mail, exigir a definição de uma senha local de backup que atenda à política de senha, criar uma Household padrão com esse User como Owner, e iniciar uma sessão autenticada.
2. WHEN um Visitante conclui o fluxo OAuth do Google com sucesso e o e-mail Google já está registrado, THE Auth_Service SHALL vincular a identidade Google ao User existente e iniciar uma sessão autenticada.
3. IF o fluxo OAuth do Google falha ou é cancelado, THEN THE Auth_Service SHALL retornar o Visitante à tela de login com mensagem de falha de autenticação.
4. WHERE um User possui identidade Google vinculada, THE Auth_Service SHALL permitir login por Google sem exigir senha local.

### Requirement 3: Perfil de Usuário

**User Story:** Como User, quero gerenciar meus dados de perfil e preferências, para personalizar minha experiência no Finora.

#### Acceptance Criteria

1. THE System SHALL manter para cada User um nome de exibição, e-mail, idioma e fuso horário.
2. WHEN um User atualiza nome de exibição, idioma ou fuso horário, THE System SHALL persistir as alterações e aplicá-las nas próximas telas exibidas.
3. WHEN um User altera o e-mail, THE Auth_Service SHALL exigir confirmação por meio de um link enviado ao novo e-mail antes de efetivar a alteração.
4. WHEN um User confirma o novo e-mail por meio do link de confirmação válido, THE Auth_Service SHALL aplicar automaticamente a troca de e-mail no momento da confirmação, sem exigir ação adicional do User.
5. WHEN um User solicita exclusão da própria conta e não é Owner de nenhuma Household com outros membros, THE System SHALL remover os dados pessoais do User em conformidade com o Requisito de LGPD.
6. IF um User que é Owner de uma Household com outros membros solicita exclusão da conta, THEN THE System SHALL exigir a transferência da propriedade da Household a outro membro antes de concluir a exclusão.
7. WHEN a propriedade da Household é transferida a outro membro durante uma solicitação de exclusão de conta, THE System SHALL concluir automaticamente a exclusão da conta assim que a transferência de propriedade for efetivada, sem exigir uma ação separada do User.

### Requirement 4: Grupo Familiar (Household) e Papéis

**User Story:** Como Owner, quero convidar pessoas para minha Household e definir seus papéis, para compartilhar o controle financeiro familiar de forma segura.

#### Acceptance Criteria

1. THE System SHALL garantir que todo User pertença a pelo menos uma Household.
2. WHEN um User cria uma Household, THE Household_Service SHALL atribuir a esse User o papel de Owner na Household criada.
3. WHERE o plano da Household permite múltiplos membros, WHEN um Owner ou Admin convida um e-mail para a Household, THE Household_Service SHALL registrar um convite com status pendente válido por 7 dias e notificar o e-mail convidado.
4. WHEN um convite atinge o limite de expiração de 7 dias, THE Household_Service SHALL atualizar automaticamente o status do convite para expirado.
5. WHEN um convidado aceita um convite válido, THE Household_Service SHALL adicionar o convidado como membro da Household com o papel definido no convite.
6. IF um convite expirou ou foi revogado, THEN THE Household_Service SHALL impedir a aceitação e informar que o convite não é mais válido.
7. WHERE o número de membros da Household já atingiu o limite do plano, WHEN um Owner ou Admin tenta convidar um novo membro, THE Household_Service SHALL rejeitar o convite, definir o status do convite como revogado, e informar que o limite do plano foi atingido.
8. WHEN um Owner altera o papel de um membro entre Admin e Member, THE Household_Service SHALL aplicar as permissões correspondentes ao papel atribuído.
9. IF um Owner tenta alterar o papel de um membro para um valor diferente de Admin ou Member, THEN THE Household_Service SHALL rejeitar a alteração e informar que apenas os papéis Admin e Member são permitidos.
10. IF um Member ou Admin tenta alterar papéis de membros, THEN THE Household_Service SHALL rejeitar a operação por falta de permissão.
11. WHEN um Owner remove um membro da Household, THE Household_Service SHALL revogar o acesso desse membro aos dados da Household, preservando os registros financeiros já criados na Household.
12. WHEN um Owner transfere a propriedade da Household a outro membro, THE Household_Service SHALL atribuir o papel de Owner ao membro indicado e rebaixar o Owner anterior a Admin.
13. THE System SHALL garantir que cada Household possua exatamente um Owner a qualquer momento.

### Requirement 5: Isolamento de Dados por Household (Autorização)

**User Story:** Como User, quero que apenas membros da minha Household acessem nossos dados financeiros, para proteger a privacidade das finanças.

#### Acceptance Criteria

1. WHEN um User solicita qualquer dado financeiro, THE System SHALL retornar somente registros pertencentes a uma Household da qual o User é membro.
2. IF um User solicita acesso a um registro de uma Household da qual não é membro, THEN THE System SHALL negar o acesso e retornar erro de autorização.
3. WHEN uma verificação de autorização é aprovada para uma operação de dados financeiros, THE System SHALL executar uma verificação secundária de participação do User na Household antes de conceder o acesso.
4. IF a verificação secundária de participação na Household falha por erro de sistema, THEN THE System SHALL tratar a operação como falha de participação, negar o acesso e retornar erro de autorização.
5. WHEN um User realiza uma escrita em dados financeiros, THE System SHALL associar o registro à Household ativa do User.
6. THE System SHALL exigir que o User selecione uma Household ativa antes de realizar operações, inclusive quando o User pertence a apenas uma Household, e THE System SHALL restringir as operações à Household ativa selecionada.

### Requirement 6: Contas Financeiras (Accounts)

**User Story:** Como Member, quero cadastrar e gerenciar contas financeiras, para organizar de onde vêm e para onde vão os recursos.

#### Acceptance Criteria

1. WHEN um Member cria uma conta com nome, tipo e saldo inicial, THE Account_Service SHALL registrar a conta na Household ativa com o saldo inicial informado.
2. THE Account_Service SHALL suportar os tipos de conta corrente, poupança, carteira e cartão de crédito.
3. WHEN uma transação afeta uma conta, THE Account_Service SHALL manter o saldo da conta igual ao saldo inicial somado às receitas e transferências de entrada efetivadas, subtraído das despesas e transferências de saída efetivadas.
4. WHEN um Member edita o nome, o tipo ou o saldo inicial de uma conta, THE Account_Service SHALL persistir a alteração e recalcular o saldo atual da conta.
5. IF um Member tenta excluir uma conta que possui transações associadas, THEN THE Account_Service SHALL rejeitar a exclusão e oferecer arquivar a conta em vez de excluí-la.
6. WHEN um Member arquiva uma conta, THE Account_Service SHALL ocultar a conta das listas de seleção padrão, preservando suas transações e seu histórico.
7. WHERE o número de contas ativas da Household já atingiu o limite do plano, WHEN um Member tenta criar uma nova conta, THE Account_Service SHALL rejeitar a criação e exibir a mensagem de limite do plano somente nesse momento de rejeição, sem emitir avisos de limite enquanto a criação ainda é permitida.

### Requirement 7: Categorias

**User Story:** Como Member, quero classificar transações por categoria com cor e classificação, para entender a natureza dos meus gastos.

#### Acceptance Criteria

1. WHEN um Member cria uma categoria com nome, cor e classificação, THE Category_Service SHALL registrar a categoria na Household ativa.
2. IF o registro de uma categoria falha por erro de banco de dados ou de rede, THEN THE Category_Service SHALL exibir uma mensagem de erro e SHALL não exibir a categoria na interface enquanto o registro não for concluído com sucesso.
3. THE Category_Service SHALL restringir o campo classificação aos valores Essencial, Fixo, Variável e Supérfluo.
4. WHEN uma Household é criada, THE Category_Service SHALL provisionar um conjunto padrão de categorias iniciais para essa Household.
5. WHEN um Member edita nome, cor ou classificação de uma categoria, ou WHEN o System inicia uma atualização de categoria, THE Category_Service SHALL persistir a alteração e refletir a cor atualizada nos relatórios.
6. IF um Member tenta excluir uma categoria associada a transações, THEN THE Category_Service SHALL exigir a escolha de uma categoria substituta e reatribuir as transações à categoria substituta antes de excluir.
7. IF um Member cria uma categoria com nome idêntico ao de uma categoria existente na mesma Household, THEN THE Category_Service SHALL rejeitar a criação e informar duplicidade de nome.

### Requirement 8: Transações — Receitas, Despesas e Transferências

**User Story:** Como Member, quero registrar receitas, despesas e transferências, para acompanhar as movimentações financeiras da Household.

#### Acceptance Criteria

1. WHEN um Member cria uma transação do tipo income com valor, conta, data de competência e status de pagamento, THE Transaction_Service SHALL registrar a transação como receita na Household ativa.
2. WHEN um Member cria uma transação do tipo expense com valor, conta, categoria, data de competência e status de pagamento, THE Transaction_Service SHALL registrar a transação como despesa na Household ativa.
3. WHEN um Member cria uma transação do tipo transfer com valor, conta de origem e conta de destino distintas, THE Transaction_Service SHALL registrar a movimentação entre as duas contas.
4. IF um Member cria uma transferência com conta de origem igual à conta de destino, THEN THE Transaction_Service SHALL rejeitar a operação e informar que origem e destino devem ser diferentes.
5. IF um Member cria uma transação com valor menor ou igual a zero, THEN THE Transaction_Service SHALL rejeitar a operação e informar que o valor deve ser positivo.
6. WHEN um Member edita uma transação existente, THE Transaction_Service SHALL persistir as alterações e recalcular os saldos das contas afetadas.
7. WHEN um Member exclui uma transação, THE Transaction_Service SHALL remover a transação e recalcular os saldos das contas afetadas.
8. IF o recálculo dos saldos das contas afetadas falha durante a alteração ou exclusão de uma transação, THEN THE Transaction_Service SHALL concluir a alteração ou exclusão da transação mesmo assim, sem bloquear a operação principal pela falha de recálculo.
9. THE Transaction_Service SHALL registrar, para cada transação, a data de competência (Accrual_Date) e o status de pagamento (Payment_Status).

### Requirement 9: Competência versus Pagamento (Pago/Pendente)

**User Story:** Como Member, quero distinguir a data do fato do pagamento efetivo, para controlar o que já foi pago e o que está pendente.

#### Acceptance Criteria

1. THE Transaction_Service SHALL permitir que uma transação tenha status de pagamento `paid` ou `pending`.
2. WHEN uma transação é marcada como `paid`, THE Transaction_Service SHALL registrar a data de pagamento e incluir a transação no saldo efetivado das contas envolvidas.
3. WHILE uma transação está com status `pending`, THE Transaction_Service SHALL excluí-la do saldo efetivado das contas e acumulá-la no total de pendências, somando seu valor ao total de todas as demais transações `pending`.
4. WHEN um Member alterna o status de pagamento de uma transação entre `paid` e `pending`, THE Transaction_Service SHALL recalcular os saldos das contas afetadas e os totais de pendências.
5. THE Transaction_Service SHALL manter toda transação em exatamente um dos estados `paid` ou `pending` e SHALL impedir estados intermediários ou inválidos.
6. THE Analytics_Service SHALL calcular o total pendente como a soma dos valores das transações explicitamente marcadas com status `pending`.

### Requirement 10: Cartões de Crédito e Faturas

**User Story:** Como Member, quero cadastrar cartões de crédito e acompanhar faturas, para saber quanto e quando vou pagar.

#### Acceptance Criteria

1. WHEN um Member cria um cartão de crédito com nome, limite, dia de fechamento e dia de vencimento, THE Card_Service SHALL registrar o cartão na Household ativa.
2. WHEN uma despesa é atribuída a um cartão de crédito com uma data de competência, THE Card_Service SHALL alocar a despesa à Invoice do ciclo correspondente à data de competência e ao dia de fechamento do cartão.
3. THE Card_Service SHALL calcular o valor total de uma Invoice como a soma das despesas e parcelas alocadas àquele ciclo.
4. WHEN o dia de fechamento de um cartão é atingido, THE Card_Service SHALL prosseguir com o processamento normal de fechamento, fechar a Invoice do ciclo independentemente de conter transações, definir sua data de vencimento conforme o dia de vencimento do cartão, e aplicar o processamento ainda que ele afete Invoices já marcadas como pagas.
5. WHEN um Member registra o pagamento de uma Invoice, THE Card_Service SHALL marcar a Invoice como paga e refletir o pagamento no saldo da conta usada para o pagamento.
6. IF uma despesa atribuída a um cartão faria o total de faturas em aberto exceder o limite do cartão, THEN THE Card_Service SHALL registrar a despesa e sinalizar que o limite foi excedido.
7. THE Card_Service SHALL disponibilizar, para cada cartão, a lista de Invoices por ciclo com valor total e status pago/pendente.

### Requirement 11: Parcelamentos (Installments)

**User Story:** Como Member, quero parcelar uma compra em N vezes, para distribuir o valor em faturas ou meses subsequentes.

#### Acceptance Criteria

1. WHEN um Member cria uma despesa parcelada com valor total e número de parcelas N maior que 1, THE Installment_Service SHALL criar um Installment_Plan com N Installments.
2. THE Installment_Service SHALL distribuir o valor total do Installment_Plan entre as N Installments de forma que a soma das parcelas seja igual ao valor total, alocando eventuais diferenças de arredondamento à última parcela.
3. WHEN um Installment_Plan é associado a um cartão de crédito, THE Installment_Service SHALL alocar cada Installment à Invoice do ciclo correspondente aos meses subsequentes.
4. THE Installment_Service SHALL registrar, para cada Installment, o número da parcela e o total de parcelas (ex.: 3 de 12).
5. WHEN um Member cancela um Installment_Plan, THE Installment_Service SHALL remover as Installments ainda não pagas e preservar as Installments já pagas.
6. THE Analytics_Service SHALL considerar cada Installment como uma despesa na sua respectiva data de competência.

### Requirement 12: Transações Recorrentes (Fase V1.1)

**User Story:** Como Member, quero cadastrar receitas e despesas recorrentes, para não precisar lançá-las manualmente a cada período.

#### Acceptance Criteria

1. WHERE o plano da Household habilita recorrências, WHEN um Member cria uma Recurring_Transaction com tipo, valor, categoria, conta, periodicidade e data de início, THE Recurrence_Service SHALL registrar o modelo de recorrência na Household ativa.
2. THE Recurrence_Service SHALL suportar as periodicidades semanal, mensal e anual.
3. WHEN a data de ocorrência de uma Recurring_Transaction é atingida, THE Recurrence_Service SHALL gerar a transação correspondente com status de pagamento `pending`.
4. WHEN um Member define uma data de término ou um número máximo de ocorrências para uma Recurring_Transaction, THE Recurrence_Service SHALL cessar a geração de novas transações após esse limite.
5. WHEN um Member edita uma Recurring_Transaction, THE Recurrence_Service SHALL aplicar as alterações somente às ocorrências futuras, preservando as transações já geradas.
6. WHEN um Member exclui uma Recurring_Transaction, THE Recurrence_Service SHALL cessar a geração de novas transações e preservar as transações já geradas.
7. IF o plano da Household não habilita recorrências, THEN THE Recurrence_Service SHALL rejeitar a criação e informar que o recurso requer um plano superior.

### Requirement 13: Orçamentos (Fase V1.2)

**User Story:** Como Member, quero definir orçamentos por categoria e período, para controlar quanto pretendo gastar.

#### Acceptance Criteria

1. WHERE o plano da Household habilita orçamentos, WHEN um Member define um Budget para uma categoria em um período com um valor limite, THE Budget_Service SHALL registrar o Budget na Household ativa.
2. THE Budget_Service SHALL calcular o valor consumido de um Budget como a soma das despesas da categoria com data de competência dentro do período do Budget.
3. WHEN o valor consumido de um Budget atinge ou ultrapassa 80% do limite, THE Notification_Service SHALL gerar uma notificação de alerta de orçamento ao Member.
4. WHEN o valor consumido de um Budget ultrapassa 100% do limite, THE Budget_Service SHALL sinalizar o Budget como estourado e THE Notification_Service SHALL gerar uma notificação de estouro.
5. IF o plano da Household não habilita orçamentos, THEN THE Budget_Service SHALL rejeitar a criação e informar que o recurso requer um plano superior.

### Requirement 14: Metas Financeiras (Goals)

**User Story:** Como Member, quero criar metas financeiras e registrar contribuições, para acompanhar meu progresso rumo a um objetivo.

#### Acceptance Criteria

1. WHEN um Member cria uma Goal com nome, valor alvo e data alvo opcional, THE Goal_Service SHALL registrar a Goal na Household ativa com valor acumulado inicial zero.
2. WHEN um Member adiciona uma Contribution com valor positivo a uma Goal, THE Goal_Service SHALL somar o valor da Contribution ao valor acumulado da Goal.
3. WHEN um Member remove uma Contribution de uma Goal, THE Goal_Service SHALL subtrair o valor da Contribution do valor acumulado da Goal.
4. THE Goal_Service SHALL calcular o progresso de uma Goal como o valor acumulado dividido pelo valor alvo.
5. WHEN o valor acumulado de uma Goal atinge ou ultrapassa o valor alvo, THE Goal_Service SHALL marcar a Goal como concluída e THE Notification_Service SHALL gerar uma notificação de meta atingida.
6. IF um Member adiciona uma Contribution com valor menor ou igual a zero, THEN THE Goal_Service SHALL registrar o resultado da validação, rejeitar a operação, e informar que a contribuição deve ser positiva.

### Requirement 15: Dashboard e Relatórios (Analytics)

**User Story:** Como Member, quero visualizar indicadores e gráficos das finanças da Household, para entender saldo, receitas, despesas, pendências e evolução mensal.

#### Acceptance Criteria

1. THE Analytics_Service SHALL calcular o saldo total da Household como a soma dos saldos de todas as contas ativas em Base_Currency.
2. THE Analytics_Service SHALL calcular o total de receitas de um período como a soma dos valores das transações do tipo income com competência no período.
3. THE Analytics_Service SHALL calcular o total de despesas de um período como a soma dos valores das transações do tipo expense e das Installments com competência no período.
4. THE Analytics_Service SHALL excluir transações do tipo transfer dos totais de receitas e de despesas.
5. THE Analytics_Service SHALL calcular o total pendente como a soma dos valores das transações com status `pending` no período.
6. THE Analytics_Service SHALL produzir a distribuição de despesas por categoria, cada item com nome, cor e total, considerando apenas categorias com total maior que zero.
7. THE Analytics_Service SHALL produzir a evolução mensal de despesas, agregando os valores por mês de competência (YYYY-MM) em ordem cronológica.
8. WHEN um Member aplica um filtro de mês, THE Analytics_Service SHALL recalcular todos os indicadores e gráficos considerando apenas as transações do mês selecionado.
9. WHEN um Member aplica um filtro de mês e o recálculo é concluído com sucesso, THE Analytics_Service SHALL exibir um indicador breve de sucesso confirmando que o filtro foi aplicado.
10. IF a recalculação do filtro de mês falha por erro de sistema ou timeout, THEN THE Analytics_Service SHALL exibir o aviso claro de que o filtro não pôde ser aplicado, inclusive quando nenhum filtro havia sido previamente aplicado pelo User.
11. IF a recalculação do filtro de mês falha e não há dados anteriores para exibir, THEN THE Analytics_Service SHALL exibir um dashboard vazio acompanhado do aviso de que o filtro não pôde ser aplicado.
12. IF a recalculação do filtro de mês falha e há dados anteriores disponíveis, THEN THE Analytics_Service SHALL exibir os dados anteriores com um aviso claro de que o filtro não pôde ser aplicado.
13. WHERE existem ao menos dois meses de dados, THE Analytics_Service SHALL calcular a variação percentual de despesas do mês mais recente em relação ao mês anterior.

### Requirement 16: Notificações

**User Story:** Como User, quero receber notificações relevantes, para não perder pagamentos, faturas e marcos financeiros.

#### Acceptance Criteria

1. WHEN uma fatura de cartão está a 3 dias ou menos do vencimento e permanece pendente, THE Notification_Service SHALL gerar uma notificação de vencimento de fatura ao User.
2. WHEN uma transação pendente atinge sua data de vencimento sem ser marcada como paga, THE Notification_Service SHALL gerar uma notificação de conta a pagar em atraso.
3. THE Notification_Service SHALL exibir na central de notificações do User tanto as notificações não lidas quanto as já lidas, mantendo as notificações lidas visíveis junto das não lidas após a leitura.
4. WHEN um User marca explicitamente uma notificação como lida, THE Notification_Service SHALL atualizar o estado da notificação para lida, e THE Notification_Service SHALL alterar o estado para lida somente por marcação explícita do User.
5. WHERE um User desativa uma categoria de notificação nas preferências, THE Notification_Service SHALL suprimir a geração de notificações dessa categoria para esse User, aplicando a preferência do User inclusive às categorias críticas, permitindo assim a desativação de todas as categorias de notificação.

### Requirement 17: Planos e Assinaturas (Billing)

**User Story:** Como Owner, quero escolher e gerenciar o plano da minha Household, para acessar os recursos adequados às minhas necessidades.

#### Acceptance Criteria

1. WHEN uma Household é criada, THE Billing_Service SHALL atribuir a ela o plano Free como estado inicial da assinatura.
2. WHEN um Owner inicia um trial de um plano pago, THE Billing_Service SHALL conceder acesso aos recursos do plano por um período de trial de 14 dias.
3. WHEN o período de trial termina sem conversão em assinatura paga, THE Billing_Service SHALL reverter a Household ao plano Free.
4. WHEN o período de trial termina e o pagamento do plano pago foi confirmado, THE Billing_Service SHALL manter a Household no plano pago sem reverter ao Free.
5. WHEN um Owner faz upgrade para um plano superior e o pagamento é confirmado, THE Billing_Service SHALL habilitar imediatamente os recursos e limites do novo plano.
6. WHEN um Owner solicita downgrade, THE Billing_Service SHALL validar que a transição é um caminho de downgrade permitido (por exemplo, Family para Pro ou Free, ou Pro para Free) antes de aceitar a solicitação.
7. WHEN um Owner solicita um downgrade válido para um plano inferior, THE Billing_Service SHALL manter os recursos do plano atual até o fim do ciclo de cobrança vigente e aplicar o plano inferior no ciclo seguinte.
8. IF, após um downgrade, o uso atual da Household excede os limites do plano inferior, THEN THE Billing_Service SHALL manter os dados existentes acima do limite acessíveis para visualização em modo somente leitura e bloquear a criação de novos itens até que o uso volte ao limite.
9. WHEN um Owner cancela a assinatura paga, THE Billing_Service SHALL definir imediatamente o estado da assinatura como canceled, manter o acesso pago até o fim do ciclo de cobrança já pago e, ao término, reverter a Household ao plano Free.
10. IF um pagamento recorrente falha, THEN THE Billing_Service SHALL colocar a assinatura em estado past_due e conceder um período de carência de 7 dias antes de reverter ao plano Free.
11. IF um Member ou Admin tenta alterar o plano ou dados de cobrança, THEN THE Billing_Service SHALL rejeitar a operação por falta de permissão, restringindo billing ao Owner.
12. WHILE a assinatura de uma Household está expirada e revertida ao Free, THE System SHALL manter todos os dados financeiros históricos acessíveis dentro dos limites do plano Free.

### Requirement 18: Aplicação de Limites por Plano

**User Story:** Como System, quero aplicar os limites de cada plano de forma consistente, para que a monetização funcione e os usuários entendam os limites.

#### Acceptance Criteria

1. WHEN um Member tenta criar um recurso cujo limite quantitativo do plano já foi atingido, THE System SHALL rejeitar a criação imediatamente, sem permitir que a criação prossiga, e informar o limite atingido e o plano necessário para ampliá-lo.
2. WHEN um Member tenta usar um recurso não habilitado no plano atual, THE System SHALL bloquear o uso do recurso imediatamente no momento em que apresenta a opção de upgrade.
3. WHERE o plano Free limita o histórico de dados exibido, THE Analytics_Service SHALL restringir relatórios ao intervalo de histórico permitido pelo plano Free.
4. THE System SHALL aplicar os limites conforme a Matriz de Funcionalidades por Plano deste documento.

### Requirement 19: Plataformas Web/PWA e Sincronização

**User Story:** Como User, quero acessar o Finora pelo navegador e instalá-lo como PWA, para usar em diferentes dispositivos com dados sincronizados.

#### Acceptance Criteria

1. THE System SHALL disponibilizar a aplicação Web responsiva instalável como PWA.
2. WHILE a sincronização inicial com o backend está em andamento para um User autenticado, THE System SHALL permitir o acesso à interface do aplicativo e SHALL bloquear a exibição de dados até que a sincronização inicial seja concluída, garantindo que o User visualize os dados atuais da fonte de verdade.
3. WHILE o dispositivo está offline e há dados previamente carregados em cache local, THE System SHALL permitir o acesso completo aos dados em cache sem exibir indicação de estado offline.
4. IF o dispositivo está offline e não há dados em cache local (por exemplo, em uma instalação nova), THEN THE System SHALL bloquear o acesso e exibir mensagem informando que o primeiro uso requer conexão com a internet.
5. WHEN a conectividade é restabelecida após alterações locais offline, THE System SHALL sincronizar as alterações com o backend.
6. IF a sincronização detecta conflito entre uma alteração local e o backend, THEN THE System SHALL preservar ambas as versões e sinalizar o conflito para resolução pelo User.

### Requirement 20: Portabilidade de Dados (Export/Import — Fase V1.4)

**User Story:** Como Owner, quero exportar e importar os dados da Household, para ter portabilidade e cópia de segurança.

#### Acceptance Criteria

1. WHEN um Owner solicita exportação dos dados da Household, THE System SHALL gerar um arquivo estruturado contendo contas, categorias, transações, cartões, faturas, parcelamentos, orçamentos e metas da Household.
2. WHERE o plano da Household habilita importação, WHEN um Owner importa um arquivo estruturado válido, THE System SHALL criar os registros correspondentes na Household ativa.
3. IF um Owner tenta importar um arquivo inválido ou corrompido, THEN THE System SHALL rejeitar a importação e informar o motivo sem alterar os dados existentes.
4. FOR ALL conjuntos de dados válidos da Household, exportar e em seguida importar em uma Household vazia SHALL produzir um conjunto de dados equivalente ao original (propriedade de ida-e-volta).

### Requirement 21: Segurança e Proteção de Dados Financeiros (Não Funcional)

**User Story:** Como User, quero que meus dados financeiros sejam protegidos, para confiar na plataforma.

#### Acceptance Criteria

1. THE System SHALL transmitir todos os dados entre cliente e servidor por canais criptografados (TLS).
2. THE Auth_Service SHALL armazenar senhas apenas como hashes com algoritmo de derivação resistente a força bruta.
3. THE System SHALL aplicar autorização por Household (RLS) em todas as operações de leitura e escrita de dados financeiros.
4. IF o RLS não está corretamente habilitado ou configurado, THEN THE System SHALL negar todo acesso a dados financeiros (comportamento fail-closed).
5. WHEN uma sessão fica inativa por mais de 24 horas, THE Auth_Service SHALL exigir nova autenticação, e THE Auth_Service SHALL não exigir nova autenticação enquanto a sessão permanecer ativa ou com inatividade inferior a 24 horas.
6. IF uma requisição autenticada apresenta token inválido ou expirado, THEN THE System SHALL negar a requisição e retornar erro de autenticação.

### Requirement 22: Privacidade e LGPD (Não Funcional)

**User Story:** Como User, quero controle sobre meus dados pessoais, para exercer meus direitos de privacidade.

#### Acceptance Criteria

1. WHEN um User solicita uma cópia dos seus dados pessoais, THE System SHALL fornecer os dados pessoais associados ao User em formato estruturado dentro do prazo legal aplicável.
2. IF o System não consegue cumprir o prazo legal de fornecimento dos dados pessoais por questões técnicas ou de volume, THEN THE System SHALL falhar a solicitação e notificar o User de que o prazo não pôde ser cumprido.
3. WHEN um User solicita a exclusão dos seus dados pessoais e não há impedimento de propriedade de Household, THE System SHALL remover ou anonimizar os dados pessoais do User.
4. WHEN um User realiza o primeiro acesso autenticado, THE System SHALL registrar o consentimento do User quanto aos termos de uso e à política de privacidade e, em seguida, processar eventuais solicitações de exclusão de dados pessoais desse User.
5. THE System SHALL restringir o acesso a dados pessoais de um User estritamente ao próprio User e aos processos internos necessários, sem conceder acesso a sistemas externos.

### Requirement 23: Desempenho, Disponibilidade e Observabilidade (Não Funcional)

**User Story:** Como User, quero uma aplicação rápida e confiável, para gerenciar minhas finanças sem interrupções.

#### Acceptance Criteria

1. WHEN um Member solicita o Dashboard de uma Household com até 5.000 transações, THE Analytics_Service SHALL retornar os indicadores consolidados em até 2 segundos no percentil 95.
2. WHEN um Member cria, edita ou exclui uma transação, THE Transaction_Service SHALL confirmar a operação em até 1 segundo no percentil 95.
3. THE System SHALL manter disponibilidade mensal de no mínimo 99,5% para as operações essenciais de autenticação e consulta de dados.
4. THE System SHALL registrar logs estruturados de eventos de autenticação, erros de aplicação e falhas de cobrança para observabilidade.
5. IF uma operação de escrita falha por erro do servidor, THEN THE System SHALL preservar o estado anterior consistente e retornar mensagem de erro ao User, tratando o tratamento de erro como bem-sucedido somente quando ambas as ações ocorrem.

---

## Regras de Negócio Financeiras

Esta seção consolida regras transversais que orientam vários módulos e devem ser observadas pelos requisitos acima.

1. **Transferência não é receita nem despesa.** Uma Transfer move valor entre duas contas da mesma Household. Afeta o saldo das contas de origem e destino, mas nunca é contabilizada nos totais de receita nem de despesa (Requisitos 8.3, 8.4 e 15.4).
2. **Competência × Pagamento.** Toda transação tem uma data de competência (fato gerador) e um status de pagamento (`paid`/`pending`) com data de efetivação quando paga. Saldos efetivados consideram apenas transações `paid`; pendências consideram transações `pending` (Requisitos 9 e 15.5).
3. **Cartão de crédito e fatura.** Compras no cartão compõem a Invoice do ciclo determinado pela data de competência e pelo dia de fechamento. A Invoice fecha no dia de fechamento e vence no dia de vencimento. O pagamento da fatura reflete no saldo da conta pagadora (Requisito 10).
4. **Parcelamento.** Um parcelamento distribui o valor total em N parcelas de soma igual ao total, com diferenças de arredondamento na última parcela; parcelas são alocadas a meses/faturas subsequentes e cada parcela conta como despesa na sua competência (Requisito 11).
5. **Recorrência.** Uma recorrência gera transações futuras conforme periodicidade, sempre com status inicial `pending`; edições afetam apenas ocorrências futuras (Requisito 12).
6. **Orçamento.** Um Budget é definido por categoria e período; o consumo é a soma das despesas da categoria no período; alertas em 80% e estouro acima de 100% (Requisito 13).
7. **Meta.** Uma Goal acumula Contributions positivas até o valor alvo; progresso é acumulado/alvo; conclusão ocorre ao atingir o alvo (Requisito 14).
8. **Moeda base.** Consolidações usam a Base_Currency da Household (padrão BRL).

---

## Matriz de Funcionalidades por Plano

A tabela define o que cada plano libera. O System aplica esses limites conforme os Requisitos 17 e 18.

| Recurso | Free | Pro | Family |
|---|---|---|---|
| Households por Owner | 1 | 1 | 1 |
| Membros por Household | 1 | 1 | Até 6 |
| Contas ativas | Até 3 | Ilimitadas | Ilimitadas |
| Cartões de crédito | Até 1 | Ilimitados | Ilimitados |
| Transações (receita/despesa/transferência) | Ilimitadas | Ilimitadas | Ilimitadas |
| Categorias personalizadas | Até 10 | Ilimitadas | Ilimitadas |
| Parcelamentos | Sim | Sim | Sim |
| Faturas de cartão | Sim | Sim | Sim |
| Metas financeiras | Até 1 | Ilimitadas | Ilimitadas |
| Recorrências (V1.1) | Não | Sim | Sim |
| Orçamentos (V1.2) | Não | Sim | Sim |
| Compartilhamento familiar (papéis) (V1.3) | Não | Não | Sim |
| Histórico de relatórios | Últimos 3 meses | Ilimitado | Ilimitado |
| Exportação de dados | Sim | Sim | Sim |
| Importação de dados (V1.4) | Não | Sim | Sim |
| Notificações | Básicas | Completas | Completas |
| Finora Intelligence / IA (V2) | Não | Prévia | Completa |
| Trial de plano pago | — | 14 dias | 14 dias |

Notas:

- "Ilimitado" significa sem limite imposto pelo plano; limites técnicos de desempenho continuam se aplicando (Requisito 23).
- Limites quantitativos aplicam-se à contagem de itens ativos (não arquivados/excluídos).
- Ao ultrapassar limites após downgrade, aplica-se o comportamento somente leitura do Requisito 17.6.

---

## Roadmap de Fases (Priorização)

- **V1.0 (MVP):** Requisitos 1–11, 14, 15, 16 (parcial), 17, 18, 19, 21, 22, 23 — planos Free e Pro.
- **V1.1:** Requisito 12 (Recorrências).
- **V1.2:** Requisito 13 (Orçamentos).
- **V1.3:** Requisito 4 completo com plano Family (compartilhamento familiar).
- **V1.4:** Requisito 20 (Importação/Exportação completa).
- **V1.5:** Android (React Native) — reaproveitando os requisitos de comportamento e o backend como fonte de verdade.
- **V2:** Finora Intelligence (insights/IA).
