// src/hooks/useRenderApi.jsx
import { useState, useCallback } from 'react';
import { Coffee } from 'lucide-react';

// 🌟 BASE_URL을 훅 내부에 직접 정의 (utils/api.js 불필요)
const BASE_URL = "https://moon-bbh0.onrender.com";

export function useRenderApi() {
  const [isSleeping, setIsSleeping] = useState(false);

  // 🌟 fetchApi의 통신 기능과 슬립 타이머(애니메이션) 기능을 하나로 합침
  const callApi = useCallback(async (endpoint, options = {}) => {
    let isResolved = false;
    
    // 💡 3초 동안 응답이 없으면 서버 슬립 상태로 간주
    const sleepTimer = setTimeout(() => {
      if (!isResolved) setIsSleeping(true);
    }, 3000);

    const url = `${BASE_URL}${endpoint}`;

    try {
      // 직접 fetch 호출
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      isResolved = true;
      clearTimeout(sleepTimer);
      setIsSleeping(false); 
      
      return result; // JSON 결과 반환

    } catch (error) {
      console.error(`[API 통신 오류] ${endpoint}:`, error);
      isResolved = true;
      clearTimeout(sleepTimer);
      setIsSleeping(false);
      throw error;
    }
  }, []);

  const ServerWakeupOverlay = () => {
    if (!isSleeping) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
         <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
              <Coffee size={64} className="text-[#3B82F6] animate-pulse" />
              <div className="absolute -top-2 -right-4 text-4xl animate-[bounce_2s_infinite]">💤</div>
         </div>
         <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-3 shadow-black drop-shadow-xl text-center">
             서버가 자고 있어요
         </h2>
         <p className="text-[#60A5FA] font-black tracking-wide text-[14px] md:text-[15px] text-center px-6 leading-relaxed">
             무료 인스턴스를 커피를 먹여 깨우는 중입니다.<br className="hidden md:block"/> 최대 30초 정도 소요될 수 있으니 조금만 기다려주세요 🚀
         </p>
      </div>
    );
  };

  return { callApi, ServerWakeupOverlay };
}
