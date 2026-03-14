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
  try {
    // ★修正: Jina Reader APIを経由して、本文だけをクリーンに抽出する
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "Accept": "text/plain" }
    });

    if (jinaRes.ok) {
      articleText = await jinaRes.text();
      // LLMのトークン上限を超えないよう、最大15000文字でカット
      articleText = articleText.substring(0, 15000);
    } else {
      console.error("Jina API returned status:", jinaRes.status);
    }
  } catch (e) {
    console.error("Extraction error:", e);
  }

  // 取得できた文字数が極端に少ない場合は失敗と判定
  const hasContent = articleText.length > 300;
  const textToAnalyze = hasContent 
    ? articleText 
    : "Failed to extract the article text due to site security. Summarize based ONLY on the headline.";

  // ★修正: AIに「具体的な固有名詞や数値を入れろ」と強く指示
  const prompt = `You are a news analyst for an expat audience in Doha, Qatar. 
Read the following original article text carefully.

Headline: ${title}
Original Text:
${textToAnalyze}

Task: Write a comprehensive, factual 3-paragraph summary and analysis in English.
Paragraph 1: What happened (strictly base this ONLY on the provided text. Include specific names, quotes, or numbers if available).
Paragraph 2: Why it matters for Qatar or the broader Middle East region.
Paragraph 3: Wider global implications or next steps.

Constraints: 
- Do NOT invent facts, context, or prior events not explicitly mentioned in the text.
- If the original text says "Failed to extract", state "Full article content could not be retrieved." and briefly analyze the headline.
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