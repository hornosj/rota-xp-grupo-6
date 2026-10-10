package br.com.rotaxp.copiloto.dominio;

import java.util.List;

public record Jornada(String clienteId, double completude, Nivel nivel, List<Missao> missoes, List<Diagnostico> diagnosticos) {
    public record Nivel(int numero, String nome, String proximo, String comoSubir, List<String> beneficios) {}
}
