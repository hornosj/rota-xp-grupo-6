package br.com.rotaxp.copiloto.analise;

import java.math.BigDecimal;
import java.util.List;

/** FGC e exposição sem garantia por conglomerado do emissor (PLAN §7.5–7.6). */
public record AnaliseFgc(
        List<Conglomerado> conglomerados, BigDecimal totalElegivel, boolean excedeTetoGlobal, BigDecimal patrimonioVisivel) {

    /**
     * @param nome                  nome do emissor (ou instituição) de maior valor no conglomerado
     * @param referencia            "do Banco Horizonte", "do conglomerado Aurora (...)" — para os textos
     * @param produtos              produtos envolvidos ("conta corrente", "CDB", "poupança"...)
     * @param elegivel              soma de produtos cobertos pelo FGC + saldo em conta corrente
     * @param excessoFgc            max(0, elegível − limite)
     * @param creditoPrivado        DEBENTURE/CRI/CRA de emissores do conglomerado
     * @param exposicaoSemGarantia  crédito privado + excesso FGC
     * @param fracaoPatrimonio      exposição / patrimônio visível (4 casas)
     */
    public record Conglomerado(
            String conglomeradoId, String nome, String referencia, List<String> produtos,
            String emissorId, String instituicaoId,
            BigDecimal elegivel, BigDecimal excessoFgc, BigDecimal creditoPrivado,
            BigDecimal exposicaoSemGarantia, double fracaoPatrimonio, boolean emissorEmpresa) {}
}
