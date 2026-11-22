-- Run in the SQL editor or psql. Synthetic users and records always roll back.
-- Covers body_profiles, body_measurements and target_adjustments (S2).
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
declare measurement_id uuid; adjustment_id uuid;
begin
  -- Owner CRUD.
  insert into public.body_profiles(user_id,birth_year,height_cm,goal_mode,goal_rate_kg_week,protein_mode,protein_grams)
  values(auth.uid(),1990,172,'lose',0.5,'limit',60);
  update public.body_profiles set height_cm=173 where user_id=auth.uid();
  if not found then raise exception 'Owner profile update failed'; end if;

  insert into public.body_measurements(user_id,measured_on,weight_kg) values(auth.uid(),current_date,80.4) returning id into measurement_id;
  perform set_config('test.measurement',measurement_id::text,true);
  -- Same day upserts into the same row (Today weigh-in), keeping other fields.
  update public.body_measurements set waist_cm=90 where id=measurement_id;
  insert into public.body_measurements(user_id,measured_on,weight_kg) values(auth.uid(),current_date,80.1)
    on conflict (user_id,measured_on) do update set weight_kg=excluded.weight_kg;
  if (select count(*) from public.body_measurements where user_id=auth.uid())<>1 then raise exception 'Same-day weigh-in duplicated'; end if;
  if (select waist_cm from public.body_measurements where id=measurement_id) is distinct from 90 then raise exception 'Upsert cleared waist'; end if;

  insert into public.target_adjustments(user_id,effective_from,delta_kcal,reason) values(auth.uid(),current_date,-150,'weekly review') returning id into adjustment_id;
  perform set_config('test.adjustment',adjustment_id::text,true);

  -- Constraints.
  begin
    insert into public.body_measurements(user_id,measured_on) values(auth.uid(),current_date-1);
    raise exception 'Empty measurement accepted';
  exception when check_violation then null; end;
  begin
    insert into public.body_measurements(user_id,measured_on,weight_kg) values(auth.uid(),current_date-2,10);
    raise exception 'Out-of-range weight accepted';
  exception when check_violation then null; end;
  begin
    update public.body_profiles set goal_mode='gain', goal_rate_kg_week=1.0 where user_id=auth.uid();
    raise exception 'Gain rate 1.0 accepted';
  exception when check_violation then null; end;
  begin
    update public.body_profiles set protein_mode='custom', protein_grams=null where user_id=auth.uid();
    raise exception 'Custom protein without grams accepted';
  exception when check_violation then null; end;

  -- Cannot write rows for someone else.
  begin
    insert into public.body_measurements(user_id,measured_on,weight_kg) values(current_setting('test.other')::uuid,current_date,70);
    raise exception 'Cross-user measurement insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.body_profiles(user_id,birth_year,height_cm) values(current_setting('test.other')::uuid,1990,170);
    raise exception 'Cross-user profile insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.target_adjustments(user_id,effective_from,delta_kcal) values(current_setting('test.other')::uuid,current_date,100);
    raise exception 'Cross-user adjustment insert accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
begin
  if exists(select 1 from public.body_profiles where user_id=current_setting('test.owner')::uuid) then raise exception 'Cross-user profile read'; end if;
  if exists(select 1 from public.body_measurements where id=current_setting('test.measurement')::uuid) then raise exception 'Cross-user measurement read'; end if;
  if exists(select 1 from public.target_adjustments where id=current_setting('test.adjustment')::uuid) then raise exception 'Cross-user adjustment read'; end if;
  update public.body_profiles set height_cm=150 where user_id=current_setting('test.owner')::uuid;
  if found then raise exception 'Cross-user profile update'; end if;
  update public.body_measurements set weight_kg=50 where id=current_setting('test.measurement')::uuid;
  if found then raise exception 'Cross-user measurement update'; end if;
  delete from public.body_measurements where id=current_setting('test.measurement')::uuid;
  if found then raise exception 'Cross-user measurement delete'; end if;
  delete from public.target_adjustments where id=current_setting('test.adjustment')::uuid;
  if found then raise exception 'Cross-user adjustment delete'; end if;
  -- Moving own row to another user is refused by WITH CHECK.
  insert into public.body_measurements(user_id,measured_on,weight_kg) values(auth.uid(),current_date,70);
  begin
    update public.body_measurements set user_id=current_setting('test.owner')::uuid where user_id=auth.uid();
    raise exception 'Row handed to another user';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
begin
  delete from public.body_measurements where id=current_setting('test.measurement')::uuid;
  if not found then raise exception 'Owner delete failed'; end if;
end;
$$;
set local role anon;
do $$ begin
  begin perform 1 from public.body_profiles; raise exception 'Anonymous body profile access'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.body_measurements; raise exception 'Anonymous measurement access'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.target_adjustments; raise exception 'Anonymous adjustment access'; exception when insufficient_privilege then null; end;
end; $$;
rollback;
