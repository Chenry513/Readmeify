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

  const scopeNote = subdir
    ? `You are generating a README specifically for the \`${subdir}/\` subdirectory, not the entire repo.`
    : "You are generating a README for the entire repository.";

  const hasInstructions = instructions?.trim().length > 0;
  const hasNotebooks = context.notebookContent?.length > 0;

  const repoContext = [
    context.configFiles ? `FILE CONTENTS (config/dependencies):\n${context.configFiles}` : "",
    hasNotebooks ? `NOTEBOOK CONTENTS (extracted from .ipynb files — use this as the primary source for methods, results, and findings):\n${context.notebookContent}` : "",
  ].filter(Boolean).join("\n\n");

  // Instructions are GUIDANCE, not content to reproduce
  const instructionsSection = hasInstructions
    ? `\nUSER GUIDANCE (use this to understand intent and structure only — do NOT copy it verbatim):\n${instructions.trim()}\n`
    : "";

  const prompt = `You are an expert technical writer generating a README.md from scratch.

${scopeNote}

Repository: ${subdir ? `${repo}/${subdir}` : repo}
Language: ${context.language}

FILE STRUCTURE:
${context.fileTree}

${repoContext}
${instructionsSection}
Your task:
- Write a clean, professional README.md based on the actual repo content above
- If notebook content is present, use it as the primary source for methods, results, and findings
- If user guidance references an example README, use it only to understand desired structure — do NOT reproduce its text
- Fix any obvious errors you find (wrong project name, wrong objective, etc.)
- Include tech stack badges (shields.io format)
- Include sections: Overview, Dataset, Methods, Results, Setup, Contributors (where relevant)
- Rewrite everything in clean technical prose — do not copy-paste from any provided content
- Output only raw markdown, no preamble or explanation`;

  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    stream: true,
    max_tokens: 2000,
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