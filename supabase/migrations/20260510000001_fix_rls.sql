-- Fix infinite recursion in profiles RLS
-- Drop the problematic policies
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admin can read all profiles" on public.profiles;

-- Simple policy: users can always read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Fix admin bills policy to use auth.jwt() instead of querying profiles
drop policy if exists "Admin reads all bills" on public.bills;
drop policy if exists "Admin can delete bills" on public.bills;

create policy "Admin reads all bills"
  on public.bills for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "Admin can delete bills"
  on public.bills for delete
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
