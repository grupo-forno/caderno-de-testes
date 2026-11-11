-- EXEMPLO DE CONFIGURAÇÃO (não faz parte do db:setup).
-- Cria um caderno novo, "Exemplo: Espaço Kids (modelo de configuração)", com módulo, telas, roteiros, um fluxo entre telas
-- e uma rodada de homologação em RASCUNHO, usando o site de demonstração. Não mexe em nenhum caderno que já existe.
-- Para apagar depois: abra o caderno > Editar caderno > Excluir caderno.
-- Para rodar: cole tudo no SQL Editor do Neon e clique em Run.
do $$
declare
  amb constant text := 'https://demo-gestao.consent.grupofornopaulista.com/';
  cad uuid;
  m_at uuid;
  t_perfil uuid; t_loja uuid; t_usuario uuid; t_pin uuid;
  i_sou_at text := gen_random_uuid()::text;
  i_sou_ge text := gen_random_uuid()::text;
  i_loja text := gen_random_uuid()::text;
  i_lista text := gen_random_uuid()::text;
  i_pin text := gen_random_uuid()::text;
  c_sou_at uuid; c_loja uuid; c_lista uuid; c_pin uuid; c_fluxo uuid;
  rod uuid; v_maria uuid; v_joao uuid;
  rc_sou_at uuid; rc_loja uuid; rc_lista uuid; rc_pin uuid; rc_fluxo uuid;
