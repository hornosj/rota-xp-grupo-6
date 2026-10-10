package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.PosicaoXp;
import java.math.BigDecimal;
import java.util.Map;

public record PainelCarteira(
        String assessorId, int totalClientes, BigDecimal patrimonioNaXp, BigDecimal patrimonioForaXpVisivel,
        double pctClientesXpPrincipal, Map<PosicaoXp, Integer> distribuicaoPosicaoXp,
        double coberturaMedia, int consentimentosExpirando15d, int clientesComAlertaAlto) {}
