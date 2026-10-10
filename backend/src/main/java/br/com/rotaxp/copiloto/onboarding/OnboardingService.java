package br.com.rotaxp.copiloto.onboarding;

import br.com.rotaxp.copiloto.config.DemoProps;
import br.com.rotaxp.copiloto.config.OnboardingProps;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Cliente.Dependente;
import br.com.rotaxp.copiloto.dominio.Cliente.InstituicaoDeclarada;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemEvento;
import br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConsentimento;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.Excecoes.Conflito;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.Onboarding.CadastroInvestidor;
import br.com.rotaxp.copiloto.dominio.Onboarding.ConviteOnboarding;
import br.com.rotaxp.copiloto.dominio.Onboarding.EventoPlanejado;
import br.com.rotaxp.copiloto.dominio.Onboarding.FormularioOnboarding;
import br.com.rotaxp.copiloto.dominio.Onboarding.InstituicaoDisponivel;
import br.com.rotaxp.copiloto.dominio.Onboarding.InstituicaoInformada;
import br.com.rotaxp.copiloto.dominio.Onboarding.ResultadoOnboarding;
import br.com.rotaxp.copiloto.dominio.Onboarding.StatusConvite;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoService;
import br.com.rotaxp.copiloto.openfinance.Repositorio;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Convites de onboarding (em memória, zerados no reset da demo) e o cadastro do investidor.
 * Concluir o cadastro cria um Cliente de verdade no repositório: XP com consentimento INTERNO e
 * as demais instituições declaradas como PENDENTE (ou ATIVO, se o investidor autorizar na hora).
 * A partir daí ele entra na fila e na 360 como qualquer outro cliente.
 */
@Service
public class OnboardingService {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Set<String> UFS = Set.of("AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT",
            "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO");
    private static final String ALFABETO_TOKEN = "abcdefghijkmnpqrstuvwxyz23456789";
    /** Ids de clientes do onboarding começam aqui, longe dos da seed. */
    private static final int PRIMEIRO_CLIENTE = 201;

    private final Repositorio repo;
    private final ConsentimentoService consentimentos;
    private final Suitability suitability;
    private final DataReferencia dataReferencia;
    private final OnboardingProps props;
    private final DemoProps demo;
    private final SecureRandom aleatorio = new SecureRandom();

    private final Map<String, ConviteOnboarding> convitesPorToken = new LinkedHashMap<>();
    private int sequenciaConvite;

    public OnboardingService(Repositorio repo, ConsentimentoService consentimentos, Suitability suitability,
                             DataReferencia dataReferencia, OnboardingProps props, DemoProps demo) {
        this.repo = repo;
        this.consentimentos = consentimentos;
        this.suitability = suitability;
        this.dataReferencia = dataReferencia;
        this.props = props;
        this.demo = demo;
    }

    // ------------------------------------------------------------------ assessor

    public synchronized ConviteOnboarding criarConvite(String nome) {
        String limpo = texto(nome);
        if (limpo.length() < 2) throw new RequisicaoInvalida("Informe o nome do investidor");
        String token = novoToken();
        ConviteOnboarding c = new ConviteOnboarding(String.format("conv-%03d", ++sequenciaConvite), token,
                props.caminhoLink() + token, limpo, demo.assessorId(), StatusConvite.PENDENTE,
                dataReferencia.agora(), null, null, null, null);
        convitesPorToken.put(token, c);
        return c;
    }

    /** Mais recentes primeiro. */
    public synchronized List<ConviteOnboarding> convites() {
        List<ConviteOnboarding> lista = new ArrayList<>(convitesPorToken.values());
        lista.sort(Comparator.comparing(ConviteOnboarding::id).reversed());
        return lista;
    }

    public synchronized void limpar() {
        convitesPorToken.clear();
        sequenciaConvite = 0;
    }

    // ------------------------------------------------------------------ investidor

    /** Abrir o link marca o convite como ABERTO (o assessor vê que o investidor começou). */
    public synchronized FormularioOnboarding formulario(String token) {
        ConviteOnboarding c = convite(token);
        if (c.status() == StatusConvite.PENDENTE) {
            c = c.aberto(dataReferencia.agora());
            convitesPorToken.put(token, c);
        }
        List<InstituicaoDisponivel> instituicoes = repo.instituicoes().values().stream()
                .filter(i -> !i.ehXp())
                .map(i -> new InstituicaoDisponivel(i.id(), i.nome()))
                .toList();
        return new FormularioOnboarding(c, instituicoes, suitability.questionario(), List.of(ProdutoDeclarado.values()));
    }

