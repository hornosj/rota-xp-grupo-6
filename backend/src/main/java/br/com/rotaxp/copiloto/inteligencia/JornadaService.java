package br.com.rotaxp.copiloto.inteligencia;

import br.com.rotaxp.copiloto.analise.AnaliseFgc;
import br.com.rotaxp.copiloto.analise.AnaliseFluxo;
import br.com.rotaxp.copiloto.analise.Texto;
import br.com.rotaxp.copiloto.config.AlertasProps;
import br.com.rotaxp.copiloto.dominio.Cliente.InstituicaoDeclarada;
import br.com.rotaxp.copiloto.dominio.Cobertura;
import br.com.rotaxp.copiloto.dominio.Cobertura.Pendente;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Diagnostico;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.PosicaoXp;
import br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado;
import br.com.rotaxp.copiloto.dominio.Enums.StatusMissao;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoDiagnostico;
import br.com.rotaxp.copiloto.dominio.Enums.TipoMissao;
import br.com.rotaxp.copiloto.dominio.FluxoCaixa;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.Jornada;
import br.com.rotaxp.copiloto.dominio.Jornada.Nivel;
import br.com.rotaxp.copiloto.dominio.Missao;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * PLAN §7.10 — gamificação do Open Finance. Premia consentimento e saúde financeira,
 * nunca giro de carteira ou risco.
 */
@Service
public class JornadaService {

    private static final String RECOMPENSA_FGC = "Diagnóstico desbloqueado: Proteção FGC";
    private static final String RECOMPENSA_CUSTO = "Diagnóstico desbloqueado: Custo de vida";

    private final AlertasProps alertasProps;

    public JornadaService(AlertasProps alertasProps) {
        this.alertasProps = alertasProps;
    }

    public Jornada montar(DadosVisiveis d, LocalDate ref, Cobertura cobertura, PosicaoXp posicaoXp, AnaliseFluxo fluxo, AnaliseFgc fgc) {
        double completude = cobertura.percentual();
        Nivel nivel = nivel(completude, posicaoXp, cobertura.pendentes());
        boolean custoDesbloqueado = cartoesPendentes(d).isEmpty();
        return new Jornada(d.cliente().id(), completude, nivel,
                missoes(d, ref, fluxo.fluxo()),
                diagnosticos(d, completude, custoDesbloqueado, fluxo, fgc));
    }

    // ---------- nível ----------

    private Nivel nivel(double completude, PosicaoXp posicaoXp, List<Pendente> pendentes) {
        String conectar = pendentes.isEmpty() ? null
                : "Conecte " + juntar(pendentes.stream().map(p -> "o " + p.nome()).toList()) + " para ver 100% do seu patrimônio.";
        if (completude >= 1.0 && posicaoXp == PosicaoXp.PRINCIPAL) {
            return new Nivel(4, "Cliente Principal", null, null,
                    List.of("Atendimento prioritário com seu assessor (exemplo)", "Convites para eventos exclusivos (exemplo)",
                            "Relatório mensal personalizado (exemplo)"));
        }
        if (completude >= 1.0) {
            return new Nivel(3, "Patrimônio Completo", "Cliente Principal",
                    "Traga sua conta do dia a dia para a XP (receba seu salário aqui) e vire Cliente Principal.",
                    List.of("Diagnóstico de proteção do FGC", "Relatório mensal personalizado (exemplo)"));
        }
        if (completude >= 0.5) {
            return new Nivel(2, "Visão Clara", "Patrimônio Completo", conectar,
                    List.of("Diagnóstico de custo de vida", "Diagnóstico de reserva de emergência"));
        }
        return new Nivel(1, "Explorador", "Visão Clara", conectar, List.of("Resumo do patrimônio conectado"));
    }

    // ---------- missões ----------

