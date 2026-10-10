package br.com.rotaxp.copiloto.dominio;

public final class Excecoes {
    private Excecoes() {}

    public static class NaoEncontrado extends RuntimeException {
        public NaoEncontrado(String mensagem) { super(mensagem); }
    }

    public static class Conflito extends RuntimeException {
        public Conflito(String mensagem) { super(mensagem); }
    }

    /** Recurso que existiu mas não vale mais (ex.: convite expirado) — HTTP 410. */
    public static class Expirado extends RuntimeException {
        public Expirado(String mensagem) { super(mensagem); }
    }

    public static class RequisicaoInvalida extends RuntimeException {
        public RequisicaoInvalida(String mensagem) { super(mensagem); }
    }

    /** Serviço externo não configurado (ex.: Whisper sem chave) — HTTP 503. */
    public static class Indisponivel extends RuntimeException {
        public Indisponivel(String mensagem) { super(mensagem); }
    }

    /** Serviço externo respondeu com erro ou não respondeu (ex.: Whisper fora do ar) — HTTP 502. */
    public static class FalhaExterna extends RuntimeException {
        public FalhaExterna(String mensagem, Throwable causa) { super(mensagem, causa); }
    }
}