    public synchronized ResultadoOnboarding concluir(String token, CadastroInvestidor cad) {
        ConviteOnboarding convite = convite(token);
        if (convite.status() == StatusConvite.CONCLUIDO) throw new Conflito("Este cadastro já foi concluído");
        if (cad == null) throw new RequisicaoInvalida("Cadastro vazio");
        LocalDate hoje = dataReferencia.hoje();

        // 1. Valida tudo antes de mexer no repositório.
        String nome = texto(cad.nome());
        if (nome.split("\\s+").length < 2) throw new RequisicaoInvalida("Informe nome e sobrenome");
        String cpf = cpf(cad.cpf());
        if (repo.clientes().stream().anyMatch(c -> cpf.equals(c.cpf()))) throw new Conflito("Já existe um cliente com este CPF");
        if (cad.dataNascimento() == null) throw new RequisicaoInvalida("Informe a data de nascimento");
        int idade = Period.between(cad.dataNascimento(), hoje).getYears();
        if (idade < props.idadeMinima()) throw new RequisicaoInvalida("O investidor precisa ter pelo menos " + props.idadeMinima() + " anos");
        if (idade > 120) throw new RequisicaoInvalida("Data de nascimento inválida");
        if (!EMAIL.matcher(texto(cad.email())).matches()) throw new RequisicaoInvalida("E-mail inválido");
        String celular = digitos(cad.celular());
        if (celular.length() < 10 || celular.length() > 11) throw new RequisicaoInvalida("Celular inválido: use DDD + número");
        String profissao = obrigatorio(cad.profissao(), "Informe a profissão");
        String cidade = obrigatorio(cad.cidade(), "Informe a cidade");
        String uf = texto(cad.uf()).toUpperCase();
        if (!UFS.contains(uf)) throw new RequisicaoInvalida("UF inválida");
        if (!cad.aceiteTermos()) throw new RequisicaoInvalida("É preciso aceitar os termos de uso e a política de privacidade");

        List<Dependente> dependentes = dependentes(cad.dependentes(), hoje);
        List<EventoPlanejado> eventos = eventos(cad.eventosVida(), hoje);
        Suitability.Resultado perfil = suitability.avaliar(cad.respostasSuitability());
        List<InstituicaoInformada> instituicoes = instituicoes(cad.instituicoes());

        // 2. Cria o cliente e os consentimentos.
        String clienteId = novoClienteId();
        String sufixo = clienteId.substring("cli-".length());
        List<InstituicaoDeclarada> declaradas = new ArrayList<>();
        declaradas.add(new InstituicaoDeclarada(instituicaoXp().id(), List.of(ProdutoDeclarado.INVESTIMENTOS)));
        instituicoes.forEach(i -> declaradas.add(new InstituicaoDeclarada(i.instituicaoId(), i.produtos())));
        List<EventoVida> eventosVida = new ArrayList<>();
        for (int k = 0; k < eventos.size(); k++) {
            EventoPlanejado e = eventos.get(k);
            eventosVida.add(new EventoVida("ev-" + sufixo + "-" + (k + 1), e.tipo(), e.descricao(), e.data(), OrigemEvento.CADASTRO));
        }
        repo.adicionarCliente(new Cliente(clienteId, nome, cpf, idade, profissao, cidade + "/" + uf, perfil.perfil(),
                convite.assessorId(), false, declaradas, dependentes, eventosVida));

        repo.salvar(new Consentimento("con-" + sufixo + "-xp", clienteId, instituicaoXp().id(), TipoConsentimento.INTERNO,
                StatusConsentimento.ATIVO, Arrays.asList(Escopo.values()), hoje, null));
        for (InstituicaoInformada i : instituicoes) {
            List<Escopo> escopos = i.produtos().stream().map(OnboardingService::escopo).distinct().toList();
            repo.salvar(new Consentimento("con-" + sufixo + "-" + i.instituicaoId().replaceFirst("^inst-", ""), clienteId,
                    i.instituicaoId(), TipoConsentimento.OPEN_FINANCE, StatusConsentimento.PENDENTE, escopos, null, null));
            if (i.compartilharAgora()) consentimentos.conceder(clienteId, i.instituicaoId());
        }

        ConviteOnboarding concluido = convite.concluido(dataReferencia.agora(), clienteId, perfil.perfil());
        convitesPorToken.put(token, concluido);
        return new ResultadoOnboarding(concluido, clienteId, perfil.perfil(), perfil.pontos(), consentimentos.listar(clienteId));
    }

    // ------------------------------------------------------------------ auxiliares

