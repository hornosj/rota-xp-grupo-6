package br.com.rotaxp.copiloto.consolidacao;

import br.com.rotaxp.copiloto.analise.AlertaService;
import br.com.rotaxp.copiloto.analise.AnaliseFgc;
import br.com.rotaxp.copiloto.analise.AnaliseFluxo;
import br.com.rotaxp.copiloto.analise.FgcService;
import br.com.rotaxp.copiloto.analise.FluxoCaixaService;
import br.com.rotaxp.copiloto.analise.PrincipalidadeService;
import br.com.rotaxp.copiloto.analise.PrioridadeService;
import br.com.rotaxp.copiloto.analise.ResultadoPrioridade;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.demo.RegistroAlertas;
import br.com.rotaxp.copiloto.dominio.AcaoSugerida;
import br.com.rotaxp.copiloto.dominio.Alerta;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Cobertura;
import br.com.rotaxp.copiloto.dominio.Principalidade;
import br.com.rotaxp.copiloto.dominio.Visao360;
import br.com.rotaxp.copiloto.inteligencia.AcaoSugeridaService;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoAlterado;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoService;
import br.com.rotaxp.copiloto.openfinance.DadosVisiveis;
import br.com.rotaxp.copiloto.openfinance.OpenFinanceGateway;
import br.com.rotaxp.copiloto.openfinance.Repositorio;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Junta consolidação, análise e ações. Tudo é derivado do estado atual dos consentimentos;
 * o cache por cliente é invalidado pelo evento ConsentimentoAlterado.
 */
@Service
public class Visao360Assembler {

    private final OpenFinanceGateway gateway;
    private final Repositorio repo;
    private final DataReferencia dataReferencia;
    private final RegistroAlertas registro;
    private final FluxoCaixaService fluxoService;
    private final PrincipalidadeService principalidadeService;
    private final FgcService fgcService;
    private final AlertaService alertaService;
    private final PrioridadeService prioridadeService;
    private final PatrimonioService patrimonioService;
    private final CoberturaService coberturaService;
    private final AcaoSugeridaService acaoService;
    private final ConsentimentoService consentimentoService;
    private final Map<String, AnaliseCliente.Base> cache = new ConcurrentHashMap<>();

    public Visao360Assembler(OpenFinanceGateway gateway, Repositorio repo, DataReferencia dataReferencia, RegistroAlertas registro,
                             FluxoCaixaService fluxoService, PrincipalidadeService principalidadeService, FgcService fgcService,
                             AlertaService alertaService, PrioridadeService prioridadeService, PatrimonioService patrimonioService,
                             CoberturaService coberturaService, AcaoSugeridaService acaoService,
                             ConsentimentoService consentimentoService) {
        this.gateway = gateway;
        this.repo = repo;
        this.dataReferencia = dataReferencia;
        this.registro = registro;
        this.fluxoService = fluxoService;
        this.principalidadeService = principalidadeService;
        this.fgcService = fgcService;
        this.alertaService = alertaService;
        this.prioridadeService = prioridadeService;
        this.patrimonioService = patrimonioService;
        this.coberturaService = coberturaService;
        this.acaoService = acaoService;
        this.consentimentoService = consentimentoService;
    }

    public AnaliseCliente analisar(String clienteId) {
        AnaliseCliente.Base base = cache.computeIfAbsent(clienteId, this::calcular);
        return new AnaliseCliente(base, registro.marcar(base.alertas()));
    }

    private AnaliseCliente.Base calcular(String clienteId) {
        LocalDate ref = dataReferencia.hoje();
        DadosVisiveis d = gateway.dados(clienteId);
        AnaliseFluxo fluxo = fluxoService.calcular(d, ref);
        AnaliseFgc fgc = fgcService.calcular(d);
        Principalidade principalidade = principalidadeService.calcular(d, ref);
        Cobertura cobertura = coberturaService.calcular(d);
        List<Alerta> alertas = alertaService.detectar(d, ref, fluxo, fgc);
        ResultadoPrioridade prioridade = prioridadeService.calcular(alertas, principalidade.posicaoXp());
        List<AcaoSugerida> acoes = acaoService.gerar(d, alertas, cobertura, fluxo.fluxo(), prioridade);
        return new AnaliseCliente.Base(d, fluxo, fgc, principalidade, cobertura, patrimonioService.calcular(d),
                alertas, prioridade, acoes);
    }

    public Visao360 visao360(String clienteId) {
        AnaliseCliente a = analisar(clienteId);
        AnaliseCliente.Base b = a.base();
        return new Visao360(b.dados().cliente(), dataReferencia.agora(), b.cobertura(), b.patrimonio(), b.principalidade(),
                b.fluxo().fluxo(), a.alertas(), b.acoes(), consentimentoService.listar(clienteId));
    }

    public List<Cliente> clientes() {
        return repo.clientes();
    }

    @EventListener
    public void aoAlterarConsentimento(ConsentimentoAlterado evento) {
        cache.remove(evento.clienteId());
    }

    public void limpar() {
        cache.clear();
    }

    /** Analisa todos os clientes registrando os alertas atuais como "antigos" (startup e reset). */
    public void registrarLinhaDeBase() {
        registro.iniciarLinhaDeBase();
        try {
            repo.clientes().forEach(c -> analisar(c.id()));
        } finally {
            registro.encerrarLinhaDeBase();
        }
    }
}
