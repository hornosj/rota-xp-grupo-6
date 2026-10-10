package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.TipoDiagnostico;
import java.util.Map;

public record Diagnostico(
        TipoDiagnostico tipo, String titulo, boolean desbloqueado, String requisito,
        String resumo, Map<String, Object> detalhes) {}
