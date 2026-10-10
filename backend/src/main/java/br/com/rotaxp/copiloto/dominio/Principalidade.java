package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.PosicaoXp;
import java.util.List;

public record Principalidade(
        String instituicaoPrincipalId, String instituicaoPrincipalNome, PosicaoXp posicaoXp,
        String explicacao, List<ScoreInstituicao> scores) {}
