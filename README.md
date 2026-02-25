# readmeify

Generate professional READMEs from your GitHub repos, powered by Claude.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in your keys (see comments in the file)
2. Install dependencies: `npm install`
3. Run locally: `npm run dev`
4. Open `http://localhost:3000`

## Getting your keys

**GitHub OAuth App:**
- Go to github.com → Settings → Developer settings → OAuth Apps → New OAuth App
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
- Copy Client ID and Client Secret into `.env.local`

**Anthropic API key:**
- Go to console.anthropic.com → API Keys → Create key
- Copy into `.env.local`

## Deploy to Vercel

1. Push to GitHub
2. Import repo at vercel.com
3. Add your env variables in Vercel project settings (same keys as `.env.local`)
4. Update your GitHub OAuth App callback URL to your Vercel domain

## Stack

- Next.js 14 (App Router)
- NextAuth.js (GitHub OAuth)
- Octokit (GitHub API)
- Anthropic SDK (Claude)
- Deployed on Vercel
