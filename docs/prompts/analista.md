# Prompt — Analista (dados, regras de análise e score)

Você é o dono das regras: o Claude Code escreve o código, você valida os números.
Cole o bloco abaixo no Claude Code, na raiz do repositório.

```
Você vai implementar a parte do Analista do Copiloto do Assessor (hackathon XP, Grupo 6). A pessoa
que está comigo tem experiência em política de crédito: explique as decisões de regra em termos de
scorecard (variáveis, pesos, cortes) e mostre os números para eu validar.

Antes de tudo, leia o CLAUDE.md e o docs/PLAN.md inteiros. Foque em §4.1, §6 (dados e
casos-âncora), §7.1 a §7.7 e §7.9 (algoritmos), §10 (backlog do Analista) e §13.

Seu escopo: AN-01 a AN-09, nesta ordem. Pastas suas: data/, backend/src/main/java/.../analise/,
backend/src/test/ (testes da análise) e backend/src/test/resources/esperados.json.

Comece em modo de planejamento: mostre o plano do AN-01 (estrutura do gerador e como garante os
totais exatos). Depois de eu aprovar, implemente.

AN-01 (começa já, não depende de ninguém): data/gerar_seed.py
- Python 3, só biblioteca padrão, random.seed(42), argumento --data-referencia (padrão 2026-10-10)
  e --saida (padrão backend/src/main/resources/seed).
- Gera os arquivos do §6 seguindo os campos do §4.1 exatamente.
- Os 6 âncoras do §6.3 com valores EXATOS; totais mensais exatos por categoria; só o consumo é
  repartido aleatoriamente em 8 a 15 transações. Descrições seguem o vocabulário do §6.2.
- Datas de vencimento, expiração e aniversários relativas à data de referência.
- 30 clientes de fundo respeitando as restrições do §6.4.
- Inclua data/checar_seed.py que imprime, por âncora: renda mensal, custo de vida (regra do §7.3),
  saldos, FGC por conglomerado e exposição sem garantia — para eu bater com a tabela do §6.5.

AN-02: esperados.json a partir do §6.5 e um teste de integração que carrega o seed e confere
cada âncora (antes e, para cli-001 e cli-003, depois de conceder o consentimento pendente).

AN-03 a AN-06 (quando BE1 tiver subido os records de dominio e o OpenFinanceGateway; até lá,
programe contra a interface do gateway e use dados em memória nos testes):
- Categorizador (§7.1), DetectorRenda (§7.2), FluxoCaixaService (§7.3), PrincipalidadeService
  (§7.4, com contribuicoes, destaques e explicacao em pt-BR), FgcService (§7.5), alertas (§7.6 e
  §7.7) e PrioridadeService (§7.9, com motivos e pontos).
- A camada analise só lê dados via OpenFinanceGateway. Todos os pesos e limites vêm do
  application.yml.
- Teste unitário para cada regra, incluindo bordas (componente zerado e renormalização de pesos;
  dois emissores no mesmo conglomerado; conta de PAGAMENTO fora do FGC).

AN-07: rode a fila e ajuste os pesos até: Marina (cli-001) NÃO é a 1ª antes do consentimento e É
a 1ª depois. Mostre a tabela de pontos por cliente antes/depois.

AN-08 (P1): docs/pitch-numeros.md com números de impacto e premissas explícitas.
AN-09 (P2): simulador de deságio (§7.11) e endpoint POST /api/simulacoes/desagio.

Não faça: chamadas de LLM, mudanças em contract/ sem falar com o BE1, números hard-coded fora do
application.yml.
```
