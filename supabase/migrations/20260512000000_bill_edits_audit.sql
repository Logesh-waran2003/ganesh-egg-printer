-- Audit table: stores original values before any edit
create table public.bill_edits (
  id bigint generated always as identity primary key,
  bill_id bigint references public.bills(id) on delete cascade not null,
  edited_by uuid references auth.users not null default auth.uid(),
  old_qty integer not null,
  old_rate numeric(10,2) not null,
  old_total numeric(10,2) not null,
  new_qty integer not null,
  new_rate numeric(10,2) not null,
  new_total numeric(10,2) not null,
  edited_at timestamptz default now()
);

alter table public.bill_edits enable row level security;

-- Only admin can see edit history
create policy "Admin reads bill_edits"
  on public.bill_edits for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Anyone can insert (the app inserts before updating)
create policy "Users can insert bill_edits"
  on public.bill_edits for insert
  with check (auth.uid() = edited_by);

-- Allow update on bills (employees own today, admin all)
create policy "Employees can update own today bills"
  on public.bills for update
  using (auth.uid() = user_id and created_at::date = current_date);

create policy "Admin can update all bills"
  on public.bills for update
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
