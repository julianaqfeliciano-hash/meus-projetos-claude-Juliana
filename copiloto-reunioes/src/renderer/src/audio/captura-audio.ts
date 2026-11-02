import type { Quem } from '../../../shared/tipos';
import { copiloto } from '../api';
import { AgrupadorPcm, nivelRms } from './pcm';

const TAXA_DE_AMOSTRAGEM = 16_000;
const AMOSTRAS_POR_BLOCO = 1600; // 100 ms
const INTERVALO_MINIMO_NIVEL_MS = 200; // no máximo 5 vezes por segundo
const ERRO_SEM_SOM_DO_COMPUTADOR = 'O Windows não entregou o som do computador';

/** Traduz o erro do navegador (em inglês) para uma mensagem que a usuária entende. */
function traduzirErroDeCaptura(quem: Quem, erro: unknown): Error {
  const nome = erro instanceof DOMException ? erro.name : '';
  let mensagem: string;
  if (quem === 'voce') {
    if (nome === 'NotAllowedError') {
      mensagem =
        'O Windows não deixou o programa usar o microfone. Confira a permissão em Configurações do Windows > Privacidade > Microfone.';
    } else if (nome === 'NotFoundError') {
      mensagem = 'Não encontrei nenhum microfone. Conecte um e escolha-o nas Configurações.';
    } else {
      mensagem = 'Não consegui abrir o microfone.';
    }
  } else {
    mensagem =
      nome === 'NotAllowedError'
        ? 'O Windows não deixou o programa capturar o som do computador.'
        : 'Não consegui capturar o som do computador.';
  }
  return new Error(mensagem, { cause: erro });
}

async function obterStream(quem: Quem, microfoneId: string | null): Promise<MediaStream> {
  try {
    if (quem === 'voce') {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: microfoneId ?? undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    }
    // O processo principal responde com a tela inteira e o som do computador (loopback), sem seletor. A faixa de
    // vídeo fica ligada, a 1 quadro por segundo: parar o vídeo poderia encerrar também o áudio.
    return await navigator.mediaDevices.getDisplayMedia({ audio: true, video: { frameRate: 1 } });
  } catch (erro) {
    throw traduzirErroDeCaptura(quem, erro);
  }
}

function liberar(stream: MediaStream, contexto: AudioContext | null): void {
  for (const faixa of stream.getTracks()) faixa.stop();
  if (contexto && contexto.state !== 'closed') {
    contexto.close().catch((erro: unknown) => console.warn('Não consegui fechar o contexto de áudio:', erro));
  }
}

/** Abre uma fonte (microfone ou som do computador) e devolve a função que a para. */
async function abrirFonte(quem: Quem, microfoneId: string | null): Promise<() => void> {
  const stream = await obterStream(quem, microfoneId);
  let contexto: AudioContext | null = null;
  try {
    if (quem === 'outros' && stream.getAudioTracks().length === 0) throw new Error(ERRO_SEM_SOM_DO_COMPUTADOR);

    contexto = new AudioContext({ sampleRate: TAXA_DE_AMOSTRAGEM });
    await contexto.audioWorklet.addModule('./captura-pcm.js');
    if (contexto.state === 'suspended') await contexto.resume();

    const origem = contexto.createMediaStreamSource(stream);
    // Entrada em mono: o Web Audio mistura os canais (som do computador costuma ser estéreo) antes do processador.
    const captura = new AudioWorkletNode(contexto, 'captura-pcm', { channelCount: 1, channelCountMode: 'explicit' });
    const mudo = contexto.createGain();
    mudo.gain.value = 0; // o grafo precisa chegar ao destino para rodar, mas sem tocar o som de volta
    origem.connect(captura);
    captura.connect(mudo);
    mudo.connect(contexto.destination);

    const agrupador = new AgrupadorPcm(AMOSTRAS_POR_BLOCO, (bloco) => copiloto.audio.enviar(quem, bloco.buffer));
    let picoDoIntervalo = 0;
    let ultimoNivelEm = -Infinity;
    captura.port.onmessage = (evento: MessageEvent<Float32Array>) => {
      agrupador.adicionar(evento.data);
      picoDoIntervalo = Math.max(picoDoIntervalo, nivelRms(evento.data));
      const agora = performance.now();
      if (agora - ultimoNivelEm >= INTERVALO_MINIMO_NIVEL_MS) {
        copiloto.audio.nivel(quem, picoDoIntervalo);
        picoDoIntervalo = 0;
        ultimoNivelEm = agora;
      }
    };

    const contextoAberto = contexto;
    let parada = false;
    return () => {
      if (parada) return;
      parada = true;
      captura.port.onmessage = null;
      liberar(stream, contextoAberto);
    };
  } catch (erro) {
    liberar(stream, contexto);
    throw erro;
  }
}

/**
 * Liga a captura das fontes pedidas (`voce`: microfone; `outros`: som do computador) e manda o áudio ao processo
 * principal em PCM de 16 bits e 16 kHz. Se alguma fonte falhar, as que já abriram são fechadas e o erro sobe.
 * Devolve a função que para a captura.
 */
export async function iniciarCaptura(quem: Quem[], microfoneId: string | null): Promise<() => void> {
  const paradores: (() => void)[] = [];
  try {
    for (const q of quem) paradores.push(await abrirFonte(q, microfoneId));
  } catch (erro) {
    for (const parar of paradores) parar();
    throw erro;
  }
  return () => {
    for (const parar of paradores) parar();
  };
}
