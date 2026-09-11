import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

// 탭/페이지 간 이동 시 같은 데이터를 다시 조회하지 않도록 하는 전역 캐시.
// staleTime 동안은 캐시된 값을 즉시 보여주고, 만료 후에만 재조회한다.
// 실제 페이지별 fetch를 useQuery로 옮기는 작업은 이후 단계(NewsDesk, QuantDesk 등)에서 진행한다.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
