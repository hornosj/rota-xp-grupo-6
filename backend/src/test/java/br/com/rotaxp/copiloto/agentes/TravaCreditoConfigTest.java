package br.com.rotaxp.copiloto.agentes;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** Toda chamada real ao Embabel passa pela trava de crédito. */
@SpringBootTest
class TravaCreditoConfigTest {

    @Autowired ExecutorAgentes executor;
    @Autowired CopilotoLive live;

    @Test
    void executorInjetadoEhOLimitado() {
        assertThat(executor).isInstanceOf(LimiteChamadasLlm.class);
        assertThat(((LimiteChamadasLlm) executor).uso().limiteDiario()).isEqualTo(100);
    }
}
