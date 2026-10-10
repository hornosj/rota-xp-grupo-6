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
}
