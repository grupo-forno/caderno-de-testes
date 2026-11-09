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
alter table telas add column if not exists refazer boolean not null default true;


-- pop-up ou janela: aponta para a tela pai (um nível só)
alter table telas add column if not exists pai_id uuid references telas(id) on delete cascade;

-- resultado por funcionalidade (item da tela). A chave é o id do item, que fica guardado dentro de telas.itens
create table if not exists respostas_item (
  caderno    text not null,
  email      text not null,
  nome       text not null,
  tela       text not null,
  item       text not null,
  rodada     int  not null default 1,
  resultado  text not null check (resultado in ('ok','nao_ok','nao_testado')),
  obs        text not null default '',
  anexos     jsonb not null default '[]',
  atualizado timestamptz not null default now(),
  primary key (caderno, email, item, rodada)
);

-- dá um id fixo para cada item que ainda não tem (pode rodar de novo sem problema)
update telas set itens = (
  select coalesce(jsonb_agg(case when e.i ? 'id' then e.i else e.i || jsonb_build_object('id', gen_random_uuid()::text) end order by e.n), '[]'::jsonb)
  from jsonb_array_elements(itens) with ordinality as e(i, n)
)
where jsonb_array_length(itens) > 0
  and exists (select 1 from jsonb_array_elements(itens) x where not (x ? 'id'))
;

-- telas com itens que estavam aprovadas no modelo antigo: cada item passa a ficar aprovado
update telas set itens = (
  select coalesce(jsonb_agg(e.i || '{"aprovado": true}'::jsonb order by e.n), '[]'::jsonb)
  from jsonb_array_elements(itens) with ordinality as e(i, n)
)
where not refazer and jsonb_array_length(itens) > 0;

-- depois disso essas telas voltam a refazer = true (o flag só vale para tela sem itens), então rodar de novo não muda nada
update telas set refazer = true where not refazer and jsonb_array_length(itens) > 0;

-- "tela como um todo" não existe mais: apaga as linhas antigas em que o item era o próprio id da tela
delete from respostas_item where item = tela
;

-- MÓDULOS: o caderno agora é o sistema inteiro. Cada módulo (Financeiro, RH...) tem suas telas
create table if not exists modulos (
  id         uuid primary key default gen_random_uuid(),
  caderno_id uuid not null references cadernos(id) on delete cascade,
  ordem      int  not null,
  titulo     text not null
);

alter table telas add column if not exists modulo_id uuid references modulos(id) on delete cascade;

-- cadernos que já tinham telas ganham um módulo chamado Geral
insert into modulos (caderno_id, ordem, titulo)
select c.id, 1, 'Geral' from cadernos c
where exists (select 1 from telas t where t.caderno_id = c.id and t.modulo_id is null)
  and not exists (select 1 from modulos m where m.caderno_id = c.id);

update telas t set modulo_id = (select m.id from modulos m where m.caderno_id = t.caderno_id order by m.ordem limit 1) where t.modulo_id is null;

-- pop-up fica no mesmo módulo da tela pai
update telas f set modulo_id = p.modulo_id from telas p where f.pai_id = p.id and f.modulo_id is distinct from p.modulo_id;

-- SEM RODADAS: uma resposta por pessoa e funcionalidade (fica a mais recente)
delete from respostas_item a using respostas_item b where a.caderno = b.caderno and a.email = b.email and a.item = b.item and a.rodada < b.rodada;

alter table respostas_item drop constraint if exists respostas_item_pkey;

alter table respostas_item add primary key (caderno, email, item);

-- o marcador de aprovada em rodada anterior não existe mais
update telas set itens = (
  select coalesce(jsonb_agg(e.i - 'aprovado' order by e.n), '[]'::jsonb)
  from jsonb_array_elements(itens) with ordinality as e(i, n)
)
where jsonb_array_length(itens) > 0
  and exists (select 1 from jsonb_array_elements(itens) x where x ? 'aprovado');

