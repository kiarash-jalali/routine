-- Run in the SQL editor or psql. Synthetic users and records always roll back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
begin
  insert into public.review_dismissals(user_id,week_start) values(auth.uid(),current_date);
  insert into public.target_adjustments(user_id,effective_from,delta_kcal,review_week) values(auth.uid(),current_date,-150,current_date);
  begin
    insert into public.target_adjustments(user_id,effective_from,delta_kcal,review_week) values(auth.uid(),current_date,-150,current_date);
    raise exception 'Suggestion applied twice';
  exception when unique_violation then null; end;
  -- Adjustments outside a review are not limited.
  insert into public.target_adjustments(user_id,effective_from,delta_kcal) values(auth.uid(),current_date,50),(auth.uid(),current_date,50);
  begin
    insert into public.review_dismissals(user_id,week_start) values(current_setting('test.other')::uuid,current_date);
    raise exception 'Cross-user insert accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
begin
  if exists(select 1 from public.review_dismissals) then raise exception 'Cross-user read'; end if;
  update public.review_dismissals set week_start=current_date-7;
  if found then raise exception 'Cross-user update'; end if;
  delete from public.review_dismissals;
  if found then raise exception 'Cross-user delete'; end if;
  insert into public.target_adjustments(user_id,effective_from,delta_kcal,review_week) values(auth.uid(),current_date,150,current_date);
end;
$$;
set local role anon;
do $$
begin
  perform 1 from public.review_dismissals;
  raise exception 'Anon can read';
exception when insufficient_privilege then null;
end;
$$;
rollback;
