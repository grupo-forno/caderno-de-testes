-- Uma linha por pessoa x tela. Rode com: npm run db:setup
create table if not exists respostas (
  caderno    text not null,
  email      text not null,
  nome       text not null,
  tela       text not null,
  resultado  text not null check (resultado in ('ok','nao_ok','nao_testado')),
  obs        text not null default '',
  atualizado timestamptz not null default now(),
  primary key (caderno, email, tela)
);

create table if not exists cadernos (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  titulo        text not null,
  versao        text not null default '1.0',
  preparado_por text not null default '',
  antes         text not null default '',   -- uma linha por item
  rodada        int  not null default 1,
  atualizado    timestamptz not null default now()
);

create table if not exists telas (
  id         uuid primary key default gen_random_uuid(),
  caderno_id uuid not null references cadernos(id) on delete cascade,
  ordem      int  not null,
  titulo     text not null,
  imagem_url text,
  link_url   text,
  pdf_url    text,
  itens      jsonb not null default '[]'   -- [{nome, faz}]
);

alter table respostas add column if not exists anexos jsonb not null default '[]';

alter table respostas add column if not exists rodada int not null default 1;

alter table respostas drop constraint if exists respostas_pkey;

alter table respostas add primary key (caderno, email, tela, rodada);

-- true = precisa ser testada na rodada atual. false = já aprovada em rodada anterior
alter table telas add column if not exists refazer boolean not null default true
