import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ConfirmProvider } from './context/ConfirmContext.tsx';
import { ErrorBoundary } from './components/Common/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallbackTitle="Ứng dụng gặp sự cố hiển thị">
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </ErrorBoundary>
);
