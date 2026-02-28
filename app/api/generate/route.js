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

  // Determine what kind of project this looks like
  const isWebApp = context.sourceFiles?.includes("next") || context.configFiles?.includes("next") || context.fileTree?.includes("page.js") || context.fileTree?.includes("app/");
  const hasApiRoutes = context.fileTree?.includes("/api/");
  const isLibraryOrCLI = !isWebApp && (context.configFiles?.includes("bin") || context.fileTree?.includes("cli") || context.fileTree?.includes("index.js"));

  const audienceNote = isWebApp
    ? "This is a web application. Write the README for someone who wants to USE the app or self-host it — NOT for someone integrating an API. Do not document internal API routes as if they are a public API."
    : isLibraryOrCLI
    ? "This appears to be a library or CLI tool. Write for someone who wants to install and use it."
    : "Write for someone who wants to use or contribute to the project.";

  const prompt = `You are a developer writing a README for your own project. You are explaining it to another developer who wants to use it, build on it, or understand how it works. You are not a technical writer. You are not an AI assistant. You built this thing and you know it well.

${audienceNote}

${scopeNote}
Repo: ${subdir ? `${repo}/${subdir}` : repo}
Language: ${context.language}

${instructionsBlock}

FILE TREE:
${context.fileTree}

${contextBlock}

RULES — follow all of these:
1. If the user gave instructions above, follow them exactly. They override everything else.
2. Default tone: a developer explaining their own project to another developer. First person, direct, no fluff. Like a README you'd actually stop scrolling to read.
3. Do NOT open with "I built X to do Y." Open with a single punchy line about what it is or why it exists — something that would make a developer think "oh that's useful."
4. Do NOT use filler phrases like "beautiful READMEs", "high-quality output", "easy to read and understand", "seamless experience". Be concrete instead.
5. Do NOT narrate internal code ("I use getRepoContext to retrieve..."). Explain what it does from the user's perspective.
6. Do NOT end with "for more information see X" or "feel free to reach out" or any soft AI landing. Just stop when you're done.
7. Every technical claim must come from the actual file contents above — no invented features.
8. If notebooks are present, use exact numbers from outputs — not approximations.
9. Be specific. Bad: "supports multiple file types." Good: "reads .py, .js, .ts, .ipynb, .r, .sql — for notebooks it pulls markdown cells, code cells, and their printed outputs so it sees actual results not just the code."
10. Setup section must include exact env vars needed based on what you see in the source (e.g. GITHUB_ID, GITHUB_SECRET, GROQ_API_KEY, NEXTAUTH_SECRET).
11. If this is a web app, do NOT list internal API routes as "API Endpoints" with GET/POST/params — those are implementation details, not documentation for users. Instead describe what the app lets you DO: "pick a repo, click generate, commit the result."
12. Do not repeat the same information twice under different headings.
11. Output only raw markdown. No preamble, no explanation, no "Here is your README:".`;

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