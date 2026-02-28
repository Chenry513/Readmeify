"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";

// ── markdown renderer (unchanged) ────────────────────────────────────────────
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
      else { inCode = false; out.push(`<pre style='background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px;overflow:auto;margin:10px 0'><code style='font-family:JetBrains Mono,monospace;font-size:.76em;color:var(--muted);line-height:1.8'>${codeBuf.map(x=>x.replace(/</g,"&lt;")).join("\n")}</code></pre>`); }
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
        tableRows.push(`<tr>${cells.map(c=>`<td style='padding:7px 12px;border:1px solid var(--border);font-size:.8em;color:var(--muted)'>${inline(c)}</td>`).join("")}</tr>`);
      }
      continue;
    }
    flush();
    if (!l.trim()) { out.push("<br/>"); continue; }
    if (/^# /.test(l)) out.push(`<h1 style='font-size:1.5em;margin:0 0 .6em;color:var(--text);font-weight:600;border-bottom:1px solid var(--border);padding-bottom:.3em'>${inline(l.slice(2))}</h1>`);
    else if (/^## /.test(l)) out.push(`<h2 style='font-size:1.05em;font-weight:600;margin:1.6em 0 .5em;color:var(--text);border-bottom:1px solid var(--border);padding-bottom:5px'>${inline(l.slice(3))}</h2>`);
    else if (/^### /.test(l)) out.push(`<h3 style='font-size:.92em;font-weight:600;margin:1.2em 0 .3em;color:var(--text)'>${inline(l.slice(4))}</h3>`);
    else if (/^> /.test(l)) out.push(`<blockquote style='border-left:3px solid var(--accent);padding:4px 0 4px 14px;color:var(--muted);font-style:italic;font-size:.85em;margin:10px 0'>${inline(l.slice(2))}</blockquote>`);
    else if (/^[-*] /.test(l)) out.push(`<div style='display:flex;gap:8px;align-items:flex-start;margin:3px 0;font-size:.85em;color:var(--muted)'><span style='color:var(--border2);margin-top:2px'>•</span><span>${inline(l.slice(2))}</span></div>`);
    else if (/^\d+\. /.test(l)) out.push(`<div style='font-size:.85em;color:var(--muted);margin:3px 0;padding-left:1rem'>${inline(l.replace(/^\d+\. /,""))}</div>`);
    else if (l.startsWith("![")) { /* skip badges */ }
    else out.push(`<p style='font-size:.875em;color:var(--muted);margin:.5em 0;line-height:1.65'>${inline(l)}</p>`);
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
  if (d === 0) return "today"; if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`; if (d < 30) return `${Math.floor(d/7)}w ago`;
  if (d < 365) return `${Math.floor(d/30)}mo ago`; return `${Math.floor(d/365)}y ago`;
}

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

function FolderIcon({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      {open
        ? <><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="2" y1="10" x2="22" y2="10"/></>
        : <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>}
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,opacity:.4}}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
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

  // file tree
  const [tree, setTree] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [selectedDir, setSelectedDir] = useState(null); // null = entire repo

  // instructions
  const [instructions, setInstructions] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const dragRef = useRef(null);

  const startSidebarDrag = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      setSidebarWidth(Math.min(480, Math.max(180, startW + delta)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // output
  const [readme, setReadme] = useState("");
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState("preview");
  const [commitState, setCommitState] = useState("idle");
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!session) return;
    setReposLoading(true);
    fetch("/api/repos")
      .then(r => r.json())
      .then(data => { setRepos(Array.isArray(data) ? data : []); setReposLoading(false); })
      .catch(() => setReposLoading(false));
  }, [session]);

  // Fetch tree when repo is selected
  useEffect(() => {
    if (!selectedRepo) return;
    setTree([]); setExpandedDirs(new Set()); setSelectedDir(null);
    setTreeLoading(true);
    const [owner] = selectedRepo.fullName.split("/");
    fetch(`/api/tree?owner=${owner}&repo=${selectedRepo.name}`)
      .then(r => r.json())
      .then(data => { setTree(Array.isArray(data) ? data : []); setTreeLoading(false); })
      .catch(() => setTreeLoading(false));
  }, [selectedRepo]);

  const filtered = repos.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggleDir = (path) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  async function handleGenerate() {
    if (!selectedRepo || generating) return;
    setReadme(""); setGenerating(true); setCommitState("idle");
    const [owner] = selectedRepo.fullName.split("/");
    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo: selectedRepo.name,
          subdir: selectedDir || null,
          instructions: instructions.trim() || null,
        }),
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
        body: JSON.stringify({ owner, repo: selectedRepo.name, content: readme, subdir: selectedDir || null }),
      });
      const data = await res.json();
      setCommitState(data.success ? "done" : "error");
    } catch { setCommitState("error"); }
  }

  function handleCopy() {
    navigator.clipboard.writeText(readme);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}><SpinnerIcon /></div>;
  }

  // ── LANDING ────────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
        <nav style={{height:56,display:"flex",alignItems:"center",padding:"0 2rem",borderBottom:"1px solid var(--border)"}}>
          <span style={{fontFamily:"inherit",fontSize:"1.15rem",fontWeight:500,color:"var(--text)",letterSpacing:"-.01em"}}>readmeify</span>
        </nav>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"4rem 2rem",textAlign:"center"}}>
          <div style={{display:"inline-block",padding:"5px 12px",borderRadius:20,border:"1px solid var(--border2)",color:"var(--muted)",fontSize:".75rem",marginBottom:"1.8rem",fontFamily:"JetBrains Mono,monospace",letterSpacing:".04em"}}>
            README generator
          </div>
          <h1 style={{fontFamily:"inherit",fontSize:"clamp(2.4rem,5vw,4rem)",fontWeight:600,lineHeight:1.15,marginBottom:"1.1rem",color:"var(--text)",maxWidth:640}}>
            Your repo deserves a<br/><span style={{fontWeight:600,color:"var(--accent2)"}}>better README</span>
          </h1>
          <p style={{color:"var(--muted)",fontSize:"1rem",maxWidth:460,lineHeight:1.7,marginBottom:"2.5rem"}}>
            Connect GitHub, pick a repo or folder, and get a handcrafted README generated from your actual code — then commit it directly.
          </p>
          <button onClick={() => signIn("github")} style={{display:"flex",alignItems:"center",gap:10,background:"var(--text)",color:"var(--bg)",border:"none",borderRadius:10,padding:"12px 24px",fontSize:".95rem",fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}
            onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
            <GitHubIcon size={17} color="var(--bg)" /> Continue with GitHub
          </button>
          <p style={{color:"var(--subtle)",fontSize:".76rem",marginTop:"1rem"}}>We only request read/write access to your repos.</p>
          <div style={{display:"flex",gap:0,marginTop:"4rem",borderTop:"1px solid var(--border)",paddingTop:"3rem",maxWidth:600,width:"100%"}}>
            {[["Connect","Sign in with your GitHub account"],["Pick a repo","Browse folders or pick the whole repo"],["Generate","AI writes a README from real context"],["Commit","Push it directly to your repo"]].map(([t,d],i,arr)=>(
              <div key={t} style={{flex:1,textAlign:"center",position:"relative",padding:"0 .5rem"}}>
                {i<arr.length-1 && <div style={{position:"absolute",right:0,top:"14px",color:"var(--border2)",fontSize:".8rem"}}>→</div>}
                <div style={{width:28,height:28,borderRadius:"50%",border:"1px solid var(--border2)",color:"var(--muted)",display:"grid",placeItems:"center",fontFamily:"JetBrains Mono,monospace",fontSize:".7rem",margin:"0 auto 10px"}}>{String(i+1).padStart(2,"0")}</div>
                <div style={{fontSize:".82rem",fontWeight:500,marginBottom:4}}>{t}</div>
                <div style={{fontSize:".74rem",color:"var(--muted)",lineHeight:1.5}}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── AUTHENTICATED ──────────────────────────────────────────────────────────
  const avatarLetter = session.user?.name?.[0]?.toUpperCase() || "U";

  // Build visible tree items (respecting expanded state)
  const visibleTree = tree.filter(item => {
    if (item.path.indexOf("/") === -1) return true; // root level always visible
    const parts = item.path.split("/");
    // every parent must be expanded
    for (let i = 1; i < parts.length; i++) {
      const parentPath = parts.slice(0, i).join("/");
      if (!expandedDirs.has(parentPath)) return false;
    }
    return true;
  });

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      {/* NAV */}
      <nav style={{height:56,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 1.5rem",borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"rgba(12,12,14,.9)",backdropFilter:"blur(12px)",zIndex:10}}>
        <span style={{fontFamily:"inherit",fontSize:"1.1rem",fontWeight:500,color:"var(--text)"}}>readmeify</span>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {session.user?.image
            ? <img src={session.user.image} alt="" style={{width:28,height:28,borderRadius:"50%",border:"1px solid var(--border2)"}}/>
            : <div style={{width:28,height:28,borderRadius:"50%",background:"var(--surface2)",border:"1px solid var(--border2)",display:"grid",placeItems:"center",fontSize:".78rem",fontWeight:600}}>{avatarLetter}</div>}
          <span style={{fontSize:".82rem",color:"var(--muted)"}}>{session.user?.name || session.user?.email}</span>
          <button onClick={() => signOut()} style={{background:"none",border:"1px solid var(--border)",color:"var(--muted)",padding:"5px 12px",borderRadius:7,fontSize:".78rem",cursor:"pointer",fontFamily:"inherit"}}>Sign out</button>
        </div>
      </nav>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* REPO SIDEBAR */}
        <div style={{width:sidebarWidth,flexShrink:0,borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",height:"calc(100vh - 56px)",position:"sticky",top:56,overflow:"hidden",position:"relative"}}>
          {/* horizontal resize handle */}
          <div onMouseDown={startSidebarDrag} style={{position:"absolute",top:0,right:-3,width:6,height:"100%",cursor:"ew-resize",zIndex:10,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:2,height:40,borderRadius:2,background:"var(--border2)",opacity:.5}}/>
          </div>
          <div style={{padding:"1rem",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontSize:".68rem",color:"var(--muted)",fontFamily:"JetBrains Mono,monospace",marginBottom:10,letterSpacing:".06em",textTransform:"uppercase"}}>repositories</div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter repos..."
              style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:"7px 12px",color:"var(--text)",fontSize:".82rem",fontFamily:"inherit",outline:"none"}}/>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
            {reposLoading ? (
              <div style={{padding:"2rem",textAlign:"center",color:"var(--muted)",fontSize:".8rem",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><SpinnerIcon/> Loading...</div>
            ) : filtered.map(repo => {
              const active = selectedRepo?.id === repo.id;
              return (
                <div key={repo.id} onClick={() => { setSelectedRepo(repo); setReadme(""); setCommitState("idle"); setInstructions(""); }}
                  style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",marginBottom:2,background:active?"rgba(35,134,54,.1)":"transparent",border:`1px solid ${active?"rgba(35,134,54,.3)":"transparent"}`,transition:"all .12s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{fontSize:".84rem",fontFamily:"JetBrains Mono,monospace",color:active?"var(--accent2)":"var(--text)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{repo.name}</span>
                    {repo.private && <span style={{fontSize:".62rem",color:"var(--muted)",border:"1px solid var(--border2)",borderRadius:3,padding:"1px 5px"}}>private</span>}
                  </div>
                  {repo.description && <div style={{fontSize:".75rem",color:"var(--muted)",marginBottom:5,lineHeight:1.4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{repo.description}</div>}
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {repo.language && <><span style={{width:7,height:7,borderRadius:"50%",background:langColors[repo.language]||"var(--muted)",flexShrink:0}}/><span style={{fontSize:".72rem",color:"var(--muted)"}}>{repo.language}</span></>}
                    <span style={{fontSize:".72rem",color:"var(--subtle)",marginLeft:"auto"}}>{timeAgo(repo.updatedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MIDDLE — file tree + instructions */}
        {selectedRepo && (
          <div style={{width:230,flexShrink:0,borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",height:"calc(100vh - 56px)",position:"sticky",top:56,overflow:"hidden"}}>

            {/* file tree */}
            <div style={{flex:1,overflow:"auto",padding:"10px 8px"}}>
              <div style={{fontSize:".65rem",color:"var(--muted)",fontFamily:"JetBrains Mono,monospace",letterSpacing:".06em",textTransform:"uppercase",marginBottom:8,padding:"0 4px"}}>scope to folder</div>

              {/* entire repo option */}
              <div onClick={() => setSelectedDir(null)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:6,cursor:"pointer",marginBottom:2,background:selectedDir===null?"rgba(35,134,54,.1)":"transparent",border:`1px solid ${selectedDir===null?"rgba(35,134,54,.25)":"transparent"}`}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={selectedDir===null?"var(--accent2)":"var(--muted)"} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                <span style={{fontSize:".76rem",color:selectedDir===null?"var(--accent2)":"var(--muted)",fontFamily:"JetBrains Mono,monospace"}}>/ entire repo</span>
              </div>

              {treeLoading ? (
                <div style={{padding:"1rem",textAlign:"center",color:"var(--muted)",fontSize:".75rem",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><SpinnerIcon/></div>
              ) : visibleTree.map(item => {
                const name = item.path.split("/").pop();
                const depth = item.path.split("/").length - 1;
                const isDir = item.type === "tree";
                const isExpanded = expandedDirs.has(item.path);
                const isSelected = selectedDir === item.path;

                return (
                  <div key={item.path}
                    onClick={() => { if (isDir) { toggleDir(item.path); setSelectedDir(item.path); } }}
                    style={{display:"flex",alignItems:"center",gap:5,padding:"4px 8px",paddingLeft:`${8+depth*12}px`,borderRadius:6,cursor:isDir?"pointer":"default",background:isSelected?"rgba(35,134,54,.08)":"transparent",border:`1px solid ${isSelected?"rgba(35,134,54,.2)":"transparent"}`,marginBottom:1}}>
                    <span style={{color:isSelected?"var(--accent2)":isDir?"var(--muted)":"transparent"}}>
                      {isDir ? <FolderIcon open={isExpanded}/> : <FileIcon/>}
                    </span>
                    <span style={{fontSize:".75rem",fontFamily:"JetBrains Mono,monospace",color:isDir?(isSelected?"var(--accent2)":"var(--text)"):"var(--muted)",fontWeight:isDir?500:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {name}
                    </span>
                    {isDir && isSelected && (
                      <span style={{marginLeft:"auto",fontSize:".58rem",color:"var(--accent)",background:"rgba(35,134,54,.12)",padding:"1px 4px",borderRadius:3,fontFamily:"JetBrains Mono,monospace",flexShrink:0}}>scoped</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* instructions */}
            <div style={{borderTop:"1px solid var(--border)"}}>
              <div style={{padding:"8px 10px"}}>
              <div style={{fontSize:".65rem",color:"var(--muted)",fontFamily:"JetBrains Mono,monospace",letterSpacing:".06em",textTransform:"uppercase",marginBottom:6}}>
                instructions <span style={{color:"var(--subtle)",textTransform:"none",letterSpacing:0,fontSize:".65rem"}}>(optional)</span>
              </div>
              <textarea value={instructions} onChange={e=>setInstructions(e.target.value)}
                placeholder="e.g. focus on the API, mention Docker, ignore the /legacy folder..."
                style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:7,padding:"8px 10px",color:"var(--text)",fontSize:".75rem",fontFamily:"inherit",resize:"none",outline:"none",lineHeight:1.5,height:100}} />
              {selectedDir && (
                <div style={{marginTop:6,fontSize:".7rem",color:"var(--accent2)",display:"flex",alignItems:"center",gap:4}}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Scoped to <code style={{fontFamily:"JetBrains Mono,monospace",background:"rgba(35,134,54,.1)",padding:"1px 5px",borderRadius:3}}>{selectedDir}/</code>
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {/* RIGHT — output */}
        <div style={{flex:1,display:"flex",flexDirection:"column",height:"calc(100vh - 56px)",overflow:"hidden"}}>
          {!selectedRepo ? (
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:"var(--muted)"}}>
              <div style={{width:48,height:48,borderRadius:12,background:"var(--surface2)",border:"1px solid var(--border)",display:"grid",placeItems:"center"}}>
                <GitHubIcon size={22} color="var(--subtle)"/>
              </div>
              <p style={{fontSize:".88rem"}}>Select a repository to get started</p>
            </div>
          ) : (
            <>
              {/* TOOLBAR */}
              <div style={{padding:"12px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:".9rem",fontWeight:500,marginBottom:2,fontFamily:"JetBrains Mono,monospace",color:"var(--text)"}}>
                    {selectedRepo.fullName}{selectedDir ? `/${selectedDir}` : ""}
                  </div>
                  {selectedRepo.description && <div style={{fontSize:".76rem",color:"var(--muted)"}}>{selectedRepo.description}</div>}
                </div>
                {readme && (
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <div style={{display:"flex",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:7,overflow:"hidden"}}>
                      {["preview","raw"].map(v=>(
                        <button key={v} onClick={()=>setView(v)} style={{padding:"5px 12px",fontSize:".75rem",border:"none",cursor:"pointer",fontFamily:"inherit",background:view===v?"var(--border2)":"transparent",color:view===v?"var(--text)":"var(--muted)"}}>{v}</button>
                      ))}
                    </div>
                    <button onClick={handleCopy} style={{background:"none",border:"1px solid var(--border)",color:copied?"var(--green)":"var(--muted)",padding:"5px 12px",borderRadius:7,fontSize:".75rem",cursor:"pointer",fontFamily:"inherit"}}>
                      {copied?"Copied!":"Copy"}
                    </button>
                    <button onClick={handleCommit} disabled={commitState==="loading"||commitState==="done"}
                      style={{display:"flex",alignItems:"center",gap:7,background:commitState==="done"?"rgba(82,208,138,.12)":"rgba(35,134,54,.1)",border:`1px solid ${commitState==="done"?"rgba(82,208,138,.4)":"rgba(35,134,54,.4)"}`,color:commitState==="done"?"var(--green)":commitState==="error"?"var(--red)":"var(--accent2)",padding:"5px 14px",borderRadius:7,fontSize:".78rem",cursor:commitState==="done"?"default":"pointer",fontFamily:"inherit",fontWeight:500}}>
                      {commitState==="loading"?<><SpinnerIcon/> Committing...</>:commitState==="done"?"✓ Committed":commitState==="error"?"Retry":<><GitHubIcon size={13} color="var(--accent2)"/> Commit to GitHub</>}
                    </button>
                  </div>
                )}
                <button onClick={handleGenerate} disabled={generating}
                  style={{display:"flex",alignItems:"center",gap:8,background:generating?"var(--surface2)":"var(--text)",color:generating?"var(--muted)":"var(--bg)",border:generating?"1px solid var(--border2)":"none",borderRadius:8,padding:"8px 18px",fontSize:".85rem",fontWeight:500,cursor:generating?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {generating?<><SpinnerIcon/> Generating...</>:readme?"Regenerate":"Generate README"}
                </button>
              </div>

              {/* OUTPUT */}
              <div style={{flex:1,overflow:"auto",padding:"24px 28px"}}>
                {!readme && !generating && (
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",flexDirection:"column",gap:10,color:"var(--muted)"}}>
                    <p style={{fontSize:".88rem"}}>Click <strong style={{color:"var(--text)"}}>Generate README</strong> to create your README</p>
                    <p style={{fontSize:".76rem",color:"var(--subtle)"}}>
                      {selectedDir ? `Scoped to ${selectedDir}/` : "Covering the entire repo"} · {instructions ? "Custom instructions added" : "No extra instructions"}
                    </p>
                  </div>
                )}
                {(readme||generating) && (
                  <div style={{maxWidth:view==="raw"?900:780,margin:"0 auto"}}>
                    {view==="raw" ? (
                      <pre style={{fontFamily:"JetBrains Mono,monospace",fontSize:".76rem",color:"#8080a0",lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                        {readme}{generating&&<span style={{color:"var(--accent2)",animation:"blink 1s step-end infinite"}}>▋</span>}
                      </pre>
                    ) : (
                      <div dangerouslySetInnerHTML={{__html:renderMd(readme)}}/>
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
        input::placeholder, textarea::placeholder { color: var(--subtle); }
        input:focus, textarea:focus { border-color: var(--border2) !important; }
      `}</style>
    </div>
  );
}