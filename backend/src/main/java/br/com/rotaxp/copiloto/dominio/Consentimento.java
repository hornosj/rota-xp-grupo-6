package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConsentimento;
import java.time.LocalDate;
import java.util.List;

public record Consentimento(
        String id, String clienteId, String instituicaoId, TipoConsentimento tipo,
        StatusConsentimento status, List<Escopo> escopos, LocalDate concedidoEm, LocalDate expiraEm) {

    public boolean ativo() { return status == StatusConsentimento.ATIVO; }

    public boolean cobre(Escopo escopo) {
        return ativo() && (tipo == TipoConsentimento.INTERNO || (escopos != null && escopos.contains(escopo)));
    }

    public Consentimento com(StatusConsentimento novoStatus, List<Escopo> novosEscopos, LocalDate concedido, LocalDate expira) {
        return new Consentimento(id, clienteId, instituicaoId, tipo, novoStatus, novosEscopos, concedido, expira);
    }
}
