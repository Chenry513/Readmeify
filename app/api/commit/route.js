import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { commitReadme } from "../../lib/github";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { owner, repo, content } = await req.json();
  if (!owner || !repo || !content) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    await commitReadme(session.accessToken, owner, repo, content);
    return Response.json({ success: true });
  } catch (err) {
    console.error("Commit error:", err);
    return Response.json({ error: err.message || "Commit failed" }, { status: 500 });
  }
}
