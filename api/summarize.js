// api/summarize.js
// Groq API版（無料枠：1日14,400リクエスト）
// Required: GROQ_API_KEY を Vercel Environment Variables に設定

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { title, execSummary } = req.body || {};
  if (!title) return res.status(400).json({ error: "title is required" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY not configured" });

  const prompt = `You are a news analyst for an expat audience in Doha, Qatar. Based on this headline and brief summary, write a 2–3 paragraph analysis in English. Cover: what happened, why it matters for Qatar or the broader region, and wider implications. Be factual and concise. No bullet points.

Headline: ${title}
Brief summary: ${execSummary || ""}

Write the full analysis now:`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq API error:", err);
      return res.status(502).json({ error: "Upstream API error", detail: err });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Summary unavailable.";
    return res.status(200).json({ summary });

  } catch (e) {
    console.error("Summarize handler error:", e);
    return res.status(500).json({ error: e.message });
  }
};
