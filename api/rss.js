// api/rss.js
const ALLOWED_HOSTS = new Set([
  'www.aljazeera.com',
  'www.gulf-times.com',
  'feeds.bbci.co.uk',
  'feeds.reuters.com',
  'www.offshore-energy.biz',
]);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL' });

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(403).json({ error: 'Host not allowed' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const r = await fetch(parsed.href, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    const text = await r.text();
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: e.name === 'AbortError' ? 'Request timeout' : e.message });
  } finally {
    clearTimeout(timer);
  }
};
