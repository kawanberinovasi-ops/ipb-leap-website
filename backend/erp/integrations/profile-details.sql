create table erp_private.profile_details (
  user_id uuid primary key references public.erp_profiles(id) on delete cascade,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  updated_at timestamptz not null default now()
);
alter table erp_private.profile_details enable row level security;
create policy profile_details_rpc_only on erp_private.profile_details
  for all to anon, authenticated using (false) with check (false);
revoke all on erp_private.profile_details from public, anon, authenticated;

create function erp_private.own_profile_details(p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  field record;
  value_text text;
  limits constant jsonb := '{"nick":80,"whatsapp":40,"study":160,"student_number":100,"institution":160,"position":160,"city":120,"linkedin":500,"bio":1500}';
  cleaned jsonb := '{}'::jsonb;
  result jsonb;
begin
  if actor is null or not erp_private.session_valid() or not exists (
    select 1 from public.erp_profiles where id = actor and active
  ) then
    raise exception 'Masuk kembali dengan akun aktif untuk membuka profil.' using errcode = '42501';
  end if;

  if p_patch is not null then
    if jsonb_typeof(p_patch) <> 'object' or octet_length(p_patch::text) > 18000 then
      raise exception 'Isian profil tidak valid.' using errcode = '22023';
    end if;

    for field in select key, value from jsonb_each(p_patch) loop
      if field.key = 'interests' then
        if jsonb_typeof(field.value) <> 'array' then
          raise exception 'Minat harus berupa daftar.' using errcode = '22023';
        end if;
        if jsonb_array_length(field.value) > 12 or exists (
          select 1 from jsonb_array_elements(field.value) item(value)
          where jsonb_typeof(item.value) <> 'string'
             or char_length(btrim(item.value #>> '{}')) not between 1 and 50
        ) then
          raise exception 'Isi maksimal 12 minat, masing-masing hingga 50 karakter.' using errcode = '22023';
        end if;
        cleaned := cleaned || jsonb_build_object('interests', (
          select coalesce(jsonb_agg(btrim(item.value) order by item.ordinality), '[]'::jsonb)
          from jsonb_array_elements_text(field.value) with ordinality item(value, ordinality)
        ));
      elsif limits ? field.key and jsonb_typeof(field.value) = 'string' then
        value_text := btrim(field.value #>> '{}');
        if char_length(value_text) > (limits ->> field.key)::integer then
          raise exception 'Ada isian profil yang melebihi batas panjang.' using errcode = '22023';
        end if;
        if field.key = 'linkedin' and value_text <> ''
          and value_text !~* '^https?://([a-z0-9-]+[.])*linkedin[.]com(/[a-z0-9][^[:space:]]*)?$' then
          raise exception 'Masukkan tautan LinkedIn lengkap yang diawali https://.' using errcode = '22023';
        end if;
        cleaned := cleaned || jsonb_build_object(field.key, value_text);
      else
        raise exception 'Ada kolom profil yang tidak dapat diubah.' using errcode = '22023';
      end if;
    end loop;

    if cleaned <> '{}'::jsonb then
      insert into erp_private.profile_details as saved (user_id, details)
      values (actor, cleaned)
      on conflict (user_id) do update
      set details = saved.details || excluded.details, updated_at = now()
      returning details into result;
      return result;
    end if;
  end if;

  select details into result from erp_private.profile_details where user_id = actor;
  return coalesce(result, '{}'::jsonb);
end
$$;

create function public.erp_profile_details(p_patch jsonb default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select erp_private.own_profile_details(p_patch);
$$;
revoke all on function erp_private.own_profile_details(jsonb) from public, anon;
revoke all on function public.erp_profile_details(jsonb) from public, anon;
grant execute on function erp_private.own_profile_details(jsonb) to authenticated;
grant execute on function public.erp_profile_details(jsonb) to authenticated;
