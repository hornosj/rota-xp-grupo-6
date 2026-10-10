package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.OrigemEvento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEventoVida;
import java.time.LocalDate;

public record EventoVida(String id, TipoEventoVida tipo, String descricao, LocalDate data, OrigemEvento origem) {}
