// O pdf.js não traz tipos para o worker; ele só é entregue ao pdf.js (ver pdf.ts), nunca usado direto.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs';
