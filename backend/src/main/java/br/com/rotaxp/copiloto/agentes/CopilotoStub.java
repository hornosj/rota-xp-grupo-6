package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.agentes.ContextoCliente.AcaoContexto;
import br.com.rotaxp.copiloto.agentes.ContextoCliente.EventoProximo;
import br.com.rotaxp.copiloto.dominio.AcaoSugerida;
import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemEvento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAcao;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEventoVida;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Templates determinísticos por TipoAcao: funciona sem chave de API e é o piso da demo. */
@Component
public class CopilotoStub implements Copiloto {

    private static final Map<String, TipoEventoVida> PALAVRAS_EVENTO = new LinkedHashMap<>();
    static {
        PALAVRAS_EVENTO.put("casar", TipoEventoVida.CASAMENTO);
        PALAVRAS_EVENTO.put("casamento", TipoEventoVida.CASAMENTO);
        PALAVRAS_EVENTO.put("aposentar", TipoEventoVida.APOSENTADORIA);
        PALAVRAS_EVENTO.put("aposentadoria", TipoEventoVida.APOSENTADORIA);
        PALAVRAS_EVENTO.put("viagem", TipoEventoVida.FERIAS);
        PALAVRAS_EVENTO.put("férias", TipoEventoVida.FERIAS);
        PALAVRAS_EVENTO.put("bebê", TipoEventoVida.NASCIMENTO);
        PALAVRAS_EVENTO.put("grávida", TipoEventoVida.NASCIMENTO);
        PALAVRAS_EVENTO.put("mudar de", TipoEventoVida.MUDANCA);
        PALAVRAS_EVENTO.put("mudança", TipoEventoVida.MUDANCA);
    }
    private static final List<String> PALAVRAS_META = List.of("quer ", "meta", "objetivo", "planeja", "juntar");

    private final ContextoClienteFactory contextos;
    private final ContextoNoticiaFactory contextosNoticia;

    public CopilotoStub(ContextoClienteFactory contextos, ContextoNoticiaFactory contextosNoticia) {
        this.contextos = contextos;
        this.contextosNoticia = contextosNoticia;
    }

    // ---------- motivo de contato (radar) ----------

    @Override
    public br.com.rotaxp.copiloto.dominio.Radar.MotivoNoticia redigirMotivoNoticia(String clienteId, String noticiaId) {
        AgentesTipos.ContextoNoticia c = contextosNoticia.para(clienteId, noticiaId);
        String leitura = switch (c.direcao()) {
            case "NEGATIVA" -> "A notícia aumenta o risco dessa parte da carteira. Sugestão: ligar hoje, explicar o fato com calma "
                    + "e avaliar com o cliente se faz sentido reduzir ou diversificar essa exposição.";
            case "POSITIVA" -> "A notícia é favorável a essa parte da carteira. Sugestão: aproveitar para um contato de "
                    + "relacionamento e revisar os objetivos.";
            default -> "A notícia pode mudar o cenário dessa parte da carteira. Sugestão: revisar a posição com o cliente "
                    + "na próxima conversa.";
        };
        String texto = c.cliente().primeiroNome() + " tem " + c.impacto().motivo() + ". Notícia: \"" + c.titulo() + "\" ("
                + c.fonte() + "). " + leitura;
        return new br.com.rotaxp.copiloto.dominio.Radar.MotivoNoticia(texto, GeradoPor.stub);
    }

    // ---------- mensagem ----------

