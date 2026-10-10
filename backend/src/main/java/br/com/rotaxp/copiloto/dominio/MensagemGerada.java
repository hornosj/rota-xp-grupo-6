package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.Canal;
import br.com.rotaxp.copiloto.dominio.Enums.GeradoPor;

public record MensagemGerada(String texto, Canal canal, GeradoPor geradoPor) {
    public MensagemGerada com(GeradoPor g) { return new MensagemGerada(texto, canal, g); }
}
