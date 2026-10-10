package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.StatusMissao;
import br.com.rotaxp.copiloto.dominio.Enums.TipoMissao;

public record Missao(
        String id, TipoMissao tipo, String titulo, String descricao, String recompensa,
        StatusMissao status, double progresso, String instituicaoId) {}
