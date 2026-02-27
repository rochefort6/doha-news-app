import { useState, useEffect, useCallback } from "react";

const RSS_PROXY = "/api/rss?url=";

const RSS_SOURCES = [
  // Qatar & Middle East
  { categoryKey: "qatar",         source: "Al Jazeera",      url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { categoryKey: "qatar",         source: "Gulf Times",       url: "https://www.gulf-times.com/rss/feed/Qatar" },
  // International
  { categoryKey: "international", source: "BBC World",        url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { categoryKey: "international", source: "Reuters World",    url: "https://feeds.reuters.com/reuters/worldNews" },
  // Business
  { categoryKey: "business",      source: "BBC Business",     url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { categoryKey: "business",      source: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews" },
  // Energy & LNG
  { categoryKey: "energy",        source: "Reuters Energy",   url: "https://feeds.reuters.com/reuters/energy" },
  { categoryKey: "energy",        source: "Offshore Energy",  url: "https://www.offshore-energy.biz/feed/" },
];

const CATEGORIES = [
  { key: "all",           label: "All",           icon: "◎" },
  { key: "qatar",         label: "Qatar & ME",    icon: "🌙" },
  { key: "international", label: "International", icon: "🌐" },
  { key: "business",      label: "Business",      icon: "📈" },
  { key: "energy",        label: "Energy & LNG",  icon: "⚡" },
];

const CAT_COLORS = {
  qatar:         { accent: "#F5A623", glow: "#F5A62330" },
  international: { accent: "#5BB8F5", glow: "#5BB8F530" },
  business:      { accent: "#3DD68C", glow: "#3DD68C30" },
  energy:        { accent: "#FFD740", glow: "#FFD74030" },
};

const KEYWORDS = {
  qatar:         ["qatar","doha","gulf","middle east","saudi","uae","dubai","iran","iraq","arab","israel","palestine","gaza","gcc","riyadh","abu dhabi","kuwait","bahrain","oman"],
  energy:        ["lng","liquefied","natural gas","oil","energy","petroleum","opec","offshore","pipeline","qatarenergy","renewable","solar","carbon","emissions","crude"],
  business:      ["economy","market","stock","trade","gdp","inflation","investment","bank","finance","earnings","merger","acquisition","startup","ipo","revenue"],
  international: ["us ","uk ","china","russia","europe","nato","united nations","election","government","president","war","conflict","treaty","sanctions","diplomacy"],
};

function scoreArticle(title, desc, key) {
  const t = (title + " " + (desc || "")).toLowerCase();
  return (KEYWORDS[key] || []).filter(k => t.includes(k)).length;
}

function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function stripHtml(h) {
  return (h || "").replace(/<[^>]*>/g, "").replace(/&[a-zA-Z]+;/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchRSS(src) {
  const proxyUrl = RSS_PROXY + encodeURIComponent(src.url);
  const res = await fetch(proxyUrl);
  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "text/xml");
  const items = Array.from(xml.querySelectorAll("item"));
  return items.map(item => {
    const get = tag => item.querySelector(tag)?.textContent?.trim() || "";
    const title = get("title");
    const desc = stripHtml(get("description"));
    const pubDate = get("pubDate");
    const link = get("link");
    const ageHours = (Date.now() - new Date(pubDate)) / 3600000;
    const sentences = desc.match(/[^.!?]+[.!?]+/g) || [];
    const execSummary = sentences.slice(0, 2).join(" ") || desc.slice(0, 180) + "…";
    return { title, desc, pubDate, link, ageHours, execSummary };
  });
}

function BreakingBadge() {
  const [v, setV] = useState(true);
  useEffect(() => { const i = setInterval(() => setV(x => !x), 800); return () => clearInterval(i); }, []);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FF193320", border: "1px solid #FF1933", color: "#FF1933", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", padding: "2px 7px", borderRadius: 3 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF1933", opacity: v ? 1 : 0.15, transition: "opacity 0.3s" }} />
      BREAKING
    </span>
  );
}

// ✅ FIXED: Claude API via Vercel serverless function to avoid CORS errors
async function generateFullSummary(title, execSummary) {
  const response = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, execSummary }),
  });
  if (!response.ok) throw new Error("Summarize API error");
  const data = await response.json();
  return data.summary || execSummary;
}

