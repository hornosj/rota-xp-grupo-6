# Números para o pitch (AN-08)

> Todos os números da carteira vêm da base sintética (`data/gerar_seed.py`, ref. 2026-10-10) via
> `GET /api/assessor/painel` e `GET /api/assessor/fila`. As estimativas de impacto são **ilustrativas**:
> cada uma traz a premissa explícita para quem perguntar "de onde veio isso?".

## O que a carteira de demonstração mostra (dados, não estimativas)

| Indicador | Valor | Fonte |
|---|---|---|
| Clientes na carteira | 36 (6 âncoras + 30 de fundo) | painel |
| Patrimônio na XP | R$ 23,0 milhões | painel `patrimonioNaXp` |
| Patrimônio **fora da XP**, mas visível via Open Finance | R$ 1,8 milhão | painel `patrimonioForaXpVisivel` |
| Clientes em que a XP é a instituição principal | 22% (8 de 36) | painel `pctClientesXpPrincipal` |
| Clientes em que a XP é "só investimentos" | 69% (25 de 36) | painel `distribuicaoPosicaoXp` |
| Clientes com pelo menos um motivo para ligar hoje | 29 de 36 | fila (`prioridade > 0`) |
| Motivos fortes (prioridade ≥ 30) | 4 | fila |
| Exemplo do roteiro: um consentimento a mais | revela **R$ 400 mil sem cobertura do FGC** e leva a Marina de 39,1 para 100 pontos (2º → 1º lugar) | §6.5 |

Mensagem central: em 7 de cada 10 clientes a XP guarda o dinheiro, mas o dia a dia (salário, contas,
cartão) está em outro banco. O Copiloto mostra isso e entrega o motivo e a mensagem para mudar.

## Estimativas de impacto (premissas explícitas — ajustar com dados reais)

| Estimativa | Conta | Premissas |
|---|---|---|
| Tempo economizado por assessor | ~**5 h/semana** | 150 clientes por assessor; hoje ~15 min para montar a visão de um cliente antes de ligar (planilhas, extratos); 20 contatos/semana; com o Copiloto ~0 min de preparo → 20 × 15 min = 5 h |
| Patrimônio fora que passa a ser visível | **+7%** sobre o patrimônio na XP | razão observada na base sintética (R$ 1,8 mi fora visível / R$ 23,0 mi na XP); em carteiras reais tende a ser maior, porque a base de fundo foi gerada com poucos saldos fora |
| Ganho de cobertura com a gamificação | de 67% para 100% no caso da Marina | completude = instituições **declaradas** pelo cliente que estão conectadas (§12); a meta do piloto seria medir a taxa de conclusão da missão "conectar" |
| Rendimento de saldo parado | R$ 61 mil parados ≈ **R$ 486/mês** a 100% do CDI | CDI ilustrativo de 10% a.a. (`premissas.cdi-anual`): atualizar para a taxa vigente antes do pitch |

## Cuidados ao apresentar

- Dados 100% fictícios; bancos Aurora, Horizonte e Ipê não existem.
- FGC: simplificação documentada (R$ 250 mil por CPF por conglomerado; teto global de R$ 1 milhão a cada 4 anos).
- Benefícios de nível na jornada são **exemplos** de produto, não oferta.
- O LLM só redige: todo número da mensagem vem da camada de análise.
