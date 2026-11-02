import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Painel } from './painel/Painel';
import './estilos.css';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <Painel />
  </StrictMode>,
);
