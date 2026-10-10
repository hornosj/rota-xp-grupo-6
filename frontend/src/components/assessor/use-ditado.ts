"use client";

// Ditado pelo navegador (Web Speech API, PLAN §8.4): Chrome/Edge, pt-BR. O áudio não passa pelo
// nosso backend — só o texto transcrito vai para POST /clientes/{id}/notas.
import { useCallback, useEffect, useRef, useState } from "react";

interface ResultadoFala {
  isFinal: boolean;
  0: { transcript: string };
}

interface EventoFala {
  resultIndex: number;
  results: ArrayLike<ResultadoFala>;
}

interface Reconhecimento {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EventoFala) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type Construtor = new () => Reconhecimento;

function construtor(): Construtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * `aoFinal` recebe cada trecho já reconhecido; `parcial` é o que ainda está sendo ouvido.
 * Use só em componente montado no cliente (ex.: dentro de um Dialog aberto), por causa do `suportado`.
 */
export function useDitado(aoFinal: (trecho: string) => void) {
  const [suportado] = useState(() => construtor() !== null);
  const [gravando, setGravando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<Reconhecimento | null>(null);
  const aoFinalRef = useRef(aoFinal);

  useEffect(() => {
    aoFinalRef.current = aoFinal;
  }, [aoFinal]);

  useEffect(() => () => rec.current?.stop(), []);

  const iniciar = useCallback(() => {
    const C = construtor();
    if (!C) return;
    const r = new C();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let ouvindo = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) aoFinalRef.current(res[0].transcript.trim());
        else ouvindo += res[0].transcript;
      }
      setParcial(ouvindo);
    };
    r.onerror = (e) =>
      setErro(e.error === "not-allowed" ? "Permita o uso do microfone para gravar." : "Não foi possível gravar o áudio.");
    r.onend = () => {
      rec.current = null;
      setGravando(false);
      setParcial("");
    };
    rec.current = r;
    setErro(null);
    r.start();
    setGravando(true);
  }, []);

  const parar = useCallback(() => rec.current?.stop(), []);

  return { suportado, gravando, parcial, erro, iniciar, parar };
}
