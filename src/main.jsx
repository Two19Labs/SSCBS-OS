import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { TimetableProvider } from './context/TimetableContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ConfigProvider } from './context/ConfigContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ConfigProvider>
            <TimetableProvider>
              <NotificationProvider>
                <App />
              </NotificationProvider>
            </TimetableProvider>
          </ConfigProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// Register Service Worker for native push notifications
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration warning:', err);
    });
  });
}



