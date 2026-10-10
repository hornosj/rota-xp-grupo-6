package br.com.rotaxp.copiloto.config;

import java.time.LocalDate;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("demo")
public record DemoProps(LocalDate dataReferencia, String assessorId, int janelaAlertaNovoMinutos) {}
