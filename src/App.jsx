import { useState, useEffect, useCallback } from "react";

// ─── RSS Source Config ────────────────────────────────────────────────────────
const RSS_SOURCES = [
  { categoryKey: "qatar",         source: "Al Jazeera",       url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { categoryKey: "international", source: "BBC World",         url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { categoryKey: "international", source: "Reuters World",     url: "https://feeds.reuters.com/reuters/worldNews" },
  { categoryKey: "business",      source: "BBC Business",      url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { categoryKey: "business",      source: "Reuters Business",  url: "https://feeds.reuters.com/reuters/businessNews" },
  { categoryKey: "entertainment", source: "Al Jazeera",        url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { categoryKey: "sports",        source: "BBC Sport",         url: "https://feeds.bbci.co.uk/sport/rss.xml" },
  { categoryKey: "sports",        source: "Al Jazeera",        url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { categoryKey: "travel",        source: "Reuters Travel",    url: "https://feeds.reuters.com/reuters/travelNews" },
  { categoryKey: "realestate",    source: "Reuters Business",  url: "https://feeds.reuters.com/reuters/businessNews" },
  { categoryKey: "energy",        source: "Reuters Energy",    url: "https://feeds.reuters.com/reuters/energy" },
  { categoryKey: "energy",        source: "Offshore Energy",   url: "https://www.offshore-energy.biz/feed/" },
];

const RSS2JSON = "https://api.rss2json.com/v1/api.json?api_key=okj3n5xnc8zm0rd4q17o2pu37xhhwhno8rcw8mja&rss_url=";

const CATEGORIES = [
  { key: "all",           label: "All",           icon: "◎" },
  { key: "qatar",         label: "Qatar & ME",    icon: "🌙" },
  { key: "international", label: "International", icon: "🌐" },
  { key: "business",      label: "Business",      icon: "📈" },
  { key: "entertainment", label: "Culture",       icon: "🎭" },
  { key: "sports",        label: "Sports",        icon: "⚽" },
  { key: "travel",        label: "Travel",        icon: "✈️" },
  { key: "realestate",    label: "Living",        icon: "🏙️" },
  { key: "energy",        label: "Energy & LNG",  icon: "⚡" },
];

const CAT_COLORS = {
  qatar:         { accent: "#F5A623", glow: "#F5A62330" },
  international: { accent: "#5BB8F5", glow: "#5BB8F530" },
  business:      { accent: "#3DD68C", glow: "#3DD68C30" },
  entertainment: { accent: "#C97EF0", glow: "#C97EF030" },
  sports:        { accent: "#FF8C42", glow: "#FF8C4230" },
  travel:        { accent: "#26C6DA", glow: "#26C6DA30" },
  realestate:    { accent: "#9CCC65", glow: "#9CCC6530" },
  energy:        { accent: "#FFD740", glow: "#FFD74030" },
};

const KEYWORDS = {
  qatar:         ["qatar", "doha", "gulf", "middle east", "saudi", "uae", "dubai", "iran", "iraq", "jordan", "egypt", "arab", "israel", "palestine", "gaza", "riyadh"],
  entertainment: ["film", "art", "culture", "music", "festival", "cinema", "theatre", "exhibition", "gallery"],
  sports:        ["football", "soccer", "cricket", "tennis", "f1", "formula", "olympic", "world cup", "league", "match", "sport", "basketball"],
  energy:        ["lng", "liquefied", "natural gas", "oil", "energy", "petroleum", "opec", "refinery", "offshore", "pipeline", "fuel", "qatarenergy", "shell", "bp", "exxon"],
  travel:        ["airline", "airport", "aviation", "flight", "tourism", "hotel", "travel", "visa", "qatar airways", "hamad"],
  realestate:    ["property", "real estate", "housing", "rent", "apartment", "mortgage", "construction", "lusail", "pearl", "west bay"],
  business:      ["economy", "market", "stock", "trade", "gdp", "inflation", "investment", "bank", "finance", "earnings"],
  international: ["us", "uk", "china", "russia", "europe", "nato", "un ", "united nations", "election", "government", "president"],
};

function scoreArticle(title, description, categoryKey) {
  const text = (title + " " + (description || "")).toLowerCase();
  return (KEYWORDS[categoryKey] || []).filter(kw => text.includes(kw)).length;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, "").replace(/&[a-zA-Z]+;/g, " ").replace(/\s+/g, " ").trim();
}

function buildExecSummary(title, description) {
  const clean = stripHtml(description);
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(0, 2).join(" ").trim() || (clean.slice(0, 180) + "…");
}

function buildDetailSummary(description) {
  const clean = stripHtml(description);
  if (clean.length < 50) return clean;
  return clean.length > 700 ? clean.slice(0, 700) + "…" : clean;
}

// ─── BreakingBadge ────────────────────────────────────────────────────────────
function BreakingBadge() {
  const [v, setV] = useState(true);
  useEffect(() => { const i = setInterval(() => setV(x => !x), 800); return () => clearInterval(i); }, []);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "#FF193320", border: "1px solid #FF1933",
      color: "#FF1933", fontSize: 9, fontWeight: 700,
      letterSpacing: "0.12em", padding: "2px 7px", borderRadius: 3,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF1933", opacity: v ? 1 : 0.15, transition: "opacity 0.3s" }} />
      BREAKING
    </span>
  );
}

// ─── SummaryPanel ─────────────────────────────────────────────────────────────
function SummaryPanel({ execSummary, detailSummary, url }) {
  const [mode, setMode] = useState("exec");
  return (
    <div style={{ marginTop: 14 }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
        {[["exec", "Exec Summary"], ["detail", "Full Summary"]].map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)} style={{
            background: mode === k ? "#4A4A52" : "#2E2E36",
            border: `1px solid ${mode === k ? "#6A6A74" : "#3E3E48"}`,
            color: mode === k ? "#FFFFFF" : "#8A8A96",
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
            padding: "4px 12px", borderRadius: 4, cursor: "pointer",
            transition: "all 0.15s", textTransform: "uppercase",
          }}>{label}</button>
        ))}
        {url && url !== "#" && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              marginLeft: "auto", fontSize: 9, color: "#8A8A96",
              textDecoration: "none", letterSpacing: "0.08em",
              padding: "4px 10px", border: "1px solid #3E3E48", borderRadius: 4,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.target.style.color = "#FFFFFF"; e.target.style.borderColor = "#6A6A74"; }}
            onMouseLeave={e => { e.target.style.color = "#8A8A96"; e.target.style.borderColor = "#3E3E48"; }}
          >SOURCE →</a>
        )}
      </div>
      <div style={{
        background: "#1E1E26",
        border: "1px solid #3E3E48",
        borderLeft: "3px solid #5A5A64",
        borderRadius: 6, padding: "12px 14px",
      }}>
        <p style={{
          fontSize: mode === "exec" ? 13 : 12,
          color: mode === "exec" ? "#E8E8F0" : "#B0B0BC",
          lineHeight: mode === "exec" ? 1.6 : 1.75,
          margin: 0,
        }}>
          {mode === "exec" ? execSummary : detailSummary}
        </p>
      </div>
    </div>
  );
}

