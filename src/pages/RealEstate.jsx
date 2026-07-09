// src/pages/RealEstate.jsx
import { Building2, Search, Download, RefreshCcw, Calendar } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export default function RealEstate() {
  const guMap = {
    '11110': '종로구', '11140': '중구', '11170': '용산구', '11200': '성동구', '11215': '광진구',
    '11230': '동대문구', '11260': '중랑구', '11290': '성북구', '11305': '강북구', '11320': '도봉구',
    '11350': '노원구', '11380': '은평구', '11410': '서대문구', '11440': '마포구', '11470': '양천구',
    '11500': '강서구', '11530': '구로구', '11545': '금천구', '11560': '영등포구', '11590': '동작구',
    '11620': '관악구', '11650': '서초구', '11680': '강남구', '11710': '송파구', '11740': '강동구'
  };

  const dongMap = {
    '11710': ['잠실동', '신천동', '풍납동', '송파동', '석촌동', '삼전동', '가락동', '문정동', '장지동', '방이동', '오금동', '거여동', '마천동'],
    '11530': ['신도림동', '구로동', '가리봉동', '고척동', '개봉동', '오류동', '궁동', '온수동', '천왕동', '항동']
  };

  const [guCode, setGuCode] = useState("11710");
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

  const logEndRef = useRef(null);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleBuild = () => {
    setLoading(true);
    setError("");
    setDownloadReady(false);

    const targetDong = dong.startsWith("전체") ? "전체" : dong;

    // 🌟 핵심 버그 수정: 초기 로그를 변수에 저장해두고 활용합니다.
    const initialLog = `🚀 부동산 데이터 대시보드 빌드 시작...\n🔗 자치구: ${guMap[guCode]} | 법정동: ${targetDong}\n📅 기간: ${startDate} ~ ${endDate}\n\n`;
    setLogs(initialLog);

    const url = `https://moon-bbh0.onrender.com/api/realestate/build-stream?gu_code=${guCode}&gu_name=${encodeURIComponent(guMap[guCode])}&dong=${encodeURIComponent(targetDong)}&start_date=${startDate}&end_date=${endDate}&filters=${encodeURIComponent(filters)}`;

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === "log" || data.status === "progress") {
        // 🌟 핵심 버그 수정: 백엔드에서 전체 누적 텍스트를 보내주므로,
        // prev에 더하지 않고 [초기로그 + 방금 받은 전체 누적로그]로 덮어씌웁니다!
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
      setError("서버 에러가 발생했습니다. 백엔드(main.py)의 실시간 터미널 로그를 확인해 주세요.");
      setLoading(false);
      eventSource.close();
    };
  };

  const handleDownload = () => {
    window.location.href = "https://moon-bbh0.onrender.com/api/realestate/download";
  };

  return (
    <div className="w-full px-0 py-0 transition-colors duration-300 relative font-['Nunito',_ui-rounded,_-apple-system,_system-ui,_sans-serif] pb-20">

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
                      {Object.entries(guMap).map(([code, name]) => (
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
