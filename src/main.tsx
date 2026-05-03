import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { CaptureWindow } from './components/CaptureWindow'
import './index.css'

const isCapture = window.location.hash === '#capture'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isCapture ? <CaptureWindow /> : <App />}
  </React.StrictMode>
)
