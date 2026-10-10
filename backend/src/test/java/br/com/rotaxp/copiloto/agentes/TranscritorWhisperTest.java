package br.com.rotaxp.copiloto.agentes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import br.com.rotaxp.copiloto.config.WhisperProps;
import br.com.rotaxp.copiloto.dominio.Edicao.Transcricao;
import br.com.rotaxp.copiloto.dominio.Excecoes.FalhaExterna;
import br.com.rotaxp.copiloto.dominio.Excecoes.Indisponivel;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/** Whisper no formato da API da OpenAI, sem rede (MockRestServiceServer). */
class TranscritorWhisperTest {

    private static final String URL = "https://whisper.teste/v1";

    private final RestClient.Builder builder = RestClient.builder().baseUrl(URL);
    private final MockRestServiceServer servidor = MockRestServiceServer.bindTo(builder).build();

    private TranscritorWhisper transcritor(String chave) {
        return new TranscritorWhisper(new WhisperProps(URL, "whisper-1", chave, "pt", 60, 25), builder.build());
    }

    @Test
    void mandaOAudioEmMultipartComModeloIdiomaEDicaEDevolveOTexto() {
        servidor.expect(requestTo(URL + "/audio/transcriptions"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer sk-teste"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.MULTIPART_FORM_DATA))
                .andExpect(req -> assertThat(((MockClientHttpRequest) req).getBodyAsString(StandardCharsets.UTF_8))
                        .contains("name=\"file\"; filename=\"audio.webm\"", "bytes do áudio",
                                "name=\"model\"", "whisper-1", "name=\"language\"", "pt",
                                "name=\"prompt\"", "Cadastro de Patrícia Gomes"))
                .andRespond(withSuccess("{\"text\":\"  A Patrícia se mudou para Campinas.  \",\"usage\":{\"seconds\":4}}",
                        MediaType.APPLICATION_JSON));

        Transcricao t = transcritor("sk-teste").transcrever("bytes do áudio".getBytes(StandardCharsets.UTF_8), "audio.webm",
                "Cadastro de Patrícia Gomes");

        assertThat(t).isEqualTo(new Transcricao("A Patrícia se mudou para Campinas.", "whisper-1"));
        servidor.verify();
    }

    @Test
    void semChaveEhIndisponivelENaoChamaOServico() {
        assertThat(transcritor(" ").disponivel()).isFalse();
        assertThat(transcritor("sk").disponivel()).isTrue();
        assertThatThrownBy(() -> transcritor("").transcrever(new byte[] {1}, "audio.webm", null))
                .isInstanceOf(Indisponivel.class).hasMessageContaining("WHISPER_APIKEY");
        servidor.verify();
    }

    @Test
    void erroDoServicoViraFalhaExterna() {
        servidor.expect(requestTo(URL + "/audio/transcriptions")).andRespond(withServerError());

        assertThatThrownBy(() -> transcritor("sk").transcrever(new byte[] {1}, "audio.webm", null))
                .isInstanceOf(FalhaExterna.class).hasMessageContaining("digite o que mudou");
    }
}
