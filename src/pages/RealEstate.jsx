import { Building2, Search, Download, RefreshCcw, Calendar } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
// 🌟 공통 API 훅 임포트
import { useRenderApi } from '../hooks/useRenderApi';

export default function RealEstate() {
const guMap = {
'11110': '종로구', '11140': '중구', '11170': '용산구', '11200': '성동구', '11215': '광진구',
'11230': '동대문구', '11260': '중랑구', '11290': '성북구', '11305': '강북구', '11320': '도봉구',
'11350': '노원구', '11380': '은평구', '11410': '서대문구', '11440': '마포구', '11470': '양천구',
'11500': '강서구', '11530': '구로구', '11545': '금천구', '11560': '영등포구', '11590': '동작구',
'11620': '관악구', '11650': '서초구', '11680': '강남구', '11710': '송파구', '11740': '강동구'
};

const dongMap = {
'11110': ['청운동', '신교동', '궁정동', '효자동', '창성동', '통의동', '적선동', '통인동', '누상동', '누하동', '옥인동', '체부동', '필운동', '내자동', '사직동', '도렴동', '당주동', '내수동', '세종로', '신문로1가', '신문로2가', '청진동', '서린동', '수송동', '중학동', '종로1가', '공평동', '관훈동', '견지동', '와룡동', '권농동', '운니동', '익선동', '경운동', '관철동', '인사동', '낙원동', '종로2가', '팔판동', '삼청동', '안국동', '소격동', '화동', '사간동', '송현동', '가회동', '송월동', '홍기동', '신영동', '구기동', '평창동', '부암동', '홍지동', '무악동', '교남동', '평동', '홍파동', '교북동', '행촌동', '종로3가', '관수동', '장사동', '훈정동', '묘동', '봉익동', '돈의동', '종로4가', '인의동', '예지동', '원남동', '연지동', '종로5가', '종로6가', '충신동', '효제동', '연건동', '이화동', '율곡동', '동숭동', '혜화동', '명륜1가', '명륜2가', '명륜3가', '명륜4가', '명륜동', '창신동', '숭인동'],
'11140': ['무교동', '다동', '태평로1가', '을지로1가', '태평로2가', '남대문로1가', '삼각동', '수하동', '장교동', '수표동', '소공동', '남창동', '북창동', '태평로', '남대문로', '봉래동', '회현동', '충무로', '명동', '남산동', '저동', '인현동', '예관동', '묵정동', '필동', '남학동', '주자동', '예장동', '장충동', '광희동', '쌍림동', '을지로', '주교동', '방산동', '오장동', '입정동', '산림동', '초동', '신당동', '흥인동', '무학동', '황학동', '서소문동', '정동', '순화동', '의주로', '충정로', '만리동'],
'11170': ['후암동', '용산동', '갈월동', '남영동', '동자동', '서계동', '청파동', '원효로', '신창동', '산천동', '청암동', '효창동', '도원동', '용문동', '문배동', '신계동', '한강로', '이촌동', '이태원동', '한남동', '동빙고동', '서빙고동', '주성동', '보광동'],
'11200': ['상왕십리동', '하왕십리동', '홍익동', '도선동', '마장동', '사근동', '행당동', '응봉동', '금호동', '옥수동', '성수동', '송정동', '용답동'],
'11215': ['중곡동', '능동', '구의동', '광장동', '자양동', '화양동', '군자동'],
'11230': ['신설동', '용두동', '제기동', '전농동', '답십리동', '장안동', '청량리동', '회기동', '휘경동', '이문동'],
'11260': ['면목동', '상봉동', '중화동', '묵동', '망우동', '신내동'],
'11290': ['성북동', '돈암동', '동소문동', '삼선동', '동선동', '안암동', '보문동', '정릉동', '길음동', '종암동', '하월곡동', '상월곡동', '장위동', '석관동'],
'11305': ['미아동', '번동', '수유동', '우이동'],
'11320': ['쌍문동', '방학동', '창동', '도봉동'],
'11350': ['월계동', '공릉동', '하계동', '상계동', '중계동'],
'11380': ['수색동', '녹번동', '불광동', '갈현동', '구산동', '대조동', '응암동', '역촌동', '신사동', '증산동', '진관동'],
'11410': ['충정로', '합동', '미근동', '냉천동', '천연동', '옥천동', '영천동', '현저동', '북아현동', '홍제동', '대현동', '대신동', '신촌동', '봉원동', '창천동', '연희동', '홍은동', '북가좌동', '남가좌동'],
'11440': ['아현동', '공덕동', '신공덕동', '도화동', '용강동', '토정동', '마포동', '대흥동', '염리동', '노고산동', '신수동', '현석동', '구수동', '창전동', '상수동', '하중동', '신정동', '당인동', '서교동', '동교동', '합정동', '망원동', '연남동', '성산동', '중동', '상암동'],
'11470': ['신정동', '목동', '신월동'],
'11500': ['염창동', '등촌동', '화곡동', '가양동', '마곡동', '내발산동', '외발산동', '방화동', '개화동', '과해동', '공항동', '오곡동', '오쇠동'],
'11530': ['신도림동', '구로동', '가리봉동', '고척동', '개봉동', '오류동', '궁동', '온수동', '천왕동', '항동'],
'11545': ['가산동', '독산동', '시흥동'],
'11560': ['영등포동', '여의도동', '당산동', '도림동', '문래동', '양평동', '양화동', '신길동', '대림동'],
'11590': ['노량진동', '상도동', '본동', '흑석동', '동작동', '사당동', '대방동', '신대방동'],
'11620': ['봉천동', '신림동', '남현동'],
'11650': ['방배동', '양재동', '우면동', '원지동', '잠원동', '서초동', '내곡동', '염곡동', '신원동'],
'11680': ['역삼동', '개포동', '청담동', '삼성동', '대치동', '신사동', '논현동', '압구정동', '세곡동', '자곡동', '율현동', '일원동', '수서동', '도곡동'],
'11710': ['잠실동', '신천동', '풍납동', '송파동', '석촌동', '삼전동', '가락동', '문정동', '장지동', '방이동', '오금동', '거여동', '마천동'],
'11740': ['명일동', '고덕동', '상일동', '길동', '둔촌동', '암사동', '성내동', '천호동', '강일동']
};

const [guCode, setGuCode] = useState("11680"); // 강남구 기본값
const [dong, setDong] = useState("전체 (구 단위)");

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

// 백틱()을 사용하여 템플릿 리터럴 정상 동작 const [startDate, setStartDate] = useState(${currentYear}-01-01`);
const [endDate, setEndDate] = useState(`${currentYear}-${currentMonth}-01`);

const [filters, setFilters] = useState("");

const [loading, setLoading] = useState(false);
const [logs, setLogs] = useState("");
const [error, setError] = useState("");
const [downloadReady, setDownloadReady] = useState(false);

// 🌟 공통 훅에서 오버레이 애니메이션만 가져옵니다.
const { ServerWakeupOverlay } = useRenderApi();
const [isSleeping, setIsSleeping] = useState(false); // SSE 전용 슬립 상태 관리

const logEndRef = useRef(null);

useEffect(() => {
if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
}, [logs]);

const handleBuild = () => {
setLoading(true);
setError("");
setDownloadReady(false);
setIsSleeping(false);

const targetDong = dong.startsWith("전체") ? "전체" : dong;
const initialLog = `🚀 부동산 데이터 대시보드 빌드 시작...\n🔗 자치구: ${guMap[guCode]} | 법정동: ${targetDong}\n📅 기간: ${startDate} ~ ${endDate}\n\n`;
setLogs(initialLog);

// 💡 URL 수정: 프록시 기반의 상대 경로 API 사용
const url = `/api/realestate/build-stream?gu_code=${guCode}&gu_name=${encodeURIComponent(guMap[guCode])}&dong=${encodeURIComponent(targetDong)}&start_date=${startDate}&end_date=${endDate}&filters=${encodeURIComponent(filters)}`;

// 💡 SSE 스트리밍 특성을 고려한 커스텀 슬립 타이머 작동
let isConnected = false;
const sleepTimer = setTimeout(() => {
  if (!isConnected) setIsSleeping(true);
}, 3000);

const eventSource = new EventSource(url);

eventSource.onmessage = (event) => {
  // 💡 첫 메시지를 받으면 무조건 연결된 것으로 간주하고 애니메이션 종료
  if (!isConnected) {
    isConnected = true;
    clearTimeout(sleepTimer);
    setIsSleeping(false);
  }

  const data = JSON.parse(event.data);
  if (data.status === "log" || data.status === "progress") {
    setLogs(initialLog + data.message + "\n");
  } else if (data.status === "error") {
    setError(data.message);
    setLoading(false);
    eventSource.close();
  } else if (data.status === "done") {
    setLogs(prev => prev + "\n✅ " + data.message + "\n\n하단의 다운로드 버튼을 눌러주세요!");
    setDownloadReady(true);
    setLoading(false);
    eventSource.close();
  }
};

eventSource.onerror = (e) => {
  isConnected = true;
  clearTimeout(sleepTimer);
  setIsSleeping(false);

  setError("서버 에러가 발생했습니다. 백엔드(main.py)의 실시간 터미널 로그를 확인해 주세요.");
  setLoading(false);
  eventSource.close();
};


};

const handleDownload = () => {
// 💡 URL 수정: 다운로드 역시 상대 경로 API 사용
window.location.href = "/api/realestate/download";
};

// 🌟 구 목록 가나다순 정렬 처리
const sortedGuEntries = Object.entries(guMap).sort((a, b) => a[1].localeCompare(b[1]));

return (
  {/* 🌟 통신 지연 시 띄워주는 서버 기상 오버레이 */}
  {isSleeping && <ServerWakeupOverlay />}

  {/* 🌟 타이틀 섹션 (디자인 통일) */}
  <div className="mb-10">
    <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight mb-3">
      <Building2 className="text-[#3182F6]" size={36} />
      아파트 실거래가 정밀 분석 엔진
    </h1>
    <p className="text-[16px] md:text-[18px] font-bold text-slate-500 dark:text-slate-400">
      국토교통부 실거래가 데이터와 K-APT 단지 정보를 크로스체킹하여 엑셀 리포트를 추출합니다.
    </p>
  </div>

  {/* 🌟 메인 폼 컨테이너 */}
  <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 p-8 md:p-10 rounded-3xl shadow-lg mb-10 w-full relative overflow-hidden">
      {/* 장식용 블러 원형 */}
      <div className={`absolute top-[-50px] right-[-50px] w-64 h-64 bg-[#3182F6]/10 rounded-full blur-[80px] pointer-events-none`}></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 relative z-10">
          <div>
              <label className="block text-[15px] font-black text-slate-700 dark:text-slate-300 mb-3 tracking-wide">자치구</label>
              <select
                value={guCode} onChange={e => {setGuCode(e.target.value); setDong("전체 (구 단위)");}}
                className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-2xl px-5 py-4 outline-none font-bold text-[16px] hover:border-blue-400 dark:hover:border-blue-500 transition-colors appearance-none cursor-pointer"
              >
                  {sortedGuEntries.map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                  ))}
              </select>
          </div>
          <div>
              <label className="block text-[15px] font-black text-slate-700 dark:text-slate-300 mb-3 tracking-wide">법정동</label>
              <select
                value={dong} onChange={e => setDong(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-2xl px-5 py-4 outline-none font-bold text-[16px] hover:border-blue-400 dark:hover:border-blue-500 transition-colors appearance-none cursor-pointer"
              >
                  <option>전체 (구 단위)</option>
                  {[...(dongMap[guCode] || [])].sort().map(d => (
                      <option key={d} value={d}>{d}</option>
                  ))}
              </select>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 relative z-10">
          <div>
              <label className="block text-[15px] font-black text-slate-700 dark:text-slate-300 mb-3 tracking-wide">시작 날짜</label>
              <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <Calendar size={20} className="text-slate-400" />
                  </div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-2xl pl-14 pr-5 py-4 outline-none font-bold text-[16px] hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:dark:invert"
                  />
              </div>
          </div>
          <div>
              <label className="block text-[15px] font-black text-slate-700 dark:text-slate-300 mb-3 tracking-wide">종료 날짜</label>
              <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <Calendar size={20} className="text-slate-400" />
                  </div>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-2xl pl-14 pr-5 py-4 outline-none font-bold text-[16px] hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:dark:invert"
                  />
              </div>
          </div>
      </div>

      <div className="mb-10 relative z-10">
          <label className="block text-[15px] font-black text-slate-700 dark:text-slate-300 mb-3 tracking-wide">단지명 필터 (선택, 쉼표 구분)</label>
          <input
            type="text"
            value={filters}
            onChange={e => setFilters(e.target.value)}
            placeholder="예: 자이, 래미안, 힐스테이트"
            className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-2xl px-5 py-4 outline-none font-bold text-[16px] hover:border-blue-400 dark:hover:border-blue-500 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
          />
      </div>

      <div className="pt-8 border-t border-slate-200 dark:border-slate-800 relative z-10">
          <button
            onClick={handleBuild} disabled={loading}
            className="w-full bg-[#F04452] hover:bg-[#D93B47] disabled:bg-slate-400 dark:disabled:bg-slate-700 text-white font-black text-[18px] py-5 rounded-2xl shadow-xl hover:shadow-2xl transition-all flex justify-center items-center gap-3 disabled:cursor-not-allowed transform active:scale-[0.99]"
          >
              {loading ? <RefreshCcw size={24} className="animate-spin" /> : <Search size={24} />}
              {loading ? "데이터 수집 및 엑셀 생성 중... (최대 1~2분 소요)" : "✨ 부동산 데이터 대시보드 빌드"}
          </button>
      </div>
  </div>

  {/* 🌟 터미널 로그 화면 */}
  {(logs || loading || error) && (
    <div className="bg-[#0B1120] border border-slate-800 p-5 rounded-3xl mb-10 font-mono text-[14px] shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
        <div className="absolute top-0 left-0 w-full h-10 bg-[#1E293B] flex items-center px-5 border-b border-slate-700/80">
            <div className="flex gap-2 mr-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-slate-400 font-bold text-xs tracking-widest uppercase">Terminal Log</span>
        </div>
        <div className="h-56 overflow-y-auto mt-10 text-slate-300 whitespace-pre-wrap leading-loose custom-scrollbar pr-2">
            {logs}
            {error && <div className="text-[#F04452] font-black mt-6 border-t border-red-900/50 pt-6">❌ ERROR: {error}</div>}
            <div ref={logEndRef} />
        </div>
        <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }`}</style>
    </div>
  )}

  {/* 🌟 다운로드 완료 버튼 */}
  {downloadReady && !error && (
    <div className="p-10 rounded-3xl flex flex-col items-center justify-center text-center transition-all bg-[#00B464]/10 dark:bg-[#00B464]/5 border border-[#00B464]/30 dark:border-[#00B464]/20 animate-in zoom-in-95">
        <p className="mb-6 font-black text-[#00B464] text-[18px]">
          🎉 데이터 추출 성공! 아래 버튼을 눌러 엑셀 파일을 다운로드하세요.
        </p>
        <button
          onClick={handleDownload}
          className="bg-[#00B464] hover:bg-[#009A54] text-white px-10 py-4 rounded-2xl flex items-center gap-3 font-black text-[18px] transition-all shadow-xl hover:shadow-2xl transform active:scale-[0.98]"
        >
            <Download size={22} /> 📥 엑셀 파일 다운로드
        </button>
    </div>
  )}
</div>
);
}
