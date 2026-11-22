-- Starter recipes are shared with every user: remove a personal name that was
-- left in two Persian texts (supabase/seed/starter-recipes.json is fixed too).
update public.recipes
set steps_fa = array_replace(
      steps_fa,
      'برنج را جدا بپزید. سهم کیارش را وزن کنید، زرشک را رویش بریزید و مرغ را کنارش بگذارید.',
      'برنج را جدا بپزید. سهم خود را وزن کنید، زرشک را رویش بریزید و مرغ را کنارش بگذارید.')
where slug = 'starter-m01' and owner_id is null;

update public.recipes
set tip_fa = 'هر سهم ۹۰ گرم مرغ خام است (حدود ۵ تکه).'
where slug = 'starter-n01' and owner_id is null;
