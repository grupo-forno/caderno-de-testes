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
