-- Keep cancelled payment references for audit; never reuse them for a new cart.
alter table public.configor_payment_intents add column if not exists cancelled boolean not null default false;
