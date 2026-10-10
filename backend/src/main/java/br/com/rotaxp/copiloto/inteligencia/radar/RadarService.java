package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.config.DemoProps;
import br.com.rotaxp.copiloto.config.RadarProps;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Radar.Classificacao;
import br.com.rotaxp.copiloto.dominio.Radar.ImpactoNoticia;
import br.com.rotaxp.copiloto.dominio.Radar.Noticia;
import br.com.rotaxp.copiloto.dominio.Radar.NoticiaClassificada;
import br.com.rotaxp.copiloto.dominio.Radar.ResultadoProcessamento;
import br.com.rotaxp.copiloto.openfinance.OpenFinanceGateway;
import br.com.rotaxp.copiloto.openfinance.Repositorio;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

/**
 * Pipeline do radar em duas cadências: coletar (frequente, sem LLM) guarda pendentes; processar classifica o
 * que acumulou (em lotes) → guarda → publica NoticiasClassificadas. O cruzamento com as carteiras é feito na leitura,
 * então segue os consentimentos atuais.
 */
@Service
public class RadarService {

    private final List<FonteNoticias> fontes;
    private final ClassificadorRegras regras;
    private final ClassificadorLlm llm;
    private final CruzamentoCarteira cruzamento;
    private final OpenFinanceGateway gateway;
    private final Repositorio repo;
    private final DataReferencia dataReferencia;
    private final DemoProps demo;
    private final RadarProps props;
    private final ApplicationEventPublisher eventos;
    private final Map<String, NoticiaClassificada> processadas = new ConcurrentHashMap<>();
    private final Map<String, NoticiaColetada> pendentes = new LinkedHashMap<>();

    public RadarService(List<FonteNoticias> fontes, ClassificadorRegras regras, ClassificadorLlm llm, CruzamentoCarteira cruzamento,
                        OpenFinanceGateway gateway, Repositorio repo, DataReferencia dataReferencia, DemoProps demo,
                        RadarProps props, ApplicationEventPublisher eventos) {
        this.fontes = fontes;
        this.regras = regras;
        this.llm = llm;
        this.cruzamento = cruzamento;
        this.gateway = gateway;
        this.repo = repo;
        this.dataReferencia = dataReferencia;
        this.demo = demo;
        this.props = props;
        this.eventos = eventos;
    }

    /** Busca as fontes e guarda como pendente o que ainda não foi visto. Sem LLM. Devolve quantas entraram. */
    public synchronized int coletar() {
        return coletarContando()[1];
    }

    public int pendentes() {
        return pendentes.size();
    }

    /** {coletadas nas fontes, novas pendentes} */
    private int[] coletarContando() {
        int coletadas = 0, novas = 0;
        for (FonteNoticias f : fontes) {
            for (NoticiaColetada n : f.coletar()) {
                coletadas++;
                String id = n.noticia().id();
                if (!processadas.containsKey(id) && pendentes.putIfAbsent(id, n) == null) novas++;
            }
        }
        return new int[] {coletadas, novas};
    }

    /** Coleta e classifica tudo o que estiver pendente (em lotes, no modo llm). */
    public synchronized ResultadoProcessamento processar() {
        int coletadas = coletarContando()[0];
        Map<String, NoticiaColetada> novas = new LinkedHashMap<>(pendentes);

        int porLlm = 0, lotes = 0;
        Map<String, Classificacao> classificacoes = new LinkedHashMap<>();
        List<NoticiaColetada> semReferencia = new ArrayList<>();
        for (NoticiaColetada n : novas.values()) {
            if ("referencia".equals(props.classificacao()) && n.referencia() != null) classificacoes.put(n.noticia().id(), n.referencia());
            else semReferencia.add(n);
        }
        List<Noticia> aClassificar = semReferencia.stream().map(NoticiaColetada::noticia).toList();
        if ("llm".equals(props.classificacao()) && props.preFiltro()) {
            // sem nada financeiro pelas regras: fica com a classificação por regra e não gasta LLM
            List<Noticia> financeiras = new ArrayList<>();
            for (Noticia n : aClassificar) {
                Classificacao c = regras.classificar(n, repo.emissores());
                if (c.emissores().isEmpty() && c.indexadores().isEmpty() && c.produtos().isEmpty()) classificacoes.put(n.id(), c);
                else financeiras.add(n);
            }
            aClassificar = financeiras;
        }
        if ("llm".equals(props.classificacao()) && !aClassificar.isEmpty()) {
            ClassificadorLlm.Resultado r = llm.classificar(aClassificar, repo.emissores());
            classificacoes.putAll(r.classificacoes());
            porLlm = r.porLlm();
            lotes = r.lotes();
        } else {
            aClassificar.forEach(n -> classificacoes.put(n.id(), regras.classificar(n, repo.emissores())));
        }

        novas.values().forEach(n -> processadas.put(n.noticia().id(), new NoticiaClassificada(n.noticia(), classificacoes.get(n.noticia().id()))));
        novas.keySet().forEach(pendentes::remove);
        int porRegra = (int) classificacoes.values().stream()
                .filter(c -> c.origem() == br.com.rotaxp.copiloto.dominio.Radar.OrigemClassificacao.REGRAS).count();
        if (!novas.isEmpty()) eventos.publishEvent(new NoticiasClassificadas(List.copyOf(novas.keySet())));
        OffsetDateTime agora = dataReferencia.agora();
        return new ResultadoProcessamento(coletadas, novas.size(), porLlm, porRegra, lotes, agora);
    }

    /** Notícias classificadas, mais recentes primeiro. */
    public List<NoticiaClassificada> noticias() {
        return processadas.values().stream()
                .sorted(Comparator.comparing((NoticiaClassificada n) -> n.noticia().publicadaEm(),
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public List<ImpactoNoticia> impactosDoCliente(String clienteId) {
        return cruzamento.impactos(gateway.dados(clienteId), noticias());
    }

    /** Impactos de todos os clientes do assessor, por pontos, com no máximo N clientes por notícia. */
    public List<ImpactoNoticia> impactosDaCarteira(int limite) {
        List<ImpactoNoticia> todos = new ArrayList<>();
        for (Cliente c : repo.clientes()) {
            if (demo.assessorId().equals(c.assessorId())) todos.addAll(impactosDoCliente(c.id()));
        }
        todos.sort(Comparator.comparingDouble(ImpactoNoticia::pontos).reversed());
        Map<String, Integer> porNoticia = new LinkedHashMap<>();
        List<ImpactoNoticia> r = new ArrayList<>();
        for (ImpactoNoticia i : todos) {
            if (r.size() >= limite) break;
            if (porNoticia.merge(i.noticiaId(), 1, Integer::sum) <= props.maxClientesPorNoticia()) r.add(i);
        }
        return r;
    }

    public NoticiaClassificada noticia(String id) {
        NoticiaClassificada n = processadas.get(id);
        if (n == null) throw new br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado("Notícia " + id + " não encontrada");
        return n;
    }
}
