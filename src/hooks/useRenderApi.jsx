// src/hooks/useRenderApi.jsx
import { useState, useCallback, useRef, useEffect } from 'react';

// 🌟 BASE_URL을 훅 내부에 직접 정의
const BASE_URL = "https://moon-bbh0.onrender.com";

export function useRenderApi() {
  const [isSleeping, setIsSleeping] = useState(false);
  // 💡 컴포넌트가 언마운트되거나 재요청될 때 타이머를 안전하게 클리어하기 위해 useRef 사용
  const timerRef = useRef(null); 

  // 🌟 [추가] 최초 1회 방문 기록(Logging)을 백엔드로 쏘는 로직
  useEffect(() => {
    // 세션 스토리지를 이용해 새로고침 할 때마다 무한으로 찍히는 것을 방지
    if (!sessionStorage.getItem('visited_logged')) {
      const logVisit = async () => {
        try {
          // 1. 브라우저의 깐깐한 보안 정책을 피해 프론트엔드에서 확실하게 잡을 수 있는 정보 추출
          const referer = document.referrer || "Direct"; // 어디서 클릭해서 왔는지
          const userAgent = navigator.userAgent; // 어떤 기기/앱(리멤버, 카톡 등)으로 들어왔는지
          const currentUrl = window.location.href; // 현재 사용자가 보고 있는 주소

          // 2. 백엔드의 로깅 전용 API로 바구니(Body)에 담아서 던짐
          await fetch(`${BASE_URL}/api/log-visit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referer: referer,
              user_agent: userAgent,
              screen_id: currentUrl
            })
          });
          
          // 성공하든 실패하든 세션에 기록을 남겨 다음번 렌더링 시 중복 호출 방지
          sessionStorage.setItem('visited_logged', 'true');
        } catch (error) {
          console.error("Visit logging failed (silent)", error);
        }
      };
      logVisit();
    }
  }, []);

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
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#08090D] overflow-hidden animate-in fade-in duration-300">

         {/* 오로라 블롭 시그니처 모션을 위한 Keyframes */}
         <style>{`
            @keyframes auroraSpin {
                to { transform: rotate(360deg); }
            }
            @keyframes blobMorph {
                0%   { border-radius: 42% 58% 65% 35% / 45% 45% 55% 55%; transform: rotate(0deg) scale(1); }
                50%  { border-radius: 63% 37% 30% 70% / 62% 35% 65% 38%; transform: rotate(180deg) scale(1.12); }
                100% { border-radius: 42% 58% 65% 35% / 45% 45% 55% 55%; transform: rotate(360deg) scale(1); }
            }
            @keyframes driftA {
                0%, 100% { transform: translate(-8%, -6%) scale(1); }
                50% { transform: translate(6%, 4%) scale(1.15); }
            }
            @keyframes driftB {
                0%, 100% { transform: translate(10%, 8%) scale(1); }
                50% { transform: translate(-6%, -5%) scale(1.1); }
            }
            @keyframes shimmerText {
                0% { background-position: 0% 50%; }
                100% { background-position: 200% 50%; }
            }
            @keyframes lineGrow {
                0% { width: 6%; }
                50% { width: 70%; }
                100% { width: 88%; }
            }
            @keyframes lineGlow {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
            }
         `}</style>

         {/* 배경 앰비언트 글로우 (깊이감) */}
         <div
            className="absolute w-[420px] h-[420px] rounded-full blur-[110px] opacity-30 top-1/3 left-1/4"
            style={{ background: '#6D5CFF', animation: 'driftA 9s ease-in-out infinite' }}
         />
         <div
            className="absolute w-[380px] h-[380px] rounded-full blur-[110px] opacity-25 bottom-1/3 right-1/4"
            style={{ background: '#22D3EE', animation: 'driftB 11s ease-in-out infinite' }}
         />

         {/* 시그니처: 모핑되는 오로라 블롭 */}
         <div className="relative w-28 h-28 mb-9 flex items-center justify-center">
             <div
                className="absolute w-full h-full rounded-full blur-2xl opacity-80"
                style={{
                  background: 'conic-gradient(from 0deg, #6D5CFF, #3B82F6, #22D3EE, #6D5CFF)',
                  animation: 'auroraSpin 3.2s linear infinite',
                }}
             />
             <div
                className="absolute w-16 h-16"
                style={{
                  background: 'linear-gradient(135deg, #7C6CFF 0%, #3B82F6 55%, #22D3EE 100%)',
                  animation: 'blobMorph 4.2s ease-in-out infinite',
                  boxShadow: '0 0 40px rgba(109,92,255,0.55)',
                }}
             />
         </div>

         <h2
            className="text-[21px] md:text-[23px] font-bold tracking-tight mb-2 text-center bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(90deg, #FFFFFF, #A5B4FC, #FFFFFF)',
              backgroundSize: '200% auto',
              animation: 'shimmerText 3s linear infinite',
            }}
         >
             서버를 깨우는 중이에요
         </h2>
         <p className="text-[#7C8598] font-medium text-[14px] md:text-[15px] text-center px-6 leading-relaxed mb-7">
             접속이 뜸했던 서버가 다시 살아나고 있어요<br/>
             보통 20~30초 정도 걸려요
         </p>

         {/* 진행 바 */}
         <div className="w-[190px] h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
             <div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #6D5CFF, #22D3EE)',
                  animation: 'lineGrow 6s ease-out forwards, lineGlow 1.6s ease-in-out infinite',
                }}
             />
         </div>
      </div>
    );
  };

  return { callApi, ServerWakeupOverlay };
}
