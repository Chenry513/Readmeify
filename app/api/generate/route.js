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

  // Log what we actually read so we can debug
  console.log("[generate] repo:", repo, "subdir:", subdir);
  console.log("[generate] configFiles length:", context.configFiles?.length || 0);
  console.log("[generate] sourceFiles length:", context.sourceFiles?.length || 0);
  console.log("[generate] notebookContent length:", context.notebookContent?.length || 0);
  console.log("[generate] instructions length:", instructions?.length || 0);

  const scopeNote = subdir
    ? `You are generating a README for the \`${subdir}/\` subdirectory only.`
    : "You are generating a README for the entire repository.";

  // Build the context — put actual file content front and center
  const contextParts = [];

  if (context.configFiles?.length) {
    contextParts.push(`=== CONFIG / DEPENDENCY FILES ===\n${context.configFiles}`);
  }
  if (context.sourceFiles?.length) {
    contextParts.push(`=== SOURCE CODE (read carefully — this is what the project actually does) ===\n${context.sourceFiles}`);
  }
  if (context.notebookContent?.length) {
    contextParts.push(`=== NOTEBOOK CELLS + OUTPUTS (use exact results, metrics, numbers from here) ===\n${context.notebookContent}`);
  }

  const contextBlock = contextParts.length
    ? contextParts.join("\n\n")
    : "(no file content could be read — infer from file names only)";

  // Instructions get their own clearly labelled block at the top
  const instructionsBlock = instructions?.trim()
    ? `=== USER INSTRUCTIONS (follow these exactly — they override defaults) ===
${instructions.trim()}
=== END USER INSTRUCTIONS ===`
    : "";

  const prompt = `You are a technical writer generating a README.md. You have been given the actual contents of files in the repository. Use them.

${scopeNote}
Repo: ${subdir ? `${repo}/${subdir}` : repo}
Language: ${context.language}

${instructionsBlock}

FILE TREE:
${context.fileTree}

${contextBlock}

RULES — follow all of these:
1. If the user gave instructions above, follow them exactly. They override everything else.
2. Write in first person ("I built this because...", "I use X to do Y") unless instructions say otherwise.
3. Every technical claim must come from the actual file contents above — do NOT invent features, do NOT use generic descriptions.
4. If notebooks are present, use the exact numbers from their outputs (accuracy, F1, etc.) — not approximations.
5. Be specific and detailed. A bad README says "supports multiple languages." A good one says "reads .py, .js, .ts, .ipynb, .r, .sql files and extracts source code and cell outputs."
6. Do not write a generic README. If you cannot find specific details in the files above, say so honestly.
7. Output only raw markdown. No preamble, no explanation, no "Here is your README:".`;

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