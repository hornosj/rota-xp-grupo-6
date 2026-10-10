package br.com.rotaxp.copiloto.openfinance;

import br.com.rotaxp.copiloto.config.ConviteProps;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Convite;
import br.com.rotaxp.copiloto.dominio.Convite.StatusConvite;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Excecoes.Conflito;
import br.com.rotaxp.copiloto.dominio.Excecoes.Expirado;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Convites de consentimento Open Finance (PLAN §7.10). Em memória; apagados no reset.
 * O token é determinístico (cliente, instituição e sequência), para a demo ser reprodutível.
 */
@Service
public class ConviteService {

    private final Repositorio repo;
    private final ConsentimentoService consentimentos;
    private final DataReferencia dataReferencia;
    private final ConviteProps props;
    private final Map<String, Convite> porToken = new LinkedHashMap<>();
    private final Map<String, Integer> sequencia = new LinkedHashMap<>();
    /** Instante real de criação: a validade mede tempo decorrido (a data da demo é fixa). */
    private final Map<String, java.time.Instant> criadoNoInstante = new LinkedHashMap<>();

    public ConviteService(Repositorio repo, ConsentimentoService consentimentos, DataReferencia dataReferencia, ConviteProps props) {
        this.repo = repo;
        this.consentimentos = consentimentos;
        this.dataReferencia = dataReferencia;
        this.props = props;
    }

    /** Cria o convite ou devolve o PENDENTE que já existe. 409 se a instituição já está conectada. */
    public synchronized Convite convidar(String clienteId, String instituicaoId) {
        Cliente cliente = repo.cliente(clienteId);
        Instituicao inst = repo.instituicao(instituicaoId)
                .orElseThrow(() -> new NaoEncontrado("Instituição " + instituicaoId + " não encontrada"));
        Consentimento atual = repo.consentimentos(clienteId).stream()
                .filter(c -> c.instituicaoId().equals(instituicaoId)).findFirst().orElse(null);
        if (atual != null && atual.ativo()) throw new Conflito(inst.nome() + " já está conectado");

        for (Convite c : listar(clienteId)) {
            if (c.instituicaoId().equals(instituicaoId) && c.status() == StatusConvite.PENDENTE) return c;
        }

        List<Escopo> escopos = atual != null && atual.escopos() != null && !atual.escopos().isEmpty()
                ? List.copyOf(atual.escopos())
                : cliente.instituicoesDeclaradas().stream().filter(d -> d.instituicaoId().equals(instituicaoId))
                        .flatMap(d -> d.produtos().stream()).map(ConsentimentoService::escopo).distinct().toList();
        int seq = sequencia.merge(clienteId + "|" + instituicaoId, 1, Integer::sum);
        String token = token(clienteId + "|" + instituicaoId + "|" + seq);
        OffsetDateTime agora = dataReferencia.agora();
        Convite c = new Convite(token, clienteId, instituicaoId, inst.nome(), escopos, props.prazoMeses(),
                props.linkBase() + token, StatusConvite.PENDENTE, agora, agora.plusHours(props.validadeHoras()));
        porToken.put(token, c);
        criadoNoInstante.put(token, dataReferencia.instante());
        return c;
    }

    public synchronized List<Convite> listar(String clienteId) {
        repo.cliente(clienteId);
        return porToken.values().stream().filter(c -> c.clienteId().equals(clienteId)).map(this::atualizado).toList();
    }

    public synchronized Convite buscar(String token) {
        Convite c = porToken.get(token);
        if (c == null) throw new NaoEncontrado("Convite " + token + " não encontrado");
        return atualizado(c);
    }

    /** Confirma no "ambiente do banco de origem": concede o consentimento. 409 se já confirmado; 410 se expirado. */
    public synchronized Convite confirmar(String token) {
        Convite c = buscar(token);
        if (c.status() == StatusConvite.CONFIRMADO) throw new Conflito("Convite já confirmado");
        if (c.status() == StatusConvite.EXPIRADO) throw new Expirado("Convite expirado em " + c.expiraEm());
        try {
            consentimentos.conceder(c.clienteId(), c.instituicaoId());
        } catch (Conflito jaAtivo) {
            // conectado por outro caminho: o convite fica confirmado do mesmo jeito
        }
        Convite confirmado = c.com(StatusConvite.CONFIRMADO);
        porToken.put(token, confirmado);
        return confirmado;
    }

    public synchronized void limpar() {
        porToken.clear();
        sequencia.clear();
        criadoNoInstante.clear();
    }

    private Convite atualizado(Convite c) {
        if (c.status() == StatusConvite.PENDENTE && java.time.Duration.between(criadoNoInstante.get(c.token()),
                dataReferencia.instante()).compareTo(java.time.Duration.ofHours(props.validadeHoras())) > 0) {
            Convite expirado = c.com(StatusConvite.EXPIRADO);
            porToken.put(c.token(), expirado);
            return expirado;
        }
        return c;
    }

    private static String token(String chave) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(chave.getBytes(StandardCharsets.UTF_8));
            return "cv-" + HexFormat.of().formatHex(h).substring(0, 10);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
