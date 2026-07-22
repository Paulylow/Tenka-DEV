-- ================================================================
-- TENKA — Schéma Supabase
-- À exécuter dans : Dashboard → SQL Editor → New query → Run
-- ================================================================

-- ---------- ENUMS ----------
create type public.user_role as enum ('joueur','moderateur','admin','fondateur');
create type public.char_status as enum ('brouillon','en_attente','valide','rejete');
create type public.news_category as enum ('annonce','changelog','evenement');
create type public.ticket_type as enum ('validation_background','creation_clan','question_hrp','item_custom','autre');
create type public.ticket_status as enum ('en_attente','en_traitement','resolu');

-- ---------- PROFILS ----------
-- Créé automatiquement à la première connexion Discord (trigger plus bas)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_username text,
  minecraft_pseudo text unique,
  role public.user_role not null default 'joueur',
  created_at timestamptz not null default now()
);

-- ---------- CLANS ----------
create table public.clans (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- ---------- PERSONNAGES ----------
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rp_name text not null,
  age int check (age between 0 and 150),
  metier text,
  clan_id bigint references public.clans(id) on delete set null,
  background text,
  status public.char_status not null default 'brouillon',
  validated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.characters (status);
create index on public.characters (user_id);

-- ---------- ACTUALITÉS ----------
create table public.news (
  id bigint generated always as identity primary key,
  author_id uuid references public.profiles(id),
  category public.news_category not null default 'annonce',
  title text not null,
  body text,
  published boolean not null default false,
  published_at timestamptz default now()
);
create index on public.news (published, published_at desc);

-- ---------- TICKETS ----------
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.ticket_type not null,
  subject text not null,
  status public.ticket_status not null default 'en_attente',
  created_at timestamptz not null default now()
);
create index on public.tickets (user_id);
create index on public.tickets (status);

create table public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.ticket_messages (ticket_id, created_at);

-- ================================================================
-- FONCTIONS & TRIGGERS
-- ================================================================

-- Profil auto à l'inscription (récupère le pseudo Discord des métadonnées)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, discord_username)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',
                           new.raw_user_meta_data->>'name'));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automatique sur characters
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger characters_touch
  before update on public.characters
  for each row execute function public.touch_updated_at();

-- Est-ce que l'utilisateur courant est staff ?
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderateur','admin','fondateur')
  );
$$;

-- Toute modification de fiche par le joueur repasse en attente
-- (le staff, lui, peut valider sans être re-neutralisé)
create or replace function public.reset_status_on_edit()
returns trigger language plpgsql as $$
begin
  if not public.is_staff()
     and (new.rp_name is distinct from old.rp_name
       or new.background is distinct from old.background
       or new.clan_id is distinct from old.clan_id
       or new.metier is distinct from old.metier
       or new.age is distinct from old.age) then
    new.status := 'en_attente';
    new.validated_by := null;
  end if;
  return new;
end $$;

create trigger characters_reset_status
  before update on public.characters
  for each row execute function public.reset_status_on_edit();

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
alter table public.profiles enable row level security;
alter table public.clans enable row level security;
alter table public.characters enable row level security;
alter table public.news enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

-- PROFILES : chacun lit/édite le sien ; le staff lit tout
create policy "profiles: lecture soi ou staff" on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy "profiles: maj soi" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- CLANS : lecture publique ; écriture staff
create policy "clans: lecture publique" on public.clans for select using (true);
create policy "clans: gestion staff" on public.clans for all
  using (public.is_staff()) with check (public.is_staff());

-- CHARACTERS :
--   lecture publique des fiches validées (Recensement)
--   le joueur gère ses propres fiches ; le staff voit et gère tout
create policy "characters: lecture publique validees" on public.characters
  for select using (status = 'valide' or user_id = auth.uid() or public.is_staff());
create policy "characters: creation par soi" on public.characters
  for insert with check (user_id = auth.uid());
create policy "characters: maj soi ou staff" on public.characters
  for update using (user_id = auth.uid() or public.is_staff());
create policy "characters: suppression soi ou staff" on public.characters
  for delete using (user_id = auth.uid() or public.is_staff());

-- NEWS : lecture publique si publié ; gestion staff
create policy "news: lecture publiee" on public.news
  for select using (published = true or public.is_staff());
create policy "news: gestion staff" on public.news for all
  using (public.is_staff()) with check (public.is_staff());

-- TICKETS : le joueur voit/crée les siens ; le staff voit/gère tout
create policy "tickets: lecture soi ou staff" on public.tickets
  for select using (user_id = auth.uid() or public.is_staff());
create policy "tickets: creation par soi" on public.tickets
  for insert with check (user_id = auth.uid());
create policy "tickets: maj staff" on public.tickets
  for update using (public.is_staff());

-- MESSAGES : visibles par le propriétaire du ticket + staff ;
--            chacun poste en son nom sur un ticket qu'il peut voir
create policy "messages: lecture" on public.ticket_messages
  for select using (
    exists (select 1 from public.tickets t
            where t.id = ticket_id and (t.user_id = auth.uid() or public.is_staff()))
  );
create policy "messages: ecriture" on public.ticket_messages
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from public.tickets t
                where t.id = ticket_id and (t.user_id = auth.uid() or public.is_staff()))
  );

-- ================================================================
-- DONNÉES DE DÉPART (optionnel)
-- ================================================================
insert into public.clans (name, description) values
  ('Clan Takeda', 'Cavaliers redoutés des provinces de l''est.'),
  ('Clan Mori',   'Maîtres des mers intérieures et du commerce.'),
  ('Clan Uesugi', 'Gardiens des montagnes du nord.');

-- ================================================================
-- APRÈS EXÉCUTION :
-- 1. Authentication → Providers → Discord : activer, coller
--    Client ID / Secret de ton app Discord
--    (https://discord.com/developers → OAuth2 → Redirects :
--     https://TON-PROJET.supabase.co/auth/v1/callback)
-- 2. Authentication → URL Configuration : ajouter l'URL de ton site
-- 3. Se connecter une première fois, puis se donner le rôle :
--    update public.profiles set role = 'fondateur' where discord_username = 'TonPseudo';
-- ================================================================
