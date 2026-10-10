package br.com.rotaxp.copiloto.config;

import br.com.rotaxp.copiloto.dominio.Enums.Produto;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("desagio")
public record DesagioProps(BigDecimal ipcaAnual, BigDecimal selicAnual,
                           int diasPorAno, List<Produto> produtosElegiveis) {}