package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.Modalidade;
import br.com.rotaxp.copiloto.dominio.Enums.TipoTransacao;
import java.math.BigDecimal;
import java.time.LocalDate;

public record Transacao(
        String id, String contaId, LocalDate data, BigDecimal valor, TipoTransacao tipo,
        Modalidade modalidade, String descricao, String contraparteDocumento, String contraparteNome) {}
