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
    hasNotebooks
      ? `NOTEBOOK CONTENTS (extracted from .ipynb files — use this as the PRIMARY source for all project content):\n${context.notebookContent}`
      : "",
  ].filter(Boolean).join("\n\n");

  // If instructions contain an example README, extract it as a style/structure reference
  const instructionsSection = hasInstructions
    ? `\nUSER GUIDANCE (read carefully):
- If the user references an example README, use it ONLY to match the section names, formatting style, and tone
- Use the actual notebook content above for all factual details — methods, results, dataset info
- Do NOT copy any text from the example verbatim
- Fix obvious errors (wrong project name, wrong objective, mismatched content)
User said: ${instructions.trim()}\n`
    : "";

  const prompt = `You are an expert technical writer generating a README.md from scratch.

${scopeNote}

Repository: ${subdir ? `${repo}/${subdir}` : repo}
Language: ${context.language}

FILE STRUCTURE:
${context.fileTree}

${repoContext}
${instructionsSection}
Write a README.md that:
- Matches this exact section structure (in order):
  1. Title + one-line description
  2. Tech stack badges (shields.io)
  3. Problem Description and Motivation
  4. Dataset Description (source, features, size, preprocessing)
  5. Project Structure (use the actual file tree above)
  6. Setup Instructions (clone, install, run)
  7. Methods Used (with subsections for each technique)
  8. Results Summary (specific numbers and findings from the notebook)
  9. Team Member Contributions (if inferable, otherwise omit)
- Uses the notebook content as the source of truth for all methods and results
- Rewrites everything in clean technical prose — never copies text verbatim
- Outputs only raw markdown, no preamble or explanation`;

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