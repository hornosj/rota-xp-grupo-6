package br.com.rotaxp.copiloto.inteligencia;

import br.com.rotaxp.copiloto.agentes.Copiloto;
import br.com.rotaxp.copiloto.agentes.Transcritor;
import br.com.rotaxp.copiloto.config.EdicaoProps;
import br.com.rotaxp.copiloto.config.WhisperProps;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Edicao.EdicaoCadastro;
import br.com.rotaxp.copiloto.dominio.Edicao.PropostaEdicao;
import br.com.rotaxp.copiloto.dominio.Edicao.Transcricao;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import br.com.rotaxp.copiloto.dominio.Visao360;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoAlterado;
import br.com.rotaxp.copiloto.openfinance.Repositorio;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Edição do cadastro por voz: áudio → texto (Whisper) → proposta (Copiloto + regras) → o assessor confirma
 * → grava e recalcula a 360. Nada é gravado sem a confirmação do assessor.
 */
@Service
public class EdicaoCadastroService {

    /** Formatos aceitos pela API do Whisper (ela deduz o formato pela extensão do arquivo). */
    private static final Set<String> EXTENSOES = Set.of("webm", "ogg", "oga", "mp3", "mp4", "m4a", "mpeg", "mpga", "wav", "flac");
    private static final Map<String, String> EXTENSAO_POR_TIPO = Map.of(
            "audio/webm", "webm", "video/webm", "webm", "audio/ogg", "ogg", "audio/mpeg", "mp3", "audio/mp4", "mp4",
            "audio/x-m4a", "m4a", "audio/m4a", "m4a", "audio/wav", "wav", "audio/x-wav", "wav", "audio/flac", "flac");

    private final Repositorio repo;
    private final Copiloto copiloto;
    private final Transcritor transcritor;
    private final RegrasCadastro regras;
    private final Visao360Assembler assembler;
    private final WhisperProps whisper;
    private final EdicaoProps props;

    public EdicaoCadastroService(Repositorio repo, Copiloto copiloto, Transcritor transcritor, RegrasCadastro regras,
                                 Visao360Assembler assembler, WhisperProps whisper, EdicaoProps props) {
        this.repo = repo;
        this.copiloto = copiloto;
        this.transcritor = transcritor;
        this.regras = regras;
        this.assembler = assembler;
        this.whisper = whisper;
        this.props = props;
    }

    public Transcricao transcrever(String clienteId, byte[] audio, String nomeOriginal, String tipo) {
        Cliente c = repo.cliente(clienteId);
        if (audio == null || audio.length == 0) throw new RequisicaoInvalida("Áudio vazio.");
        if (audio.length > whisper.tamanhoMaximoMb() * 1024L * 1024L) {
            throw new RequisicaoInvalida("Áudio maior que " + whisper.tamanhoMaximoMb() + " MB.");
        }
        return transcritor.transcrever(audio, "audio." + extensao(nomeOriginal, tipo), dica(c));
    }

    /** Só propõe: nada é gravado aqui. */
    public PropostaEdicao propor(String clienteId, String transcricao) {
        Cliente c = repo.cliente(clienteId);
        String t = transcricao == null ? "" : transcricao.strip();
        if (t.isEmpty()) throw new RequisicaoInvalida("Transcrição vazia: grave um áudio ou digite o que mudou.");
        if (t.length() > props.maxCaracteresTranscricao()) {
            throw new RequisicaoInvalida("Transcrição maior que " + props.maxCaracteresTranscricao() + " caracteres.");
        }
        return regras.propor(c, copiloto.extrairEdicao(clienteId, t), t);
    }

    /** Grava o que o assessor confirmou e devolve a 360 recalculada. */
    public Visao360 aplicar(String clienteId, EdicaoCadastro edicao) {
        repo.salvarCadastro(regras.aplicar(repo.cliente(clienteId), edicao));
        assembler.aoAlterarConsentimento(new ConsentimentoAlterado(clienteId, null));
        return assembler.visao360(clienteId);
    }

    /** Ajuda o Whisper a grafar o nome do cliente e os termos do cadastro. */
    static String dica(Cliente c) {
        return "Atualização do cadastro de " + c.nome() + ": nome, idade, profissão e cidade.";
    }

    static String extensao(String nomeOriginal, String tipo) {
        String porNome = nomeOriginal == null || !nomeOriginal.contains(".") ? ""
                : nomeOriginal.substring(nomeOriginal.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        if (EXTENSOES.contains(porNome)) return porNome;
        String semParametros = tipo == null ? "" : tipo.split(";")[0].strip().toLowerCase(Locale.ROOT);
        String porTipo = EXTENSAO_POR_TIPO.get(semParametros);
        if (porTipo != null) return porTipo;
        throw new RequisicaoInvalida("Formato de áudio não suportado. Use webm, ogg, mp3, mp4, m4a, wav ou flac.");
    }
}