// ─── NewsCard ─────────────────────────────────────────────────────────────────
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
      style={{
        background: expanded ? "#2A2A34" : hovered ? "#282830" : "#242430",
        border: `1px solid ${expanded || hovered ? col.accent + "70" : "#3A3A44"}`,
        borderRadius: 10, padding: "16px 18px", cursor: "pointer",
        transition: "all 0.18s ease",
        boxShadow: hovered || expanded ? `0 4px 20px ${col.glow}` : "none",
        animation: "fadeIn 0.35s ease both",
        animationDelay: `${Math.min(index, 8) * 0.04}s`,
      }}
    >
      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
            color: col.accent,
            background: col.accent + "18",
            border: `1px solid ${col.accent}50`,
            padding: "2px 9px", borderRadius: 3,
          }}>{catLabel}</span>
          {item.isBreaking && <BreakingBadge />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#888896", fontFamily: "monospace" }}>{item.source}</span>
          <span style={{ fontSize: 10, color: "#666672" }}>{item.time}</span>
          <span style={{
            fontSize: 13, color: expanded ? col.accent : "#666672",
            display: "inline-block",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s, color 0.2s",
          }}>›</span>
        </div>
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: 14, fontWeight: 600,
        color: expanded || hovered ? "#FFFFFF" : "#E0E0EC",
        lineHeight: 1.45, margin: "0 0 0 0",
        fontFamily: "'Playfair Display', Georgia, serif",
        letterSpacing: "-0.01em", transition: "color 0.2s",
      }}>{item.title}</h3>

      {/* Expanded summary */}
      {expanded && (
        <SummaryPanel
          execSummary={item.execSummary}
          detailSummary={item.detailSummary}
          url={item.url}
        />
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {[...Array(7)].map((_, i) => (
        <div key={i} style={{
          background: "#242430", border: "1px solid #3A3A44",
          borderRadius: 10, padding: "16px 18px",
          animation: "pulse 1.6s ease-in-out infinite",
          animationDelay: `${i * 0.1}s`,
        }}>
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

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function DohaNewsApp() {
  const [articles, setArticles]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchStatus, setFetchStatus] = useState({});
  const [activeCategory, setActiveCategory] = useState("all");
  const [now, setNow]                 = useState(new Date());
  const [showBanner, setShowBanner]   = useState(true);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const statusMap = {};
    const seen = new Set();
    const results = [];

    await Promise.allSettled(
      RSS_SOURCES.map(async (src) => {
        try {
          const res = await fetch(`${RSS2JSON}${encodeURIComponent(src.url)}&count=20`);
          const data = await res.json();
          if (data.status !== "ok") throw new Error(data.message);
          statusMap[src.source] = "ok";

          (data.items || []).forEach(item => {
            const title = (item.title || "").trim();
            if (!title || seen.has(title)) return;
            const score = scoreArticle(title, item.description, src.categoryKey);
            const isBroadFeed = src.url.includes("all.xml");
            if (isBroadFeed && score === 0) return;
            seen.add(title);

            const pubDate = item.pubDate || new Date().toISOString();
            const ageHours = (Date.now() - new Date(pubDate)) / 3600000;
            results.push({
              id: title + src.categoryKey,
              title,
              categoryKey: src.categoryKey,
              source: src.source,
              time: timeAgo(pubDate),
              pubDate,
              ageHours,
              isBreaking: ageHours < 2,
              execSummary: buildExecSummary(title, item.description),
              detailSummary: buildDetailSummary(item.description || item.content),
              url: item.link || "#",
            });
          });
        } catch (e) {
          statusMap[src.source] = "error";
        }
      })
    );

    results.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    setArticles(results);
    setFetchStatus(statusMap);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const t = setInterval(fetchAll, 15 * 60 * 1000); return () => clearInterval(t); }, [fetchAll]);

  const filtered = activeCategory === "all" ? articles : articles.filter(a => a.categoryKey === activeCategory);
  const breakingAll = articles.filter(a => a.isBreaking);
  const successCount = Object.values(fetchStatus).filter(s => s === "ok").length;
  const errorCount   = Object.values(fetchStatus).filter(s => s === "error").length;

  const dohaTime = now.toLocaleTimeString("en-US", { timeZone: "Asia/Qatar", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dohaDate = now.toLocaleDateString("en-US", { timeZone: "Asia/Qatar", weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#1C1C24", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", color: "#E0E0EC" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin   { to { transform:rotate(360deg); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:#4A4A54; border-radius:2px; }
      `}</style>

      {/* Breaking Banner */}
      {showBanner && breakingAll.length > 0 && (
        <div style={{
          background: "#FF193312",
          borderBottom: "1px solid #FF193330",
          padding: "8px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
            <BreakingBadge />
            <span style={{ fontSize: 11, color: "#C8C8D4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "72vw" }}>
              {breakingAll.slice(0, 3).map(n => n.title.slice(0, 55) + "…").join("  ·  ")}
            </span>
          </div>
          <button onClick={() => setShowBanner(false)} style={{ background: "none", border: "none", color: "#8A8A96", cursor: "pointer", fontSize: 18, flexShrink: 0, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Header */}
      <header style={{ padding: "18px 20px 0", borderBottom: "1px solid #32323C", background: "#20202A" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F5A623", boxShadow: "0 0 10px #F5A62380" }} />
                <span style={{ fontSize: 9, letterSpacing: "0.22em", color: "#F5A623", fontWeight: 700, textTransform: "uppercase" }}>Doha Intelligence</span>
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em", margin: 0 }}>
                News Desk
              </h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, color: "#FFFFFF", fontWeight: 500, letterSpacing: "0.04em" }}>{dohaTime}</div>
              <div style={{ fontSize: 10, color: "#666672", marginTop: 4 }}>{dohaDate} · AST</div>
            </div>
          </div>

          {/* Category Tabs */}
          <div style={{ display: "flex", gap: 2, overflowX: "auto" }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.key;
              const col = cat.key !== "all" ? CAT_COLORS[cat.key] : null;
              const count = cat.key === "all" ? articles.length : articles.filter(a => a.categoryKey === cat.key).length;
              return (
                <button key={cat.key} onClick={() => setActiveCategory(cat.key)} style={{
                  background: isActive ? "#2A2A34" : "transparent",
                  border: "none",
                  borderBottom: `2px solid ${isActive ? (col ? col.accent : "#F5A623") : "transparent"}`,
                  color: isActive ? "#FFFFFF" : "#7A7A86",
                  padding: "8px 13px 10px", cursor: "pointer",
                  fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
                  transition: "all 0.15s", borderRadius: "5px 5px 0 0",
                  display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                }}>
                  <span style={{ fontSize: 12 }}>{cat.icon}</span>
                  {cat.label}
                  <span style={{
                    background: isActive ? "#3A3A44" : "transparent",
                    color: isActive ? (col ? col.accent : "#F5A623") : "#4A4A56",
                    fontSize: 9, padding: "1px 6px", borderRadius: 8,
                    fontFamily: "'DM Mono', monospace",
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "16px 20px 56px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
          {[
            { v: articles.length.toString(),      l: "Articles",     s: "Live feed" },
            { v: breakingAll.length.toString(),   l: "Breaking",     s: "< 2h old" },
            { v: successCount.toString(),          l: "Sources Live", s: errorCount > 0 ? `${errorCount} failed` : "All OK ✓" },
            { v: lastUpdated
                ? lastUpdated.toLocaleTimeString("en-US", { timeZone: "Asia/Qatar", hour: "2-digit", minute: "2-digit", hour12: false })
                : "--:--",                          l: "Last Sync",   s: "AST" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#242430", border: "1px solid #3A3A44", borderRadius: 8, padding: "11px 13px" }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#FFFFFF", fontFamily: "'DM Mono', monospace" }}>{s.v}</div>
              <div style={{ fontSize: 10, color: "#8A8A96", marginTop: 2 }}>{s.l}</div>
              <div style={{ fontSize: 9, color: s.l === "Sources Live" && errorCount > 0 ? "#FF1933" : "#525260", marginTop: 2 }}>{s.s}</div>
            </div>
          ))}
        </div>

        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 14, background: activeCategory !== "all" && CAT_COLORS[activeCategory] ? CAT_COLORS[activeCategory].accent : "#F5A623", borderRadius: 2 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#A0A0AC", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {activeCategory === "all" ? "All Stories" : CATEGORIES.find(c => c.key === activeCategory)?.label}
            </span>
            <span style={{ fontSize: 9, color: "#4A4A56" }}>· tap to expand</span>
          </div>
          <button
            onClick={fetchAll} disabled={loading}
            style={{
              background: "none", border: "1px solid #3A3A44",
              color: loading ? "#4A4A56" : "#8A8A96",
              fontSize: 10, padding: "5px 12px", borderRadius: 5,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = "#6A6A74"; e.currentTarget.style.color = "#FFFFFF"; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#3A3A44"; e.currentTarget.style.color = loading ? "#4A4A56" : "#8A8A96"; }}
          >
            <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>↻</span>
            {loading ? "Fetching…" : "Refresh"}
          </button>
        </div>

        {/* Content */}
        {loading && articles.length === 0 ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 0", color: "#525260", fontSize: 14 }}>
            No articles found for this category.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.slice(0, 60).map((item, i) => <NewsCard key={item.id} item={item} index={i} />)}
          </div>
        )}
      </main>
    </div>
  );
}