    private List<Missao> missoes(DadosVisiveis d, LocalDate ref, FluxoCaixa fluxo) {
        String cli = d.cliente().id();
        List<Missao> missoes = new ArrayList<>();
        for (InstituicaoDeclarada decl : declaradas(d)) {
            Instituicao inst = d.instituicao(decl.instituicaoId());
            if (inst == null || inst.ehXp()) continue;
            boolean conectada = d.conectada(inst.id());
            if (conectada && !concedidoHoje(d, inst.id(), ref)) continue;
            boolean cartao = decl.produtos().contains(ProdutoDeclarado.CARTAO);
            StatusMissao status = conectada ? StatusMissao.CONCLUIDA : StatusMissao.DISPONIVEL;
            double progresso = conectada ? 1.0 : 0.0;
            String descricao = "Compartilhe seus dados do " + inst.nome() + " pelo Open Finance. Você escolhe o que "
                    + "compartilhar, por quanto tempo, e pode revogar quando quiser.";
            missoes.add(cartao
                    ? new Missao("mis-" + cli + "-cartao-" + inst.id(), TipoMissao.CONECTAR_CARTAO,
                            "Conecte o cartão do " + inst.nome() + " e descubra seu custo de vida real",
                            descricao, RECOMPENSA_CUSTO, status, progresso, inst.id())
                    : new Missao("mis-" + cli + "-conectar-" + inst.id(), TipoMissao.CONECTAR_INSTITUICAO,
                            "Conecte o " + inst.nome() + " e descubra se seu patrimônio está protegido pelo FGC",
                            descricao, RECOMPENSA_FGC, status, progresso, inst.id()));
        }

        double alvo = alertasProps.reservaMesesAlvo();
        if (fluxo.custoVidaMensal().signum() > 0 && fluxo.reservaEmergenciaMeses() < alvo) {
            missoes.add(new Missao("mis-" + cli + "-reserva", TipoMissao.RESERVA_EMERGENCIA,
                    "Monte sua reserva de emergência",
                    "Hoje sua reserva cobre " + meses(fluxo.reservaEmergenciaMeses()) + ". A meta é "
                            + meses(alvo) + " do seu custo de vida.",
                    "Selo Reserva Completa", StatusMissao.DISPONIVEL,
                    arred(Math.min(1.0, fluxo.reservaEmergenciaMeses() / alvo)), null));
        }

        for (Consentimento c : d.consentimentos()) {
            if (!c.ativo() || c.expiraEm() == null) continue;
            long dias = ChronoUnit.DAYS.between(ref, c.expiraEm());
            if (dias < 0 || dias > alertasProps.consentimentoExpirandoDias()) continue;
            Instituicao inst = d.instituicao(c.instituicaoId());
            missoes.add(new Missao("mis-" + cli + "-renovar-" + c.instituicaoId(), TipoMissao.RENOVAR_CONSENTIMENTO,
                    "Renove o compartilhamento com o " + inst.nome(),
                    "Seu compartilhamento com o " + inst.nome() + " vence em " + dias + " dias.",
                    "Mantém seus diagnósticos atualizados", StatusMissao.DISPONIVEL, 0.0, inst.id()));
        }
        return List.copyOf(missoes);
    }

    private static boolean concedidoHoje(DadosVisiveis d, String instituicaoId, LocalDate ref) {
        return d.consentimentos().stream().anyMatch(c -> c.instituicaoId().equals(instituicaoId)
                && c.tipo() == TipoConsentimento.OPEN_FINANCE && c.ativo() && ref.equals(c.concedidoEm()));
    }

    // ---------- diagnósticos ----------

