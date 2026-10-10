package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.TipoAcao;
import java.util.List;

public record AcaoSugerida(
        String id, String clienteId, TipoAcao tipo, String titulo, String motivo,
        String impactoEstimado, List<String> alertaIds, boolean principal) {

    public AcaoSugerida comoPrincipal(boolean p) {
        return new AcaoSugerida(id, clienteId, tipo, titulo, motivo, impactoEstimado, alertaIds, p);
    }
}
