# Radar de notícias (BE2-10)

Mostra ao assessor as notícias que **mexem na carteira visível** de cada cliente e explica por que ligar.

## Pipeline

```
 a cada 30 min (sem LLM)              6×/dia útil, ou POST /api/radar/processar
 ┌──────────────────────┐            ┌────────────────────────────────────────────────┐
 │ coletar              │ pendentes  │ pré-filtro (regras) → classificar em lotes (LLM)│
 │ curadas + RSS        │──────────► │ → valida item a item → cai nas regras se falhar │
 │ dedup por id         │            │ → guarda → evento NoticiasClassificadas         │
 └──────────────────────┘            └────────────────────────────────────────────────┘
                                                        │
                    na leitura, por regra (segue o consentimento atual)
                                                        ▼
               cruzamento com a carteira visível → impactos (pontos, motivo, gatilhos)
                                                        │
                     só quando o assessor clica "Por que ligar?" (LLM, sob demanda)
                                                        ▼
                                  motivo de contato (texto para o assessor)
```

- **Cruzamento sem LLM.** Notícia com emissor casa só pela exposição àquele emissor (pelo conglomerado);
  notícia macro casa por indexador ou produto. `pontos = relevância × 100 × min(1, fração do patrimônio / 0,25)`.
- **O texto é para o assessor**, não uma recomendação ao cliente (atividade regulada): por que ligar e o que conversar.
- O radar **não altera a prioridade da fila** (o roteiro do §6.5 segue igual).

## Fontes

| Fonte | Como entra | Situação |
|---|---|---|
| Curadoria (fictícia) | `resources/noticias/curadas.json`, 20 notícias sobre os emissores fictícios + macro, com gabarito | padrão da demo (offline) |
| InfoMoney | RSS `https://www.infomoney.com.br/feed/` | funciona (10 itens por leitura) |
| CNN Brasil | RSS `https://www.cnnbrasil.com.br/feed/` (geral; o de economia deu 404) | funciona (60 itens, muitos fora de finanças) |
| Bloomberg Línea | RSS `https://www.bloomberglinea.com.br/arc/outboundfeeds/rss/?outputType=xml` | funciona (100 itens) |
| Bloomberg (inglês) | paywall; termos costumam proibir raspagem | precisa de licença |
| ANBIMA | não é notícia: são **dados** (índices, taxas de debêntures, curvas) por API com cadastro | próximo passo natural: gatilho sem LLM |

RSS liga com `RADAR_RSS=true`. Só título, resumo e link; o parser recusa DTD/entidades externas (XXE).
Não verificamos os termos de uso de cada site — conferir antes de produção.

Medição nos feeds reais (10/10/2026): 70 notícias lidas, **só 5 com algo financeiro** pelas regras.
Daí o **pré-filtro**: no modo `llm`, notícia sem emissor, indexador ou produto nem vai ao LLM (≈ −90% de chamadas).

## Cadência: lote agendado ou pontual?

- **Coleta frequente, classificação em lote.** O feed do InfoMoney só traz as 10 últimas e atualiza de hora em
  hora: coletar só 6×/dia perderia notícias. Por isso a coleta (barata, sem LLM) roda a cada 30 min e guarda
  pendentes; a classificação (LLM) roda 6×/dia útil (7h, 10h, 12h, 14h, 16h, 19h) sobre tudo que acumulou.
- **Pontual quando importa:** `POST /api/radar/processar` processa na hora (ex.: fato relevante de um emissor).
- **Orientado a eventos, dentro do backend:** eventos Spring (`NoticiasClassificadas`) e `@Scheduled` bastam.
  Fila/broker externo (Kafka etc.) seria exagero para este volume.
- **Lotes no LLM:** 10 notícias por chamada. O system prompt (regras + lista de emissores, ~700 tokens) é pago
  uma vez por lote: o custo de entrada por notícia cai de ~1.000 para ~370 tokens (−63%) e há 10× menos requisições.
  Cada item volta validado; item ausente ou lote que falha cai nas regras.
- **APIs "batch" dos provedores** (variantes `:batch` no OpenRouter, ~20% mais baratas, ex.: `openai/gpt-oss-120b:batch`)
  combinam com o agendamento, mas é preciso confirmar como funcionam (latência/assíncrono) antes de adotar —
  neste volume a economia seria de frações de centavo.

## Modelos (preços do OpenRouter em 10/10/2026, US$ por milhão de tokens)

| Uso | Modelo sugerido | Entrada | Saída | Por quê |
|---|---|---|---|---|
| Classificação (extração de tags, JSON) | `openai/gpt-oss-120b` (padrão em `radar.modelo-classificacao`) | 0,037 | 0,17 | barato, saída estruturada, bom em PT |
| Alternativas mais baratas | `openai/gpt-oss-20b`, `mistralai/mistral-nemo`, `google/gemini-2.5-flash-lite:batch` | 0,018–0,05 | 0,03–0,2 | avaliar qualidade antes |
| Motivo de contato (texto PT-BR) | `deepseek/deepseek-v4-pro` (padrão em `copiloto.modelo`) | 0,21 | 0,42 | escrita melhor; só sob demanda |

Escolha por **qualidade medida**, não só preço: o avaliador roda as 20 notícias curadas em vários modelos e
compara com o gabarito (precisão/cobertura de emissores, indexadores, produtos, direção, latência, falhas):

```bash
./mvnw test -Dtest=AvaliacaoModelosRadarTest -Dradar.avaliar-modelos=true   # precisa de OPENROUTER_APIKEY comum
```

## Custo estimado

Premissas: classificação ~370 tokens de entrada e ~120 de saída por notícia (lote de 10); motivo ~2.000 de entrada
e ~300 de saída por clique.

| Cenário | Volume | Custo |
|---|---|---|
| Demo | 20 notícias curadas, gabarito (sem LLM) | US$ 0 |
| Feeds reais, 1 backend | ~300 notícias/dia → ~30 ao LLM após o pré-filtro (3 lotes) | ~US$ 0,001/dia (gpt-oss-120b) |
| Motivos sob demanda | 1.000 assessores × 10 cliques/dia | ~US$ 5/dia (deepseek-v4-pro) |
| Motivos gerados para todo par cliente×notícia | ~60 mil pares/dia | ~US$ 33/dia — por isso é sob demanda |
| Armadilha: toda notícia × todo cliente no LLM | dezenas de milhões de chamadas/dia | dezenas de milhares de US$/dia |

A classificação é custo fixo (não cresce com o número de clientes); o cruzamento é por regra; só o motivo cresce
com o uso — e só quando o assessor pede.

## Configuração (`application.yml`, prefixo `radar`)

`classificacao` (`referencia` | `regras` | `llm`), `modelo-classificacao`, `tamanho-lote`, `cron`, `cron-coleta`,
`pre-filtro`, `fracao-plena`, `pontos-minimos`, `rss.habilitado`, `rss.feeds`.

## Endpoints

`GET /api/radar/noticias` · `POST /api/radar/processar` · `GET /api/clientes/{id}/radar` ·
`GET /api/assessor/radar?limite=20` · `POST /api/clientes/{id}/radar/{noticiaId}/motivo`