    private List<Diagnostico> diagnosticos(DadosVisiveis d, double completude, boolean custoDesbloqueado,
                                           AnaliseFluxo fluxo, AnaliseFgc fgc) {
        boolean tudo = completude >= 1.0;
        String requisitoTudo = "Conecte todas as instituições que você usa";
        FluxoCaixa f = fluxo.fluxo();

        Diagnostico patrimonio = new Diagnostico(TipoDiagnostico.PATRIMONIO_COMPLETO, "Patrimônio completo", tudo, requisitoTudo,
                tudo ? Texto.reais(fgc.patrimonioVisivel()) + " em " + d.instituicoesVisiveis().size() + " instituições" : null,
                tudo ? Map.of("total", fgc.patrimonioVisivel(), "instituicoes", d.instituicoesVisiveis().size()) : null);

        Diagnostico protecao = new Diagnostico(TipoDiagnostico.PROTECAO_FGC, "Proteção FGC", tudo, requisitoTudo,
                tudo ? resumoFgc(fgc) : null, tudo ? Map.of("conglomerados", detalhesFgc(fgc)) : null);

        List<String> cartoes = cartoesPendentes(d);
        Map<String, Object> custoDetalhes = new LinkedHashMap<>();
        custoDetalhes.put("total", f.custoVidaMensal());
        custoDetalhes.put("porCategoria", fluxo.custoPorCategoria());
        Diagnostico custo = new Diagnostico(TipoDiagnostico.CUSTO_DE_VIDA, "Custo de vida", custoDesbloqueado,
                cartoes.isEmpty() ? "Conecte os cartões que você usa" : "Conecte o cartão " + juntar(cartoes.stream().map(n -> "do " + n).toList()),
                custoDesbloqueado ? "Seu custo de vida é de " + Texto.reais(f.custoVidaMensal()) + " por mês" : null,
                custoDesbloqueado ? custoDetalhes : null);

        BigDecimal meta = f.custoVidaMensal().multiply(BigDecimal.valueOf(alertasProps.reservaMesesAlvo()));
        Diagnostico reserva = new Diagnostico(TipoDiagnostico.RESERVA_EMERGENCIA, "Reserva de emergência", custoDesbloqueado,
                "Desbloqueie o diagnóstico de custo de vida",
                custoDesbloqueado ? "Sua reserva cobre " + meses(f.reservaEmergenciaMeses()) + " do seu custo de vida" : null,
                custoDesbloqueado ? Map.of("meses", f.reservaEmergenciaMeses(), "liquidez", f.liquidezImediata(),
                        "metaMeses", alertasProps.reservaMesesAlvo(), "meta", meta) : null);

        return List.of(patrimonio, protecao, custo, reserva);
    }

    private static String resumoFgc(AnaliseFgc fgc) {
        List<String> partes = fgc.conglomerados().stream().filter(c -> c.excessoFgc().signum() > 0)
                .map(c -> Texto.reais(c.excessoFgc()) + " sem cobertura " + c.referencia().replaceFirst("^d([oa]) ", "n$1 "))
                .toList();
        return partes.isEmpty() ? "Todo o seu patrimônio está protegido" : String.join("; ", partes);
    }

    private static List<Map<String, Object>> detalhesFgc(AnaliseFgc fgc) {
        return fgc.conglomerados().stream().filter(c -> c.elegivel().signum() > 0).map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("conglomeradoId", c.conglomeradoId());
            m.put("nome", c.nome());
            m.put("valor", c.elegivel());
            m.put("coberto", c.elegivel().subtract(c.excessoFgc()));
            m.put("descoberto", c.excessoFgc());
            return m;
        }).toList();
    }

    private static List<String> cartoesPendentes(DadosVisiveis d) {
        return declaradas(d).stream()
                .filter(decl -> decl.produtos().contains(ProdutoDeclarado.CARTAO))
                .filter(decl -> !d.visivel(decl.instituicaoId(), Escopo.CARTOES))
                .map(decl -> d.instituicao(decl.instituicaoId()))
                .filter(java.util.Objects::nonNull).map(Instituicao::nome).toList();
    }

    private static List<InstituicaoDeclarada> declaradas(DadosVisiveis d) {
        return d.cliente().instituicoesDeclaradas() == null ? List.of() : d.cliente().instituicoesDeclaradas();
    }

    private static String meses(double m) {
        String n = Texto.decimal(m);
        return n + (n.equals("1") ? " mês" : " meses");
    }

    private static String juntar(List<String> itens) {
        if (itens.size() <= 1) return String.join("", itens);
        return String.join(", ", itens.subList(0, itens.size() - 1)) + " e " + itens.get(itens.size() - 1);
    }

    private static double arred(double v) {
        return BigDecimal.valueOf(v).setScale(3, java.math.RoundingMode.HALF_EVEN).doubleValue();
    }
}
