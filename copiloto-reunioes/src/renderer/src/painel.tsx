import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './estilos.css';

function Painel() {
  return <h1>Painel</h1>;
}

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <Painel />
  </StrictMode>,
);
