// src/hooks/useRenderApi.jsx
import { useState, useCallback, useRef } from 'react';

// 🌟 BASE_URL을 훅 내부에 직접 정의
const BASE_URL = "https://moon-bbh0.onrender.com";

export function useRenderApi() {
  const [isSleeping, setIsSleeping] = useState(false);
  // 💡 컴포넌트가 언마운트되거나 재요청될 때 타이머를 안전하게 클리어하기 위해 useRef 사용
  const timerRef = useRef(null); 

  const callApi = useCallback(async (endpoint, options = {}) => {
    // 이전 타이머가 있다면 초기화
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    let isResolved = false;
    
    // 💡 1. 콜드 스타트 판별 타이머 (4초)
    // 별도의 Ping 요청 없이, 메인 데이터 요청이 4초를 넘어가면 무조건 서버가 잔다고 판단!
    // 이렇게 하면 콘솔창에 404나 502 같은 불필요한 에러가 찍히지 않습니다.
    timerRef.current = setTimeout(() => {
      if (!isResolved) {
        setIsSleeping(true);
      }
    }, 4000);

    const url = `${BASE_URL}${endpoint}`;

    try {
      // 💡 2. 실제 데이터 요청
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
      
      // 💡 3. 정상 응답 시 타이머 해제 및 오버레이 닫기
      isResolved = true;
      clearTimeout(timerRef.current);
      setIsSleeping(false); 
      
      return result;

    } catch (error) {
      // 💡 4. 에러 발생 시에도 무한 로딩 방지를 위해 오버레이 닫기
      isResolved = true;
      clearTimeout(timerRef.current);
      setIsSleeping(false);
      
      console.error(`[API 통신 오류] ${endpoint}:`, error);
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
             (인스턴스 부팅에 약 20~30초 정도 소요됩니다 🚀)
         </p>
      </div>
    );
  };

  return { callApi, ServerWakeupOverlay };
}
