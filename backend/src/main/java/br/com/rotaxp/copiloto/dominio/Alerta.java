package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.Severidade;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAlerta;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record Alerta(
        String id, String clienteId, TipoAlerta tipo, Severidade severidade,
        String titulo, String explicacao, BigDecimal valor, String instituicaoId, String emissorId,
        OffsetDateTime detectadoEm, boolean novo) {

    /** Chave estável usada pelo RegistroAlertas: cliente|tipo|instituicao|emissor. */
    public String chave() {
        return clienteId + "|" + tipo + "|" + (instituicaoId == null ? "" : instituicaoId)
                + "|" + (emissorId == null ? "" : emissorId);
    }

    public Alerta comRegistro(OffsetDateTime detectado, boolean ehNovo) {
        return new Alerta(id, clienteId, tipo, severidade, titulo, explicacao, valor, instituicaoId, emissorId, detectado, ehNovo);
    }
}
