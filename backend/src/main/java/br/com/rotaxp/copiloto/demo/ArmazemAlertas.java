package br.com.rotaxp.copiloto.demo;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Map;

/** Onde o RegistroAlertas guarda quando cada alerta foi detectado. */
public interface ArmazemAlertas {

    record Registro(Instant instante, OffsetDateTime detectadoEm, boolean linhaDeBase) {}

    /** Todos os registros, por chave do alerta. */
    Map<String, Registro> carregar();

    void salvar(Map<String, Registro> novos);

    void limpar();

    /** Não guarda nada fora do processo (banco.tipo=memoria e testes unitários). */
    ArmazemAlertas EM_MEMORIA = new ArmazemAlertas() {
        @Override public Map<String, Registro> carregar() { return Map.of(); }
        @Override public void salvar(Map<String, Registro> novos) {}
        @Override public void limpar() {}
    };
}
