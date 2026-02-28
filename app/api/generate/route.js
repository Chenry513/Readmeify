import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getRepoContext } from "../../lib/github";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    ? "=== USER INSTRUCTIONS (highest priority) ===\n" + instructions.trim() + "\n"
    : "";

  const prompt = `You are writing a README.md for a GitHub repository. You have been given the actual file contents — use them to write something specific and accurate.

${scopeNote}
Language: ${context.language}

${instructionsBlock}

FILE TREE:
${context.fileTree}

${contextBlock}

Write the README with these qualities:
- First person, direct voice — like a developer explaining their own project to another developer
- Open with what the project actually does or why it exists — not "I'm excited to introduce" or "X is a tool that"
- Be specific using details from the file contents above — no generic filler
- If notebooks are present, use exact numbers from their outputs
- Include a self-hosting/setup section with the exact env vars you can see in the source
- End with a stack line (e.g. "Next.js · NextAuth · GitHub API · Vercel")
- Do not mention internal function names, file paths, or API route implementations
- Output only raw markdown`;

  console.log("[generate] prompt length:", prompt.length);

  const stream = await anthropic.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}