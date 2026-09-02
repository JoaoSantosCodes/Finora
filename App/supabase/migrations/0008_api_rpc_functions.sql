-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRAÇÃO 0008: FUNÇÕES RPC ATÔMICAS COM HARDENING DE SEGURANÇA (API-001)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. RPC: TRANSFERÊNCIA DE SALDO ENTRE CONTAS (ATÔMICA)
create or replace function public.rpc_transfer_funds(
  p_household_id uuid,
  p_source_account_id uuid,
  p_target_account_id uuid,
  p_amount_cents bigint,
  p_accrual_date date,
  p_description text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source_household uuid;
  v_target_household uuid;
  v_tx_id uuid;
begin
  -- Validações de parâmetros
  if p_amount_cents <= 0 then
    raise exception 'INVALID_AMOUNT: o valor da transferência deve ser maior que zero';
  end if;
  if p_source_account_id = p_target_account_id then
    raise exception 'INVALID_TRANSFER: a conta de origem e destino devem ser diferentes';
  end if;

  -- Verificar pertencimento e existência das contas (RLS + Triggers farão validação estrita)
  select household_id into v_source_household from public.accounts where id = p_source_account_id;
  select household_id into v_target_household from public.accounts where id = p_target_account_id;

  if v_source_household is null or v_source_household <> p_household_id then
    raise exception 'ACCOUNT_NOT_FOUND: conta de origem inválida ou de outro household';
  end if;
  if v_target_household is null or v_target_household <> p_household_id then
    raise exception 'ACCOUNT_NOT_FOUND: conta de destino inválida ou de outro household';
  end if;

  -- Criar transação única do tipo transfer
  insert into public.transactions (
    household_id,
    type,
    amount_cents,
    account_id,
    counter_account_id,
    accrual_date,
    payment_status,
    paid_at,
    external_ref
  ) values (
    p_household_id,
    'transfer',
    p_amount_cents,
    p_source_account_id,
    p_target_account_id,
    p_accrual_date,
    'paid',
    now(),
    coalesce(p_description, 'Transferência entre contas')
  )
  returning id into v_tx_id;

  return jsonb_build_object('success', true, 'transaction_id', v_tx_id);
end;
$$;

revoke all on function public.rpc_transfer_funds(uuid, uuid, uuid, bigint, date, text) from public, anon;
grant execute on function public.rpc_transfer_funds(uuid, uuid, uuid, bigint, date, text) to authenticated;


-- 2. RPC: LANÇAMENTO PARCELADO (ATÔMICO)
create or replace function public.rpc_create_installment_transaction(
  p_household_id uuid,
  p_account_id uuid,
  p_category_id uuid,
  p_total_cents bigint,
  p_installments_count integer,
  p_first_due_date date,
  p_description text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_main_tx_id uuid;
  v_base_amount bigint;
  v_remainder bigint;
  v_installment_amount bigint;
  v_accrual_date date;
  i integer;
begin
  if p_installments_count < 2 then
    raise exception 'INVALID_INSTALLMENT_COUNT: parcelamento exige no mínimo 2 parcelas';
  end if;
  if p_total_cents <= 0 then
    raise exception 'INVALID_AMOUNT: valor total deve ser maior que zero';
  end if;

  -- 1. Criar Installment Plan
  insert into public.installment_plans (
    household_id,
    total_amount_cents,
    installments_count
  ) values (
    p_household_id,
    p_total_cents,
    p_installments_count
  )
  returning id into v_plan_id;

  -- 2. Criar Transação Principal
  insert into public.transactions (
    household_id,
    type,
    amount_cents,
    account_id,
    category_id,
    accrual_date,
    payment_status,
    external_ref
  ) values (
    p_household_id,
    'expense',
    p_total_cents,
    p_account_id,
    p_category_id,
    p_first_due_date,
    'pending',
    p_description
  )
  returning id into v_main_tx_id;

  -- 3. Calcular parcelas com resto no último lançamento (Property 3)
  v_base_amount := p_total_cents / p_installments_count;
  v_remainder := p_total_cents % p_installments_count;

  for i in 1..p_installments_count loop
    if i = p_installments_count then
      v_installment_amount := v_base_amount + v_remainder;
    else
      v_installment_amount := v_base_amount;
    end if;

    v_accrual_date := p_first_due_date + ((i - 1) || ' month')::interval;

    insert into public.installments (
      household_id,
      installment_plan_id,
      number,
      amount_cents,
      accrual_date,
      transaction_id,
      payment_status
    ) values (
      p_household_id,
      v_plan_id,
      i,
      v_installment_amount,
      v_accrual_date,
      v_main_tx_id,
      'pending'
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'installment_plan_id', v_plan_id,
    'transaction_id', v_main_tx_id,
    'installments_count', p_installments_count
  );
end;
$$;

revoke all on function public.rpc_create_installment_transaction(uuid, uuid, uuid, bigint, integer, date, text) from public, anon;
grant execute on function public.rpc_create_installment_transaction(uuid, uuid, uuid, bigint, integer, date, text) to authenticated;


-- 3. RPC: EXCLUSÃO DE TRANSAÇÃO COM AUDITORIA ATÔMICA
create or replace function public.rpc_delete_transaction_with_audit(
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tx record;
  v_actor_id uuid;
begin
  -- Buscar dados da transação antes de excluir (respeitando RLS do invokador)
  select * into v_tx from public.transactions where id = p_transaction_id;

  if v_tx.id is null then
    raise exception 'TRANSACTION_NOT_FOUND: transação não encontrada ou acesso negado pelo RLS';
  end if;

  -- Identificar ator da sessão RLS
  v_actor_id := auth.uid();

  -- Executar exclusão
  delete from public.transactions where id = p_transaction_id;

  -- Inserir registro em audit_logs na MESMA transação
  insert into public.audit_logs (
    household_id,
    actor_id,
    operation,
    entity,
    metadata
  ) values (
    v_tx.household_id,
    v_actor_id,
    'DELETE',
    'transactions',
    jsonb_build_object(
      'transaction_id', v_tx.id,
      'amount_cents', v_tx.amount_cents,
      'type', v_tx.type,
      'account_id', v_tx.account_id
    )
  );

  return jsonb_build_object('success', true, 'deleted_id', p_transaction_id);
end;
$$;

revoke all on function public.rpc_delete_transaction_with_audit(uuid) from public, anon;
grant execute on function public.rpc_delete_transaction_with_audit(uuid) to authenticated;
