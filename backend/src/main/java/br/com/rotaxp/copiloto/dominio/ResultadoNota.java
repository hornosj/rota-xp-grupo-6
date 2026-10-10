package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import java.util.List;

public record ResultadoNota(
        String resumo, List<EventoVida> eventosCriados, List<String> metas,
        List<String> mudancasPerfil, List<AcaoSugerida> acoesCriadas, GeradoPor geradoPor) {

    public ResultadoNota com(GeradoPor g) {
        return new ResultadoNota(resumo, eventosCriados, metas, mudancasPerfil, acoesCriadas, g);
    }
}
