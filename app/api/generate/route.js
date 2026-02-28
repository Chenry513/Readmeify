import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getRepoContext } from "../../lib/github";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { owner, repo, subdir, instructions } = await req.json();
  if (!owner || !repo) {
    return Response.json({ error: "Missing owner or repo" }, { status: 400 });
  }

  const context = await getRepoContext(session.accessToken, owner, repo, subdir || null);

  console.log("[generate] repo:", repo, "subdir:", subdir);
  console.log("[generate] configFiles length:", context.configFiles?.length || 0);
  console.log("[generate] sourceFiles length:", context.sourceFiles?.length || 0);
  console.log("[generate] notebookContent length:", context.notebookContent?.length || 0);
  console.log("[generate] instructions length:", instructions?.length || 0);

  const scopeNote = subdir
    ? `You are generating a README for the \`${subdir}/\` subdirectory only.`
    : "You are generating a README for the entire repository.";

  const contextParts = [];
  if (context.configFiles?.length) {
    contextParts.push(`=== CONFIG / DEPENDENCY FILES ===\n${context.configFiles}`);
  }
  if (context.sourceFiles?.length) {
    contextParts.push(`=== SOURCE CODE ===\n${context.sourceFiles}`);
  }
  if (context.notebookContent?.length) {
    contextParts.push(`=== NOTEBOOK CELLS + OUTPUTS ===\n${context.notebookContent}`);
  }
  const contextBlock = contextParts.join("\n\n") || "(no file content available)";

  const instructionsBlock = instructions?.trim()
    ? `=== USER INSTRUCTIONS — follow these, they override the example format below ===\n${instructions.trim()}\n`
    : "";

  const prompt = `You are writing a README for a GitHub repository. Below is the actual content of the files in the repo — use it to write something specific and accurate.

${scopeNote}
Repo: ${subdir ? `${repo}/${subdir}` : repo}
Language: ${context.language}

${instructionsBlock}

FILE TREE:
${context.fileTree}

${contextBlock}

---

Here is an example of the style, depth, and structure I want. Study it carefully — your output should feel like this:

---EXAMPLE START---
# readmeify

I hate writing READMEs. This tool connects to your GitHub, reads your actual repo — file tree, config files, source code, notebook outputs — and generates a README that reflects what the project actually does. Then lets you commit it directly without leaving the page.

**Live:** https://readmeify-five.vercel.app

---

## What it does

When you generate a README, it:

1. Fetches your full file tree (scoped to a subdirectory if you want)
2. Reads config files — \`package.json\`, \`requirements.txt\`, \`Cargo.toml\`, \`go.mod\`, etc.
3. Opens any \`.ipynb\` notebooks and extracts markdown cells, code cells, and their outputs — so it sees actual accuracy scores and printed results, not just the code that produced them
4. Feeds all of that as structured context to Groq (LLaMA 3.3 70B)
5. Streams the output back in real time
6. Lets you commit the result directly to your repo via the GitHub API

---

## Self-hosting

\`\`\`bash
git clone https://github.com/Chenry513/readmeify
cd readmeify
npm install
cp .env.local.example .env.local
\`\`\`

You need four things in \`.env.local\`:
- \`NEXTAUTH_SECRET\` — any random string
- \`GITHUB_ID\` + \`GITHUB_SECRET\` — from a GitHub OAuth App
- \`GROQ_API_KEY\` — free at console.groq.com

\`\`\`bash
npm run dev
\`\`\`

---

## Stack

Next.js · NextAuth · GitHub API · Groq (LLaMA 3.3 70B) · Vercel
---EXAMPLE END---

Now write the README for the repo above. Use the same voice, depth, and structure as the example — but base every detail on the actual file contents provided. Do not copy the example text. Output only raw markdown.`;

  console.log("[generate] prompt length:", prompt.length);

  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    stream: true,
    max_tokens: 2500,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}