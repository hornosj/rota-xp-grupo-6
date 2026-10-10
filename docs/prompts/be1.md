# Prompt — BE1 (Open Finance, contrato e consolidação)

Cole o bloco abaixo no Claude Code, na raiz do repositório.

```
Você vai implementar a parte BE1 do Copiloto do Assessor (hackathon XP, Grupo 6).

Antes de tudo, leia o CLAUDE.md e o docs/PLAN.md inteiros. Foque nas seções §2, §3, §4, §5, §6.1,
§7.10 (convites), §10 (backlog BE1) e §13.

Seu escopo: tarefas BE1-01 a BE1-10, nesta ordem. Pastas suas: backend/ (pom, config, dominio,
openfinance, consolidacao, demo, api dos seus endpoints), contract/, README.md.
Não implemente a camada analise (é do analista) nem inteligencia/agentes (BE2): crie só as
interfaces que você precisar consumir, com implementação provisória que devolve dados das fixtures,
e deixe um TODO com o dono.

Comece em modo de planejamento: me mostre o plano das tarefas BE1-01 e BE1-02 com os arquivos que
vai criar. Depois de eu aprovar, implemente.

URGENTE — Etapa 0 (meta: ~40 minutos), porque destrava o time inteiro:
1. BE1-01: projeto Spring Boot 3.5.x, Java 21, Maven wrapper, springdoc-openapi, application.yml
   do §13 com classes @ConfigurationProperties, DataReferencia (lê demo.data-referencia),
   README.md com como rodar.
2. BE1-02: records do §4 em dominio/; controllers do §5 devolvendo fixtures escritas à mão em
   contract/fixtures/ (Visao360 da cli-001 antes e depois do consentimento, fila antes e depois,
   convite da cli-001 pendente e confirmado, painel). Use os números exatos do §6.3 e §6.5.
   POST conceder na cli-001/inst-horizonte troca as fixtures para "depois"; POST /demo/reset volta.
3. Exporte contract/openapi.json (curl em /v3/api-docs). Confira que o JSON tem todos os schemas.
4. Commit em main com a mensagem "contrato v1" e me avise para eu comunicar o grupo.

Depois, BE1-03 a BE1-07 com dados reais e BE1-11 (convites) / BE1-12 (contrato v2):
- SeedLoader lendo backend/src/main/resources/seed/*.json (o analista gera; até lá, crie um seed
  mínimo só com a cli-001 para não ficar bloqueado).
- OpenFinanceGateway é a ÚNICA porta de leitura para a camada analise: só devolve dados de
  instituições com consentimento ATIVO e com o escopo correspondente. Consentimento INTERNO (XP)
  é sempre ativo.
- ConsentimentoService publica ConsentimentoAlterado; caches por cliente são invalidados.
- Visao360Assembler junta consolidação + análise + ações. A resposta do POST conceder já vem recalculada.

Critérios de aceite:
- ./mvnw test verde.
- Teste de integração: GET /api/clientes/cli-001/360 não mostra o Banco Horizonte; depois de
  POST /api/clientes/cli-001/consentimentos/inst-horizonte/conceder, mostra cobertura 1.0 e
  patrimônio com +650.000; POST /api/demo/reset volta ao estado inicial.
- O contrato só muda de forma aditiva. Se precisar mudar, faça num commit separado, regenere o
  openapi.json e me avise.

Não faça: banco de dados, autenticação, Spring Boot 4, LocalDate.now() fora de DataReferencia.
```
