package br.com.rotaxp.copiloto.api;

import br.com.rotaxp.copiloto.dominio.Onboarding.CadastroInvestidor;
import br.com.rotaxp.copiloto.dominio.Onboarding.ConviteOnboarding;
import br.com.rotaxp.copiloto.dominio.Onboarding.FormularioOnboarding;
import br.com.rotaxp.copiloto.dominio.Onboarding.NovoConviteBody;
import br.com.rotaxp.copiloto.dominio.Onboarding.ResultadoOnboarding;
import br.com.rotaxp.copiloto.onboarding.OnboardingService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Convites (lado do assessor) e cadastro do investidor pelo link do convite. */
@RestController
public class OnboardingController {

    private final OnboardingService onboarding;

    public OnboardingController(OnboardingService onboarding) {
        this.onboarding = onboarding;
    }

    @GetMapping("/api/assessor/convites")
    public List<ConviteOnboarding> convites() {
        return onboarding.convites();
    }

    @PostMapping("/api/assessor/convites")
    @ResponseStatus(HttpStatus.CREATED)
    public ConviteOnboarding criarConvite(@RequestBody NovoConviteBody body) {
        return onboarding.criarConvite(body == null ? null : body.nome());
    }

    /** Monta o formulário; 404 se o token não existir. Marca o convite como ABERTO. */
    @GetMapping("/api/onboarding/{token}")
    public FormularioOnboarding formulario(@PathVariable String token) {
        return onboarding.formulario(token);
    }

    /** Cria o cliente. 400 com { erro: INVALIDO } em dado inválido; 409 se já concluído ou CPF repetido. */
    @PostMapping("/api/onboarding/{token}")
    public ResultadoOnboarding concluir(@PathVariable String token, @RequestBody CadastroInvestidor body) {
        return onboarding.concluir(token, body);
    }
}
