-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null default 'employee' check (role in ('admin', 'employee')),
  created_at timestamptz default now()
);

-- Bills table
create table public.bills (
  id bigint generated always as identity primary key,
  bill_no serial,
  user_id uuid references auth.users not null default auth.uid(),
  type text not null check (type in ('white', 'brown', 'quail')),
  mode text not null check (mode in ('loose', 'tray', 'box')),
  qty integer not null,
  rate numeric(10,2) not null,
  total numeric(10,2) not null,
  created_at timestamptz default now()
);

-- Index for fast date queries
create index bills_created_at_idx on public.bills (created_at desc);
create index bills_user_id_idx on public.bills (user_id);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.bills enable row level security;

-- Profiles policies
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admin can read all profiles"
  on public.profiles for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Bills policies
-- Employees: can insert their own bills
create policy "Users can insert own bills"
  on public.bills for insert
  with check (auth.uid() = user_id);

-- Employees: can read only their today's bills
create policy "Employees read own today bills"
  on public.bills for select
  using (
    auth.uid() = user_id
    and created_at::date = current_date
  );

-- Admin: can read all bills
create policy "Admin reads all bills"
  on public.bills for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Admin: can delete bills (for undo)
create policy "Admin can delete bills"
  on public.bills for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Employees can delete their own bills created in last 10 seconds (undo)
create policy "Users can undo own recent bills"
  on public.bills for delete
  using (
    auth.uid() = user_id
    and created_at > now() - interval '10 seconds'
  );

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Employee'), coalesce(new.raw_user_meta_data->>'role', 'employee'));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