    @Override
    public MensagemGerada redigirMensagem(String clienteId, String acaoId, Canal canal) {
        ContextoCliente c = contextos.paraAcao(clienteId, acaoId);
        String corpo = corpo(c);
        if (c.acao().tipo() == TipoAcao.CONVIDAR_CONEXAO && c.acao().link() != null) {
            String convite = "Para eu enxergar seu patrimônio completo e checar sua proteção no FGC, você pode conectar o "
                    + c.acao().instituicaoNome() + " por aqui: " + c.acao().link() + ". Leva 1 minuto e você pode revogar quando quiser.";
            String t = canal == Canal.EMAIL
                    ? "Assunto: " + c.acao().titulo() + "\n\nOlá, " + c.primeiroNome() + ",\n\n" + convite
                      + "\n\nAbraços,\nSeu assessor de investimentos"
                    : "Oi, " + c.primeiroNome() + "! " + convite;
            return new MensagemGerada(t, canal, GeradoPor.stub);
        }
        String texto = canal == Canal.EMAIL
                ? "Assunto: " + c.acao().titulo() + "\n\nOlá, " + c.primeiroNome() + ",\n\n" + corpo
                  + "\n\nAbraços,\nSeu assessor de investimentos"
                : "Oi, " + c.primeiroNome() + "! Tudo bem? " + corpo;
        return new MensagemGerada(texto, canal, GeradoPor.stub);
    }

    private static String corpo(ContextoCliente c) {
        AcaoContexto a = c.acao();
        EventoProximo evento = c.eventosProximos().isEmpty() ? null : c.eventosProximos().get(0);
        String valor = a.valorTexto() == null ? "" : a.valorTexto();
        String inst = a.instituicaoNome() == null ? "outro banco" : a.instituicaoNome();
        String base = switch (a.tipo()) {
            case DIVERSIFICAR_FGC -> "Revisando seu patrimônio, vi que " + valor + " no " + inst + " estão acima da cobertura "
                    + "do FGC. Tenho uma sugestão simples para deixar tudo protegido. Podemos falar 10 minutos amanhã?";
            case REDUZIR_CONCENTRACAO -> "Olhando sua carteira, vi que " + valor + " dependem de um único emissor, sem a "
                    + "proteção do FGC. Queria te mostrar uma forma simples de diluir esse risco. Podemos conversar esta semana?";
            case APLICAR_SALDO_PARADO -> "Vi que você tem cerca de " + valor + " parados em conta corrente, além do que "
                    + "precisa no mês. Dá para deixar esse dinheiro rendendo com liquidez diária, sem perder a flexibilidade. "
                    + "Posso te mostrar em 10 minutos?";
            case APORTE_PROGRAMADO -> "Pensando nos seus objetivos, que tal programarmos um aporte mensal automático? "
                    + "Assim seu patrimônio cresce sem você precisar lembrar todo mês. Posso te ligar para montarmos juntos?";
            case REINVESTIR_VENCIMENTO -> "Um investimento seu de " + valor + " vence nos próximos dias. Queria conversar "
                    + "antes para escolhermos juntos o melhor destino para esse dinheiro. Qual o melhor horário para você?";
            case RENOVAR_CONSENTIMENTO -> "O compartilhamento dos seus dados do " + inst + " pelo Open Finance vence em breve. "
                    + "Renovar leva 1 minuto pelo app e mantém sua visão de patrimônio completa. Quer que eu te mande o passo a passo?";
            case CONTATO_RELACIONAMENTO -> evento == null
                    ? "Passando para saber como você está. Se quiser, marcamos um café para colocar a vida financeira em dia."
                    : "Lembrei que " + minuscula(evento.descricao()) + " está chegando. Desejo tudo de bom! Se quiser, depois "
                      + "marcamos um café para colocar a vida financeira em dia.";
            case CONVIDAR_CONEXAO -> "Você sabia que pode conectar o " + inst + " pelo app da XP, via Open Finance? Assim "
                    + "consigo te dar uma visão completa do seu patrimônio e checar se está tudo protegido. Leva 2 minutos.";
            case MONTAR_RESERVA -> "Revisando seu planejamento, vi que sua reserva de emergência pode ficar mais robusta: "
                    + "faltam " + valor + " para cobrir 6 meses do seu custo de vida. Posso te sugerir um plano simples?";
        };
        if (evento != null && a.tipo() != TipoAcao.CONTATO_RELACIONAMENTO) {
            base += evento.descricao().startsWith("Aniversário")
                    ? " E já adianto: parabéns antecipado pelo " + minuscula(evento.descricao()) + "!"
                    : " E já adianto: " + minuscula(evento.descricao()) + " está chegando, conte comigo!";
        }
        return base;
    }

