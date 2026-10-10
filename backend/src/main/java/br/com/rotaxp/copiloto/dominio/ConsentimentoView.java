package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConsentimento;
import java.time.LocalDate;
import java.util.List;

/** Consentimento & { instituicaoNome }. */
public record ConsentimentoView(
        String id, String clienteId, String instituicaoId, TipoConsentimento tipo,
        StatusConsentimento status, List<Escopo> escopos, LocalDate concedidoEm, LocalDate expiraEm,
        String instituicaoNome) {

    public static ConsentimentoView de(Consentimento c, String instituicaoNome) {
        return new ConsentimentoView(c.id(), c.clienteId(), c.instituicaoId(), c.tipo(), c.status(),
                c.escopos(), c.concedidoEm(), c.expiraEm(), instituicaoNome);
    }
}
