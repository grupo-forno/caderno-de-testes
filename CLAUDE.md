# Contexto: Caderno de testes

Documento para o Claude Code. Pode ser salvo como `CLAUDE.md` na raiz do projeto novo. Fale com a usuária em **português do Brasil**, de forma simples e direta.

## O que vamos criar
Um **caderno de testes**: um ambiente próprio, para **enviar a um cliente**, onde ele **vê as telas de um software e diz se estão certas**. A ideia **não depende do tipo de software** que está sendo desenvolvido (app, site, sistema interno, ERP etc.).

O caderno serve em **duas fases do mesmo projeto**:
1. **Telas desenhadas.** Primeiro as telas são modeladas e desenhadas, não programadas. O cliente as valida vendo uma **imagem**.
2. **Telas programadas.** Quando o software estiver em desenvolvimento, em vez da imagem a tela passa a ter um **link** para a tela em código, e o cliente a testa de verdade.

## O que a usuária pediu (nas palavras dela, resumidas)
- Um ambiente **para enviar ao cliente ver as telas desenhadas ou programadas**.
- Como a tela desenhada **não é programada**, é preciso **detalhar, em alguma parte do programa, o que cada item, campo, botão etc. da tela faz**.
- Para cada tela, o cliente vê:
  1. **A tela**: primeiro uma **imagem**; depois, quando houver código, um **link** para aquela tela.
  2. **Um PDF**, que **sempre existirá**, destrinchando as funcionalidades que a tela tem.
  3. **Um campo para dizer se aquilo foi testado ou não** (sim ou não).
  4. **Um campo de observações e feedback.**
- Tudo do **jeito do site de referência** que ela mostrou: https://homologacao.direcionaapp.com.br/caderno-de-teste/avisos-perfil

## Estrutura observada no site de referência
É material de outra empresa, feito para o cliente dela. **Use só a estrutura como inspiração; não copie conteúdo, textos, nomes nem identidade visual.**
- Uma página por entrega, com título, **versão com data** e **quem preparou**. Existe um modo de **reteste** que destaca os passos a refazer.
- **Faixa de aviso** de que é um ambiente de teste e nada afeta o sistema real.
- **Como usar**: o que significa cada resultado possível. No exemplo, OK, Não OK e Não testado, com observação e prints.
- **Antes de começar**: o que a pessoa precisa ter à mão (por exemplo, logins de teste).
- **Roteiro em partes** que abrem e fecham, cada uma com contador ("0 de 4"), o perfil usado e um carimbo de **concluída**.
- **Tabela de passos** com cinco colunas: número, **o que fazer**, **o que deve acontecer**, **resultado** e **observações e prints**.
- **Salvamento automático** ("Salvo em hh:mm"). Dá para continuar em outro dia ou computador abrindo o mesmo link.
- **Resultado final** (aprovação), botão de **finalizar** e **imprimir ou salvar em PDF**.
- Tempo estimado do teste completo e do reteste.

## Quem usa
- **Autora (usuária):** monta o caderno, anexa as telas e os PDFs, envia o link e acompanha as respostas.
- **Cliente:** abre o link, vê cada tela, lê o que ela faz, responde se testou, escreve observações e finaliza.

## Princípios
- **Independente do software.** Nenhum conteúdo, nome ou regra de um cliente específico no código. Tudo isso é dado do caderno.
- **Simples, clean e autoexplicativo**, para qualquer pessoa. UI e UX são muito importantes.
- Cada tela deve **explicar o que faz** (o PDF), para o cliente conseguir validar mesmo sem o sistema programado.
- Textos em português do Brasil simples. Mensagens de erro dizem o que fazer a seguir.
- Funciona bem no celular e no computador.

## Decisões já tomadas
- Ela vai **desenvolver no Claude Code** e **publicar no Vercel**, a partir de um repositório ("mais simples").
- Ela **não usa Figma**: as telas são geradas por IA, fora do caderno, e entram aqui como **prints/imagens**. O caderno só recebe, mostra e coleta a validação; não é onde se desenha.

## O que ainda não está decidido (pergunte a ela antes de construir)
1. **Resultado de cada tela.** Ela falou em "testado sim ou não". O site de referência usa OK, Não OK e Não testado. Qual ela prefere? Os nomes devem mudar entre a fase de desenho e a programada?
2. **PDF.** Ela envia o PDF de cada tela, ou o sistema deve **gerar** o PDF a partir de uma lista de itens (campo, botão, o que faz)? Pode ser os dois?
3. **Como o cliente acessa.** Apenas um link? Link com código? Precisa de conta? O endereço pode ser público para quem tiver o link?
4. **Onde guardar os dados.** Para o Vercel gravar respostas, imagens e PDFs é preciso um banco e um armazenamento de arquivos. Qual ela pode usar na conta dela?
5. **Quantas pessoas respondem** por caderno (uma ou várias) e se o autor precisa ver as respostas de cada uma.
6. **Anexos do cliente:** ele pode anexar prints nas observações, como no site de referência?
7. **Versões e reteste:** como ela vai enviar uma nova versão e pedir que só algumas telas sejam refeitas?
8. **Identidade visual:** cores e logo do caderno (neutro, ou configurável por cliente?).
9. **Tamanho dos arquivos:** qual o tamanho típico dos PDFs e das imagens?

## Como o Claude Code deve trabalhar
1. Leia este documento e **me confirme o que entendeu em poucas linhas**.
2. **Faça as perguntas acima**, uma por vez ou agrupadas, e espere as respostas. Não decida por mim.
3. Depois, **mostre um plano** (telas, dados, como o autor e o cliente usam, onde os dados ficam) e espere minha aprovação.
4. Construa em **passos pequenos**, mostrando o resultado de cada um e testando antes de dizer que funciona.
5. **Não invente funcionalidade.** O que for proposta sua, diga que é proposta.
6. Se algo depender de uma conta ou configuração minha (Vercel, banco, armazenamento), me diga o que preciso fazer.

## Mensagem inicial para colar no Claude Code
> Leia o `CLAUDE.md`. Vamos criar o caderno de testes descrito nele. Comece confirmando o que entendeu e me fazendo as perguntas da seção "O que ainda não está decidido". Depois de eu responder, proponha um plano antes de escrever código.
