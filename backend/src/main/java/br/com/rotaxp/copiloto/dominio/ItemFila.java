package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.PosicaoXp;
import java.util.List;

public record ItemFila(
        int posicao, String clienteId, String nome, PerfilInvestidor perfil,
        double prioridade, List<Motivo> motivos, AcaoSugerida acaoPrincipal,
        PosicaoXp posicaoXp, boolean novo) {

    public record Motivo(String texto, double pontos) {}
}
