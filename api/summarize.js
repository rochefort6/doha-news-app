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

  // 1. まずはJina Readerで試す
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "Accept": "text/plain" }
    });
    if (jinaRes.ok) {
      const text = await jinaRes.text();
      if (text.length > 300 && !text.includes("Just a moment...") && !text.includes("Enable JavaScript")) {
        articleText = text;
      }
    }
  } catch (e) {
    console.error("Jina extraction error:", e);
  }

  // 2. Jinaがブロックされた場合はGooglebotになりすまして直接HTMLを取得
  if (!articleText) {
    try {
      const directRes = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' 
        }
      });
      const html = await directRes.text();
      const paragraphs = html.match(/<p\b[^>]*>(.*?)<\/p>/gis) || [];
      const text = paragraphs
        .map(p => p.replace(/<[^>]+>/g, '').trim())
        .filter(p => p.length > 40)
        .join("\n\n");
        
      if (text.length > 300) {
        articleText = text;
      }
    } catch (e) {
      console.error("Googlebot fallback error:", e);
    }
  }

  articleText = articleText.substring(0, 15000);

  const hasContent = articleText.length > 300;
  const textToAnalyze = hasContent 
    ? articleText 
    : "Failed to extract the article text due to strict site security. Summarize based ONLY on the headline.";

  // ★変更点：3パラグラフの構成を「事実と詳細の抽出」に特化
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
- If the original text says "Failed to extract", state "Full article content could not be retrieved." and briefly summarize the headline.
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