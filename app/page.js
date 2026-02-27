"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";

// ── tiny markdown renderer ────────────────────────────────────────────────────
function renderMd(md) {
  const lines = md.split("\n");
  const out = [];
  let inCode = false, codeBuf = [], inTable = false, tableRows = [];

  const flush = () => {
    if (inTable) { out.push(`<table>${tableRows.join("")}</table>`); tableRows = []; inTable = false; }
  };
  const inline = (t) =>
    t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "")
     .replace(/\[([^\]]+)\]\([^)]+\)/g, "<span style='color:var(--accent2)'>$1</span>")
     .replace(/`([^`]+)`/g, `<code style='font-family:JetBrains Mono,monospace;font-size:.78em;background:var(--surface2);padding:2px 6px;border-radius:4px;color:var(--accent2)'>$1</code>`)
     .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
     .replace(/\*([^*]+)\*/g, "<em>$1</em>")
     .replace(/~~([^~]+)~~/g, "<s>$1</s>");

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("```")) {
      if (!inCode) { inCode = true; codeBuf = []; }
      else { inCode = false; out.push(`<pre style='background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px;overflow:auto;margin:10px 0'><code style='font-family:JetBrains Mono,monospace;font-size:.76em;color:#8888aa;line-height:1.8'>${codeBuf.map(x=>x.replace(/</g,"&lt;")).join("\n")}</code></pre>`); }
      continue;
    }
    if (inCode) { codeBuf.push(l); continue; }
    if (l.startsWith("|")) {
      inTable = true;
      const cells = l.split("|").filter(Boolean).map(c => c.trim());
      const next = lines[i+1] || "";
      if (next.startsWith("|--") || next.startsWith("| --")) {
        tableRows.push(`<tr>${cells.map(c=>`<th style='background:var(--surface2);padding:8px 12px;border:1px solid var(--border);text-align:left;font-size:.78em;color:var(--muted)'>${inline(c)}</th>`).join("")}</tr>`);
      } else if (!l.match(/^[\s|:-]+$/)) {
        tableRows.push(`<tr>${cells.map(c=>`<td style='padding:7px 12px;border:1px solid var(--border);font-size:.8em;color:#8888aa'>${inline(c)}</td>`).join("")}</tr>`);
      }
      continue;
    }
    flush();
    if (!l.trim()) { out.push("<br/>"); continue; }
    if (/^# /.test(l)) out.push(`<h1 style='font-family:Lora,serif;font-size:1.8em;margin:0 0 .4em;color:var(--text);font-weight:600'>${inline(l.slice(2))}</h1>`);
    else if (/^## /.test(l)) out.push(`<h2 style='font-size:1.05em;font-weight:600;margin:1.6em 0 .5em;color:var(--text);border-bottom:1px solid var(--border);padding-bottom:5px'>${inline(l.slice(3))}</h2>`);
    else if (/^### /.test(l)) out.push(`<h3 style='font-size:.92em;font-weight:600;margin:1.2em 0 .3em;color:var(--accent2)'>${inline(l.slice(4))}</h3>`);
    else if (/^> /.test(l)) out.push(`<blockquote style='border-left:3px solid var(--accent);padding:4px 0 4px 14px;color:var(--muted);font-style:italic;font-size:.85em;margin:10px 0'>${inline(l.slice(2))}</blockquote>`);
    else if (/^[-*] /.test(l)) out.push(`<div style='display:flex;gap:8px;align-items:flex-start;margin:3px 0;font-size:.85em;color:#9090b0'><span style='color:var(--border2);margin-top:2px'>–</span><span>${inline(l.slice(2))}</span></div>`);
    else if (/^\d+\. /.test(l)) out.push(`<div style='font-size:.85em;color:#9090b0;margin:3px 0;padding-left:1rem'>${inline(l.replace(/^\d+\. /,""))}</div>`);
    else if (l.startsWith("![")) { /* skip badge images */ }
    else out.push(`<p style='font-size:.85em;color:#9090b0;margin:.4em 0;line-height:1.7'>${inline(l)}</p>`);
  }
  flush();
  return out.join("");
}

const langColors = {
  TypeScript:"#3178c6",JavaScript:"#f1e05a",Python:"#3572A5",
  Rust:"#dea584",Go:"#00ADD8",Ruby:"#701516",Java:"#b07219",
  "C++":"#f34b7d","C#":"#178600",PHP:"#4F5D95",Swift:"#fa7343",
  Kotlin:"#A97BFF",Dart:"#00B4AB",Shell:"#89e051",
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d/7)}w ago`;
  if (d < 365) return `${Math.floor(d/30)}mo ago`;
  return `${Math.floor(d/365)}y ago`;
}

// ── GitHubIcon (clean SVG, no emoji) ─────────────────────────────────────────
function GitHubIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur=".8s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: session, status } = useSession();
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [readme, setReadme] = useState("");
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState("preview"); // preview | raw
  const [commitState, setCommitState] = useState("idle"); // idle | loading | done | error
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(null);

  // Fetch repos once logged in
  useEffect(() => {
    if (!session) return;
    setReposLoading(true);
    fetch("/api/repos")
      .then(r => r.json())
      .then(data => { setRepos(Array.isArray(data) ? data : []); setReposLoading(false); })
      .catch(() => setReposLoading(false));
  }, [session]);

  const filtered = repos.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleGenerate() {
    if (!selectedRepo || generating) return;
    setReadme("");
    setGenerating(true);
    setCommitState("idle");
    const [owner] = selectedRepo.fullName.split("/");

    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo: selectedRepo.name }),
        signal: abortRef.current.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setReadme(acc);
      }
    } catch (e) {
      if (e.name !== "AbortError") console.error(e);
    }
    setGenerating(false);
  }

  async function handleCommit() {
    if (!selectedRepo || !readme) return;
    setCommitState("loading");
    const [owner] = selectedRepo.fullName.split("/");
    try {
      const res = await fetch("/api/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo: selectedRepo.name, content: readme }),
      });
      const data = await res.json();
      setCommitState(data.success ? "done" : "error");
    } catch {
      setCommitState("error");
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(readme);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── LANDING ────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
        <SpinnerIcon />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
        {/* nav */}
        <nav style={{ height:56, display:"flex", alignItems:"center", padding:"0 2rem", borderBottom:"1px solid var(--border)" }}>
          <span style={{ fontFamily:"inherit", fontSize:"1.15rem", fontWeight:500, color:"var(--text)", letterSpacing:"-.01em" }}>readmeify</span>
        </nav>

        {/* hero */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"4rem 2rem", textAlign:"center" }}>
          <div style={{
            display:"inline-block", padding:"5px 12px", borderRadius:20,
            border:"1px solid var(--border2)", color:"var(--muted)",
            fontSize:".75rem", marginBottom:"1.8rem", fontFamily:"JetBrains Mono,monospace",
            letterSpacing:".04em"
          }}>
            README generator
          </div>

          <h1 style={{
            fontFamily:"inherit", fontSize:"clamp(2.4rem,5vw,4rem)",
            fontWeight:600, lineHeight:1.15, marginBottom:"1.1rem",
            color:"var(--text)", maxWidth:640
          }}>
            Your repo deserves a<br/>
            <span style={{ fontStyle:"italic", color:"var(--accent2)" }}>better README</span>
          </h1>

          <p style={{ color:"var(--muted)", fontSize:"1rem", maxWidth:460, lineHeight:1.7, marginBottom:"2.5rem" }}>
            Connect GitHub, pick a repo, and get a handcrafted README generated from your actual code — then commit it directly.
          </p>

          <button
            onClick={() => signIn("github")}
            style={{
              display:"flex", alignItems:"center", gap:10,
              background:"var(--text)", color:"var(--bg)",
              border:"none", borderRadius:10, padding:"12px 24px",
              fontSize:".95rem", fontWeight:500, cursor:"pointer",
              fontFamily:"inherit", transition:"opacity .15s"
            }}
            onMouseOver={e=>e.currentTarget.style.opacity=".85"}
            onMouseOut={e=>e.currentTarget.style.opacity="1"}
          >
            <GitHubIcon size={17} color="var(--bg)" />
            Continue with GitHub
          </button>

          <p style={{ color:"var(--subtle)", fontSize:".76rem", marginTop:"1rem" }}>
            We only request read/write access to your repos.
          </p>

          {/* steps */}
          <div style={{
            display:"flex", gap:0, marginTop:"4rem",
            borderTop:"1px solid var(--border)", paddingTop:"3rem",
            maxWidth:560, width:"100%"
          }}>
            {[
              ["Connect", "Sign in with your GitHub account"],
              ["Pick a repo", "We read your file tree & dependencies"],
              ["Generate", "Claude writes a tailored README"],
              ["Commit", "Push it directly to your repo"],
            ].map(([t,d], i, arr) => (
              <div key={t} style={{ flex:1, textAlign:"center", position:"relative", padding:"0 .5rem" }}>
                {i < arr.length-1 && (
                  <div style={{ position:"absolute", right:0, top:"14px", color:"var(--border2)", fontSize:".8rem" }}>→</div>
                )}
                <div style={{
                  width:28, height:28, borderRadius:"50%",
                  border:"1px solid var(--border2)", color:"var(--muted)",
                  display:"grid", placeItems:"center",
                  fontFamily:"JetBrains Mono,monospace", fontSize:".7rem",
                  margin:"0 auto 10px"
                }}>{String(i+1).padStart(2,"0")}</div>
                <div style={{ fontSize:".82rem", fontWeight:500, marginBottom:4 }}>{t}</div>
                <div style={{ fontSize:".74rem", color:"var(--muted)", lineHeight:1.5 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── AUTHENTICATED APP ──────────────────────────────────────────────────────
  const avatarLetter = session.user?.name?.[0]?.toUpperCase() || "U";

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      {/* NAV */}
      <nav style={{
        height:56, display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 1.5rem", borderBottom:"1px solid var(--border)",
        position:"sticky", top:0, background:"rgba(12,12,14,.9)", backdropFilter:"blur(12px)", zIndex:10
      }}>
        <span style={{ fontFamily:"inherit", fontSize:"1.1rem", fontWeight:500, color:"var(--text)" }}>readmeify</span>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {session.user?.image ? (
            <img src={session.user.image} alt="" style={{ width:28, height:28, borderRadius:"50%", border:"1px solid var(--border2)" }} />
          ) : (
            <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--surface2)", border:"1px solid var(--border2)", display:"grid", placeItems:"center", fontSize:".78rem", fontWeight:600 }}>{avatarLetter}</div>
          )}
          <span style={{ fontSize:".82rem", color:"var(--muted)" }}>{session.user?.name || session.user?.email}</span>
          <button
            onClick={() => signOut()}
            style={{ background:"none", border:"1px solid var(--border)", color:"var(--muted)", padding:"5px 12px", borderRadius:7, fontSize:".78rem", cursor:"pointer", fontFamily:"inherit" }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* MAIN LAYOUT */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* LEFT SIDEBAR — repo picker */}
        <div style={{
          width:300, flexShrink:0, borderRight:"1px solid var(--border)",
          display:"flex", flexDirection:"column", height:"calc(100vh - 56px)",
          position:"sticky", top:56, overflow:"hidden"
        }}>
          <div style={{ padding:"1rem", borderBottom:"1px solid var(--border)" }}>
            <div style={{ fontSize:".72rem", color:"var(--muted)", fontFamily:"JetBrains Mono,monospace", marginBottom:10, letterSpacing:".06em", textTransform:"uppercase" }}>
              repositories
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter repos..."
              style={{
                width:"100%", background:"var(--surface2)", border:"1px solid var(--border)",
                borderRadius:8, padding:"7px 12px", color:"var(--text)", fontSize:".82rem",
                fontFamily:"inherit", outline:"none"
              }}
            />
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
            {reposLoading ? (
              <div style={{ padding:"2rem", textAlign:"center", color:"var(--muted)", fontSize:".8rem", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <SpinnerIcon /> Loading repos...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding:"2rem", textAlign:"center", color:"var(--muted)", fontSize:".8rem" }}>No repos found</div>
            ) : filtered.map(repo => {
              const active = selectedRepo?.id === repo.id;
              return (
                <div
                  key={repo.id}
                  onClick={() => { setSelectedRepo(repo); setReadme(""); setCommitState("idle"); }}
                  style={{
                    padding:"10px 12px", borderRadius:8, cursor:"pointer", marginBottom:2,
                    background: active ? "rgba(35,134,54,.1)" : "transparent",
                    border: `1px solid ${active ? "rgba(35,134,54,.3)" : "transparent"}`,
                    transition:"all .12s"
                  }}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                    <span style={{ fontSize:".84rem", fontFamily:"JetBrains Mono,monospace", color: active ? "var(--accent2)" : "var(--text)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{repo.name}</span>
                    {repo.private && <span style={{ fontSize:".62rem", color:"var(--muted)", border:"1px solid var(--border2)", borderRadius:3, padding:"1px 5px" }}>private</span>}
                  </div>
                  {repo.description && (
                    <div style={{ fontSize:".75rem", color:"var(--muted)", marginBottom:5, lineHeight:1.4, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{repo.description}</div>
                  )}
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {repo.language && (
                      <>
                        <span style={{ width:7, height:7, borderRadius:"50%", background: langColors[repo.language] || "var(--muted)", flexShrink:0 }} />
                        <span style={{ fontSize:".72rem", color:"var(--muted)" }}>{repo.language}</span>
                      </>
                    )}
                    <span style={{ fontSize:".72rem", color:"var(--subtle)", marginLeft:"auto" }}>{timeAgo(repo.updatedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — generator + output */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", height:"calc(100vh - 56px)", overflow:"hidden" }}>

          {!selectedRepo ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, color:"var(--muted)" }}>
              <div style={{ width:48, height:48, borderRadius:12, background:"var(--surface2)", border:"1px solid var(--border)", display:"grid", placeItems:"center" }}>
                <GitHubIcon size={22} color="var(--subtle)" />
              </div>
              <p style={{ fontSize:".88rem" }}>Select a repository to get started</p>
            </div>
          ) : (
            <>
              {/* TOOLBAR */}
              <div style={{
                padding:"12px 20px", borderBottom:"1px solid var(--border)",
                display:"flex", alignItems:"center", gap:12, flexWrap:"wrap"
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:".9rem", fontWeight:500, marginBottom:2, fontFamily:"JetBrains Mono,monospace", color:"var(--text)" }}>
                    {selectedRepo.fullName}
                  </div>
                  {selectedRepo.description && (
                    <div style={{ fontSize:".76rem", color:"var(--muted)" }}>{selectedRepo.description}</div>
                  )}
                </div>

                {readme && (
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    {/* view toggle */}
                    <div style={{ display:"flex", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:7, overflow:"hidden" }}>
                      {["preview","raw"].map(v => (
                        <button key={v} onClick={() => setView(v)} style={{
                          padding:"5px 12px", fontSize:".75rem", border:"none", cursor:"pointer",
                          fontFamily:"inherit", background: view===v ? "var(--border2)" : "transparent",
                          color: view===v ? "var(--text)" : "var(--muted)", transition:"all .1s"
                        }}>{v}</button>
                      ))}
                    </div>
                    {/* copy */}
                    <button onClick={handleCopy} style={{
                      background:"none", border:"1px solid var(--border)", color: copied ? "var(--green)" : "var(--muted)",
                      padding:"5px 12px", borderRadius:7, fontSize:".75rem", cursor:"pointer", fontFamily:"inherit", transition:"all .15s"
                    }}>{copied ? "Copied!" : "Copy"}</button>
                    {/* commit */}
                    <button
                      onClick={handleCommit}
                      disabled={commitState === "loading" || commitState === "done"}
                      style={{
                        display:"flex", alignItems:"center", gap:7,
                        background: commitState === "done" ? "rgba(82,208,138,.12)" : "rgba(35,134,54,.1)",
                        border: `1px solid ${commitState === "done" ? "rgba(82,208,138,.4)" : "rgba(35,134,54,.4)"}`,
                        color: commitState === "done" ? "var(--green)" : commitState === "error" ? "var(--red)" : "var(--accent2)",
                        padding:"5px 14px", borderRadius:7, fontSize:".78rem", cursor: commitState === "done" ? "default" : "pointer",
                        fontFamily:"inherit", fontWeight:500, transition:"all .15s"
                      }}
                    >
                      {commitState === "loading" ? <><SpinnerIcon /> Committing...</> :
                       commitState === "done" ? "✓ Committed to GitHub" :
                       commitState === "error" ? "Commit failed — retry" :
                       <><GitHubIcon size={13} color="var(--accent2)" /> Commit to GitHub</>}
                    </button>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{
                    display:"flex", alignItems:"center", gap:8,
                    background: generating ? "var(--surface2)" : "var(--text)",
                    color: generating ? "var(--muted)" : "var(--bg)",
                    border: generating ? "1px solid var(--border2)" : "none",
                    borderRadius:8, padding:"8px 18px",
                    fontSize:".85rem", fontWeight:500, cursor: generating ? "not-allowed" : "pointer",
                    fontFamily:"inherit", transition:"all .15s"
                  }}
                >
                  {generating ? <><SpinnerIcon /> Generating...</> : readme ? "Regenerate" : "Generate README"}
                </button>
              </div>

              {/* OUTPUT AREA */}
              <div style={{ flex:1, overflow:"auto", padding:"24px 28px" }}>
                {!readme && !generating && (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", flexDirection:"column", gap:10, color:"var(--muted)" }}>
                    <p style={{ fontSize:".88rem" }}>Click <strong style={{color:"var(--text)"}}>Generate README</strong> to create your README</p>
                    <p style={{ fontSize:".76rem", color:"var(--subtle)" }}>We'll read your file structure and dependencies automatically</p>
                  </div>
                )}

                {(readme || generating) && (
                  <div style={{ maxWidth: view === "raw" ? 900 : 780, margin:"0 auto" }}>
                    {view === "raw" ? (
                      <pre style={{
                        fontFamily:"JetBrains Mono,monospace", fontSize:".76rem",
                        color:"#8080a0", lineHeight:1.8, whiteSpace:"pre-wrap", wordBreak:"break-word"
                      }}>{readme}{generating && <span style={{color:"var(--accent2)",animation:"blink 1s step-end infinite"}}>▋</span>}</pre>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: renderMd(readme) }} />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        input::placeholder { color: var(--subtle); }
        input:focus { border-color: var(--border2) !important; }
      `}</style>
    </div>
  );
}