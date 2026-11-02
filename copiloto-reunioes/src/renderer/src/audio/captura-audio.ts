import type { Quem } from '../../../shared/tipos';
import { copiloto } from '../api';
import { AgrupadorPcm, nivelRms } from './pcm';

const TAXA_DE_AMOSTRAGEM = 16_000;
const AMOSTRAS_POR_BLOCO = 1600; // 100 ms
const INTERVALO_MINIMO_NIVEL_MS = 200; // no máximo 5 vezes por segundo
const ERRO_SEM_SOM_DO_COMPUTADOR = 'O Windows não entregou o som do computador';
const NOME_QUEM: Record<Quem, string> = { voce: 'Você', outros: 'Outros' };

/** Traduz o erro do navegador (em inglês) para uma mensagem que a usuária entende. O original vai para o console. */
function traduzirErroDeCaptura(quem: Quem, erro: unknown): Error {
  console.warn(
    `Falha ao abrir a captura de áudio (${quem}):`,
    erro instanceof DOMException ? `${erro.name}: ${erro.message}` : erro,
  );
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
        ? 'A captura do som do computador não foi permitida. Clique em “Tentar de novo”.'
        : 'Não consegui capturar o som do computador.';
  }
  return new Error(mensagem, { cause: erro });
}

// O navegador só deixa pedir a captura da tela com "ação do usuário", e ela vale por poucos segundos depois do clique.
// Quem inicia a reunião chama `prepararSomDoComputador` dentro do clique; o pedido fica guardado até o comando de
// captura do processo principal chegar (depois de ler os documentos e contar os tokens, o que pode demorar).
let somPreparado: Promise<MediaStream> | null = null;

/** O processo principal responde com a tela inteira e o som do computador (loopback), sem seletor. A faixa de vídeo
 *  fica ligada, a 1 quadro por segundo: parar o vídeo poderia encerrar também o áudio. */
async function pedirSomDoComputador(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getDisplayMedia({ audio: true, video: { frameRate: 1 } });
  } catch (erro) {
    throw traduzirErroDeCaptura('outros', erro);
  }
}

/** Pede o som do computador já, para ser chamada de dentro de um clique (antes de qualquer `await`). */
export function prepararSomDoComputador(): void {
  descartarSomPreparado();
  const pedido = pedirSomDoComputador();
  // Sem ninguém esperando por ele ainda, uma falha não pode virar "rejeição não tratada"; quem o usar recebe o erro.
  pedido.catch(() => undefined);
  somPreparado = pedido;
}

/** Desiste do pedido de `prepararSomDoComputador`, parando as faixas se ele já chegou (ou quando chegar). */
export function descartarSomPreparado(): void {
  const pedido = somPreparado;
  somPreparado = null;
  pedido?.then(
    (stream) => {
      for (const faixa of stream.getTracks()) faixa.stop();
    },
    () => undefined, // a falha já foi registrada em `traduzirErroDeCaptura`
  );
}

async function obterStream(quem: Quem, microfoneId: string | null): Promise<MediaStream> {
  if (quem === 'outros') {
    const preparado = somPreparado;
    somPreparado = null;
    return preparado ?? pedirSomDoComputador();
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: microfoneId ?? undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
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

interface FonteAberta {
  parar: () => void;
  faixasDeAudio: MediaStreamTrack[];
}

/** Abre uma fonte (microfone ou som do computador). */
async function abrirFonte(quem: Quem, microfoneId: string | null): Promise<FonteAberta> {
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
    return {
      faixasDeAudio: stream.getAudioTracks(),
      parar: () => {
        if (parada) return;
        parada = true;
        captura.port.onmessage = null;
        liberar(stream, contextoAberto);
      },
    };
  } catch (erro) {
    liberar(stream, contexto);
    throw erro;
  }
}

/**
 * Liga a captura das fontes pedidas (`voce`: microfone; `outros`: som do computador) e manda o áudio ao processo
 * principal em PCM de 16 bits e 16 kHz. As fontes abrem ao mesmo tempo, para que o pedido do som do computador (quando
 * não foi preparado antes) ainda aconteça dentro do clique que a chamou. Se alguma falhar, as que já abriram são
 * fechadas e o erro sobe. Se uma faixa de áudio acabar sozinha (microfone desligado da tomada, por exemplo), a captura
 * inteira para e `aoInterromper` recebe o motivo. Devolve a função que para a captura.
 */
export async function iniciarCaptura(
  quem: Quem[],
  microfoneId: string | null,
  aoInterromper?: (erro: Error) => void,
): Promise<() => void> {
  const resultados = await Promise.allSettled(quem.map((q) => abrirFonte(q, microfoneId)));
  const abertas = resultados.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const falha = resultados.find((r) => r.status === 'rejected');
  if (falha) {
    for (const fonte of abertas) fonte.parar();
    throw falha.reason;
  }

  let ligada = true;
  const pararTudo = () => {
    if (!ligada) return;
    ligada = false;
    for (const fonte of abertas) fonte.parar();
  };
  // `stop()` não dispara `ended`: o evento só vem de uma faixa que acabou por conta própria.
  quem.forEach((q, i) => {
    for (const faixa of abertas[i].faixasDeAudio) {
      faixa.addEventListener(
        'ended',
        () => {
          if (!ligada) return;
          pararTudo();
          aoInterromper?.(new Error(`A captura de ${NOME_QUEM[q]} foi interrompida.`));
        },
        { once: true },
      );
    }
  });
  return pararTudo;
}
