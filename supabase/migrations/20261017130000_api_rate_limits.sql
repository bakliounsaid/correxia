-- Compteurs de rate limiting de l'API FastAPI (fenêtre fixe, partagée entre instances).
-- Écrite uniquement par le backend (connexion Postgres directe).
create table if not exists public.api_rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (bucket_key, window_start)
);
create index if not exists api_rate_limits_window_start_idx on public.api_rate_limits (window_start);
