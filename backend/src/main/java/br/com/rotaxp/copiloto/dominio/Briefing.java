package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import java.util.List;

public record Briefing(String clienteId, List<String> bullets, List<String> perguntasSugeridas, GeradoPor geradoPor) {
    public Briefing com(GeradoPor g) { return new Briefing(clienteId, bullets, perguntasSugeridas, g); }
}
