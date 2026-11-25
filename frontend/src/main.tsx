import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './app/AppRoutes'
import './styles/global.css'

const root = document.getElementById('root')

if (!root) throw new Error('Không tìm thấy phần tử gốc của ứng dụng PAW.')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
)
