package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import java.math.BigDecimal;

public final class Requisicoes {
    private Requisicoes() {}

    public record PedidoMensagemBody(Canal canal) {}

    public record NotaBody(String transcricao, br.com.rotaxp.copiloto.dominio.Enums.OrigemAnotacao origem) {}   // origem: AUDIO | TEXTO (padrão)

    public record DesagioBody(BigDecimal desagio, BigDecimal taxaAntiga, BigDecimal taxaNova, BigDecimal prazoRestanteAnos) {}

    public record DesagioResultado(double breakEvenAnos, boolean compensa, String explicacao) {}

    public record ErroResposta(String erro, String mensagem) {}

    public record DemoEstado(java.time.LocalDate dataReferencia, String modoCopiloto, String modeloLlm, UsoLlm llm) {}

    /** Chamadas ao LLM hoje e o teto diário (trava de crédito). */
    public record UsoLlm(int chamadasHoje, int limiteDiario) {}
}
