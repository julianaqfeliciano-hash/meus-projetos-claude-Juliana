import { describe, expect, it } from 'vitest';
import { AgrupadorPcm, nivelRms, paraPcm16 } from './pcm';

describe('paraPcm16', () => {
  it('converte e limita', () => {
    expect(Array.from(paraPcm16(new Float32Array([0, 1, -1, 2])))).toEqual([0, 32767, -32767, 32767]);
  });

  it('limita também os valores muito negativos', () => {
    expect(Array.from(paraPcm16(new Float32Array([-2, -0.5])))).toEqual([-32767, -16383]);
  });
});

describe('nivelRms', () => {
  it('rms do silêncio é 0', () => {
    expect(nivelRms(new Float32Array(128))).toBe(0);
  });

  it('rms de uma onda quadrada em amplitude 0.5 é 0.5', () => {
    expect(nivelRms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5, 6);
  });

  it('fica entre 0 e 1 mesmo com amostras acima do limite', () => {
    expect(nivelRms(new Float32Array([3, -3]))).toBe(1);
  });

  it('um quadro vazio tem nível 0', () => {
    expect(nivelRms(new Float32Array(0))).toBe(0);
  });
});

describe('AgrupadorPcm', () => {
  it('agrupa em blocos de 1600', () => {
    const blocos: Int16Array[] = [];
    const a = new AgrupadorPcm(1600, (b) => blocos.push(b));
    for (let i = 0; i < 13; i++) a.adicionar(new Float32Array(128)); // 1664 amostras
    expect(blocos).toHaveLength(1);
    expect(blocos[0].length).toBe(1600);
  });

  it('guarda a sobra para o bloco seguinte, sem perder nem repetir amostras', () => {
    const blocos: number[][] = [];
    const a = new AgrupadorPcm(4, (b) => blocos.push(Array.from(b)));
    a.adicionar(new Float32Array([1, 1, 1])); // 3 amostras: ainda não fecha um bloco
    expect(blocos).toEqual([]);
    a.adicionar(new Float32Array([-1, 0, 1, 1, 1, -1, 0])); // fecha 2 blocos e deixa 2 de sobra
    expect(blocos).toEqual([
      [32767, 32767, 32767, -32767],
      [0, 32767, 32767, 32767],
    ]);
    a.adicionar(new Float32Array([0, 0])); // completa o terceiro bloco com a sobra
    expect(blocos[2]).toEqual([-32767, 0, 0, 0]);
  });

  it('cada bloco tem o próprio buffer, do tamanho exato, para seguir pelo IPC', () => {
    const blocos: Int16Array[] = [];
    const a = new AgrupadorPcm(1600, (b) => blocos.push(b));
    a.adicionar(new Float32Array(3200));
    expect(blocos).toHaveLength(2);
    expect(blocos[0].buffer).not.toBe(blocos[1].buffer);
    expect(blocos.map((b) => b.buffer.byteLength)).toEqual([3200, 3200]);
  });

  it('usa blocos de 1600 amostras (100 ms a 16 kHz) quando não se diz o tamanho', () => {
    const blocos: Int16Array[] = [];
    const a = new AgrupadorPcm(undefined, (b) => blocos.push(b));
    a.adicionar(new Float32Array(1600));
    expect(blocos.map((b) => b.length)).toEqual([1600]);
  });

  it('recusa um tamanho de bloco que não é um inteiro positivo', () => {
    expect(() => new AgrupadorPcm(0, () => {})).toThrow(RangeError);
    expect(() => new AgrupadorPcm(1.5, () => {})).toThrow(RangeError);
  });
});
