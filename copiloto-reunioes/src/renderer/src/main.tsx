import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './estilos.css';

function App() {
  return <h1>Copiloto de Reuniões</h1>;
}

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
