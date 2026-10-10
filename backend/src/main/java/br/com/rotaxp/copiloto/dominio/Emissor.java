package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.TipoEmissor;

public record Emissor(String id, String nome, String conglomeradoId, TipoEmissor tipo) {}
