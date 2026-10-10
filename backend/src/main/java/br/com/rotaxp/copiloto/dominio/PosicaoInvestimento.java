package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import java.math.BigDecimal;
import java.time.LocalDate;

public record PosicaoInvestimento(
        String id, String clienteId, String instituicaoId, String emissorId, Produto produto, String nome,
        BigDecimal valorAplicado, BigDecimal valorAtual, LocalDate dataAplicacao, LocalDate vencimento,
        Indexador indexador, String taxa, boolean liquidezDiaria) {}
