/* global AudioWorkletProcessor, registerProcessor */

// Roda na thread de áudio: copia o canal 0 de cada quadro (128 amostras) e manda para a página, que agrupa
// em blocos e envia ao processo principal. Fica em `public/` porque o `audioWorklet.addModule` carrega o
// arquivo pelo endereço, sem passar pelo bundler.
class CapturaPcm extends AudioWorkletProcessor {
  process(entradas) {
    const canal = entradas[0]?.[0];
    if (canal) {
      const copia = canal.slice();
      this.port.postMessage(copia, [copia.buffer]);
    }
    return true;
  }
}

registerProcessor('captura-pcm', CapturaPcm);
