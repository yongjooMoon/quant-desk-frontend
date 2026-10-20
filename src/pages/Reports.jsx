// src/pages/Reports.jsx - "리포트": dated reports (HTML authored by the backend) listed by category and shown in a sandboxed iframe
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';
import { useRenderApi } from '../hooks/useRenderApi';

// Add a category here (e.g. { key: 'stock', label: '종목 리포트' }) and it gets a tab automatically.
const CATEGORIES = [{ key: 'morning', label: '모닝 증시' }];

const HEIGHT_PROBE = '<script>(function(){function s(){parent.postMessage({type:"report-height",h:document.documentElement.scrollHeight},"*")}addEventListener("load",s);addEventListener("resize",s);if(window.ResizeObserver)new ResizeObserver(s).observe(document.documentElement)})()</script>';

const PANEL ='rounded-lg border border-slate-200 dark:border-[#2C323A] bg-white dark:bg-[#1E2329]';
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

// report_date is a plain 'YYYY-MM-DD'; parse as local date parts to avoid timezone shifts.
const fmtDate = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y) return String(s);
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${WEEKDAY[new Date(y, m - 1, d).getDay()]})`;
};
const fmtTime = (s) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export default function Reports() {
  const { callApi, ServerWakeupOverlay } = useRenderApi();
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [list, setList] = useState({ loading: true, error: false, data: [] });
  const [doc, setDoc] = useState({ loading: false, error: false, html: '', title: '' });
  const [reload, setReload] = useState(0);
  const selId = params.get('id');

  const select = useCallback((id) => setParams({ id: String(id) }, { replace: true }), [setParams]);

  // Load the list for the active category; default to the newest report when ?id= is absent.
  useEffect(() => {
    let alive = true;
    setList(l => ({ ...l, loading: true, error: false }));
    callApi(`/api/reports?category=${encodeURIComponent(category)}&limit=60`)
      .then(r => {
        if (!alive) return;
        const data = r.status === 'success' ? (r.data || []) : [];
        if (r.status !== 'success') throw new Error('bad status');
        data.sort((a, b) => String(b.report_date).localeCompare(String(a.report_date)));
        setList({ loading: false, error: false, data });
        if (data.length && !new URLSearchParams(window.location.search).get('id')) select(data[0].id);
      })
      .catch(() => { if (alive) setList({ loading: false, error: true, data: [] }); });
    return () => { alive = false; };
  }, [callApi, category, reload, select]);

  // Load the selected report body.
  useEffect(() => {
    if (!selId) { setDoc({ loading: false, error: false, html: '', title: '' }); return; }
    let alive = true;
    setDoc(d => ({ ...d, loading: true, error: false }));
    callApi(`/api/reports/${encodeURIComponent(selId)}`)
      .then(r => {
        if (!alive) return;
        if (r.status !== 'success') throw new Error('bad status');
        setDoc({ loading: false, error: false, html: r.html || '', title: r.title || '' });
      })
      .catch(() => { if (alive) setDoc({ loading: false, error: true, html: '', title: '' }); });
    return () => { alive = false; };
  }, [callApi, selId, reload]);

  // Mobile: size the iframe to its content (the page scrolls, not the iframe). The sandboxed doc reports its own height.
  const frameRef = useRef(null);
  const [frameH, setFrameH] = useState(0);
  useEffect(() => {
    const onMsg = (e) => {
      if (e.source !== frameRef.current?.contentWindow || e.data?.type !== 'report-height') return;
      const h = Number(e.data.h);
      if (h > 0 && h < 100000) setFrameH(Math.ceil(h));
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  useEffect(() => { setFrameH(0); }, [selId]);
  const srcDoc = doc.html + HEIGHT_PROBE;

  const retry = () => setReload(n => n + 1);
  const empty = !list.loading && !list.error && list.data.length === 0;

  return (
    <div className="space-y-4">
      <ServerWakeupOverlay />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold text-slate-900 dark:text-white">리포트</h2>
        <div className="flex gap-1">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => { setCategory(c.key); setParams({}, { replace: true }); }}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors cursor-pointer ${category === c.key ? 'border-brand text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/70' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {list.error ? (
        <div className={`${PANEL} p-8 text-center text-[13.5px] text-slate-500 dark:text-slate-400`}>
          <p className="mb-3">리포트를 불러오지 못했습니다.</p>
          <button onClick={retry} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer"><RefreshCcw size={13} />다시 시도</button>
        </div>
      ) : empty ? (
        <div className={`${PANEL} p-8 text-center text-[13.5px] text-slate-500 dark:text-slate-400`}>아직 리포트가 없습니다</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          {/* list: horizontal strip on mobile, vertical column on desktop */}
          <div className={`${PANEL} md:w-[220px] shrink-0 p-1.5 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto md:max-h-[calc(100dvh-9rem)]`}>
            {list.loading && !list.data.length && <div className="p-3 text-[13px] text-slate-500">불러오는 중…</div>}
            {list.data.map(it => {
              const on = String(it.id) === selId;
              return (
                <button key={it.id} onClick={() => select(it.id)}
                  className={`relative shrink-0 text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${on ? 'bg-slate-100 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                  {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-brand" />}
                  <div className="text-[13.5px] font-medium tabular-nums whitespace-nowrap">{fmtDate(it.report_date)}</div>
                  {it.updated_at && <div className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap">갱신 {fmtTime(it.updated_at)}</div>}
                </button>
              );
            })}
          </div>

          {/* viewer: untrusted HTML, so no allow-same-origin */}
          <div className={`${PANEL} flex-1 min-w-0 overflow-hidden relative ${frameH ? 'h-[var(--fh)]' : 'h-[75dvh]'} md:h-[calc(100dvh-9rem)]`} style={frameH ? { '--fh': `${frameH}px` } : undefined}>
            {doc.error ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-[13.5px] text-slate-500 dark:text-slate-400">
                <p>리포트 본문을 불러오지 못했습니다.</p>
                <button onClick={retry} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer"><RefreshCcw size={13} />다시 시도</button>
              </div>
            ) : (
              <>
                {doc.html && <iframe ref={frameRef} title={doc.title || '리포트'} sandbox="allow-scripts allow-popups" srcDoc={srcDoc}className="w-full h-full border-0 bg-white" />}
                {(doc.loading || list.loading) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-[#1E2329]/60 text-[13px] text-slate-500">불러오는 중…</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