function SummaryPanel({ execSummary, title, url }) {
  const [mode, setMode] = useState("exec");
  const [fullSummary, setFullSummary] = useState(null);
  const [loadingFull, setLoadingFull] = useState(false);

  const handleFullClick = async () => {
    setMode("detail");
    if (!fullSummary && !loadingFull) {
      setLoadingFull(true);
      try {
        const result = await generateFullSummary(title, execSummary);
        setFullSummary(result);
      } catch (e) {
        setFullSummary("Could not generate full summary. Please visit the source article.");
      }
      setLoadingFull(false);
    }
  };

  return (
    <div style={{ marginTop: 14 }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
        <button onClick={() => setMode("exec")} style={{ background: mode === "exec" ? "#4A4A52" : "#2E2E36", border: `1px solid ${mode === "exec" ? "#6A6A74" : "#3E3E48"}`, color: mode === "exec" ? "#FFFFFF" : "#8A8A96", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", padding: "4px 12px", borderRadius: 4, cursor: "pointer", textTransform: "uppercase" }}>Exec Summary</button>
        <button onClick={handleFullClick} style={{ background: mode === "detail" ? "#4A4A52" : "#2E2E36", border: `1px solid ${mode === "detail" ? "#6A6A74" : "#3E3E48"}`, color: mode === "detail" ? "#FFFFFF" : "#8A8A96", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", padding: "4px 12px", borderRadius: 4, cursor: "pointer", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
          {loadingFull ? <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>↻</span> : null}
          Full Summary ✦
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            style={{ marginLeft: "auto", fontSize: 9, color: "#8A8A96", textDecoration: "none", padding: "4px 10px", border: "1px solid #3E3E48", borderRadius: 4, fontFamily: "'Inter', sans-serif" }}>
            SOURCE →
          </a>
        )}
      </div>
      <div style={{ background: "#1E1E26", border: "1px solid #3E3E48", borderLeft: "3px solid #5A5A64", borderRadius: 6, padding: "14px 16px" }}>
        {mode === "exec" ? (
          <p style={{ fontSize: 14, color: "#E8E8F0", lineHeight: 1.75, margin: 0, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>{execSummary}</p>
        ) : loadingFull ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ height: 13, background: "#2E2E38", borderRadius: 3, width: i === 4 ? "60%" : "100%", animation: "pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        ) : (
          <div>
            {(fullSummary || "").split("\n\n").filter(p => p.trim()).map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: "#C0C0CC", lineHeight: 1.8, margin: i === 0 ? 0 : "14px 0 0 0", fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>{para}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewsCard({ item, index }) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const col = CAT_COLORS[item.categoryKey] || CAT_COLORS.international;
  const catLabel = CATEGORIES.find(c => c.key === item.categoryKey)?.label || "";
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setExpanded(e => !e)}
      style={{ background: expanded ? "#2A2A34" : hovered ? "#282830" : "#242430", border: `1px solid ${expanded || hovered ? col.accent + "70" : "#3A3A44"}`, borderRadius: 10, padding: "16px 18px", cursor: "pointer", transition: "all 0.18s ease", boxShadow: hovered || expanded ? `0 4px 20px ${col.glow}` : "none", animation: "fadeIn 0.35s ease both", animationDelay: `${Math.min(index, 8) * 0.04}s` }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: col.accent, background: col.accent + "18", border: `1px solid ${col.accent}50`, padding: "2px 9px", borderRadius: 3, fontFamily: "'Inter', sans-serif" }}>{catLabel}</span>
          {item.isBreaking && <BreakingBadge />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#888896", fontFamily: "'DM Mono', monospace" }}>{item.source}</span>
          <span style={{ fontSize: 10, color: "#666672", fontFamily: "'Inter', sans-serif" }}>{item.time}</span>
          <span style={{ fontSize: 13, color: expanded ? col.accent : "#666672", display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s, color 0.2s" }}>›</span>
        </div>
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: expanded || hovered ? "#FFFFFF" : "#E0E0EC", lineHeight: 1.5, margin: 0, fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.01em", transition: "color 0.2s" }}>{item.title}</h3>
      {expanded && <SummaryPanel execSummary={item.execSummary} title={item.title} url={item.url} />}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {[...Array(7)].map((_, i) => (
        <div key={i} style={{ background: "#242430", border: "1px solid #3A3A44", borderRadius: 10, padding: "16px 18px", animation: "pulse 1.6s ease-in-out infinite", animationDelay: `${i * 0.1}s` }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 72, height: 16, background: "#3A3A44", borderRadius: 3 }} />
            <div style={{ width: 44, height: 16, background: "#323240", borderRadius: 3 }} />
          </div>
          <div style={{ width: "80%", height: 15, background: "#3A3A44", borderRadius: 3, marginBottom: 7 }} />
          <div style={{ width: "55%", height: 15, background: "#323240", borderRadius: 3 }} />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState({});
  const [lastSync, setLastSync] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [now, setNow]           = useState(new Date());
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const statusMap = {};
    const seen = new Set();
    const results = [];

    await Promise.allSettled(RSS_SOURCES.map(async src => {
      try {
        const items = await fetchRSS(src);
        statusMap[src.source] = "ok";
        items.forEach(item => {
          if (!item.title || seen.has(item.title)) return;
          const score = scoreArticle(item.title, item.desc, src.categoryKey);
          const isBroad = src.url.includes("all.xml") || src.url.includes("bbci");
          if (isBroad && score === 0) return;
          seen.add(item.title);
          results.push({
            id: item.title + src.categoryKey,
            title: item.title,
            categoryKey: src.categoryKey,
            source: src.source,
            time: timeAgo(item.pubDate),
            pubDate: item.pubDate,
            isBreaking: item.ageHours < 2,
            execSummary: item.execSummary,
            url: item.link,
          });
        });
      } catch (e) {
        statusMap[src.source] = "error";
      }
    }));

    results.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    setArticles(results);
    setStatus(statusMap);
    setLastSync(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const t = setInterval(fetchAll, 15 * 60 * 1000); return () => clearInterval(t); }, [fetchAll]);

  const filtered = activeCategory === "all" ? articles : articles.filter(a => a.categoryKey === activeCategory);
  const breaking = articles.filter(a => a.isBreaking);
  const okCount  = Object.values(status).filter(s => s === "ok").length;
  const errCount = Object.values(status).filter(s => s === "error").length;

  const dohaTime = now.toLocaleTimeString("en-US", { timeZone: "Asia/Qatar", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dohaDate = now.toLocaleDateString("en-US", { timeZone: "Asia/Qatar", weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#1C1C24", fontFamily: "'Inter', 'Helvetica Neue', sans-serif", color: "#E0E0EC" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin   { to { transform:rotate(360deg); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:#4A4A54; border-radius:2px; }
        body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
      `}</style>

      {showBanner && breaking.length > 0 && (
        <div style={{ background: "#FF193312", borderBottom: "1px solid #FF193330", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
            <BreakingBadge />
            <span style={{ fontSize: 12, color: "#C8C8D4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "72vw", fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
              {breaking.slice(0, 3).map(n => n.title.slice(0, 60) + "…").join("  ·  ")}
            </span>
          </div>
          <button onClick={() => setShowBanner(false)} style={{ background: "none", border: "none", color: "#8A8A96", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
      )}

      <header style={{ padding: "18px 20px 0", borderBottom: "1px solid #32323C", background: "#20202A" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F5A623", boxShadow: "0 0 10px #F5A62380" }} />
                <span style={{ fontSize: 9, letterSpacing: "0.22em", color: "#F5A623", fontWeight: 700, textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>Doha Intelligence</span>
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em", margin: 0 }}>News Desk</h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, color: "#FFFFFF", fontWeight: 500, letterSpacing: "0.04em" }}>{dohaTime}</div>
              <div style={{ fontSize: 10, color: "#666672", marginTop: 4, fontFamily: "'Inter', sans-serif" }}>{dohaDate} · AST</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 2, overflowX: "auto" }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.key;
              const col = cat.key !== "all" ? CAT_COLORS[cat.key] : null;
              const count = cat.key === "all" ? articles.length : articles.filter(a => a.categoryKey === cat.key).length;
              return (
                <button key={cat.key} onClick={() => setActiveCategory(cat.key)} style={{ background: isActive ? "#2A2A34" : "transparent", border: "none", borderBottom: `2px solid ${isActive ? (col ? col.accent : "#F5A623") : "transparent"}`, color: isActive ? "#FFFFFF" : "#7A7A86", padding: "8px 13px 10px", cursor: "pointer", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", transition: "all 0.15s", borderRadius: "5px 5px 0 0", display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontFamily: "'Inter', sans-serif", letterSpacing: "0.01em" }}>
                  <span style={{ fontSize: 13 }}>{cat.icon}</span>
                  {cat.label}
                  <span style={{ background: isActive ? "#3A3A44" : "transparent", color: isActive ? (col ? col.accent : "#F5A623") : "#4A4A56", fontSize: 9, padding: "1px 6px", borderRadius: 8, fontFamily: "'DM Mono', monospace" }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "16px 20px 56px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
          {[
            { v: articles.length.toString(), l: "Articles",     s: "Live feed" },
            { v: breaking.length.toString(), l: "Breaking",     s: "< 2h old" },
            { v: okCount.toString(),          l: "Sources Live", s: errCount > 0 ? `${errCount} failed` : "All OK ✓" },
            { v: lastSync ? lastSync.toLocaleTimeString("en-US", { timeZone: "Asia/Qatar", hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--", l: "Last Sync", s: "AST" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#242430", border: "1px solid #3A3A44", borderRadius: 8, padding: "11px 13px" }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#FFFFFF", fontFamily: "'DM Mono', monospace" }}>{s.v}</div>
              <div style={{ fontSize: 10, color: "#8A8A96", marginTop: 2, fontFamily: "'Inter', sans-serif" }}>{s.l}</div>
              <div style={{ fontSize: 9, color: s.l === "Sources Live" && errCount > 0 ? "#FF1933" : "#525260", marginTop: 2, fontFamily: "'Inter', sans-serif" }}>{s.s}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 14, background: activeCategory !== "all" && CAT_COLORS[activeCategory] ? CAT_COLORS[activeCategory].accent : "#F5A623", borderRadius: 2 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#A0A0AC", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>
              {activeCategory === "all" ? "All Stories" : CATEGORIES.find(c => c.key === activeCategory)?.label}
            </span>
            <span style={{ fontSize: 9, color: "#4A4A56", fontFamily: "'Inter', sans-serif" }}>· tap to expand</span>
          </div>
          <button onClick={fetchAll} disabled={loading}
            style={{ background: "none", border: "1px solid #3A3A44", color: loading ? "#4A4A56" : "#8A8A96", fontSize: 10, padding: "5px 12px", borderRadius: 5, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Inter', sans-serif" }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = "#6A6A74"; e.currentTarget.style.color = "#FFFFFF"; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#3A3A44"; e.currentTarget.style.color = loading ? "#4A4A56" : "#8A8A96"; }}>
            <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>↻</span>
            {loading ? "Fetching…" : "Refresh"}
          </button>
        </div>

        {loading && articles.length === 0 ? <Skeleton /> : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 0", color: "#525260", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>No articles found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.slice(0, 60).map((item, i) => <NewsCard key={item.id} item={item} index={i} />)}
          </div>
        )}
      </main>
    </div>
  );
}
