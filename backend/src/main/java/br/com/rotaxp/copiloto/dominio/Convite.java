package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import java.time.OffsetDateTime;
import java.util.List;

/** Convite de consentimento Open Finance enviado pelo assessor (PLAN §7.10). */
public record Convite(
        String token, String clienteId, String instituicaoId, String instituicaoNome,
        List<Escopo> escopos, int prazoMeses, String link, StatusConvite status,
        OffsetDateTime criadoEm, OffsetDateTime expiraEm) {

    public enum StatusConvite { PENDENTE, CONFIRMADO, EXPIRADO }

    public Convite com(StatusConvite novo) {
        return new Convite(token, clienteId, instituicaoId, instituicaoNome, escopos, prazoMeses, link, novo, criadoEm, expiraEm);
    }
}
