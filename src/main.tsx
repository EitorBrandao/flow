import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErroApp from './ui/ErroApp';
import { registrarAtualizacaoAutomatica } from './pwa';
import './styles.css';

if (navigator.storage?.persist) {
  void navigator.storage.persist();
}

registrarAtualizacaoAutomatica();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErroApp>
      <App />
    </ErroApp>
  </StrictMode>,
);
