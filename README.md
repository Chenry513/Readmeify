# readmeify

I built this because I'm lazy and hate writing READMEs. It connects to your GitHub, reads your actual repo structure and dependencies, and generates a proper README. It then lets you commit it directly to your repo without leaving the page.

**Live:** https://readmeify-five.vercel.app

---

## Usage

Visit the live site at https://readmeify-five.vercel.app

### Generate a README

1. Sign in with GitHub
2. Pick a repo from the sidebar
3. Click **Generate README**
4. Review the output in the preview or raw markdown tab
5. Hit **Commit to GitHub** to push it directly to your repo

---

## What it reads from your repo

| File | Why |
|------|-----|
| File tree | Understands your project structure |
| `package.json` | Detects stack, scripts, dependencies |
| `requirements.txt` / `Cargo.toml` / `go.mod` | Same for other languages |
| Existing `README.md` | Uses it as context if one exists |

---

## Project structure

```
readmeify/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.js   ← GitHub OAuth
│   │   ├── generate/route.js             ← AI generation
│   │   ├── commit/route.js               ← commits to GitHub
│   │   └── repos/route.js                ← fetches your repos
│   ├── lib/
│   │   └── github.js                     ← GitHub API helpers
│   ├── components/
│   │   └── Providers.js
│   ├── page.js                           ← main UI
│   ├── layout.js
│   └── globals.css
├── .env.local.example
└── package.json
```

---

## Self-hosting

```bash
git clone https://github.com/Chenry513/readmeify
cd readmeify
npm install
cp .env.local.example .env.local
```

Fill in `.env.local` with your keys — see the example file for where to get each one. Then:

```bash
npm run dev
```

---

## Stack

Next.js · NextAuth · Groq API · GitHub API · Vercel

---

## License

MIT
