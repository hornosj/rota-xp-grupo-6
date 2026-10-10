package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.agentes.ContextoCliente.AcaoContexto;
import br.com.rotaxp.copiloto.agentes.ContextoCliente.EventoProximo;
import br.com.rotaxp.copiloto.dominio.AcaoSugerida;
import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Edicao.CamposExtraidos;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemEvento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAcao;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEventoVida;
import br.com.rotaxp.copiloto.dominio.Enums.TipoNecessidade;
import br.com.rotaxp.copiloto.dominio.Necessidade;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
    /** Ordem importa só para empates numa mesma oração; o resultado segue a ordem da nota. */
    private static final Map<TipoNecessidade, List<String>> PALAVRAS_NECESSIDADE = new LinkedHashMap<>();
    static {
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.PROTECAO_VEICULO, List.of("bateu o carro", "bateu a moto", "batida",
                "acidente de carro", "roubaram o carro", "carro roubado", "furtaram o carro"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.PROTECAO_VIDA, List.of("bebê", "grávida", "filho nasceu", "dependentes",
                "casou", "vai casar", "casamento"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.PROTECAO_RESIDENCIAL,
                List.of("assaltad", "casa foi roubada", "alagou", "enchente", "incêndio"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.SAUDE, List.of("doença", "doente", "hospital", "cirurgia", "internad",
                "diagnóstico", "câncer", "tratamento"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.RESERVA_EMERGENCIA, List.of("demitid", "desempreg", "perdeu o emprego", "imprevisto"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.EDUCACAO, List.of("faculdade", "escola"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.APOSENTADORIA, List.of("aposent"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.COMPRA_IMOVEL, List.of("comprar um apartamento", "comprar uma casa",
                "casa própria", "imóvel"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.COMPRA_VEICULO, List.of("comprar um carro", "carro novo", "trocar de carro"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.VIAGEM, List.of("viagem", "viajar", "férias"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.SUCESSAO, List.of("sucessão", "testamento", "inventário"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.LUTO, List.of("perdeu o filho", "perdeu a filha", "perdeu o pai",
                "perdeu a mãe", "perdeu o marido", "perdeu a esposa", "faleceu", "morreu", "falecimento", "luto"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.REORGANIZACAO_FINANCEIRA, List.of("perdeu todo o dinheiro",
                "perdeu dinheiro", "perdeu muito dinheiro", "prejuízo", "golpe", "dívida", "endividad", "divórcio",
                "divorci", "separou"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.ALOCACAO_LIQUIDEZ, List.of("herança", "herdou", "bônus", "plr",
                "indenização", "vendeu o", "vendeu a"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.AUMENTO_RENDA, List.of("promovid", "promoção", "aumento de salário",
                "novo emprego"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.EMPREENDIMENTO, List.of("abriu uma empresa", "abrir uma empresa",
                "abriu um negócio", "abrir um negócio", "empresa própria", "cnpj"));
        PALAVRAS_NECESSIDADE.put(TipoNecessidade.INTERNACIONAL, List.of("morar fora", "exterior", "intercâmbio",
                "viagem internacional", "dólar"));
    }
    /** "o carro tá com seguro": a necessidade de proteção vira revisão, não venda. */
    private static final List<String> JA_TEM_SEGURO = List.of("com seguro", "tem seguro", "segurad", "tem plano");
    private static final Map<TipoNecessidade, List<String>> OBJETO_DO_SEGURO = Map.of(
            TipoNecessidade.PROTECAO_VEICULO, List.of("carro", "moto", "veículo"),
            TipoNecessidade.PROTECAO_RESIDENCIAL, List.of("casa", "apartamento", "residência"),
            TipoNecessidade.PROTECAO_VIDA, List.of("vida"),
            TipoNecessidade.SAUDE, List.of("saúde", "plano"));
    /** Ditado não tem pontuação: separa por pontuação e pelos conectivos que encadeiam fatos. */
    private static final String ORACOES = "(?<=[.!?;,])\\s+|\\s+(?:(?:e|depois|agora|então|aí|mas|porque)\\s+)+";

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
        if (!c.anotacoesAssessor().isEmpty()) bullets.add("Contexto do assessor: " + c.anotacoesAssessor().getLast());
        if (!c.momentoDelicado().isEmpty()) {
            bullets.add("Momento delicado: " + semPonto(c.momentoDelicado().getFirst()) + ". Acolha antes de falar de produtos.");
        } else if (!c.produtosRecomendados().isEmpty()) {
            bullets.add("Oportunidade: " + c.produtosRecomendados().getFirst() + ".");
        }
        bullets.add("Patrimônio: " + c.patrimonioTexto() + ".");
        bullets.add("Fluxo: " + c.fluxoTexto() + ".");
        c.alertas().stream().limit(2).forEach(a -> bullets.add("Atenção: " + a));
        c.eventosProximos().forEach(e -> bullets.add(e.descricao() + " em " + e.emDias() + " dias."));
        c.acoesSugeridas().forEach(a -> bullets.add("Sugestão: " + a + "."));
        while (bullets.size() < 5) bullets.add("Sem outros pontos de atenção no momento.");

        List<String> perguntas = new ArrayList<>();
        if (!c.momentoDelicado().isEmpty()) {
            perguntas.add("Como você e sua família estão?");
        } else if (!c.produtosRecomendados().isEmpty()) {
            String produto = c.produtosRecomendados().getFirst().replaceAll(" \\(.*$", "");
            perguntas.add("Faz sentido conversarmos sobre " + minuscula(produto) + "?");
        }
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
        Map<TipoNecessidade, Necessidade> necessidades = new LinkedHashMap<>();
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
        List<String> oracoes = java.util.Arrays.stream(transcricao.split(ORACOES)).map(String::strip)
                .filter(o -> !o.isEmpty()).toList();
        for (String o : oracoes) {
            String lower = o.toLowerCase(Locale.ROOT);
            PALAVRAS_NECESSIDADE.forEach((t, palavras) -> {
                if (palavras.stream().anyMatch(lower::contains)) {
                    necessidades.putIfAbsent(t, new Necessidade(t, semPonto(o), jaPossui(t, oracoes)));
                }
            });
        }
        List<AcaoSugerida> acoes = new ArrayList<>();
        acoes.add(new AcaoSugerida("acao-" + clienteId + "-nota-followup", clienteId, TipoAcao.CONTATO_RELACIONAMENTO,
                "Enviar resumo da reunião e próximos passos", "Registrado na nota da reunião.", null, List.of(), false));
        String resumo = "Reunião com " + c.primeiroNome() + ": " + eventos.size() + " evento(s) de vida, " + metas.size()
                + " meta(s) e " + perfil.size() + " mudança(s) de perfil registradas.";
        return new ResultadoNota(resumo, eventos, metas, perfil, List.copyOf(necessidades.values()), List.of(), acoes, GeradoPor.stub);
    }

    /** Alguma oração diz que já tem seguro deste tipo (ou de algo não especificado). */
    private static boolean jaPossui(TipoNecessidade t, List<String> oracoes) {
        List<String> objetos = OBJETO_DO_SEGURO.get(t);
        if (objetos == null) return false;
        return oracoes.stream().map(o -> o.toLowerCase(Locale.ROOT))
                .filter(o -> JA_TEM_SEGURO.stream().anyMatch(o::contains))
                .anyMatch(o -> objetos.stream().anyMatch(o::contains)
                        || OBJETO_DO_SEGURO.values().stream().flatMap(List::stream).noneMatch(o::contains));
    }

    // ---------- edição do cadastro por voz ----------

    /** Palavras com inicial maiúscula, com "de/da/do/dos/das/e" no meio ("Rio de Janeiro"). */
    private static final String NOME_PROPRIO = "\\p{Lu}[\\p{L}'-]*(?:\\s+(?:(?:de|da|do|dos|das|e)\\s+)?\\p{Lu}[\\p{L}'-]*)*";
    private static final Pattern NOME = Pattern.compile("\\b(?iu:nome)\\s+(?iu:(?:correto|certo|completo)\\s+)?"
            + "(?iu:(?:dela|dele|do cliente|da cliente)\\s+)?(?iu:(?:agora\\s+)?(?:é|para|passa a ser|fica))\\s+"
            + "((?:(?:Dra?|Sra?)\\.\\s+)?" + NOME_PROPRIO + ")");
    private static final Pattern IDADE = Pattern.compile("\\b(?iu:fez|faz|completou|completa|tem|está com|esta com|"
            + "idade (?:dela |dele )?(?:agora )?(?:é|de|correta é|certa é))\\s+(\\d{1,3})\\s+(?iu:anos)(?!\\s+de\\s+(?!idade))");
    private static final Pattern PROFISSAO = Pattern.compile("\\b(?iu:agora (?:ela |ele )?(?:é|trabalha como|atua como)|"
            + "virou|passou a ser|trabalha como|atua como|começou a trabalhar como|foi promovid[oa] a|"
            + "profiss[ãa]o (?:dela |dele )?(?:agora )?(?:é|mudou para|passou a ser))\\s+(?:(?iu:um|uma|o|a)\\s+)?([^,.;!?]+)");
    private static final Pattern FIM_DA_PROFISSAO = Pattern.compile("\\s+(?iu:e|mas|que|porque|pois|desde|há)\\s+.*$");
    private static final Pattern CIDADE = Pattern.compile("\\b(?iu:mudou-se|se mudou|mudou|vai se mudar|foi morar|"
            + "passou a morar|est[áa] morando|mora|reside)(?:\\s+(?iu:de)\\s+" + NOME_PROPRIO + ")?"
            + "\\s+(?iu:agora\\s+)?(?iu:para|pra|em|no)\\s+(?:(?iu:o|a)\\s+)?(" + NOME_PROPRIO + "(?:\\s*[/-]\\s*\\p{Lu}{2}\\b)?)");
    private static final Pattern PERFIL = Pattern.compile("(?iu:perfil[^.!?]*\\b(conservador|moderad[oa]|arrojad[oa]|agressiv[oa]))");
    private static final Pattern PALAVRA_DE_PERFIL = Pattern.compile("(?iu:\\bperfil\\b|conservador|moderad[oa]|arrojad[oa]|agressiv[oa])");
    private static final Pattern OUTRO_CAMPO_ANTES = Pattern.compile("(?iu:\\b(?:nome|idade|cidade|perfil)\\b)");

    /** Frases típicas do assessor ("se mudou para Campinas", "agora é consultora", "fez 69 anos"). */
    @Override
    public CamposExtraidos extrairEdicao(String clienteId, String transcricao) {
        String t = transcricao == null ? "" : transcricao;
        String nome = ultimo(NOME, t, n -> n.contains(" "));
        String idade = ultimo(IDADE, t, i -> true);
        String cidade = ultimo(CIDADE, t, c -> !PALAVRA_DE_PERFIL.matcher(c).find());
        String perfil = ultimo(PERFIL, t, p -> true);
        String profissao = null;
        Matcher m = PROFISSAO.matcher(t);
        while (m.find()) {
            // "o nome dela agora é...", "a idade agora é..." não são profissão.
            String antes = t.substring(Math.max(0, Math.max(t.lastIndexOf('.', m.start()), t.lastIndexOf(',', m.start()))), m.start());
            String p = FIM_DA_PROFISSAO.matcher(m.group(1)).replaceFirst("").strip();
            if (!p.isEmpty() && !OUTRO_CAMPO_ANTES.matcher(antes).find() && !PALAVRA_DE_PERFIL.matcher(p).find()
                    && !p.matches(".*\\d.*")) {
                profissao = p;
            }
        }
        return new CamposExtraidos(nome, idade, profissao, cidade, perfil, GeradoPor.stub);
    }

    /** A última ocorrência vale: o assessor costuma se corrigir no fim ("... aliás, Sorocaba"). */
    private static String ultimo(Pattern p, String texto, java.util.function.Predicate<String> aceita) {
        String r = null;
        Matcher m = p.matcher(texto);
        while (m.find()) {
            String v = m.group(1).strip();
            if (aceita.test(v)) r = v;
        }
        return r;
    }

    private static String semPonto(String s) {
        return s.replaceAll("[.!?]+$", "");
    }

    private static String minuscula(String s) {
        return s.isEmpty() ? s : Character.toLowerCase(s.charAt(0)) + s.substring(1);
    }
}
