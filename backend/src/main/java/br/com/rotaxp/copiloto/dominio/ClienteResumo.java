package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.PosicaoXp;

public record ClienteResumo(String id, String nome, PerfilInvestidor perfil, PosicaoXp posicaoXp, double prioridade) {}
