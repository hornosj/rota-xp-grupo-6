package br.com.rotaxp.copiloto.inteligencia;

import br.com.rotaxp.copiloto.config.EdicaoProps;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Edicao.AlteracaoCampo;
import br.com.rotaxp.copiloto.dominio.Edicao.CamposExtraidos;
import br.com.rotaxp.copiloto.dominio.Edicao.CampoCadastro;
import br.com.rotaxp.copiloto.dominio.Edicao.EdicaoCadastro;
import br.com.rotaxp.copiloto.dominio.Edicao.PropostaEdicao;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Edição do cadastro por voz, por regra (sem LLM): valida e normaliza o que o Copiloto entendeu, descarta o
 * que não mudou e monta a proposta. As mesmas regras validam o PATCH que o assessor confirma.
 */
@Component
public class RegrasCadastro {

    private static final Locale PT = Locale.forLanguageTag("pt-BR");
    private static final Set<String> PARTICULAS = Set.of("de", "da", "do", "dos", "das", "e");
    private static final Set<String> TITULOS = Set.of("dr.", "dra.", "sr.", "sra.");
    private static final Set<String> UFS = Set.of("AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
            "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO");
    private static final Pattern CIDADE_COM_UF = Pattern.compile("^(.+?)\\s*[/,-]\\s*(\\p{L}{2})$");
    private static final Pattern NUMERO = Pattern.compile("\\d{1,3}");
    private static final Pattern SO_LETRAS = Pattern.compile("[\\p{L}][\\p{L}'. -]*");

    private final EdicaoProps props;

    public RegrasCadastro(EdicaoProps props) {
        this.props = props;
    }

    public PropostaEdicao propor(Cliente atual, CamposExtraidos ditos, String transcricao) {
        List<AlteracaoCampo> alteracoes = new ArrayList<>();
        List<String> avisos = new ArrayList<>();
        comparar(CampoCadastro.NOME, ditos.nome(), atual.nome(), this::nome, alteracoes, avisos);
        comparar(CampoCadastro.IDADE, ditos.idade(), String.valueOf(atual.idade()), v -> String.valueOf(idade(v)), alteracoes, avisos);
        comparar(CampoCadastro.PROFISSAO, ditos.profissao(), atual.profissao(), this::profissao, alteracoes, avisos);
        comparar(CampoCadastro.CIDADE, ditos.cidade(), atual.cidade(), this::cidade, alteracoes, avisos);
        PerfilInvestidor perfil = presente(ditos.perfil()) ? perfil(ditos.perfil()) : null;
        if (perfil != null && perfil != atual.perfil()) {
            avisos.add("O perfil de investidor não muda por voz: para ir de " + rotulo(atual.perfil()) + " para " + rotulo(perfil)
                    + ", é preciso refazer o questionário de suitability.");
        }
        return new PropostaEdicao(atual.id(), transcricao, List.copyOf(alteracoes), List.copyOf(avisos), ditos.geradoPor());
    }

    /** PATCH: null mantém o valor atual; valor inválido é 400. */
    public Cliente aplicar(Cliente atual, EdicaoCadastro e) {
        if (e == null || (e.nome() == null && e.idade() == null && e.profissao() == null && e.cidade() == null)) {
            throw new RequisicaoInvalida("Nada para alterar: informe nome, idade, profissão ou cidade.");
        }
        return atual.comCadastro(
                e.nome() == null ? atual.nome() : nome(e.nome()),
                e.idade() == null ? atual.idade() : idade(e.idade()),
                e.profissao() == null ? atual.profissao() : profissao(e.profissao()),
                e.cidade() == null ? atual.cidade() : cidade(e.cidade()));
    }

    private static void comparar(CampoCadastro campo, String dito, String atual, UnaryOperator<String> normalizar,
                                 List<AlteracaoCampo> alteracoes, List<String> avisos) {
        if (!presente(dito)) return;
        try {
            String novo = normalizar.apply(dito);
            if (!novo.equalsIgnoreCase(atual == null ? "" : atual)) alteracoes.add(new AlteracaoCampo(campo, atual, novo));
        } catch (RequisicaoInvalida invalido) {
            avisos.add(invalido.getMessage());
        }
    }

