// api/summarize.js  ← CommonJS形式（Vercel標準）
// Required: ANTHROPIC_API_KEY を Vercel Environment Variables に設定

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { title, execSummary } = req.body || {};
  if (!title) return res.status(400).json({ error: "title is required" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `You are a news analyst for an expat audience in Doha, Qatar. Based on this headline and brief summary, write a 2–3 paragraph analysis in English. Cover: what happened, why it matters for Qatar or the broader region, and wider implications. Be factual and concise. No bullet points.

Headline: ${title}
Brief summary: ${execSummary || ""}

Write the full analysis now:`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return res.status(502).json({ error: "Upstream API error", detail: err });
    }

    const data = await response.json();
    const summary = data.content?.[0]?.text || "Summary unavailable.";
    return res.status(200).json({ summary });

  } catch (e) {
    console.error("Summarize handler error:", e);
    return res.status(500).json({ error: e.message });
  }
};