-- AUDITORIA: tudo que muda de resultado, observação e cada correção fica guardado, como um git (só se acrescenta)
create table if not exists historico (
  id      bigserial primary key,
  caderno text not null,
  tela    text not null,
  item    text not null,
  ator    text not null check (ator in ('cliente', 'autora')),
  email   text,
  nome    text not null,
  tipo    text not null check (tipo in ('resultado', 'observacao', 'correcao')),
  de      text,
  para    text,
  obs     text not null default '',
  anexos  jsonb not null default '[]',
  criado  timestamptz not null default now()
);

create index if not exists historico_item on historico (caderno, item, criado)
;

-- SEVERIDADE do NÃO OK, em linguagem simples (padrão de UAT)
alter table respostas_item add column if not exists severidade text;

alter table respostas_item drop constraint if exists respostas_item_severidade_check;

alter table respostas_item add constraint respostas_item_severidade_check check (severidade is null or severidade in ('impede', 'contornavel', 'visual', 'sugestao'));

alter table historico add column if not exists severidade text
;

-- TERMO DE ACEITE: prova de quem concluiu a homologação, quando e com quais números
create table if not exists aceites (
  id              bigserial primary key,
  token           text not null unique,
  caderno         text not null,
  nome            text not null,
  email           text not null,
  declaracao      text not null,
  resumo          jsonb not null,
  hash            text not null,
  ip              text,
  agente          text,
  criado          timestamptz not null default now(),
  reaberto_em     timestamptz,
  reaberto_por    text,
  reaberto_motivo text
);

create index if not exists aceites_caderno on aceites (caderno, criado);

alter table historico drop constraint if exists historico_tipo_check;

alter table historico add constraint historico_tipo_check check (tipo in ('resultado', 'observacao', 'correcao', 'aceite', 'reabertura'))
;

-- só pode haver um aceite valendo por caderno (os reabertos não contam)
create unique index if not exists aceites_vigente on aceites (caderno) where reaberto_em is null
;

-- LIMITE DE TENTATIVAS de senha na área da autora, por endereço (IP)
create table if not exists tentativas_login (
  ip     text not null,
  criado timestamptz not null default now()
);

create index if not exists tentativas_login_ip on tentativas_login (ip, criado)
;

-- ÍNDICES: as consultas do cliente e da autora sempre começam pelo caderno, pelo módulo ou pela tela pai
create index if not exists telas_caderno on telas (caderno_id);

create index if not exists telas_modulo on telas (modulo_id);

create index if not exists telas_pai on telas (pai_id);

create index if not exists modulos_caderno on modulos (caderno_id)
;

-- MÓDULO 1: ROTEIRO DE TESTE. Os passos de cada funcionalidade ficam dentro de telas.itens (campo "passos"), então a tabela de telas não muda.
-- Endereço do ambiente de teste (opcional), mostrado ao validador como "Abrir ambiente de teste"
alter table cadernos add column if not exists ambiente_url text;

-- Quem valida ganha uma chave secreta (guardamos só o hash). Ela, e não o e-mail digitado, prova quem é a pessoa nos passos e prints.
create table if not exists validadores (
  caderno    text not null,
  email      text not null,
  nome       text not null,
  token_hash text not null unique,
  criado     timestamptz not null default now(),
  primary key (caderno, email)
);

-- Resposta de uma pessoa a um passo do roteiro
create table if not exists respostas_passo (
  caderno    text not null,
  email      text not null,
  nome       text not null,
  tela       text not null,
  item       text not null,
  passo      text not null,
  resultado  text not null check (resultado in ('funcionou', 'diferente', 'nao_consegui')),
  obs        text not null default '',
  anexos     jsonb not null default '[]',
  atualizado timestamptz not null default now(),
  primary key (caderno, email, passo)
);

create index if not exists respostas_passo_item on respostas_passo (caderno, item);

-- o histórico também registra o passo (null = mudança da funcionalidade inteira)
alter table historico add column if not exists passo text
