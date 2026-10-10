package br.com.rotaxp.copiloto.agentes;

import br.com.rotaxp.copiloto.dominio.Edicao.Transcricao;

/** Fala → texto, para a edição do cadastro por voz. Só o texto segue para o Copiloto. */
public interface Transcritor {

    /** false sem chave configurada: o front pede o texto digitado. */
    boolean disponivel();

    String modelo();

    /**
     * @param nomeArquivo com a extensão do formato (a API do Whisper deduz o formato por ela)
     * @param dica        texto curto que ajuda a grafar nomes próprios (prompt do Whisper); pode ser null
     * @throws br.com.rotaxp.copiloto.dominio.Excecoes.Indisponivel sem chave configurada
     * @throws br.com.rotaxp.copiloto.dominio.Excecoes.FalhaExterna se o serviço falhar
     */
    Transcricao transcrever(byte[] audio, String nomeArquivo, String dica);
}
