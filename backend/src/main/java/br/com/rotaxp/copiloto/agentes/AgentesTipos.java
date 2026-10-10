package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import java.time.LocalDate;
import java.util.List;

/**
 * Tipos que circulam no blackboard dos agentes Embabel. O planejador (GOAP) encadeia as ações
 * pelos tipos de entrada e saída, então cada etapa tem o seu.
 */
public final class AgentesTipos {

    private AgentesTipos() {}

    // AgenteMensagemCliente: PedidoMensagem -> ContextoMensagem -> MensagemGerada
    public record PedidoMensagem(String clienteId, String acaoId, Canal canal) {}

    public record ContextoMensagem(ContextoCliente contexto, Canal canal) {}

    /** Saída estruturada do LLM. */
    public record MensagemRedigida(String texto) {}

    // AgenteBriefing: PedidoBriefing -> ContextoBriefing -> Briefing
    public record PedidoBriefing(String clienteId) {}

    public record ContextoBriefing(ContextoCliente contexto) {}

    /** Saída estruturada do LLM. */
    public record BriefingRedigido(List<String> bullets, List<String> perguntasSugeridas) {}

    // AgenteNotaPosReuniao: NotaReuniao -> ContextoNota -> FatosExtraidos -> ResultadoNota
    public record NotaReuniao(String clienteId, String transcricao) {}

    public record ContextoNota(ContextoCliente contexto, String transcricao, LocalDate dataReferencia) {}

    /** Saída estruturada do LLM: tipo e data chegam como texto e são validados por regra. */
    public record FatosExtraidos(String resumo, List<EventoExtraido> eventos, List<String> metas, List<String> mudancasPerfil,
                                 List<NecessidadeExtraida> necessidades) {}

    public record EventoExtraido(String tipo, String descricao, String data) {}

    /** "tipo" chega como texto e é validado contra TipoNecessidade por regra; jaPossui pode faltar (= false). */
    public record NecessidadeExtraida(String tipo, String motivo, Boolean jaPossui) {}

    // AgenteEdicaoCadastro: PedidoEdicao -> ContextoEdicao (sem LLM) -> Edicao.CamposExtraidos (LLM)
    public record PedidoEdicao(String clienteId, String transcricao) {}

    /** Cadastro atual, sem CPF nem dados de outras pessoas: só o que a fala do assessor pode mudar. */
    public record CadastroAtual(String nome, int idade, String profissao, String cidade, PerfilInvestidor perfil) {}

    public record ContextoEdicao(CadastroAtual cadastro, String transcricao) {}

    /** Saída estruturada do LLM: tudo como texto (null = não citado), validado depois pelas regras. */
    public record CamposDitos(String nome, String idade, String profissao, String cidade, String perfil) {}

    // AgenteClassificacaoNoticias: LoteNoticias -> LoteClassificado (várias notícias numa chamada)
    public record LoteNoticias(List<br.com.rotaxp.copiloto.dominio.Radar.Noticia> noticias, String modelo, int maxTokens,
                               List<EmissorPermitido> emissoresPermitidos) {
        public record EmissorPermitido(String id, String nome) {}
    }

    /** Saída estruturada do LLM: valores como texto, validados depois pelo ClassificadorLlm. */
    public record LoteClassificado(List<ItemClassificado> itens) {}

    public record ItemClassificado(String noticiaId, List<String> emissores, List<String> indexadores, List<String> produtos,
                                   String direcao, double relevancia, String resumoImpacto) {}

    // AgenteRadarNoticias: PedidoMotivoNoticia -> ContextoNoticia (sem LLM) -> MotivoNoticia (LLM)
    public record PedidoMotivoNoticia(String clienteId, String noticiaId) {}

    /** Contexto enxuto: cliente + notícia + impacto já calculado por regra. */
    public record ContextoNoticia(ContextoCliente cliente, String noticiaId, String titulo, String resumo, String fonte,
                                  String direcao, String resumoImpacto,
                                  br.com.rotaxp.copiloto.dominio.Radar.ImpactoNoticia impacto) {}

    /** Saída estruturada do LLM. */
    public record MotivoRedigido(String texto) {}
}
