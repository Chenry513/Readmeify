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

  const hasNotebooks = context.notebookContent?.length > 0;
  const hasSource = context.sourceFiles?.length > 0;
  const hasInstructions = instructions?.trim().length > 0;

  // Build context block — notebooks are highest priority for results/methods,
  // source files for understanding what the project actually does
  const repoContext = [
    context.configFiles
      ? `CONFIG FILES (dependencies, scripts):\n${context.configFiles}`
      : "",
    hasSource
      ? `SOURCE FILES (read these to understand what the project does):\n${context.sourceFiles}`
      : "",
    hasNotebooks
      ? `NOTEBOOK CONTENTS (cells + outputs — PRIMARY source for methods and results):\n${context.notebookContent}`
      : "",
  ].filter(Boolean).join("\n\n");

  const instructionsSection = hasInstructions
    ? `\nUSER GUIDANCE (use to understand intent, tone, and structure — do NOT copy verbatim, do NOT reproduce example READMEs word for word):\n${instructions.trim()}\n`
    : "";

  const prompt = `You are an expert technical writer generating a README.md from scratch.

${scopeNote}

Repository: ${subdir ? `${repo}/${subdir}` : repo}
Language: ${context.language}
Topics: ${context.topics.join(", ") || "none"}

FILE STRUCTURE:
${context.fileTree}

${repoContext}
${instructionsSection}
Write a README.md that:
- Opens with 1-2 sentences describing what the project actually does (inferred from the source/notebook content, not just the name)
- Uses source files and notebooks as the ground truth for all technical details
- If notebooks are present, uses their outputs for real results, metrics, and findings — not guesses
- Matches the section structure and depth from any example in the user guidance (if provided)
- Includes tech stack badges (shields.io format)
- Has clear Setup/Installation and Usage sections
- Rewrites everything in clean technical prose — never copies text verbatim from any provided content
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