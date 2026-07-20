// src/pages/RealEstate.jsx
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

  // 서울시 전체 법정동 하드코딩 데이터
  const dongMap = {
    '11680': ['개포동', '논현동', '대치동', '도곡동', '삼성동', '세곡동', '수서동', '신사동', '압구정동', '역삼동', '율현동', '일원동', '자곡동', '청담동'],
    '11740': ['강일동', '고덕동', '길동', '둔촌동', '명일동', '상일동', '성내동', '암사동', '천호동'],
    '11305': ['미아동', '번동', '수유동', '우이동'],
    '11500': ['가양동', '개화동', '공항동', '과해동', '내발산동', '등촌동', '마곡동', '방화동', '염창동', '오곡동', '오쇠동', '외발산동', '화곡동'],
    '11620': ['남현동', '봉천동', '신림동'],
    '11215': ['광장동', '구의동', '군자동', '능동', '자양동', '중곡동', '화양동'],
    '11530': ['가리봉동', '개봉동', '고척동', '구로동', '궁동', '신도림동', '오류동', '온수동', '천왕동', '항동'],
    '11545': ['가산동', '독산동', '시흥동'],
    '11350': ['공릉동', '상계동', '월계동', '중계동', '하계동'],
    '11320': ['도봉동', '방학동', '쌍문동', '창동'],
    '11230': ['답십리동', '신설동', '용두동', '이문동', '장안동', '전농동', '제기동', '청량리동', '회기동', '휘경동'],
    '11590': ['노량진동', '대방동', '동작동', '본동', '사당동', '상도1동', '상도동', '신대방동', '흑석동'],
    '11440': ['공덕동', '구수동', '노고산동', '당인동', '대흥동', '도화동', '동교동', '마포동', '망원동', '상수동', '상암동', '서교동', '성산동', '신공덕동', '신수동', '신정동', '아현동', '연남동', '염리동', '용강동', '중동', '창전동', '토정동', '하중동', '합정동', '현석동'],
    '11410': ['남가좌동', '냉천동', '대신동', '대현동', '미근동', '봉원동', '북가좌동', '북아현동', '신촌동', '연희동', '영천동', '옥천동', '창천동', '천연동', '충정로2가', '충정로3가', '합동', '현저동', '홍은동', '홍제동'],
    '11650': ['내곡동', '반포동', '방배동', '서초동', '신원동', '양재동', '염곡동', '우면동', '원지동', '잠원동'],
    '11200': ['금호동1가', '금호동2가', '금호동3가', '금호동4가', '도선동', '마장동', '사근동', '상왕십리동', '성수동1가', '성수동2가', '송정동', '옥수동', '용답동', '응봉동', '하왕십리동', '홍익동', '행당동'],
    '11290': ['길음동', '돈암동', '동선동1가', '동선동2가', '동선동3가', '동선동4가', '동선동5가', '동소문동1가', '동소문동2가', '동소문동3가', '동소문동4가', '동소문동5가', '동소문동6가', '동소문동7가', '보문동1가', '보문동2가', '보문동3가', '보문동4가', '보문동5가', '보문동6가', '보문동7가', '삼선동1가', '삼선동2가', '삼선동3가', '삼선동4가', '삼선동5가', '상월곡동', '석관동', '성북동', '성북동1가', '안암동1가', '안암동2가', '안암동3가', '안암동4가', '안암동5가', '장위동', '정릉동', '종암동', '하월곡동'],
    '11710': ['가락동', '거여동', '마천동', '문정동', '방이동', '삼전동', '석촌동', '송파동', '신천동', '오금동', '잠실동', '장지동', '풍납동'],
    '11470': ['목동', '신월동', '신정동'],
    '11560': ['당산동', '당산동1가', '당산동2가', '당산동3가', '당산동4가', '당산동5가', '당산동6가', '대림동', '도림동', '문래동1가', '문래동2가', '문래동3가', '문래동4가', '문래동5가', '문래동6가', '신길동', '양화동', '양평동1가', '양평동2가', '양평동3가', '양평동4가', '양평동5가', '양평동6가', '여의도동', '영등포동', '영등포동1가', '영등포동2가', '영등포동3가', '영등포동4가', '영등포동5가', '영등포동6가', '영등포동7가', '영등포동8가'],
    '11170': ['갈월동', '남영동', '도원동', '동빙고동', '동자동', '문배동', '보광동', '산천동', '서계동', '서빙고동', '신계동', '신창동', '용문동', '용산동1가', '용산동2가', '용산동3가', '용산동4가', '용산동5가', '용산동6가', '원효로1가', '원효로2가', '원효로3가', '원효로4가', '이촌동', '이태원동', '주성동', '청암동', '청파동1가', '청파동2가', '청파동3가', '한강로1가', '한강로2가', '한강로3가', '한남동', '효창동', '후암동'],
    '11380': ['갈현동', '구산동', '녹번동', '대조동', '불광동', '수색동', '신사동', '역촌동', '응암동', '증산동', '진관동'],
    '11110': ['가회동', '견지동', '경운동', '계동', '공평동', '관수동', '관철동', '관훈동', '교남동', '교북동', '구기동', '궁정동', '권농동', '낙원동', '내수동', '내자동', '누상동', '누하동', '당주동', '도렴동', '돈의동', '동숭동', '명륜1가', '명륜2가', '명륜3가', '명륜4가', '묘동', '무악동', '봉익동', '부암동', '사간동', '사직동', '삼청동', '서린동', '세종로', '소격동', '송월동', '송현동', '수송동', '숭인동', '신교동', '신문로1가', '신문로2가', '신영동', '안국동', '연건동', '연지동', '예지동', '옥인동', '와룡동', '운니동', '원남동', '원서동', '이화동', '익선동', '인사동', '인의동', '장사동', '재동', '적선동', '종로1가', '종로2가', '종로3가', '종로4가', '종로5가', '종로6가', '중학동', '창성동', '창신동', '청운동', '청진동', '체부동', '충신동', '통의동', '통인동', '팔판동', '평동', '평창동', '필운동', '행촌동', '혜화동', '홍지동', '홍파동', '화동', '효자동', '효제동', '훈정동'],
    '11140': ['광희동1가', '광희동2가', '남대문로1가', '남대문로2가', '남대문로3가', '남대문로4가', '남대문로5가', '남산동1가', '남산동2가', '남산동3가', '남창동', '남학동', '다동', '만리동1가', '만리동2가', '명동1가', '명동2가', '무교동', '무학동', '묵정동', '방산동', '봉래동1가', '봉래동2가', '북창동', '산림동', '삼각동', '서소문동', '소공동', '수표동', '수하동', '순화동', '신당동', '쌍림동', '오장동', '예관동', '예장동', '을지로1가', '을지로2가', '을지로3가', '을지로4가', '을지로5가', '을지로6가', '을지로7가', '의주로1가', '의주로2가', '인현동1가', '인현동2가', '입정동', '장교동', '장충동1가', '장충동2가', '저동1가', '저동2가', '정동', '주교동', '주자동', '중림동', '초동', '충무로1가', '충무로2가', '충무로3가', '충무로4가', '충무로5가', '충정로1가', '태평로1가', '태평로2가', '필동1가', '필동2가', '필동3가', '황학동', '회현동1가', '회현동2가', '회현동3가', '흥인동'],
    '11260': ['망우동', '면목동', '묵동', '상봉동', '신내동', '중화동']
  };

  const [guCode, setGuCode] = useState("11680"); // 기본값을 정렬 첫번째(강남구)로 변경
  const [dong, setDong] = useState("전체 (구 단위)");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-${currentMonth}-01`);

  const [filters, setFilters] = useState("");

  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState("");
  const [error, setError] = useState("");
  const [downloadReady, setDownloadReady] = useState(false);

  // 🌟 변경된 callApi를 훅에서 가져옵니다
  const { ServerWakeupOverlay, callApi } = useRenderApi();
  const [isSleeping, setIsSleeping] = useState(false);

  const logEndRef = useRef(null);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleBuild = async () => {
    setLoading(true);
    setError("");
    setDownloadReady(false);
    setIsSleeping(false);

    const targetDong = dong.startsWith("전체") ? "전체" : dong;
    const initialLog = `🚀 부동산 데이터 대시보드 빌드 시작...\n🔗 자치구: ${guMap[guCode]} | 법정동: ${targetDong}\n📅 기간: ${startDate} ~ ${endDate}\n\n`;
    
    // callApi를 사용하므로 실시간 스트리밍 대신 안내 메시지 출력
    setLogs(initialLog + "데이터를 수집하고 엑셀 리포트를 생성 중입니다...\n(데이터 양에 따라 1~2분 정도 소요될 수 있습니다. 잠시만 기다려주세요.)\n");

    const url = `/api/realestate/build-stream?gu_code=${guCode}&gu_name=${encodeURIComponent(guMap[guCode])}&dong=${encodeURIComponent(targetDong)}&start_date=${startDate}&end_date=${endDate}&filters=${encodeURIComponent(filters)}`;

    let isConnected = false;
    const sleepTimer = setTimeout(() => {
      if (!isConnected) setIsSleeping(true);
    }, 3000);

    try {
      // 🌟 새로 적용된 callApi 비동기 방식
      await callApi(url);

      isConnected = true;
      clearTimeout(sleepTimer);
      setIsSleeping(false);

      setLogs(prev => prev + "\n✅ 데이터 처리가 성공적으로 완료되었습니다.\n\n하단의 다운로드 버튼을 눌러주세요!");
      setDownloadReady(true);
    } catch (err) {
      isConnected = true;
      clearTimeout(sleepTimer);
      setIsSleeping(false);
      
      setError(err.message || "서버 에러가 발생했습니다. 백엔드 로그를 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    window.location.href = "/api/realestate/download";
  };

  return (
    <div className="w-full px-0 py-0 transition-colors duration-300 relative font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif] pb-20">

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
                      {/* 🌟 자치구 이름(가나다) 기준으로 정렬 후 렌더링 */}
                      {Object.entries(guMap)
                        .sort((a, b) => a[1].localeCompare(b[1]))
                        .map(([code, name]) => (
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
                      {/* 🌟 선택된 자치구의 동을 가나다순으로 정렬 */}
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
