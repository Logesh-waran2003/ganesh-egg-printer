-- Settings table (shared across all devices)
create table public.settings (
  id text primary key default 'default',
  white_egg_rate numeric(10,2) not null default 7,
  white_tray_rate numeric(10,2) not null default 210,
  brown_egg_rate numeric(10,2) not null default 8,
  brown_tray_rate numeric(10,2) not null default 240,
  quail_box_rate numeric(10,2) not null default 40,
  shop_name text not null default 'Ganesh Egg Centre',
  shop_phone text not null default '',
  updated_at timestamptz default now()
);

-- Insert default row
insert into public.settings (id) values ('default');

-- Enable RLS
alter table public.settings enable row level security;

-- Everyone can read settings
create policy "Anyone can read settings"
  on public.settings for select
  using (true);

-- Only admin can update settings
create policy "Admin can update settings"
  on public.settings for update
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
