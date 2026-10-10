package br.com.rotaxp.copiloto.agentes;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Respostas do LLM gravadas em disco: {agente}-{clienteId}-{extra}-{hash do contexto}.json.
 * O hash garante que "antes" e "depois" do consentimento da Marina sejam entradas diferentes.
 */
public class CacheLlm {

    private final Path dir;
    private final ObjectMapper mapper;

    public CacheLlm(Path dir, ObjectMapper mapper) {
        this.dir = dir;
        this.mapper = mapper;
    }

    public String chave(String agente, ContextoCliente contexto, String extra) {
        String base = agente + "-" + contexto.clienteId() + (extra == null ? "" : "-" + extra);
        return base + "-" + hash(contexto);
    }

    public <T> Optional<T> ler(String chave, Class<T> tipo) {
        Path arquivo = dir.resolve(chave + ".json");
        if (!Files.exists(arquivo)) return Optional.empty();
        try {
            return Optional.of(mapper.readValue(arquivo.toFile(), tipo));
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    public void gravar(String chave, Object valor) {
        try {
            Files.createDirectories(dir);
            mapper.writerWithDefaultPrettyPrinter().writeValue(dir.resolve(chave + ".json").toFile(), valor);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private String hash(ContextoCliente contexto) {
        try {
            byte[] bytes = mapper.writeValueAsString(contexto).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)).substring(0, 10);
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    static String hashTexto(String texto) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d).substring(0, 10);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