    // ---------- briefing ----------

    @Override
    public Briefing gerarBriefing(String clienteId) {
        ContextoCliente c = contextos.paraCliente(clienteId);
        List<String> bullets = new ArrayList<>();
        bullets.add(c.principalidade());
        bullets.add("Patrimônio: " + c.patrimonioTexto() + ".");
        bullets.add("Fluxo: " + c.fluxoTexto() + ".");
        c.alertas().stream().limit(2).forEach(a -> bullets.add("Atenção: " + a));
        c.eventosProximos().forEach(e -> bullets.add(e.descricao() + " em " + e.emDias() + " dias."));
        c.acoesSugeridas().forEach(a -> bullets.add("Sugestão: " + a + "."));
        while (bullets.size() < 5) bullets.add("Sem outros pontos de atenção no momento.");

        List<String> perguntas = new ArrayList<>();
        c.eventosProximos().forEach(e -> perguntas.add("Como estão os planos para o " + minuscula(e.descricao()) + "?"));
        perguntas.add("Algum objetivo novo para os próximos 12 meses?");
        perguntas.add("Houve alguma mudança na sua renda ou nos seus gastos?");
        perguntas.add("Tem alguma outra instituição que você usa e ainda não conectamos?");
        return new Briefing(clienteId, List.copyOf(bullets.subList(0, 5)), List.copyOf(perguntas.subList(0, 3)), GeradoPor.stub);
    }

    // ---------- nota pós-reunião ----------

    @Override
    public ResultadoNota processarNota(String clienteId, String transcricao) {
        ContextoCliente c = contextos.paraCliente(clienteId);
        LocalDate ref = contextos.hoje();
        List<EventoVida> eventos = new ArrayList<>();
        List<String> metas = new ArrayList<>();
        List<String> perfil = new ArrayList<>();
        int n = 0;
        for (String frase : transcricao.split("(?<=[.!?])\\s+")) {
            String f = frase.trim();
            String lower = f.toLowerCase(Locale.ROOT);
            if (f.isEmpty()) continue;
            TipoEventoVida tipo = PALAVRAS_EVENTO.entrySet().stream().filter(e -> lower.contains(e.getKey()))
                    .map(Map.Entry::getValue).findFirst().orElse(null);
            if (tipo != null) {
                eventos.add(new EventoVida("evt-nota-" + clienteId + "-" + (++n), tipo, semPonto(f), ref.plusDays(180),
                        OrigemEvento.NOTA_REUNIAO));
            } else if (PALAVRAS_META.stream().anyMatch(lower::contains)) {
                metas.add(semPonto(f));
            }
            if (lower.contains("conservador")) perfil.add("Sinalizou preferência mais conservadora");
            if (lower.contains("arrojad") || lower.contains("mais risco")) perfil.add("Sinalizou apetite maior a risco");
        }
        List<AcaoSugerida> acoes = new ArrayList<>();
        acoes.add(new AcaoSugerida("acao-" + clienteId + "-nota-followup", clienteId, TipoAcao.CONTATO_RELACIONAMENTO,
                "Enviar resumo da reunião e próximos passos", "Registrado na nota da reunião.", null, List.of(), false));
        String resumo = "Reunião com " + c.primeiroNome() + ": " + eventos.size() + " evento(s) de vida, " + metas.size()
                + " meta(s) e " + perfil.size() + " mudança(s) de perfil registradas.";
        return new ResultadoNota(resumo, eventos, metas, perfil, acoes, GeradoPor.stub);
    }

    private static String semPonto(String s) {
        return s.replaceAll("[.!?]+$", "");
    }

    private static String minuscula(String s) {
        return s.isEmpty() ? s : Character.toLowerCase(s.charAt(0)) + s.substring(1);
    }
}
