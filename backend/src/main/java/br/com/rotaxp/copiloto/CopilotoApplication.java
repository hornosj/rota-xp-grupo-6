package br.com.rotaxp.copiloto;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class CopilotoApplication {
    public static void main(String[] args) {
        SpringApplication.run(CopilotoApplication.class, args);
    }
}
