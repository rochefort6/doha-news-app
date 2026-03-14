// api/summarize.js
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { title, url } = req.body || {};
  if (!title || !url) return res.status(400).json({ error: "title and url are required" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY not configured" });

  let articleText = "";

  // 本文抽出と判定のヘルパー関数
  const extractText = (html) => {
    const paragraphs = html.match(/<p\b[^>]*>(.*?)<\/p>/gis) || [];
    return paragraphs
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .filter(p => p.length > 40)
      .join("\n\n");
  };

  const isValidContent = (text) => {
    return text.length > 300 && 
           !text.includes("Just a moment...") && 
           !text.includes("Enable JavaScript") && 
           !text.includes("Attention Required!");
  };

  // --- 1. Jina Reader API（基本ルート） ---
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, { headers: { "Accept": "text/plain" } });
    if (jinaRes.ok) {
      const text = await jinaRes.text();
      if (isValidContent(text)) articleText = text;
    }
  } catch (e) { console.error("Jina error:", e); }

  // --- 2. Twitterbot偽装（SNSプレビューの抜け道を突く） ---
  if (!articleText) {
    try {
      const directRes = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0)',
          'Referer': 'https://t.co/'
        }
      });
      const html = await directRes.text();
      if (isValidContent(html)) {
        const text = extractText(html);
        if (text.length > 300) articleText = text;
      }
    } catch (e) { console.error("Twitterbot error:", e); }
  }

  // --- 3. AllOriginsプロキシ（別サーバーIPを経由してブロックを回避） ---
  if (!articleText) {
    try {
      const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data.contents && isValidContent(data.contents)) {
          const text = extractText(data.contents);
          if (text.length > 300) articleText = text;
        }
      }
    } catch (e) { console.error("AllOrigins error:", e); }
  }

  // 取得したテキストの文字数制限と判定
  articleText = articleText.substring(0, 15000);
  const hasContent = articleText.length > 300;
  
  // 取得失敗時は、正直にAIにその旨を伝える
  const textToAnalyze = hasContent 
    ? articleText 
    : "Failed to extract the article text due to strict site security. Summarize based ONLY on the headline. Do not invent details.";

  // プロンプト（詳細要約版）
  const prompt = `You are a news analyst for an expat audience in Doha, Qatar. 
Read the following original article text carefully.

Headline: ${title}
Original Text:
${textToAnalyze}

Task: Write a comprehensive, factual 3-paragraph summary in English based strictly on the provided text.
Paragraph 1: Core Event (What happened, main conclusion).
Paragraph 2: Key Details (Specific names, numbers, quotes, and critical facts).
Paragraph 3: Background & Context (Prior events or broader context explicitly mentioned in the article).

Constraints: 
- Do NOT invent facts, context, or prior events not explicitly mentioned in the text.
- If the original text says "Failed to extract", state "Full article content could not be retrieved due to security." and briefly summarize the headline.
- No bullet points.

Write the 3-paragraph summary now:`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: "Upstream API error", detail: err });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Summary unavailable.";
    return res.status(200).json({ summary });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};