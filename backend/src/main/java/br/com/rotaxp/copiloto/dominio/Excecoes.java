package br.com.rotaxp.copiloto.dominio;

public final class Excecoes {
    private Excecoes() {}

    public static class NaoEncontrado extends RuntimeException {
        public NaoEncontrado(String mensagem) { super(mensagem); }
    }

    public static class Conflito extends RuntimeException {
        public Conflito(String mensagem) { super(mensagem); }
    }

    public static class Invalido extends RuntimeException {
        public Invalido(String mensagem) { super(mensagem); }
    }
}