begin
  insert into cadernos (slug, titulo, versao, preparado_por, ambiente_url)
  values ('exemplo-espaco-kids-' || substr(md5(random()::text), 1, 20), 'Exemplo: Espaço Kids (modelo de configuração)', '1.0', 'Equipe de tecnologia', amb)
  returning id into cad;

  -- 1) Módulo: uma área do sistema
  insert into modulos (caderno_id, ordem, titulo) values (cad, 1, 'Atendente') returning id into m_at;

  -- 2) Telas, cada uma com suas funcionalidades e o ROTEIRO (passo a passo) de cada funcionalidade
  insert into telas (caderno_id, modulo_id, ordem, titulo, link_url, caminho_menu, modo_teste, itens)
  values (cad, m_at, 1, 'Escolher o perfil', amb, 'Tela inicial', 'funcional', jsonb_build_array(
    jsonb_build_object('id', i_sou_at, 'nome', 'Botão "Sou atendente"',
      'faz', 'Abre a área do atendente, que começa pelo cadastro do celular da loja.',
      'passos', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text,
        'fazer', 'Abra o endereço do ambiente de demonstração e clique em "Sou atendente".',
        'esperado', 'Abre a tela "Cadastrar este celular", com a lista de lojas.'))),
    jsonb_build_object('id', i_sou_ge, 'nome', 'Botão "Sou da gestão"',
      'faz', 'Abre a área da gestão (usuários, equipe, lojas, termo e termos assinados). Funcionalidade ainda sem roteiro: veja o aviso "Sem roteiro" na Estrutura.',
      'passos', '[]'::jsonb)
  )) returning id into t_perfil;

  insert into telas (caderno_id, modulo_id, ordem, titulo, link_url, caminho_menu, modo_teste, itens)
  values (cad, m_at, 2, 'Cadastrar este celular', amb, 'Tela inicial > Sou atendente', 'funcional', jsonb_build_array(
    jsonb_build_object('id', i_loja, 'nome', 'Escolher a loja deste celular',
      'faz', '[FUNCIONALIDADE ADAPTADA] Na demonstração, a loja é escolhida sem código. Em produção, a gerência gera um código para cada celular.',
      'passos', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text,
        'fazer', 'Na tela "Cadastrar este celular", clique na loja "Dirceu".',
        'esperado', 'A tela muda para "Quem está usando o celular?".')))
  )) returning id into t_loja;

  insert into telas (caderno_id, modulo_id, ordem, titulo, link_url, caminho_menu, modo_teste, itens)
  values (cad, m_at, 3, 'Quem está usando o celular?', amb, 'Tela inicial > Sou atendente > escolher a loja', 'funcional', jsonb_build_array(
    jsonb_build_object('id', i_lista, 'nome', 'Lista de usuários da loja',
      'faz', 'Mostra as pessoas da loja para quem vai usar o celular escolher o próprio nome.',
      'passos', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text,
          'fazer', 'Confira os nomes que aparecem na lista.',
          'esperado', 'Aparecem "Ana Demonstração" e "Bruno Demonstração".'),
        jsonb_build_object('id', gen_random_uuid()::text,
          'fazer', 'Clique em "Ana Demonstração".',
          'esperado', 'Abre a tela do PIN, com o nome "Ana Demonstração".')))
  )) returning id into t_usuario;

  insert into telas (caderno_id, modulo_id, ordem, titulo, link_url, caminho_menu, modo_teste, itens)
  values (cad, m_at, 4, 'Digitar o PIN', amb, 'Tela inicial > Sou atendente > escolher a loja > escolher o usuário', 'funcional', jsonb_build_array(
    jsonb_build_object('id', i_pin, 'nome', 'Entrar com o PIN',
      'faz', 'Pede o PIN de 6 números do usuário. Na demonstração, o PIN é 123456.',
      'passos', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text,
          'fazer', 'Digite o PIN 123456 e clique em "Entrar".',
          'esperado', 'O sistema aceita o PIN e abre a área do atendente.'),
        jsonb_build_object('id', gen_random_uuid()::text,
          'fazer', 'Volte, escolha o mesmo usuário de novo e digite um PIN errado, por exemplo 000000.',
          'esperado', 'O sistema não entra e avisa que o PIN está errado.')))
  )) returning id into t_pin;

  -- 3) Cenários. Os roteiros das telas viram cenários "vinculados" (origem_item começa com "roteiro:").
  --    É o que o sistema faz sozinho ao escolher o roteiro de uma tela na rodada.
  insert into cenarios (caderno_id, titulo, objetivo, tipo, tela_id, passos, origem_item)
  select cad, 'Atendente › ' || t.titulo || ' › ' || (e->>'nome'), e->>'faz', 'funcional', t.id,
    (select jsonb_agg(jsonb_build_object('id', p->>'id', 'fazer', p->>'fazer', 'esperado', p->>'esperado', 'telaId', null, 'perfil', '')) from jsonb_array_elements(e->'passos') p),
    'roteiro:' || (e->>'id')
  from telas t, jsonb_array_elements(t.itens) e
  where t.caderno_id = cad and jsonb_array_length(e->'passos') > 0;

  select id into c_sou_at from cenarios where caderno_id = cad and origem_item = 'roteiro:' || i_sou_at;
  select id into c_loja from cenarios where caderno_id = cad and origem_item = 'roteiro:' || i_loja;
  select id into c_lista from cenarios where caderno_id = cad and origem_item = 'roteiro:' || i_lista;
  select id into c_pin from cenarios where caderno_id = cad and origem_item = 'roteiro:' || i_pin;

  -- Fluxo entre telas: um teste que atravessa várias telas, com a tela e o perfil de cada passo
  insert into cenarios (caderno_id, titulo, objetivo, tipo, pre_requisitos, dados_teste, passos)
  values (cad, 'Fluxo: do cadastro do celular até a entrada do atendente',
    'Garante que o atendente consegue sair da tela inicial e chegar à área dele, passando por todas as telas.',
    'funcional',
    'Nenhum. O ambiente de demonstração é apagado toda madrugada e já vem com loja e usuários.',
    'Loja: Dirceu. Usuário: Ana Demonstração. PIN: 123456.',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text, 'perfil', 'Atendente', 'telaId', t_perfil::text,
        'fazer', 'Abra o ambiente de demonstração e clique em "Sou atendente".', 'esperado', 'Abre "Cadastrar este celular".'),
      jsonb_build_object('id', gen_random_uuid()::text, 'perfil', 'Atendente', 'telaId', t_loja::text,
        'fazer', 'Clique na loja "Dirceu".', 'esperado', 'Abre "Quem está usando o celular?".'),
      jsonb_build_object('id', gen_random_uuid()::text, 'perfil', 'Atendente', 'telaId', t_usuario::text,
        'fazer', 'Clique em "Ana Demonstração".', 'esperado', 'Abre a tela do PIN.'),
      jsonb_build_object('id', gen_random_uuid()::text, 'perfil', 'Atendente', 'telaId', t_pin::text,
        'fazer', 'Digite 123456 e clique em "Entrar".', 'esperado', 'Entra na área do atendente.')))
  returning id into c_fluxo;

  -- 4) Rodada de homologação (rascunho): dados da entrega
  insert into rodadas (caderno_id, nome, versao, ambiente_url, prazo, resumo, instrucoes, fora_escopo)
  values (cad, 'Entrega 1: acesso do atendente', '1.0', amb, current_date + 7,
    'Primeira entrega para validação: o caminho que o atendente faz para abrir o sistema no celular da loja.',
    E'1. Abra o endereço do ambiente de demonstração.\n2. Siga os passos de cada teste, na ordem.\n3. Em cada passo, marque "Funcionou" ou "Deu diferente". Se não conseguir fazer, marque "Não consegui testar" e explique o motivo.\n4. Nos casos "Deu diferente", escreva o que aconteceu e, se puder, anexe um print.\n5. No fim, envie os testes.',
    'A área da gestão (usuários, equipe, lojas e termos) não faz parte desta entrega.')
  returning id into rod;

  -- 5) Cenários escolhidos para a rodada
  insert into rodada_cenarios (rodada_id, cenario_id, ordem) values (rod, c_sou_at, 1) returning id into rc_sou_at;
  insert into rodada_cenarios (rodada_id, cenario_id, ordem) values (rod, c_loja, 2) returning id into rc_loja;
  insert into rodada_cenarios (rodada_id, cenario_id, ordem) values (rod, c_lista, 3) returning id into rc_lista;
  insert into rodada_cenarios (rodada_id, cenario_id, ordem) values (rod, c_pin, 4) returning id into rc_pin;
  insert into rodada_cenarios (rodada_id, cenario_id, ordem) values (rod, c_fluxo, 5) returning id into rc_fluxo;

  -- 6) Validadores (pessoas que testam) e o que cada um recebe
  insert into rodada_validadores (rodada_id, nome, email, nota) values (rod, 'Maria (exemplo)', 'maria.exemplo@example.com', 'Faz os testes de cada tela.') returning id into v_maria;
  insert into rodada_validadores (rodada_id, nome, email, nota) values (rod, 'João (exemplo)', 'joao.exemplo@example.com', 'Faz o fluxo completo.') returning id into v_joao;

  insert into rodada_atribuicoes (rodada_cenario_id, validador_id) values
    (rc_sou_at, v_maria), (rc_loja, v_maria), (rc_lista, v_maria), (rc_pin, v_maria), (rc_fluxo, v_joao);
end $$
