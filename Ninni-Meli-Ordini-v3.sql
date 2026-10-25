-- Ninni Meli only. Requires the existing public.products table.
-- Sandbox implementation: no customer addresses, credentials or card data here.
begin;
create table public.shop_orders (
  id uuid primary key,
  fingerprint text not null,
  status text not null default 'creating' check (status in ('creating','pending','paid','expired','needs_review')),
  amount_total integer not null default 0 check (amount_total >= 0),
  currency text not null default 'eur' check (currency = 'eur'),
  stripe_session_id text unique,
  expires_at timestamptz not null default (now() + interval '40 minutes'),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create table public.shop_order_items (
  order_id uuid not null references public.shop_orders(id),
  product_id uuid not null references public.products(id),
  name text not null,
  unit_amount integer not null check (unit_amount >= 0),
  quantity integer not null check (quantity between 1 and 20),
  primary key(order_id,product_id)
);
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;
revoke all on public.shop_orders, public.shop_order_items from public, anon, authenticated;
grant select,insert,update on public.shop_orders to service_role;
grant select,insert on public.shop_order_items to service_role;

create function public.shop_prepare_order(p_order_id uuid, p_fingerprint text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.shop_orders; p public.products; item jsonb; created boolean; qty integer; total bigint := 0; result_items jsonb;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'invalid_fingerprint'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'invalid_items'; end if;
  if jsonb_array_length(p_items) not between 1 and 10 then raise exception 'invalid_items'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then raise exception 'duplicate_product'; end if;
  insert into public.shop_orders(id,fingerprint) values(p_order_id,p_fingerprint) on conflict(id) do nothing;
  created := found;
  select * into o from public.shop_orders where id=p_order_id for update;
  if o.fingerprint <> p_fingerprint then raise exception 'order_conflict'; end if;
  if created then
    -- Consistent product lock order; the entire function runs in one transaction.
    for item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
      if coalesce(item->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'invalid_quantity'; end if;
      qty := (item->>'quantity')::integer;
      if qty not between 1 and 20 then raise exception 'invalid_quantity'; end if;
      select * into p from public.products where id=(item->>'id')::uuid for update;
      if not found then raise exception 'product_unavailable'; end if;
      if not p.published or p.currency <> 'EUR' or p.stock < qty then raise exception 'product_unavailable'; end if;
      total := total + p.price_cents::bigint*qty;
      if total > 1000000 then raise exception 'amount_limit'; end if;
      update public.products set stock=stock-qty where id=p.id;
      insert into public.shop_order_items(order_id,product_id,name,unit_amount,quantity) values(p_order_id,p.id,p.name,p.price_cents,qty);
    end loop;
    if total < 50 then raise exception 'amount_too_small'; end if;
    update public.shop_orders set amount_total=total::integer where id=p_order_id returning * into o;
  end if;
  select jsonb_agg(jsonb_build_object('product_id',i.product_id,'name',i.name,'unit_amount',i.unit_amount,'quantity',i.quantity) order by i.product_id)
    into result_items from public.shop_order_items i where i.order_id=p_order_id;
  return jsonb_build_object('id',o.id,'status',o.status,'amount_total',o.amount_total,'expires_at',floor(extract(epoch from o.expires_at)),
    'stripe_session_id',o.stripe_session_id,'items',result_items);
end $$;

create function public.shop_bind_session(p_order_id uuid,p_session_id text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.shop_orders;
begin
  select * into o from public.shop_orders where id=p_order_id for update;
  if not found or p_session_id is null or p_session_id !~ '^cs_test_' then raise exception 'invalid_session'; end if;
  if o.stripe_session_id is not null and o.stripe_session_id <> p_session_id then raise exception 'session_conflict'; end if;
  update public.shop_orders set stripe_session_id=p_session_id,status=case when status='creating' then 'pending' else status end where id=p_order_id;
end $$;

create function public.shop_finish_order(p_order_id uuid,p_session_id text,p_amount integer,p_currency text,p_outcome text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.shop_orders; i public.shop_order_items;
begin
  select * into o from public.shop_orders where id=p_order_id for update;
  if not found then raise exception 'unknown_order'; end if;
  if p_session_id is null or p_session_id !~ '^cs_test_' then raise exception 'invalid_session'; end if;
  if p_amount is distinct from o.amount_total or p_currency is distinct from o.currency then raise exception 'amount_mismatch'; end if;
  if o.stripe_session_id is not null and o.stripe_session_id <> p_session_id then raise exception 'session_conflict'; end if;
  if p_outcome is null or p_outcome not in ('paid','expired') then raise exception 'invalid_outcome'; end if;
  if p_outcome='paid' then
    update public.shop_orders set stripe_session_id=p_session_id,
      status=case when status in ('expired','needs_review') then 'needs_review' else 'paid' end,
      paid_at=coalesce(paid_at,now()) where id=p_order_id;
  elsif o.status in ('creating','pending') then
    for i in select * from public.shop_order_items where order_id=p_order_id order by product_id loop
      update public.products set stock=stock+i.quantity where id=i.product_id;
    end loop;
    update public.shop_orders set stripe_session_id=p_session_id,status='expired' where id=p_order_id;
  end if;
end $$;
revoke all on function public.shop_prepare_order(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.shop_bind_session(uuid,text) from public,anon,authenticated;
revoke all on function public.shop_finish_order(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.shop_prepare_order(uuid,text,jsonb) to service_role;
grant execute on function public.shop_bind_session(uuid,text) to service_role;
grant execute on function public.shop_finish_order(uuid,text,integer,text,text) to service_role;
commit;
