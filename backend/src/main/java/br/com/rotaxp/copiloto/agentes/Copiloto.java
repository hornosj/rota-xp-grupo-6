package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.dominio.Briefing;
import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.MensagemGerada;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;

/** Porta única da camada de IA (PLAN §8.1). O LLM redige; nunca calcula. */
public interface Copiloto {

    MensagemGerada redigirMensagem(String clienteId, String acaoId, Canal canal);

    Briefing gerarBriefing(String clienteId);

    ResultadoNota processarNota(String clienteId, String transcricao);

    /** Radar (BE2-10): por que a notícia é motivo de contato com o cliente — texto para o assessor. */
    br.com.rotaxp.copiloto.dominio.Radar.MotivoNoticia redigirMotivoNoticia(String clienteId, String noticiaId);
}
