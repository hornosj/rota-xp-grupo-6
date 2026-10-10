package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.Indexador;
import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class SimulacaoDesagio {
    private SimulacaoDesagio() {}

    public record PremissasMercado(double cdiAnual, double ipcaAnual, double selicAnual) {}

    public record PosicaoDesagio(
            String posicaoId, String nome, Produto produto, Indexador indexador,
            String instituicaoId, String instituicaoNome, String emissorNome,
            BigDecimal valorAplicado, BigDecimal valorAtual, LocalDate dataAplicacao, LocalDate vencimento,
            Double prazoRestanteAnos, String taxaTexto,
            Double taxaAnualEstimada,
            boolean taxaDependeDePremissa,
            boolean elegivel, String motivoInelegibilidade) {}

    public record PosicoesDesagio(
            String clienteId, String clienteNome, LocalDate dataReferencia,
            PremissasMercado premissas, List<PosicaoDesagio> posicoes) {}

    public record DesagioPedido(
            String clienteId, String posicaoId,
            BigDecimal valorAtual, BigDecimal taxaAntiga, BigDecimal prazoRestanteAnos,
            BigDecimal desagio, BigDecimal precoVenda, BigDecimal taxaNova) {}

    public record EntradaResolvida(
            String posicaoId, String posicaoNome, BigDecimal valorAtual,
            double taxaAntiga, double taxaNova, double prazoRestanteAnos,
            BigDecimal desagio, BigDecimal precoVenda) {}

    public record EntradaUsada(
            String posicaoId, String posicaoNome, BigDecimal valorAtual,
            double taxaAntiga, double taxaNova, double prazoRestanteAnos,
            double desagio, BigDecimal precoVenda) {}

    public record PontoSerie(int mes, double anos, BigDecimal valorManter, BigDecimal valorVender, BigDecimal diferenca) {}

    public record DesagioDetalhado(
            EntradaUsada entrada,
            BigDecimal perdaImediata,
            BigDecimal valorFinalManter,
            BigDecimal valorFinalVender,
            BigDecimal ganhoDaTroca,
            double ganhoDaTrocaPercentual,
            Double breakEvenAnos,
            Integer breakEvenMeses,
            boolean compensa,
            Double desagioMaximoQueCompensa,
            BigDecimal precoMinimoQueCompensa,
            double spreadTaxas,
            List<PontoSerie> serie,
            String explicacao,
            List<String> premissas,
            List<String> avisos) {}
}