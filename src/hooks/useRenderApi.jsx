// src/hooks/useRenderApi.jsx
import { useState, useCallback } from 'react';

// 🌟 BASE_URL을 훅 내부에 직접 정의
const BASE_URL = "https://moon-bbh0.onrender.com";

export function useRenderApi() {
  const [isSleeping, setIsSleeping] = useState(false);

  const callApi = useCallback(async (endpoint, options = {}) => {
    let isDataResolved = false;
    let isPingResolved = false;
    
    // 💡 1. [스마트 감지] 서버 생존 여부만 묻는 초경량 Ping 병렬 요청
    fetch(`${BASE_URL}/`, { method: 'HEAD' })
      .then(() => { isPingResolved = true; })
      .catch(() => { isPingResolved = true; }); // 에러(404 등)가 나도 응답이 온 거면 깬 것임

    // 💡 2. 콜드 스타트 판별 타이머 (미국 서버 레이턴시를 고려하여 4초로 설정!)
    // 4초가 지났는데도 Ping 응답조차 없다면 이건 네크워크 지연이 아니라 확실한 '서버 슬립'입니다.
    const sleepTimer = setTimeout(() => {
      if (!isDataResolved && !isPingResolved) {
        setIsSleeping(true);
      }
    }, 4000);

    const url = `${BASE_URL}${endpoint}`;

    try {
      // 💡 3. 실제 데이터 요청
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
      
      isDataResolved = true;
      clearTimeout(sleepTimer);
      setIsSleeping(false); 
      
      return result;

    } catch (error) {
      console.error(`[API 통신 오류] ${endpoint}:`, error);
      isDataResolved = true;
      clearTimeout(sleepTimer);
      setIsSleeping(false);
      throw error;
    }
  }, []);

  const ServerWakeupOverlay = () => {
    if (!isSleeping) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0B1120]/90 backdrop-blur-md animate-in fade-in duration-300">
         
         {/* 🌟 귀여운 애니메이션을 위한 커스텀 Keyframes CSS */}
         <style>{`
            @keyframes sunRise {
                0% { transform: translateY(60px) scale(0.8); opacity: 0; filter: brightness(0.5); }
                100% { transform: translateY(0px) scale(1.1); opacity: 1; filter: drop-shadow(0 0 20px rgba(250,204,21,0.6)); }
            }
            @keyframes floatCoffee {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                50% { transform: translateY(-8px) rotate(-3deg); }
            }
            @keyframes zzz {
                0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
                50% { opacity: 1; }
                100% { transform: translate(20px, -25px) scale(1.2); opacity: 0; }
            }
         `}</style>
         
         {/* 🌟 해가 뜨고 커피 마시는 귀여운 캐릭터 씬 */}
         <div className="relative w-48 h-48 flex flex-col items-center justify-end mb-6">
             {/* 뒤에서 떠오르는 해 */}
             <div className="absolute top-0 text-7xl animate-[sunRise_2s_ease-out_forwards] z-0">
                 ☀️
             </div>
             
             {/* 잠꼬대 Zzz 애니메이션 */}
             <div className="absolute top-8 right-6 text-2xl text-blue-300 font-black animate-[zzz_2s_ease-in-out_infinite] z-20">
                 z
             </div>
             <div className="absolute top-2 right-2 text-xl text-blue-300 font-black animate-[zzz_2.5s_ease-in-out_infinite_0.5s] z-20">
                 z
             </div>

             {/* 둥둥 떠있는 곰돌이 캐릭터 */}
             <div className="relative z-10 text-[85px] leading-none animate-[floatCoffee_3s_ease-in-out_infinite] filter drop-shadow-xl">
                 🐻☕
             </div>
         </div>

         <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-3 shadow-black drop-shadow-xl text-center">
             백엔드 서버가 쿨쿨 자고 있어요
         </h2>
         <p className="text-[#60A5FA] font-black tracking-wide text-[14px] md:text-[15px] text-center px-6 leading-relaxed">
             아침 해가 떴습니다! 곰돌이가 모닝 커피를 내려서 서버를 깨우고 있어요.<br className="hidden md:block"/> 
             (무료 티어 인스턴스 부팅에 약 20~30초 정도 소요됩니다 🚀)
         </p>
      </div>
    );
  };

  return { callApi, ServerWakeupOverlay };
}
```eof
