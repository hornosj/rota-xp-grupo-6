package br.com.rotaxp.copiloto.agentes;

/** Chamada mínima a um LLM: system + user → texto. */
@FunctionalInterface
public interface LlmCliente {
    String completar(String system, String user);
}
