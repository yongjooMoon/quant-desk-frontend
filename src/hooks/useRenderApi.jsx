// src/hooks/useRenderApi.jsx
import { useState, useCallback, useRef, useEffect } from 'react';

// 🌟 BASE_URL을 훅 내부에 직접 정의
const BASE_URL = "https://moon-bbh0.onrender.com";

// ══════════════════════════════════════════
// 🎮 대기화면 재미 요소 ① 탭 캔들 게임
//   초록 캔들만 터치해서 "익절" — 잘못 누르면 "손절" 카운트
// ══════════════════════════════════════════
function CandleTapGame() {
  const [candles, setCandles] = useState([]);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const idRef = useRef(0);

  useEffect(() => {
    const spawnTimer = setInterval(() => {
      setCandles(prev => {
        if (prev.length >= 6) return prev; // 성능 보호: 동시 최대 6개
        idRef.current += 1;
        return [...prev, {
          id: idRef.current,
          up: Math.random() < 0.55, // 초록(익절) 쪽이 살짝 더 잘 나오게
          x: 8 + Math.random() * 78,
          h: 30 + Math.random() * 34,
        }];
      });
    }, 650);
    return () => clearInterval(spawnTimer);
  }, []);

  const removeCandle = (id) => setCandles(prev => prev.filter(c => c.id !== id));

  const handleHit = (c) => {
    removeCandle(c.id);
    if (c.up) setHits(h => h + 1); else setMisses(m => m + 1);
  };

  const attempts = hits + misses;
  const rate = attempts > 0 ? Math.round((hits / attempts) * 100) : null;

  return (
    <>
      <div className="relative w-[300px] h-56 mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {candles.map(c => (
          <button
            key={c.id}
            onClick={() => handleHit(c)}
            aria-label={c.up ? "초록 캔들 (익절)" : "빨간 캔들 (손절)"}
            className="absolute bottom-0 flex flex-col items-center px-2 py-1 -mx-2 -my-1"
            style={{ left: `${c.x}%`, animation: 'candleRise 2.6s linear forwards' }}
            onAnimationEnd={() => removeCandle(c.id)}
          >
            <div className={`w-[3px] h-3 ${c.up ? 'bg-emerald-400/70' : 'bg-rose-400/70'}`} />
            <div className={`w-4 rounded-[3px] ${c.up ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ height: c.h }} />
          </button>
        ))}
      </div>
      <p className="text-[12px] font-bold text-slate-500 mb-1">🟢 초록 캔들만 터치해서 익절하세요</p>
      <p className="text-[14px] font-black text-white mb-6">
        {attempts === 0 ? '아직 기록 없음' : `승률 ${rate}%  (익절 ${hits} · 손절 ${misses})`}
      </p>
    </>
  );
}

// ══════════════════════════════════════════
// 🎮 대기화면 재미 요소 ② 카드 뒤집기 (퀀트 드립/명언)
//   처음엔 카드 뒷면(패턴)만 보이고, 탭하면 진짜 카드처럼 뒤집히며 내용이 드러남.
//   한 세션(로딩 1회)에는 카드 1장만 — 뒤집은 뒤에는 다시 안 바뀜.
// ══════════════════════════════════════════
const FUN_LINES = [
  "무릎에 사서 어깨에 팔라던데, 제 무릎은 대체 어디 갔을까요.",
  "손절은 습관이고 익절은 재능이라죠.",
  "차트는 후행지표, 후회는 선행지표.",
  "존버는 실력, 물타기는 재능.",
  "오늘의 상한가는 어제의 손절러가 만든다.",
  "떨어지는 칼날은 잡지 말라던데, 캔들은 왜 이렇게 예쁘게 떨어지나요.",
  "분산투자란, 여러 종목에서 골고루 잃는 기술.",
  "장기투자 합니다. 손절 타이밍을 놓쳤을 뿐이에요.",
  "매수는 3초, 후회는 3개월.",
  "이 서버도 물린 제 계좌처럼 회복하는 중입니다.",
];

function LineFlipCard() {
  // 이 세션에서 보여줄 카드 문구 — 처음 한 번만 뽑고 이후 고정 (탭해도 안 바뀜)
  const [line] = useState(() => FUN_LINES[Math.floor(Math.random() * FUN_LINES.length)]);
  const [flipped, setFlipped] = useState(false);

  // 카드 뒷면 — 실제 카드처럼 보이도록 대각선 크로스해치 패턴
  const cardBackPattern = {
    backgroundColor: '#11131C',
    backgroundImage: `
      repeating-linear-gradient(45deg, rgba(124,108,255,0.12) 0px, rgba(124,108,255,0.12) 2px, transparent 2px, transparent 14px),
      repeating-linear-gradient(-45deg, rgba(34,211,238,0.10) 0px, rgba(34,211,238,0.10) 2px, transparent 2px, transparent 14px)
    `,
  };

  return (
    <>
      <div className="[perspective:1400px] w-[210px] h-[290px] mb-4">
        <button
          onClick={() => setFlipped(f => !f)}
          aria-label="카드 뒤집기"
          className={`relative w-full h-full [transform-style:preserve-3d] transition-transform duration-500 ease-out ${flipped ? '[transform:rotateY(180deg)]' : ''}`}
        >
          {/* 카드 뒷면 (처음 보이는 면) */}
          <div
            className="absolute inset-0 [backface-visibility:hidden] rounded-2xl border-[3px] border-white/15 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] overflow-hidden flex items-center justify-center"
            style={cardBackPattern}
          >
            {/* 안쪽 이중 테두리 — 카드 프레임 느낌 */}
            <div className="absolute inset-[9px] rounded-xl border border-white/10 pointer-events-none" />
            {/* 코너 인덱스 마크 (실제 카드의 좌상단/우하단 숫자처럼) */}
            <span className="absolute top-3 left-3.5 text-[12px] font-black tracking-widest text-white/35">Q</span>
            <span className="absolute bottom-3 right-3.5 text-[12px] font-black tracking-widest text-white/35 rotate-180">Q</span>
            {/* 중앙 엠블럼 */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #7C6CFF 0%, #3B82F6 55%, #22D3EE 100%)',
                boxShadow: '0 0 30px rgba(109,92,255,0.5)',
              }}
            >
              <span className="text-white font-black text-xl">Q</span>
            </div>
            <p className="absolute bottom-8 text-[11px] font-bold text-white/40">탭해서 뒤집기</p>
          </div>

          {/* 카드 앞면 (뒤집으면 보이는 면) */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-2xl border-[3px] border-white/15 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] bg-[#11131C] overflow-hidden flex flex-col items-center justify-center px-6 text-center">
            <div className="absolute inset-[9px] rounded-xl border border-white/10 pointer-events-none" />
            <span className="absolute top-3 left-3.5 text-[12px] font-black tracking-widest text-white/20">Q</span>
            <span className="absolute bottom-3 right-3.5 text-[12px] font-black tracking-widest text-white/20 rotate-180">Q</span>

            <span
              className="mb-4 px-3 py-1 rounded-full text-[10px] font-black tracking-wide text-white/70 border border-white/10"
              style={{ background: 'rgba(124,108,255,0.14)' }}
            >
              오늘의 한마디
            </span>
            <p className="text-[14px] font-bold text-slate-200 leading-relaxed">{line}</p>
          </div>
        </button>
      </div>
      <p className="text-[12px] font-bold text-slate-500 mb-6 h-4">{flipped ? '' : '\u00A0'}</p>
    </>
  );
}

export function useRenderApi() {
  const [isSleeping, setIsSleeping] = useState(false);
  // 🎲 이번 대기화면에서 A(캔들 게임)/C(카드 뒤집기) 중 뭘 보여줄지 — sleep 진입 시 1번만 뽑음
  const [funMode, setFunMode] = useState('candle');
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
          setFunMode(Math.random() < 0.5 ? 'candle' : 'card');
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

  // 🌟 useCallback으로 컴포넌트 identity를 고정 — 매 렌더마다 새로 만들어지면
  //    게임/카드의 내부 상태가 중간에 리셋되는 버그가 생길 수 있어서 방지.
  const ServerWakeupOverlay = useCallback(() => {
    // 🌟 터치/클릭한 자리에 오로라 톤의 리플(파문)을 살짝 띄워주는 상태
    const [ripples, setRipples] = useState([]);

    const handleRipple = (e) => {
      // 모션에 민감한 사용자는 리플도 끔 (prefers-reduced-motion 존중)
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      const x = point.clientX - rect.left;
      const y = point.clientY - rect.top;
      const id = `${Date.now()}-${Math.random()}`;

      // 성능 보호를 위해 동시에 떠있는 리플은 최대 5개까지만
      setRipples(prev => [...prev.slice(-4), { id, x, y }]);
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== id));
      }, 900);
    };

    if (!isSleeping) return null;
    return (
      <div
        onPointerDown={handleRipple}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#08090D] overflow-hidden animate-in fade-in duration-300"
      >

         {/* Keyframes: 텍스트 시머 + 진행바 + 리플 + 캔들게임. (오로라 블롭 회전/모핑 애니메이션은 재미 요소와 중복돼서 제거) */}
         <style>{`
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
            @keyframes rippleExpand {
                0%   { transform: translate(-50%, -50%) scale(0); opacity: 0.55; }
                100% { transform: translate(-50%, -50%) scale(22); opacity: 0; }
            }
            @keyframes candleRise {
                0%   { transform: translateY(0); opacity: 0; }
                10%  { opacity: 1; }
                88%  { opacity: 1; }
                100% { transform: translateY(-210px); opacity: 0; }
            }
         `}</style>

         {/* 🌟 터치/클릭 리플 — 정보(텍스트·진행바)를 가리지 않게 pointer-events-none, 은은한 잔상만 남김 */}
         {ripples.map(r => (
            <span
                key={r.id}
                className="pointer-events-none absolute rounded-full"
                style={{
                  left: r.x, top: r.y, width: 10, height: 10,
                  background: 'radial-gradient(circle, rgba(165,180,252,0.55) 0%, rgba(34,211,238,0.25) 45%, rgba(34,211,238,0) 70%)',
                  animation: 'rippleExpand 900ms ease-out forwards',
                }}
            />
         ))}

         {/* 배경 앰비언트 글로우 (깊이감, 레이아웃 흐름 밖이라 공간 차지 없음) */}
         <div
            className="absolute w-[420px] h-[420px] rounded-full blur-[110px] opacity-30 top-1/3 left-1/4"
            style={{ background: '#6D5CFF', animation: 'driftA 9s ease-in-out infinite' }}
         />
         <div
            className="absolute w-[380px] h-[380px] rounded-full blur-[110px] opacity-25 bottom-1/3 right-1/4"
            style={{ background: '#22D3EE', animation: 'driftB 11s ease-in-out infinite' }}
         />

         <h2
            className="text-[19px] md:text-[21px] font-bold tracking-tight mb-2 text-center bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(90deg, #FFFFFF, #A5B4FC, #FFFFFF)',
              backgroundSize: '200% auto',
              animation: 'shimmerText 3s linear infinite',
            }}
         >
             서버를 깨우는 중이에요
         </h2>
         <p className="text-[#7C8598] font-medium text-[13px] md:text-[14px] text-center px-6 leading-relaxed mb-6">
             보통 20~30초 정도 걸려요. 기다리는 동안 이거 한 판 어때요?
         </p>

         {/* 🎮 랜덤으로 뽑힌 재미 요소 (탭 캔들 게임 or 카드 뒤집기) */}
         {funMode === 'candle' ? <CandleTapGame /> : <LineFlipCard />}

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
  }, [isSleeping, funMode]);

  return { callApi, ServerWakeupOverlay };
}
