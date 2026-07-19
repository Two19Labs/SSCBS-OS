import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { TimetableProvider } from './context/TimetableContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <TimetableProvider>
          <App />
        </TimetableProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)

