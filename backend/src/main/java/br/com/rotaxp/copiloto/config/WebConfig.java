package br.com.rotaxp.copiloto.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // O front chama pelo proxy do Next, que repassa o Origin do navegador: aceita o front local em
        // qualquer porta (3000, 3010...). Origem externa continua bloqueada.
        registry.addMapping("/api/**").allowedOriginPatterns("http://localhost:[*]", "http://127.0.0.1:[*]")
                .allowedMethods("*");
    }
}
