package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;
import java.util.List;

/**
 * Edição do cadastro por voz (aditivo no contrato): o assessor grava o que mudou, o Whisper transcreve,
 * o Copiloto propõe as alterações e o assessor confirma o que aplicar. O perfil de investidor fica de fora:
 * ele vem do questionário de suitability, não da fala do assessor.
 */
public final class Edicao {

    private Edicao() {}

    /** Campos do cadastro que a edição por voz pode mudar. */
    public enum CampoCadastro { NOME, IDADE, PROFISSAO, CIDADE }

    /** Texto transcrito do áudio e o modelo que transcreveu. */
    public record Transcricao(String texto, String modelo) {}

    public record PedidoProposta(String transcricao) {}

    /**
     * O que o Copiloto entendeu da fala, campo a campo, ainda sem validação (null = não citado).
     * Sai do LLM (ou do stub) e passa pelas regras antes de virar proposta.
     */
    public record CamposExtraidos(String nome, String idade, String profissao, String cidade, String perfil,
                                  GeradoPor geradoPor) {
        public CamposExtraidos com(GeradoPor g) {
            return new CamposExtraidos(nome, idade, profissao, cidade, perfil, g);
        }
    }

    /** Um campo que mudou, já validado e normalizado; valorAtual para o assessor conferir. */
    public record AlteracaoCampo(CampoCadastro campo, String valorAtual, String valorNovo) {}

    /** avisos: o que foi entendido mas não entra na proposta (valor inválido, perfil de investidor). */
    public record PropostaEdicao(String clienteId, String transcricao, List<AlteracaoCampo> alteracoes,
                                 List<String> avisos, GeradoPor geradoPor) {}

    /** Corpo do PATCH /clientes/{id}: só os campos que mudam; null mantém o valor atual. */
    public record EdicaoCadastro(String nome, Integer idade, String profissao, String cidade) {}
}
