import { useState, useCallback } from 'react';
import { Coffee } from 'lucide-react';
import { fetchApi } from '../utils/api';

/**
 * Render.com 특유의 무료 티어 콜드 스타트(서버 슬립) 현상 대응을 위한 커스텀 훅
 * - API 요청 후 3초 이상 지연되면 "서버 깨우기" 애니메이션 오버레이를 표시합니다.
 */
export function useRenderApi() {
  const [isSleeping, setIsSleeping] = useState(false);

  /**
   * utils/api.js의 fetchApi를 래핑하여 슬립 타이머 로직 추가
   */
  const callApi = useCallback(async (endpoint, options = {}) => {
    let isResolved = false;
    
    // 💡 3초(3000ms) 동안 응답이 없으면 Render 서버가 슬립 상태인 것으로 간주하고 오버레이 작동
    const sleepTimer = setTimeout(() => {
      if (!isResolved) setIsSleeping(true);
    }, 3000);

    try {
      // 💡 공통 유틸리티 fetchApi 사용
      const response = await fetchApi(endpoint, options);
      isResolved = true;
      clearTimeout(sleepTimer);
      setIsSleeping(false); // 응답이 오면 즉시 오버레이 해제
      return response;
    } catch (error) {
      isResolved = true;
      clearTimeout(sleepTimer);
      setIsSleeping(false);
      throw error;
    }
  }, []);

  /**
   * 공통으로 띄워줄 서버 기상 애니메이션 컴포넌트
   * (사용하는 페이지의 JSX 루트에 삽입해야 합니다)
   */
  const ServerWakeupOverlay = () => {
    if (!isSleeping) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
         <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
              <Coffee size={64} className="text-[#3B82F6] animate-pulse" />
              <div className="absolute -top-2 -right-4 text-4xl animate-[bounce_2s_infinite]">💤</div>
         </div>
         <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-3 shadow-black drop-shadow-xl text-center">
             백엔드 서버가 자고 있어요
         </h2>
         <p className="text-[#60A5FA] font-black tracking-wide text-[14px] md:text-[15px] text-center px-6 leading-relaxed">
             무료 인스턴스를 커피를 먹여 깨우는 중입니다.<br className="hidden md:block"/> 최대 30초 정도 소요될 수 있으니 조금만 기다려주세요 🚀
         </p>
      </div>
    );
  };

  return { callApi, ServerWakeupOverlay };
}
