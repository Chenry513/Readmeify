# readmeify — AI-Powered README Generator

**Live Site:** [readmeify-five.vercel.app](https://readmeify-five.vercel.app)

A full-stack web app that connects to your GitHub account, reads your actual repository structure and dependencies, and generates a tailored README using AI — then lets you commit it directly to your repo without leaving the page.

> Built because writing READMEs manually is tedious and most AI-generated ones are generic. This one actually reads your code first.

---

## What This Project Does

readmeify solves the documentation problem for developers by:

- **Reading your actual repo** — file tree, `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, and any existing README are all pulled as structured context before generation
- **Generating project-specific READMEs** — the AI understands your actual stack, scripts, and dependencies rather than producing a generic template
- **Committing directly to GitHub** — review the output, then push it to your repo in one click without leaving the page
- **Real-time streaming output** — the README streams in token by token so you're not staring at a loading spinner

---

## How It Works

```
GitHub OAuth → Select Repo → GitHub API pulls file tree + deps → 
Groq API (LLaMA 3.3 70B) generates README → Stream to UI → Commit to GitHub
```

### Step by Step
1. Sign in with GitHub OAuth
2. Pick a repo from the sidebar
3. Click **Generate README** — the app fetches your repo structure and dependency files as context
4. Review the output in the preview or raw markdown tab
5. Hit **Commit to GitHub** to push directly to your repo

---

## Tech Stack

**Frontend & Framework:**
- Next.js (App Router)
- NextAuth.js — GitHub OAuth session management
- Streaming UI — real-time token-by-token output display

**AI & APIs:**
- Groq API with LLaMA 3.3 70B — fast inference with streaming support
- GitHub API — repo listing, file tree extraction, dependency manifest reading, commit creation

**Infrastructure:**
- Deployed on Vercel
- Server-side environment variable handling — API keys never exposed to client
- `vercel.json` for custom deployment configuration

---

## What It Reads From Your Repo

| File | Purpose |
|------|---------|
| File tree | Understands overall project structure |
| `package.json` | Detects stack, scripts, and dependencies |
| `requirements.txt` | Python project detection |
| `Cargo.toml` | Rust project detection |
| `go.mod` | Go project detection |
| Existing `README.md` | Used as additional context if present |

---

## Project Structure

```
readmeify/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.js   ← GitHub OAuth (NextAuth)
│   │   ├── generate/route.js             ← Groq API + streaming generation
│   │   ├── commit/route.js               ← GitHub API commit
│   │   └── repos/route.js                ← GitHub API repo listing
│   ├── lib/
│   │   └── github.js                     ← GitHub API helpers
│   ├── components/
│   │   └── Providers.js
│   ├── page.js                           ← Main UI
│   ├── layout.js
│   └── globals.css
├── .env.local.example
├── next.config.js
├── vercel.json
└── package.json
```

---

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/Chenry513/Readmeify
cd Readmeify

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.local.example .env.local
```

Fill in `.env.local` — see the example file for where to get each key:

| Variable | Where to get it |
|----------|----------------|
| `NEXTAUTH_SECRET` | Any random string |
| `GITHUB_CLIENT_ID` | GitHub → Settings → OAuth Apps |
| `GITHUB_CLIENT_SECRET` | Same OAuth App |
| `GROQ_API_KEY` | console.groq.com |

```bash
# 4. Run locally
npm run dev
```

Visit `http://localhost:3000`

---

## Key Design Decisions

**Why Groq over OpenAI?**
Groq's inference speed is significantly faster than OpenAI for streaming use cases — users see output start appearing almost instantly rather than waiting for a large response to begin. LLaMA 3.3 70B produces high-quality structured markdown output comparable to GPT-4 class models for this task.

**Why read dependency files instead of just the file tree?**
Generic README generators that only see filenames produce boilerplate output. By reading `package.json` scripts, actual dependency names, and existing documentation, the model can accurately describe what the project does, how to run it, and what technologies it uses — specific to that repo.

**Why server-side API calls?**
All Groq and GitHub API calls happen server-side in Next.js API routes. This keeps API keys out of the client bundle entirely, preventing accidental exposure through browser devtools or bundle analysis.

**Why NextAuth for GitHub OAuth?**
NextAuth handles the full OAuth flow, session management, and token refresh with minimal boilerplate. The GitHub access token is stored server-side in the session and used to make authenticated GitHub API calls on the user's behalf.

---

## Deployment

Deployed on Vercel with zero configuration — `vercel.json` handles any custom routing. Environment variables are set in the Vercel dashboard and injected at build time.

```bash
# Deploy your own instance
vercel deploy
```

---

## Future Improvements

- Support for more languages and manifest files (Gemfile, pyproject.toml, etc.)
- Section-level editing — regenerate individual README sections
- Badge auto-detection and insertion
- Multiple README style templates (minimal, detailed, academic)
- Organization-level repo access

---

## License

MIT License
