package br.com.rotaxp.copiloto.agentes;

/** Executa o agente que produz o tipo pedido a partir da entrada (o Embabel planeja pelos tipos). */
@FunctionalInterface
public interface ExecutorAgentes {
    <T> T executar(Object entrada, Class<T> resultado);
}
