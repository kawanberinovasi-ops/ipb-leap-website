-- Leadership Model Canvas is independent of GROW and assessment records.
create table erp_private.leadership_canvases (
  cohort_id uuid not null references public.erp_cohorts(id),
  mentee_id uuid not null references public.erp_profiles(id),
  draft jsonb,
  shared jsonb,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (cohort_id, mentee_id)
);
create index leadership_canvases_mentee_idx on erp_private.leadership_canvases(mentee_id);
alter table erp_private.leadership_canvases enable row level security;
revoke all on erp_private.leadership_canvases from public, anon, authenticated;

create function erp_private.dmc_state(p_cohort uuid,p_mentee uuid,p_role text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  canvas erp_private.leadership_canvases;
begin
  if p_role is null or p_role not in ('mentee','asmen','mentor') then
    raise exception 'Peran tidak tersedia untuk canvas.' using errcode='42501';
  end if;
  perform erp_private.grow_access(p_cohort,p_mentee,p_role);
  select * into canvas from erp_private.leadership_canvases
    where cohort_id=p_cohort and mentee_id=p_mentee;
  if p_role='mentee' then
    return jsonb_build_object('draft',canvas.draft,'shared',canvas.shared,'revision',coalesce(canvas.revision,0));
  end if;
  return jsonb_build_object('shared',canvas.shared);
end;
$$;

create function erp_private.dmc_save(p_cohort uuid,p_mentee uuid,p_blocks jsonb,p_share boolean,p_expected integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  keys constant text[]:=array['audience','value','channels','engagement','outcomes','resources','activities','partners','costs'];
  blocks jsonb;
  canvas erp_private.leadership_canvases;
begin
  perform erp_private.grow_access(p_cohort,p_mentee,'mentee');
  if p_share is null or p_expected is null or p_expected<0 or jsonb_typeof(p_blocks) is distinct from 'object' then
    raise exception 'Isian canvas tidak valid.' using errcode='22023';
  end if;
  if not (p_blocks ?& keys) or (p_blocks - keys)<>'{}'::jsonb or exists(
    select 1 from jsonb_each(p_blocks) block
    where jsonb_typeof(block.value)<>'string' or char_length(block.value #>> '{}')>2000
  ) then
    raise exception 'Isian sembilan blok tidak valid.' using errcode='22023';
  end if;
  select jsonb_object_agg(block.key,btrim(block.value)) into blocks from jsonb_each_text(p_blocks) block;
  if p_share and not exists(select 1 from jsonb_each_text(blocks) block where block.value ~ '[^[:space:]]') then
    raise exception 'Isi minimal satu blok sebelum membagikan canvas.' using errcode='22023';
  end if;
  if p_expected=0 then
    insert into erp_private.leadership_canvases(cohort_id,mentee_id,draft,shared,revision)
    values(p_cohort,p_mentee,case when not p_share then blocks end,case when p_share then blocks end,1)
    on conflict(cohort_id,mentee_id) do nothing
    returning * into canvas;
  else
    update erp_private.leadership_canvases
    set draft=case when not p_share then blocks end,
        shared=case when p_share then blocks else shared end,
        revision=revision+1,
        updated_at=now()
    where cohort_id=p_cohort and mentee_id=p_mentee and revision=p_expected
    returning * into canvas;
  end if;
  if canvas.revision is null then
    raise exception 'Canvas berubah di tab lain. Salin isian lalu muat ulang.' using errcode='40001';
  end if;
  return jsonb_build_object('draft',canvas.draft,'shared',canvas.shared,'revision',canvas.revision);
end;
$$;

create function public.erp_dmc_state(p_cohort uuid,p_mentee uuid,p_role text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select erp_private.dmc_state(p_cohort,p_mentee,p_role)
$$;

create function public.erp_dmc_save(p_cohort uuid,p_mentee uuid,p_blocks jsonb,p_share boolean,p_expected integer)
returns jsonb language sql security invoker set search_path='' as $$
  select erp_private.dmc_save(p_cohort,p_mentee,p_blocks,p_share,p_expected)
$$;

revoke all on function erp_private.dmc_state(uuid,uuid,text),erp_private.dmc_save(uuid,uuid,jsonb,boolean,integer),
  public.erp_dmc_state(uuid,uuid,text),public.erp_dmc_save(uuid,uuid,jsonb,boolean,integer) from public,anon,authenticated;
grant execute on function erp_private.dmc_state(uuid,uuid,text),erp_private.dmc_save(uuid,uuid,jsonb,boolean,integer),
  public.erp_dmc_state(uuid,uuid,text),public.erp_dmc_save(uuid,uuid,jsonb,boolean,integer) to authenticated;
