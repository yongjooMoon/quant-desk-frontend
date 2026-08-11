export default async function handler(req, res) {
  // Vercel 엣지가 실어준 진짜 방문자 IP를 여기서 꺼낸다
  const forwardedFor = req.headers['x-forwarded-for'];
  const visitorIp = (forwardedFor ? forwardedFor.split(',')[0].trim() : req.socket?.remoteAddress) || 'unknown';

  // /api/quant-dashboard, /api/search/AAPL 처럼 뒤에 붙는 경로를 그대로 복원
  const { path = [] } = req.query;
  const targetPath = Array.isArray(path) ? path.join('/') : path;

  // 쿼리스트링(?t=... 같은 것)도 그대로 유지
  const queryIndex = req.url.indexOf('?');
  const queryString = queryIndex !== -1 ? req.url.slice(queryIndex) : '';

  const targetUrl = `https://moon-bbh0.onrender.com/api/${targetPath}${queryString}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Real-IP': visitorIp,        // 🌟 FastAPI가 읽을 진짜 방문자 IP
        'X-Forwarded-For': visitorIp,
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    const data = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.send(data);
  } catch (err) {
    res.status(502).json({ status: 'error', message: 'proxy failed', detail: String(err) });
  }
}
