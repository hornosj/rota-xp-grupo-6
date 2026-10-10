package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.analise.Texto;
import br.com.rotaxp.copiloto.consolidacao.AnaliseCliente;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.dominio.AcaoSugerida;
import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Cliente.Dependente;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.dominio.FluxoCaixa;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.Patrimonio;
import br.com.rotaxp.copiloto.dominio.RecomendacaoProduto;
import br.com.rotaxp.copiloto.inteligencia.AnotacoesService;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

/** Monta o contexto do LLM a partir da análise já calculada (sem LLM). */
@Component
public class ContextoClienteFactory {

    static final int JANELA_EVENTOS_DIAS = 15;
    private static final String PREFIXO_CONVITE = "convidar_conexao-";

    private final Visao360Assembler assembler;
    private final DataReferencia dataReferencia;
    private final br.com.rotaxp.copiloto.openfinance.ConviteService convites;   // null nos testes sem convite
    private final AnotacoesService anotacoes;                                     // null nos testes sem notas

    public ContextoClienteFactory(Visao360Assembler assembler, DataReferencia dataReferencia) {
        this(assembler, dataReferencia, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ContextoClienteFactory(Visao360Assembler assembler, DataReferencia dataReferencia,
                                  br.com.rotaxp.copiloto.openfinance.ConviteService convites, AnotacoesService anotacoes) {
        this.assembler = assembler;
        this.dataReferencia = dataReferencia;
        this.convites = convites;
        this.anotacoes = anotacoes;
    }

    public LocalDate hoje() {
        return dataReferencia.hoje();
    }

    public ContextoCliente paraCliente(String clienteId) {
        return montar(assembler.analisar(clienteId), null);
    }

    public ContextoCliente paraAcao(String clienteId, String acaoId) {
        AnaliseCliente a = assembler.analisar(clienteId);
        AcaoSugerida acao = a.acoes().stream().filter(x -> x.id().equals(acaoId)).findFirst()
                .orElseThrow(() -> new NaoEncontrado("Ação " + acaoId + " não encontrada para " + clienteId));
        return montar(a, acaoContexto(a, acao, convites));
    }

    private ContextoCliente montar(AnaliseCliente a, ContextoCliente.AcaoContexto acao) {
        Cliente c = a.dados().cliente();
        Patrimonio p = a.base().patrimonio();
        FluxoCaixa f = a.base().fluxo().fluxo();
        List<RecomendacaoProduto> recomendacoes = anotacoes == null ? List.of() : anotacoes.contexto(c.id()).recomendacoes();
        return new ContextoCliente(c.id(), c.primeiroNome(), c.perfil(), c.profissao(),
                a.principalidade().explicacao(),
                Texto.reais(p.totalVisivel()) + " visível, " + Texto.reais(p.naXp()) + " na XP",
                "Renda de " + Texto.reais(f.rendaMensal()) + "/mês, custo de vida de " + Texto.reais(f.custoVidaMensal()) + "/mês",
                a.alertas().stream().map(x -> x.titulo() + ": " + x.explicacao()).toList(),
                eventos(c, dataReferencia.hoje()),
                a.acoes().stream().map(AcaoSugerida::titulo).toList(),
                acao,
                anotacoes == null ? List.of() : anotacoes.textosRecentes(c.id()),
                recomendacoes.stream().filter(r -> !r.sensivel()).map(r -> r.produto() + " (" + r.motivo() + ")").toList(),
                recomendacoes.stream().filter(RecomendacaoProduto::sensivel).map(RecomendacaoProduto::motivo).toList());
    }

    private static ContextoCliente.AcaoContexto acaoContexto(AnaliseCliente a, AcaoSugerida acao,
                                                             br.com.rotaxp.copiloto.openfinance.ConviteService convites) {
        Alerta alerta = a.alertas().stream().filter(x -> acao.alertaIds().contains(x.id())).findFirst().orElse(null);
        String instituicaoId = alerta != null ? alerta.instituicaoId()
                : acao.id().contains(PREFIXO_CONVITE) ? acao.id().substring(acao.id().indexOf(PREFIXO_CONVITE) + PREFIXO_CONVITE.length())
                : null;
        Instituicao inst = instituicaoId == null ? null : a.dados().instituicao(instituicaoId);
        String link = null;
        if (convites != null && acao.tipo() == br.com.rotaxp.copiloto.dominio.Enums.TipoAcao.CONVIDAR_CONEXAO && instituicaoId != null) {
            try {
                link = convites.convidar(a.dados().cliente().id(), instituicaoId).link();   // cria se não existir
            } catch (br.com.rotaxp.copiloto.dominio.Excecoes.Conflito jaConectada) {
                link = null;
            }
        }
        return new ContextoCliente.AcaoContexto(acao.id(), acao.tipo(), acao.titulo(), acao.motivo(), acao.impactoEstimado(),
                alerta == null ? null : alerta.valor(),
                alerta == null || alerta.valor() == null ? null : Texto.reais(alerta.valor()),
                inst == null ? null : inst.nome(), link);
    }

    static List<ContextoCliente.EventoProximo> eventos(Cliente c, LocalDate ref) {
        List<ContextoCliente.EventoProximo> r = new ArrayList<>();
        for (Dependente d : c.dependentes() == null ? List.<Dependente>of() : c.dependentes()) {
            LocalDate prox = d.dataNascimento().withYear(ref.getYear());
            if (prox.isBefore(ref)) prox = prox.plusYears(1);
            long dias = ChronoUnit.DAYS.between(ref, prox);
            if (dias <= JANELA_EVENTOS_DIAS) r.add(new ContextoCliente.EventoProximo(Texto.aniversario(d.nome(), d.parentesco()), prox, dias));
        }
        for (EventoVida e : c.eventosVida() == null ? List.<EventoVida>of() : c.eventosVida()) {
            long dias = ChronoUnit.DAYS.between(ref, e.data());
            if (dias >= 0 && dias <= JANELA_EVENTOS_DIAS) r.add(new ContextoCliente.EventoProximo(e.descricao(), e.data(), dias));
        }
        r.sort(Comparator.comparingLong(ContextoCliente.EventoProximo::emDias));
        return r;
    }
}
