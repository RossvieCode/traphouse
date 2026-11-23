-- Delete a product from the admin.
--
-- A product nobody ever ordered is removed completely, with its sizes and
-- stock log. A product that appears in past orders is archived instead: it
-- leaves the shop and the admin, its stock goes to 0 (logged), and its rows
-- stay so sales history and order details keep working.
-- A product held by a waiting order can't be deleted until that order is
-- confirmed or cancelled.

alter table public.products add column deleted_at timestamptz;

-- An archived product can't be edited back to life (e.g. from an old admin tab).
create function public.products_block_deleted() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is not null then
    raise exception 'This product was deleted';
  end if;
  return new;
end $$;

create trigger products_block_deleted before update on public.products
  for each row execute function public.products_block_deleted();

-- The admin's stock list no longer shows archived products.
create or replace view public.inventory with (security_invoker = true) as
select
  v.id         as variant_id,
  p.id         as product_id,
  p.slug,
  p.name,
  p.category,
  p.price_rwf,
  p.main_photo,
  p.active     as product_active,
  v.size,
  v.colour,
  v.position,
  v.active,
  v.on_hand,
  coalesce(r.reserved, 0)                              as reserved,
  greatest(0, v.on_hand - coalesce(r.reserved, 0))     as available,
  coalesce(s.sold, 0)                                  as sold
from public.variants v
join public.products p on p.id = v.product_id
left join lateral (
  select sum(oi.qty)::int as reserved
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.variant_id = v.id and o.status = 'pending' and o.expires_at > now()
) r on true
left join lateral (
  -- sales are negative, returns (cancelled confirmed orders) positive
  select (-sum(m.change))::int as sold
  from public.stock_movements m
  where m.variant_id = v.id and m.reason in ('sale', 'cancel')
) s on true
where p.deleted_at is null;

-- Returns {"result": "removed" | "archived", "photos": [...]}; the admin then
-- deletes those photos from Storage.
create function public.delete_product(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_admin   uuid := public.require_admin();
  v_product public.products;
  v_held    int;
  v_photos  text[];
  v_var     record;
begin
  select * into v_product from public.products p where p.id = p_id and p.deleted_at is null for update;
  if not found then raise exception 'This product doesn''t exist (any more)'; end if;

  -- lock its sizes, in id order like the other stock functions
  perform 1 from public.variants v where v.product_id = p_id order by v.id for update;

  select coalesce(sum(public.reserved_qty(v.id)), 0) into v_held
  from public.variants v where v.product_id = p_id;
  if v_held > 0 then
    raise exception 'This product is in a waiting order (% held). Confirm or cancel that order first.', v_held;
  end if;

  v_photos := array_remove(array[v_product.main_photo] || v_product.extra_photos || v_product.colour_photos, '');

  if exists (select 1 from public.order_items oi where oi.product_id = p_id) then
    for v_var in select v.id, v.on_hand from public.variants v where v.product_id = p_id and v.on_hand > 0 order by v.id loop
      insert into public.stock_movements (variant_id, change, reason, admin_id, note)
      values (v_var.id, -v_var.on_hand, 'adjustment', v_admin, 'product deleted');
    end loop;
    update public.variants v set on_hand = 0, active = false where v.product_id = p_id;
    update public.products p set active = false, deleted_at = now() where p.id = p_id;
    return jsonb_build_object('result', 'archived', 'photos', to_jsonb(v_photos));
  end if;

  delete from public.stock_movements m using public.variants v where m.variant_id = v.id and v.product_id = p_id;
  delete from public.variants v where v.product_id = p_id;
  delete from public.products p where p.id = p_id;
  return jsonb_build_object('result', 'removed', 'photos', to_jsonb(v_photos));
end $$;

revoke execute on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_product(uuid) to authenticated;
revoke execute on function public.products_block_deleted() from public, anon, authenticated;
