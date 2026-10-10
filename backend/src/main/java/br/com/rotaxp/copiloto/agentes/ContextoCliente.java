package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.TipoAcao;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Contexto enxuto que o LLM recebe (PLAN §8.2). Todo número já vem calculado e formatado;
 * nunca contém dados de outros clientes.
 */
public record ContextoCliente(
        String clienteId, String primeiroNome, PerfilInvestidor perfil, String profissao,
        String principalidade, String patrimonioTexto, String fluxoTexto,
        List<String> alertas, List<EventoProximo> eventosProximos, List<String> acoesSugeridas,
        AcaoContexto acao) {

    public record EventoProximo(String descricao, LocalDate data, long emDias) {}

    public record AcaoContexto(String id, TipoAcao tipo, String titulo, String motivo, String impactoEstimado,
                               BigDecimal valor, String valorTexto, String instituicaoNome,
                               String link) {}   // link do convite, só em CONVIDAR_CONEXAO
}
