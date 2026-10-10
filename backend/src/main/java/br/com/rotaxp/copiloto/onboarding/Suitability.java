package br.com.rotaxp.copiloto.onboarding;

import br.com.rotaxp.copiloto.config.OnboardingProps;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import br.com.rotaxp.copiloto.dominio.Onboarding.OpcaoSuitability;
import br.com.rotaxp.copiloto.dominio.Onboarding.PerguntaSuitability;
import br.com.rotaxp.copiloto.dominio.Onboarding.RespostaSuitability;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Questionário de perfil do investidor (versão simplificada para a demo). Cada opção vale de 1 a 4
 * pontos; a pontuação nunca vai para o front — só as perguntas e o perfil calculado.
 */
@Component
public class Suitability {

    private record Opcao(String id, String texto, int pontos) {}

    private record Pergunta(String id, String texto, List<Opcao> opcoes) {}

    private static final List<Pergunta> PERGUNTAS = List.of(
            new Pergunta("objetivo", "Qual é o seu principal objetivo ao investir?", List.of(
                    new Opcao("a", "Preservar o que já tenho, sem correr riscos", 1),
                    new Opcao("b", "Ter uma renda complementar estável", 2),
                    new Opcao("c", "Fazer o patrimônio crescer no médio prazo", 3),
                    new Opcao("d", "Buscar o maior retorno, aceitando oscilações fortes", 4))),
            new Pergunta("prazo", "Por quanto tempo você pretende deixar a maior parte do dinheiro investida?", List.of(
                    new Opcao("a", "Até 1 ano", 1),
                    new Opcao("b", "De 1 a 3 anos", 2),
                    new Opcao("c", "De 3 a 5 anos", 3),
                    new Opcao("d", "Mais de 5 anos", 4))),
            new Pergunta("queda", "Se seus investimentos caíssem 15% em um mês, o que você faria?", List.of(
                    new Opcao("a", "Resgataria tudo", 1),
                    new Opcao("b", "Resgataria uma parte", 2),
                    new Opcao("c", "Manteria e esperaria recuperar", 3),
                    new Opcao("d", "Aproveitaria para investir mais", 4))),
            new Pergunta("experiencia", "Com quais investimentos você já tem experiência?", List.of(
                    new Opcao("a", "Poupança ou nenhum", 1),
                    new Opcao("b", "CDB, Tesouro e fundos de renda fixa", 2),
                    new Opcao("c", "Também ações e fundos imobiliários", 3),
                    new Opcao("d", "Também derivativos, cripto ou operações frequentes", 4))),
            new Pergunta("reserva", "Quanto do seu patrimônio pode ficar investido sem que você precise resgatar?", List.of(
                    new Opcao("a", "Menos de 10%", 1),
                    new Opcao("b", "De 10% a 30%", 2),
                    new Opcao("c", "De 30% a 60%", 3),
                    new Opcao("d", "Mais de 60%", 4))));

    public record Resultado(PerfilInvestidor perfil, int pontos) {}

    private final OnboardingProps.Suitability limites;

    public Suitability(OnboardingProps props) {
        this.limites = props.suitability();
    }

    public List<PerguntaSuitability> questionario() {
        return PERGUNTAS.stream()
                .map(p -> new PerguntaSuitability(p.id(), p.texto(),
                        p.opcoes().stream().map(o -> new OpcaoSuitability(o.id(), o.texto())).toList()))
                .toList();
    }

    /** Exige exatamente uma resposta válida por pergunta. */
    public Resultado avaliar(List<RespostaSuitability> respostas) {
        Map<String, String> porPergunta = new HashMap<>();
        for (RespostaSuitability r : respostas == null ? List.<RespostaSuitability>of() : respostas) {
            if (r == null || r.perguntaId() == null) throw new RequisicaoInvalida("Resposta do questionário sem pergunta");
            if (porPergunta.put(r.perguntaId(), r.opcaoId()) != null) {
                throw new RequisicaoInvalida("Pergunta respondida mais de uma vez: " + r.perguntaId());
            }
        }
        int pontos = 0;
        for (Pergunta p : PERGUNTAS) {
            String opcaoId = porPergunta.remove(p.id());
            if (opcaoId == null) throw new RequisicaoInvalida("Responda a pergunta: " + p.texto());
            pontos += p.opcoes().stream().filter(o -> o.id().equals(opcaoId)).findFirst()
                    .orElseThrow(() -> new RequisicaoInvalida("Opção inválida na pergunta " + p.id()))
                    .pontos();
        }
        if (!porPergunta.isEmpty()) throw new RequisicaoInvalida("Pergunta desconhecida: " + porPergunta.keySet().iterator().next());
        return new Resultado(perfil(pontos), pontos);
    }

    PerfilInvestidor perfil(int pontos) {
        if (pontos <= limites.limiteConservador()) return PerfilInvestidor.CONSERVADOR;
        if (pontos <= limites.limiteModerado()) return PerfilInvestidor.MODERADO;
        if (pontos <= limites.limiteArrojado()) return PerfilInvestidor.ARROJADO;
        return PerfilInvestidor.AGRESSIVO;
    }
}
