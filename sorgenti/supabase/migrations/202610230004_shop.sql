-- Optional merchandise catalog. No card, shipping-address or order data stored here.
create table public.shop_settings (
  id integer primary key default 1 check(id=1),
  enabled boolean not null default false,
  recommendations_enabled boolean not null default false,
  amazon_affiliate boolean not null default false,
  seller_name text not null default '',
  seller_address text not null default '',
  seller_contact text not null default '',
  tax_details text not null default '',
  shipping_terms text not null default '',
  returns_terms text not null default '',
  terms_url text not null default '',
  check(not enabled or (
    length(trim(seller_name))>=5 and length(trim(seller_address))>=5
    and seller_contact ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and length(trim(tax_details))>=5 and length(trim(shipping_terms))>=5
    and length(trim(returns_terms))>=5 and terms_url ~ '^https://[^/[:space:]]+'
  ))
);
insert into public.shop_settings(id) values(1);
create table public.shop_products (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'doctor' check(kind in ('amazon','doctor')),
  title text not null check(length(trim(title))>=3),
  description text not null default '',
  price_cents integer not null default 0 check(price_cents between 0 and 99999999),
  image_url text not null default '' check(image_url='' or image_url ~ '^https://[^/[:space:]]+'),
  checkout_url text not null default '',
  status text not null default 'draft' check(status in ('draft','published')),
  created_at timestamptz not null default now(),
  check(checkout_url='' or
    (kind='doctor' and checkout_url ~ '^https://buy\.stripe\.com/[A-Za-z0-9_/?=&%+.#-]+$') or
    (kind='amazon' and checkout_url ~ '^https://(www\.)?amazon\.it/[^[:space:]@]+$') or
    (kind='amazon' and checkout_url ~ '^https://amzn\.(to|eu)/[^[:space:]@]+$')
  ),
  check(status <> 'published' or (length(trim(description))>0 and checkout_url<>'' and
    (kind='amazon' or (price_cents>0 and image_url<>''))))
);
alter table public.shop_products enable row level security;
alter table public.shop_settings enable row level security;
revoke all on public.shop_products,public.shop_settings from public,anon,authenticated;
grant select on public.shop_products,public.shop_settings to anon,authenticated;
grant insert,update,delete on public.shop_products to authenticated;
grant insert,update on public.shop_settings to authenticated;
create policy shop_settings_public on public.shop_settings for select to anon,authenticated using(true);
create policy shop_settings_editor on public.shop_settings for all to authenticated using(public.is_editor()) with check(public.is_editor());
create policy shop_products_public on public.shop_products for select to anon,authenticated using(
  status='published' and exists(select 1 from public.shop_settings where id=1 and ((kind='doctor' and enabled) or (kind='amazon' and recommendations_enabled)))
);
create policy shop_products_editor on public.shop_products for all to authenticated using(public.is_editor()) with check(public.is_editor());
