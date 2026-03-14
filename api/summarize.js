// api/summarize.js
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // URLとタイトルを受け取る
  const { title, url } = req.body || {};
  if (!title || !url) return res.status(400).json({ error: "title and url are required" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY not configured" });

  // 1. 実際の記事URLにアクセスして、本文を簡易スクレイピングする
  let articleText = "";
  try {
    const articleRes = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } 
    });
    const html = await articleRes.text();
    
    // <p>タグの中身だけを抽出してHTMLタグを除去（本文の再構築）
    const paragraphs = html.match(/<p\b[^>]*>(.*?)<\/p>/gis) || [];
    articleText = paragraphs
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .filter(p => p.length > 40) // メニューなどの短いノイズ文字を排除
      .join("\n\n");
      
    // LLMの入力制限を超えないように念のため文字数をカット
    articleText = articleText.substring(0, 15000); 
  } catch (e) {
    console.error("Scraping error:", e);
  }

  // スクレイピング対策等で本文が取れなかった場合のフェイルセーフ
  const hasContent = articleText.length > 200;
  const textToAnalyze = hasContent 
    ? articleText 
    : "Could not extract full article content due to site blocking. Please provide a brief analysis based strictly on the headline.";

  // 2. 取得した「本物の記事本文」をベースに要約させる
  const prompt = `You are a news analyst for an expat audience in Doha, Qatar. 
Read the following original article text carefully.

Headline: ${title}
Original Text:
${textToAnalyze}

Task: Write a comprehensive, factual 3-paragraph summary and analysis in English.
Paragraph 1: What happened (strictly base this ONLY on the provided text).
Paragraph 2: Why it matters for Qatar or the broader Middle East region.
Paragraph 3: Wider global implications or next steps.

Constraints: 
- Do NOT invent facts, context, or prior events not explicitly mentioned in the text.
- If the original text is a failure message, state "Full article content could not be retrieved." and summarize the headline only.
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