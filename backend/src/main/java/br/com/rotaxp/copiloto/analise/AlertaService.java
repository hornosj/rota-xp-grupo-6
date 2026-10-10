package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.config.AlertasProps;
import br.com.rotaxp.copiloto.config.Premissas;
import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Cliente.Dependente;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Enums.Severidade;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAlerta;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.FluxoCaixa;
import br.com.rotaxp.copiloto.dominio.FluxoCaixa.FonteRenda;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

/** Alertas do PLAN §7.5–7.7. detectadoEm/novo são preenchidos depois pelo RegistroAlertas. */
@Service
public class AlertaService {

    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DIA_MES = DateTimeFormatter.ofPattern("dd/MM");

    private final AlertasProps props;
    private final Premissas premissas;

    public AlertaService(AlertasProps props, Premissas premissas) {
        this.props = props;
        this.premissas = premissas;
    }

    public List<Alerta> detectar(DadosVisiveis d, LocalDate ref, AnaliseFluxo fluxo, AnaliseFgc fgc) {
        String cli = d.cliente().id();
        List<Alerta> r = new ArrayList<>();
        fgcExcedido(cli, fgc, r);
        tetoGlobal(cli, fgc, r);
        concentracao(cli, fgc, r);
        vencimentos(d, ref, r);
        saldoParado(cli, fluxo, r);
        rendaForaXp(d, fluxo.fluxo(), r);
        consentimentosExpirando(d, ref, r);
        eventosVida(d.cliente(), ref, r);
        reserva(cli, fluxo.fluxo(), r);
        r.sort(Comparator.comparing(Alerta::severidade));
        return List.copyOf(r);
    }

    private static Alerta novo(String cli, TipoAlerta tipo, String sufixo, Severidade sev, String titulo, String explicacao,
                               BigDecimal valor, String instituicaoId, String emissorId) {
        String id = "alr-" + cli + "-" + tipo.name().toLowerCase(Locale.ROOT) + (sufixo == null ? "" : "-" + sufixo);
        return new Alerta(id, cli, tipo, sev, titulo, explicacao, valor == null ? null : Dinheiro.de(valor),
                instituicaoId, emissorId, null, false);
    }

    private void fgcExcedido(String cli, AnaliseFgc fgc, List<Alerta> r) {
        BigDecimal limite = premissas.fgc().limitePorConglomerado();
        for (AnaliseFgc.Conglomerado c : fgc.conglomerados()) {
            if (c.excessoFgc().signum() <= 0) continue;
            r.add(novo(cli, TipoAlerta.FGC_EXCEDIDO, c.conglomeradoId(), Severidade.ALTA,
                    Texto.reais(c.excessoFgc()) + " acima da cobertura do FGC",
                    Texto.reais(c.elegivel()) + " em " + lista(c.produtos()) + " " + c.referencia() + ". O FGC cobre até "
                            + Texto.reais(limite) + " por CPF por conglomerado: " + Texto.reais(c.excessoFgc())
                            + " ficariam sem garantia se o banco quebrar.",
                    c.excessoFgc(), c.instituicaoId(), c.emissorId()));
        }
    }

    private void tetoGlobal(String cli, AnaliseFgc fgc, List<Alerta> r) {
        if (!fgc.excedeTetoGlobal()) return;
        BigDecimal teto = premissas.fgc().tetoGlobal();
        r.add(novo(cli, TipoAlerta.FGC_TETO_GLOBAL, null, Severidade.MEDIA,
                "Mais de " + Texto.reais(teto) + " em produtos com FGC",
                "Há " + Texto.reais(fgc.totalElegivel()) + " em produtos cobertos pelo FGC. Além do limite por conglomerado, "
                        + "o FGC tem um teto global de " + Texto.reais(teto) + " por CPF a cada 4 anos.",
                fgc.totalElegivel(), null, null));
    }