    private ConviteOnboarding convite(String token) {
        ConviteOnboarding c = convitesPorToken.get(token);
        if (c == null) throw new NaoEncontrado("Convite " + token + " não encontrado");
        return c;
    }

    private String novoToken() {
        String token;
        do {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 12; i++) sb.append(ALFABETO_TOKEN.charAt(aleatorio.nextInt(ALFABETO_TOKEN.length())));
            token = sb.toString();
        } while (convitesPorToken.containsKey(token));
        return token;
    }

    private String novoClienteId() {
        Set<String> existentes = new HashSet<>();
        repo.clientes().forEach(c -> existentes.add(c.id()));
        int n = PRIMEIRO_CLIENTE;
        while (existentes.contains("cli-" + n)) n++;
        return "cli-" + n;
    }

    private Instituicao instituicaoXp() {
        return repo.instituicoes().values().stream().filter(Instituicao::ehXp).findFirst()
                .orElseThrow(() -> new IllegalStateException("Seed sem instituição XP"));
    }

    private List<Dependente> dependentes(List<Dependente> lista, LocalDate hoje) {
        List<Dependente> r = new ArrayList<>();
        for (Dependente d : lista == null ? List.<Dependente>of() : lista) {
            String nome = obrigatorio(d.nome(), "Informe o nome do dependente");
            String parentesco = obrigatorio(d.parentesco(), "Informe o parentesco de " + nome).toUpperCase();
            if (d.dataNascimento() == null || d.dataNascimento().isAfter(hoje)) {
                throw new RequisicaoInvalida("Data de nascimento inválida para " + nome);
            }
            r.add(new Dependente(nome, parentesco, d.dataNascimento()));
        }
        return r;
    }

    private static List<EventoPlanejado> eventos(List<EventoPlanejado> lista, LocalDate hoje) {
        List<EventoPlanejado> r = new ArrayList<>();
        for (EventoPlanejado e : lista == null ? List.<EventoPlanejado>of() : lista) {
            if (e.tipo() == null) throw new RequisicaoInvalida("Informe o tipo do acontecimento");
            String descricao = obrigatorio(e.descricao(), "Descreva o acontecimento");
            if (e.data() == null || e.data().isBefore(hoje)) throw new RequisicaoInvalida("A data de \"" + descricao + "\" precisa ser futura");
            r.add(new EventoPlanejado(e.tipo(), descricao, e.data()));
        }
        return r;
    }

    private List<InstituicaoInformada> instituicoes(List<InstituicaoInformada> lista) {
        List<InstituicaoInformada> r = new ArrayList<>();
        Set<String> vistas = new HashSet<>();
        for (InstituicaoInformada i : lista == null ? List.<InstituicaoInformada>of() : lista) {
            Instituicao inst = repo.instituicao(i.instituicaoId())
                    .orElseThrow(() -> new RequisicaoInvalida("Instituição desconhecida: " + i.instituicaoId()));
            if (inst.ehXp()) throw new RequisicaoInvalida("A XP já entra automaticamente no seu cadastro");
            if (!vistas.add(inst.id())) throw new RequisicaoInvalida(inst.nome() + " informado mais de uma vez");
            if (i.produtos() == null || i.produtos().isEmpty()) {
                throw new RequisicaoInvalida("Escolha ao menos um produto que você tem no " + inst.nome());
            }
            r.add(new InstituicaoInformada(inst.id(), i.produtos().stream().distinct().toList(), i.compartilharAgora()));
        }
        return r;
    }

    private static Escopo escopo(ProdutoDeclarado p) {
        return switch (p) {
            case CONTA -> Escopo.CONTAS;
            case CARTAO -> Escopo.CARTOES;
            case CREDITO -> Escopo.CREDITO;
            case INVESTIMENTOS -> Escopo.INVESTIMENTOS;
        };
    }

    /** Só confere o formato (11 dígitos): os CPFs da demo são fictícios. */
    private static String cpf(String bruto) {
        String d = digitos(bruto);
        if (d.length() != 11) throw new RequisicaoInvalida("CPF inválido: informe os 11 dígitos");
        return d.substring(0, 3) + "." + d.substring(3, 6) + "." + d.substring(6, 9) + "-" + d.substring(9);
    }

    private static String obrigatorio(String valor, String mensagem) {
        String t = texto(valor);
        if (t.isEmpty()) throw new RequisicaoInvalida(mensagem);
        return t;
    }

    private static String texto(String valor) {
        return valor == null ? "" : valor.trim().replaceAll("\\s+", " ");
    }

    private static String digitos(String valor) {
        return valor == null ? "" : valor.replaceAll("\\D", "");
    }
}
