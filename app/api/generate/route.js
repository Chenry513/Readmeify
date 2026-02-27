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

  const instructionsNote = instructions?.trim()
    ? `\nExtra instructions from the user:\n${instructions.trim()}`
    : "";

  const prompt = `You are an expert technical writer. Generate a professional, well-structured README.md for the following GitHub repository.

${scopeNote}

Repository name: ${subdir ? `${repo}/${subdir}` : repo}
Description: ${context.description || "not provided"}
Primary language: ${context.language}
Topics/tags: ${context.topics.join(", ") || "none"}

File structure:
${context.fileTree}

${context.configFiles ? `Configuration files:\n${context.configFiles}` : ""}
${instructionsNote}

Write a README.md that:
- Opens with a concise 1-2 sentence description of what the project does
- Includes relevant tech stack badges (use shields.io style markdown)
- Has a Features section with the most important capabilities inferred from the code structure
- Has clear Installation and Usage sections based on the detected tech stack
- Includes a Contributing section
- Ends with a License section (assume MIT)
- Uses clean markdown formatting with proper headers, code blocks, and tables where appropriate
- Feels like it was written by a senior developer, not a template generator

Do not include any preamble or explanation — output only the raw markdown content of the README.`;

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
