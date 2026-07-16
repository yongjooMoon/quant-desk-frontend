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
    // 🌟 [추가] options.background가 true면 백그라운드 폴링이므로 오버레이 팝업을 띄우지 않습니다.
    if (!options.background) {
      timerRef.current = setTimeout(() => {
        if (!isResolved) {
          setIsSleeping(true);
        }
      }, 4000);
    }

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
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsSleeping(false); 
      
      return result;

    } catch (error) {
      // 💡 4. 에러 발생 시에도 무한 로딩 방지를 위해 오버레이 닫기
      isResolved = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsSleeping(false);
      
      console.error(`[API 통신 오류] ${endpoint}:`, error);
      throw error;
    }
  }, []);

  const ServerWakeupOverlay = () => {
    if (!isSleeping) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/95 backdrop-blur-xl animate-in fade-in duration-300">

         {/* Toss 스타일 미니멀 모션을 위한 Keyframes */}
         <style>{`
            @keyframes ringSpin {
                to { transform: rotate(360deg); }
            }
            @keyframes ringPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }
            @keyframes dotBlink {
                0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
                40% { opacity: 1; transform: scale(1); }
            }
            @keyframes barGrow {
                0% { width: 8%; }
                50% { width: 78%; }
                100% { width: 92%; }
            }
         `}</style>

         {/* 원형 로딩 인디케이터 */}
         <div className="relative w-16 h-16 mb-8">
             <div className="absolute inset-0 rounded-full border-[3px] border-[#E8EBF3]" />
             <div
                className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#3182F6] border-r-[#3182F6]"
                style={{ animation: 'ringSpin 0.9s linear infinite' }}
             />
             <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ animation: 'ringPulse 1.8s ease-in-out infinite' }}
             >
                <div className="w-2.5 h-2.5 rounded-full bg-[#3182F6]" />
             </div>
         </div>

         <h2 className="text-[20px] md:text-[22px] font-bold text-[#191F28] tracking-tight mb-2 text-center">
             서버를 준비하고 있어요
         </h2>
         <p className="text-[#8B95A1] font-medium text-[14px] md:text-[15px] text-center px-6 leading-relaxed mb-6">
             접속이 오랜만이라 서버가 깨어나는 중이에요<br className="hidden md:block"/>
             보통 20~30초 정도 걸려요
         </p>

         {/* 진행 바 */}
         <div className="w-[180px] h-1 rounded-full bg-[#F2F4F6] overflow-hidden mb-3">
             <div
                className="h-full rounded-full bg-[#3182F6]"
                style={{ animation: 'barGrow 6s ease-out forwards' }}
             />
         </div>

         {/* 점 3개 로딩 문구 */}
         <div className="flex items-center gap-1">
             <span className="text-[13px] text-[#B0B8C1] font-medium">잠시만 기다려주세요</span>
             <span className="flex gap-[3px] ml-0.5">
                <span className="w-1 h-1 rounded-full bg-[#B0B8C1]" style={{ animation: 'dotBlink 1.4s ease-in-out infinite' }} />
                <span className="w-1 h-1 rounded-full bg-[#B0B8C1]" style={{ animation: 'dotBlink 1.4s ease-in-out 0.2s infinite' }} />
                <span className="w-1 h-1 rounded-full bg-[#B0B8C1]" style={{ animation: 'dotBlink 1.4s ease-in-out 0.4s infinite' }} />
             </span>
         </div>
      </div>
    );
  };

  return { callApi, ServerWakeupOverlay };
}
