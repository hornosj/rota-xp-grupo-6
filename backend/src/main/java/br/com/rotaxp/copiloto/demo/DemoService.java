package br.com.rotaxp.copiloto.demo;

import br.com.rotaxp.copiloto.agentes.CopilotoRouter;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.dominio.Requisicoes.DemoEstado;
import br.com.rotaxp.copiloto.onboarding.OnboardingService;
import br.com.rotaxp.copiloto.openfinance.Repositorio;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/** Reset da demo e linha de base dos alertas (no startup e a cada reset). */
@Service
public class DemoService {

    private final Repositorio repo;
    private final Visao360Assembler assembler;
    private final RegistroAlertas registro;
    private final DataReferencia dataReferencia;
    private final CopilotoRouter copiloto;
    private final OnboardingService onboarding;
    private final br.com.rotaxp.copiloto.agentes.LimiteChamadasLlm limite;
    private final br.com.rotaxp.copiloto.config.CopilotoProps copilotoProps;
    private final br.com.rotaxp.copiloto.openfinance.ConviteService convites;
    private final br.com.rotaxp.copiloto.inteligencia.AnotacoesService anotacoes;
    private final br.com.rotaxp.copiloto.agentes.Transcritor transcritor;

    public DemoService(Repositorio repo, Visao360Assembler assembler, RegistroAlertas registro,
                       DataReferencia dataReferencia, CopilotoRouter copiloto, OnboardingService onboarding,
                       br.com.rotaxp.copiloto.openfinance.ConviteService convites,
                       br.com.rotaxp.copiloto.agentes.LimiteChamadasLlm limite,
                       br.com.rotaxp.copiloto.config.CopilotoProps copilotoProps,
                       br.com.rotaxp.copiloto.inteligencia.AnotacoesService anotacoes,
                       br.com.rotaxp.copiloto.agentes.Transcritor transcritor) {
        this.repo = repo;
        this.assembler = assembler;
        this.registro = registro;
        this.dataReferencia = dataReferencia;
        this.copiloto = copiloto;
        this.onboarding = onboarding;
        this.convites = convites;
        this.limite = limite;
        this.copilotoProps = copilotoProps;
        this.anotacoes = anotacoes;
        this.transcritor = transcritor;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void aoIniciar() {
        assembler.registrarLinhaDeBase();
    }

    public synchronized void resetar() {
        repo.recarregar();
        onboarding.limpar();
        assembler.limpar();
        registro.limpar();
        convites.limpar();
        anotacoes.limpar();
        assembler.registrarLinhaDeBase();
    }

    public DemoEstado estado() {
        var uso = limite.uso();
        return new DemoEstado(dataReferencia.hoje(), copiloto.modoEfetivo(), copilotoProps.modelo(),
                new br.com.rotaxp.copiloto.dominio.Requisicoes.UsoLlm(uso.chamadasHoje(), uso.limiteDiario()),
                new br.com.rotaxp.copiloto.dominio.Requisicoes.TranscricaoVoz(transcritor.disponivel(), transcritor.modelo()));
    }
}