    // ---------------------------------------------------------------- campos

    String nome(String bruto) {
        String v = limpo(bruto);
        long palavras = palavras(v).stream().filter(p -> !TITULOS.contains(p.toLowerCase(PT))).count();
        if (v.length() > props.maxCaracteresCampo() || !SO_LETRAS.matcher(v).matches() || palavras < 2) {
            throw new RequisicaoInvalida("Nome \"" + bruto.strip() + "\" inválido: use nome e sobrenome.");
        }
        return titulo(v);
    }

    int idade(String bruto) {
        Matcher m = NUMERO.matcher(bruto);
        if (!m.find()) throw new RequisicaoInvalida("Idade \"" + bruto.strip() + "\" não é um número.");
        return idade(Integer.parseInt(m.group()));
    }

    int idade(int valor) {
        if (valor < props.idadeMinima() || valor > props.idadeMaxima()) {
            throw new RequisicaoInvalida("Idade " + valor + " fora do intervalo aceito (" + props.idadeMinima() + " a "
                    + props.idadeMaxima() + " anos).");
        }
        return valor;
    }

    String profissao(String bruto) {
        String v = limpo(bruto);
        if (v.isEmpty() || v.length() > props.maxCaracteresCampo()) {
            throw new RequisicaoInvalida("Profissão \"" + bruto.strip() + "\" inválida.");
        }
        return v.substring(0, 1).toUpperCase(PT) + v.substring(1);
    }

    /** "campinas/sp", "Campinas - SP" e "Campinas, SP" viram "Campinas/SP". */
    String cidade(String bruto) {
        String v = limpo(bruto);
        if (v.isEmpty() || v.length() > props.maxCaracteresCampo() || !SO_LETRAS.matcher(v.replaceAll("[/,]", " ")).matches()) {
            throw new RequisicaoInvalida("Cidade \"" + bruto.strip() + "\" inválida.");
        }
        Matcher m = CIDADE_COM_UF.matcher(v);
        if (m.matches() && UFS.contains(m.group(2).toUpperCase(PT))) {
            return titulo(m.group(1)) + "/" + m.group(2).toUpperCase(PT);
        }
        return titulo(v);
    }

    /** Perfil citado na fala, por prefixo e sem acento; null se não reconhecer. */
    static PerfilInvestidor perfil(String bruto) {
        String v = semAcento(bruto.strip().toLowerCase(PT));
        if (v.startsWith("conserv")) return PerfilInvestidor.CONSERVADOR;
        if (v.startsWith("moder")) return PerfilInvestidor.MODERADO;
        if (v.startsWith("arroj")) return PerfilInvestidor.ARROJADO;
        if (v.startsWith("agress")) return PerfilInvestidor.AGRESSIVO;
        return null;
    }

    // ---------------------------------------------------------------- texto

    private static boolean presente(String s) {
        return s != null && !s.isBlank();
    }

    /** Sem aspas, espaços repetidos nem pontuação no fim. */
    private static String limpo(String s) {
        return s.strip().replaceAll("^[\"'“”]+|[\"'“”]+$", "").replaceAll("\\s+", " ").replaceAll("[\\s.,;:!?]+$", "").strip();
    }

    private static List<String> palavras(String s) {
        return s.isEmpty() ? List.of() : List.of(s.split(" "));
    }

    /** "rio de janeiro" → "Rio de Janeiro"; "PATRÍCIA" → "Patrícia"; "McDonald" fica como está. */
    private static String titulo(String s) {
        List<String> r = new ArrayList<>();
        for (String p : palavras(limpo(s))) {
            String min = p.toLowerCase(PT);
            if (!r.isEmpty() && PARTICULAS.contains(min)) r.add(min);
            else if (p.equals(p.toUpperCase(PT)) || p.equals(min)) r.add(min.substring(0, 1).toUpperCase(PT) + min.substring(1));
            else r.add(p.substring(0, 1).toUpperCase(PT) + p.substring(1));
        }
        return String.join(" ", r);
    }

    private static String rotulo(PerfilInvestidor p) {
        String n = p.name().toLowerCase(PT);
        return n.substring(0, 1).toUpperCase(PT) + n.substring(1);
    }

    private static String semAcento(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}