    private void concentracao(String cli, AnaliseFgc fgc, List<Alerta> r) {
        for (AnaliseFgc.Conglomerado c : fgc.conglomerados()) {
            if (c.fracaoPatrimonio() <= props.exposicaoSemGarantiaMax()) continue;
            boolean alta = c.fracaoPatrimonio() > props.exposicaoSemGarantiaAlta() || c.emissorEmpresa();
            String pct = Texto.pct(c.fracaoPatrimonio());
            List<String> partes = new ArrayList<>();
            if (c.creditoPrivado().signum() > 0) {
                partes.add(Texto.reais(c.creditoPrivado()) + " em crédito privado (" + lista(c.produtos().stream()
                        .filter(p -> p.equals("DEBENTURE") || p.equals("CRI") || p.equals("CRA")).toList()) + ")");
            }
            if (c.excessoFgc().signum() > 0) partes.add(Texto.reais(c.excessoFgc()) + " acima do limite do FGC");
            r.add(novo(cli, TipoAlerta.CONCENTRACAO_EMISSOR, c.conglomeradoId(), alta ? Severidade.ALTA : Severidade.MEDIA,
                    pct + " do patrimônio sem garantia " + c.referencia(),
                    lista(partes) + " dependem só da saúde financeira " + c.referencia() + ", sem garantia do FGC. "
                            + "Isso é " + pct + " do patrimônio visível.",
                    c.exposicaoSemGarantia(), c.instituicaoId(), c.emissorId()));
        }
    }

    private void vencimentos(DadosVisiveis d, LocalDate ref, List<Alerta> r) {
        for (PosicaoInvestimento p : d.investimentos()) {
            if (p.vencimento() == null) continue;
            long dias = ChronoUnit.DAYS.between(ref, p.vencimento());
            if (dias < 0 || dias > props.vencimentoDias()) continue;
            r.add(novo(d.cliente().id(), TipoAlerta.VENCIMENTO_PROXIMO, p.id(), Severidade.MEDIA,
                    Texto.reais(p.valorAtual()) + " vencem em " + dias + " dias",
                    p.nome() + " (" + Texto.reais(p.valorAtual()) + ") vence em " + p.vencimento().format(DATA)
                            + ". Bom momento para planejar o reinvestimento.",
                    p.valorAtual(), p.instituicaoId(), p.emissorId()));
        }
    }

    private void saldoParado(String cli, AnaliseFluxo fluxo, List<Alerta> r) {
        BigDecimal custo = fluxo.fluxo().custoVidaMensal();
        BigDecimal excesso = fluxo.saldoContas().subtract(custo.multiply(props.saldoParadoMultiploCusto()));
        if (excesso.compareTo(props.saldoParadoMinimo()) < 0) return;
        BigDecimal mensal = rendimentoMensal(excesso, premissas);
        r.add(novo(cli, TipoAlerta.SALDO_PARADO, null, Severidade.MEDIA,
                Texto.reais(excesso) + " parados em conta",
                Texto.reais(excesso) + " estão em conta além de " + Texto.decimal(props.saldoParadoMultiploCusto().doubleValue())
                        + " mês de custo de vida. Aplicados a 100% do CDI, renderiam cerca de " + Texto.reais(mensal) + " por mês.",
                excesso, null, null));
    }

    /** valor × ((1 + CDI)^(1/12) − 1), em reais inteiros. */
    public static BigDecimal rendimentoMensal(BigDecimal valor, Premissas premissas) {
        double cdi = premissas.cdiAnual().doubleValue();
        BigDecimal taxa = new BigDecimal(Math.pow(1 + cdi, 1.0 / 12) - 1, MathContext.DECIMAL64);
        return valor.multiply(taxa).setScale(0, RoundingMode.HALF_EVEN);
    }

    private void rendaForaXp(DadosVisiveis d, FluxoCaixa f, List<Alerta> r) {
        if (f.fontesRenda().isEmpty()) return;
        FonteRenda maior = f.fontesRenda().get(0);
        Instituicao inst = d.instituicao(maior.instituicaoId());
        if (inst == null || inst.ehXp()) return;
        if (f.capacidadeAporteMensal().compareTo(props.rendaForaCapacidadeMinima()) < 0) return;
        r.add(novo(d.cliente().id(), TipoAlerta.RENDA_FORA_XP, null, Severidade.BAIXA,
                "Renda cai no " + inst.nome(),
                "A renda de " + Texto.reais(maior.valorMensal()) + " (" + maior.pagadorNome() + ") cai no " + inst.nome()
                        + ". Depois do custo de vida, sobram cerca de " + Texto.reais(f.capacidadeAporteMensal()) + " por mês.",
                f.capacidadeAporteMensal(), inst.id(), null));
    }

