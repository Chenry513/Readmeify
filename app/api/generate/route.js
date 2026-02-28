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
    ? `You are generating a README for the ${repo}/${subdir} subdirectory only.`
    : `You are generating a README for the ${repo} repository.`;

  const contextParts = [];
  if (context.configFiles?.length) contextParts.push("=== CONFIG FILES ===\n" + context.configFiles);
  if (context.sourceFiles?.length) contextParts.push("=== SOURCE CODE ===\n" + context.sourceFiles);
  if (context.notebookContent?.length) contextParts.push("=== NOTEBOOKS ===\n" + context.notebookContent);
  const contextBlock = contextParts.join("\n\n") || "(no file content available)";

  const instructionsBlock = instructions?.trim()
    ? "=== USER INSTRUCTIONS ===\n" + instructions.trim() + "\n"
    : "";

  const prompt = `You are writing a README.md for a GitHub repository. Use the actual file contents below.

${scopeNote}
Language: ${context.language}

${instructionsBlock}

FILE TREE:
${context.fileTree}

${contextBlock}

Write the README in first person, direct voice. Open with what the project does. Be specific. Include setup with exact env vars. End with stack line. Output only raw markdown.`;

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