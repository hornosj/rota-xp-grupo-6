package br.com.rotaxp.copiloto.analise;

import br.com.rotaxp.copiloto.dominio.ItemFila.Motivo;
import java.util.List;
import java.util.Map;

/** Scorecard da fila: prioridade 0–100, motivos explicáveis e pontos de cada alerta. */
public record ResultadoPrioridade(double prioridade, List<Motivo> motivos, Map<String, Double> pontosPorAlerta) {}