    private void consentimentosExpirando(DadosVisiveis d, LocalDate ref, List<Alerta> r) {
        for (Consentimento c : d.consentimentos()) {
            if (!c.ativo() || c.expiraEm() == null) continue;
            long dias = ChronoUnit.DAYS.between(ref, c.expiraEm());
            if (dias < 0 || dias > props.consentimentoExpirandoDias()) continue;
            Instituicao inst = d.instituicao(c.instituicaoId());
            String nome = inst == null ? c.instituicaoId() : inst.nome();
            r.add(novo(d.cliente().id(), TipoAlerta.CONSENTIMENTO_EXPIRANDO, c.instituicaoId(), Severidade.MEDIA,
                    "Open Finance com o " + nome + " expira em " + dias + " dias",
                    "O compartilhamento de dados com o " + nome + " vence em " + c.expiraEm().format(DATA)
                            + ". Sem renovação, a visão do patrimônio fica incompleta.",
                    null, c.instituicaoId(), null));
        }
    }

    private void eventosVida(Cliente c, LocalDate ref, List<Alerta> r) {
        for (Dependente dep : c.dependentes() == null ? List.<Dependente>of() : c.dependentes()) {
            LocalDate prox = proximoAniversario(dep.dataNascimento(), ref);
            long dias = ChronoUnit.DAYS.between(ref, prox);
            if (dias > props.eventoVidaDias()) continue;
            int idade = prox.getYear() - dep.dataNascimento().getYear();
            r.add(novo(c.id(), TipoAlerta.EVENTO_VIDA_PROXIMO, "dep-" + slug(dep.nome()), Severidade.BAIXA,
                    "Aniversário " + artigo(dep.parentesco()) + " " + dep.nome() + " " + quando(dias),
                    dep.nome() + " (" + dep.parentesco().toLowerCase(Locale.ROOT) + ") faz " + idade + " anos em "
                            + prox.format(DIA_MES) + ". Um bom motivo para um contato de relacionamento.",
                    null, null, null));
        }
        for (EventoVida e : c.eventosVida() == null ? List.<EventoVida>of() : c.eventosVida()) {
            long dias = ChronoUnit.DAYS.between(ref, e.data());
            if (dias < 0 || dias > props.eventoVidaDias()) continue;
            r.add(novo(c.id(), TipoAlerta.EVENTO_VIDA_PROXIMO, e.id(), Severidade.BAIXA,
                    e.descricao() + " " + quando(dias),
                    e.descricao() + " em " + e.data().format(DATA) + ". Um bom motivo para um contato de relacionamento.",
                    null, null, null));
        }
    }

    private void reserva(String cli, FluxoCaixa f, List<Alerta> r) {
        if (f.custoVidaMensal().signum() == 0 || f.reservaEmergenciaMeses() >= props.reservaMesesAlvo()) return;
        BigDecimal meta = f.custoVidaMensal().multiply(BigDecimal.valueOf(props.reservaMesesAlvo()));
        BigDecimal falta = meta.subtract(f.liquidezImediata()).max(BigDecimal.ZERO);
        String meses = Texto.decimal(f.reservaEmergenciaMeses());
        r.add(novo(cli, TipoAlerta.RESERVA_INSUFICIENTE, null, Severidade.MEDIA,
                "Reserva de emergência cobre " + meses + (meses.equals("1") ? " mês" : " meses"),
                "Liquidez de " + Texto.reais(f.liquidezImediata()) + " para um custo de vida de " + Texto.reais(f.custoVidaMensal())
                        + " por mês. A meta é " + Texto.decimal(props.reservaMesesAlvo()) + " meses: faltam " + Texto.reais(falta) + ".",
                falta, null, null));
    }

    static LocalDate proximoAniversario(LocalDate nascimento, LocalDate ref) {
        LocalDate esteAno = nascimento.withYear(ref.getYear());
        return esteAno.isBefore(ref) ? esteAno.plusYears(1) : esteAno;
    }

    private static String quando(long dias) {
        return dias == 0 ? "hoje" : dias == 1 ? "amanhã" : "em " + dias + " dias";
    }

    private static String artigo(String parentesco) {
        String p = parentesco == null ? "" : parentesco.toUpperCase(Locale.ROOT);
        if (p.endsWith("A") || p.equals("MAE") || p.equals("MÃE")) return "da";
        if (p.endsWith("O") || p.equals("PAI")) return "do";
        return "de";
    }

    private static String slug(String s) {
        return Categorizador.normalizar(s).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
    }

    private static String lista(List<String> itens) {
        if (itens.size() <= 1) return String.join("", itens);
        return String.join(", ", itens.subList(0, itens.size() - 1)) + " e " + itens.get(itens.size() - 1);
    }
}
