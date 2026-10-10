package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import java.math.BigDecimal;

public final class Requisicoes {
    private Requisicoes() {}

    public record PedidoMensagemBody(Canal canal) {}

    public record NotaBody(String transcricao) {}

    public record DesagioBody(BigDecimal desagio, BigDecimal taxaAntiga, BigDecimal taxaNova, BigDecimal prazoRestanteAnos) {}

    public record DesagioResultado(double breakEvenAnos, boolean compensa, String explicacao) {}

    public record ErroResposta(String erro, String mensagem) {}

    public record DemoEstado(java.time.LocalDate dataReferencia, String modoCopiloto, String modeloLlm, UsoLlm llm,
                             TranscricaoVoz transcricao) {}

    /** Chamadas ao LLM hoje e o teto diário (trava de crédito). */
    public record UsoLlm(int chamadasHoje, int limiteDiario) {}

    /** Edição do cadastro por voz: false sem chave do Whisper (o front pede o texto digitado). */
    public record TranscricaoVoz(boolean disponivel, String modelo) {}
}
