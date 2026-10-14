import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ConfirmProvider } from './context/ConfirmContext.tsx';

createRoot(document.getElementById('root')!).render(
  <ConfirmProvider>
    <App />
  </ConfirmProvider>
);
