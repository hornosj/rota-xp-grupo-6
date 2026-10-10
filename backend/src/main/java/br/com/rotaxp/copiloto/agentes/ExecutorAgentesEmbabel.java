package br.com.rotaxp.copiloto.agentes;

import com.embabel.agent.api.invocation.AgentInvocation;
import com.embabel.agent.core.AgentPlatform;
import org.springframework.stereotype.Component;

/** Invoca os agentes registrados na AgentPlatform do Embabel. */
@Component
public class ExecutorAgentesEmbabel implements ExecutorAgentes {

    private final AgentPlatform plataforma;

    public ExecutorAgentesEmbabel(AgentPlatform plataforma) {
        this.plataforma = plataforma;
    }

    @Override
    public <T> T executar(Object entrada, Class<T> resultado) {
        return AgentInvocation.create(plataforma, resultado).invoke(entrada);
    }
}
