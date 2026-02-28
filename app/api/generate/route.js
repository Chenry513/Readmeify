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
    ? `You are generating a README for the ${repo}/${subdir} subdirectory only.`
    : `You are generating a README for the ${repo} repository.`;

  const contextParts = [];
  if (context.configFiles?.length) {
    contextParts.push("=== CONFIG / DEPENDENCY FILES ===\n" + context.configFiles);
  }
  if (context.sourceFiles?.length) {
    contextParts.push("=== SOURCE CODE ===\n" + context.sourceFiles);
  }
  if (context.notebookContent?.length) {
    contextParts.push("=== NOTEBOOK CELLS + OUTPUTS ===\n" + context.notebookContent);
  }
  const contextBlock = contextParts.join("\n\n") || "(no file content available)";

  const instructionsBlock = instructions?.trim()
    ? "=== USER INSTRUCTIONS (highest priority — override the example style if needed) ===\n" + instructions.trim() + "\n"
    : "";

  const exampleReadme = `# readmeify

I hate writing READMEs. This connects to GitHub, reads your actual repo — file tree, config files, source code, notebook outputs — and generates a README that reflects what the project actually does. Then lets you commit it without leaving the page.

**Live:** https://readmeify-five.vercel.app

---

## What it does

Most README generators just use the repo name and spit out a template. This one actually reads your code.

When you generate a README, it:

1. Fetches your full file tree (scoped to a subdirectory if you want)
2. Reads config files — package.json, requirements.txt, Cargo.toml, go.mod, etc.
3. Opens .ipynb notebooks and extracts markdown cells, code cells, and their printed outputs — so it sees actual accuracy scores and results, not just the code that produced them
4. Reads source files — .py, .js, .ts, .r, .sql and more — up to 8 files at 1000 chars each
5. Feeds all of that as structured context to Groq (LLaMA 3.3 70B) and streams the output back
6. Lets you commit the result directly to your repo via the GitHub API

You can also scope generation to a subdirectory (useful for monorepos or course project folders), and add notes in the instructions box for context the files don't make obvious.

---

## Self-hosting

git clone https://github.com/Chenry513/readmeify
cd readmeify
npm install
cp .env.local.example .env.local

You need four things in .env.local:

- NEXTAUTH_SECRET — any random string
- GITHUB_ID + GITHUB_SECRET — from a GitHub OAuth App (callback: http://localhost:3000/api/auth/callback/github)
- GROQ_API_KEY — free at console.groq.com

npm run dev

---

## Stack

Next.js · NextAuth · GitHub API · Groq (LLaMA 3.3 70B) · Vercel`;

  const prompt = `Your job is to write a README for a GitHub repository. 

IMPORTANT: Study this example README carefully. Match its tone exactly — direct, first person, no filler phrases like "I'm excited to introduce" or "simplifies the process". The example author is a developer talking to other developers, not a product marketer.

=== EXAMPLE README (match this tone and structure) ===
${exampleReadme}
=== END EXAMPLE ===

Now write a README for this repo using the same voice. Base every technical detail on the file contents below — do not copy the example text.

${scopeNote}
Language: ${context.language}

${instructionsBlock}

FILE TREE:
${context.fileTree}

${contextBlock}

Output only raw markdown. Do not start with "I'm excited" or any similar opener. Do not mention internal function names or file paths. Do not list API routes. Just write the README.`;

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