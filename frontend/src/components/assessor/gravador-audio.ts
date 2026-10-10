"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Formatos que o Whisper aceita, em ordem de preferência (Chrome e Firefox gravam webm; Safari, mp4). */
const FORMATOS = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

/** A gravação para sozinha depois disso: áudio curto transcreve mais rápido e gasta menos. */
export const LIMITE_GRAVACAO_S = 120;

export interface Gravacao {
  audio: Blob;
  /** Com a extensão do formato: a API do Whisper deduz o formato por ela. */
  nomeArquivo: string;
}

export type EstadoGravador = "parado" | "pedindo" | "gravando";

export function podeGravar(): boolean {
  return typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function extensaoDoTipo(tipo: string): string {
  if (tipo.includes("mp4")) return "mp4";
  if (tipo.includes("ogg")) return "ogg";
  return "webm";
}

/** Grava do microfone com MediaRecorder. Sair da tela no meio da gravação libera o microfone sem enviar nada. */
export function useGravadorAudio(aoTerminar: (g: Gravacao) => void) {
  const [estado, setEstado] = useState<EstadoGravador>("parado");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const terminar = useRef(aoTerminar);

  useEffect(() => {
    terminar.current = aoTerminar;
  }, [aoTerminar]);

  const soltarMicrofone = useCallback(() => {
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
    gravador.current?.stream.getTracks().forEach((t) => t.stop());
    gravador.current = null;
  }, []);

  const descartar = useCallback(() => {
    const rec = gravador.current;
    if (rec) {
      rec.onstop = null;
      if (rec.state === "recording") rec.stop();
    }
    soltarMicrofone();
  }, [soltarMicrofone]);

  const parar = useCallback(() => {
    if (gravador.current?.state === "recording") gravador.current.stop();
  }, []);

  const iniciar = useCallback(async () => {
    setErro(null);
    setEstado("pedindo");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setEstado("parado");
      setErro(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Permita o uso do microfone no navegador para gravar."
          : "Não foi possível acessar o microfone.",
      );
      return;
    }
    const tipo = FORMATOS.find((f) => MediaRecorder.isTypeSupported(f));
    const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    const partes: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) partes.push(e.data);
    };
    rec.onstop = () => {
      soltarMicrofone();
      setEstado("parado");
      const mime = rec.mimeType || tipo || "audio/webm";
      const audio = new Blob(partes, { type: mime });
      if (audio.size > 0) terminar.current({ audio, nomeArquivo: `audio.${extensaoDoTipo(mime)}` });
    };
    gravador.current = rec;
    rec.start();
    const inicio = Date.now();
    setSegundos(0);
    setEstado("gravando");
    relogio.current = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(s);
      if (s >= LIMITE_GRAVACAO_S && rec.state === "recording") rec.stop();
    }, 250);
  }, [soltarMicrofone]);

  useEffect(() => descartar, [descartar]);

  return { estado, segundos, erro, iniciar, parar };
}
