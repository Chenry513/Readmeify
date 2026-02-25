import { Octokit } from "@octokit/rest";

// Decode base64 content from GitHub API
function decode(content) {
  return Buffer.from(content, "base64").toString("utf-8");
}

// Files we want to read for context (in priority order)
const CONTEXT_FILES = [
  "package.json",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "composer.json",
  "Gemfile",
  "pyproject.toml",
];

export async function getRepoContext(accessToken, owner, repo) {
  const octokit = new Octokit({ auth: accessToken });

  // 1. Get the full file tree
  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: "HEAD",
    recursive: "1",
  });

  // Build a readable file tree string (max 120 entries to keep prompt lean)
  const tree = treeData.tree
    .filter((f) => f.type === "blob")
    .slice(0, 120)
    .map((f) => f.path)
    .join("\n");

  // 2. Try to grab dependency/config files for tech stack context
  const contextSnippets = [];
  for (const filename of CONTEXT_FILES) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: filename });
      if (data.content) {
        const content = decode(data.content).slice(0, 1500); // cap size
        contextSnippets.push(`=== ${filename} ===\n${content}`);
      }
    } catch {
      // File doesn't exist in this repo, skip
    }
    if (contextSnippets.length >= 2) break; // 2 config files is plenty
  }

  // 3. Grab repo metadata
  const { data: repoMeta } = await octokit.repos.get({ owner, repo });

  return {
    name: repo,
    description: repoMeta.description || "",
    language: repoMeta.language || "",
    stars: repoMeta.stargazers_count,
    topics: repoMeta.topics || [],
    fileTree: tree,
    configFiles: contextSnippets.join("\n\n"),
  };
}

export async function getUserRepos(accessToken) {
  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 30,
    type: "owner",
  });
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    updatedAt: r.updated_at,
    private: r.private,
  }));
}

export async function commitReadme(accessToken, owner, repo, content) {
  const octokit = new Octokit({ auth: accessToken });

  // Check if README.md already exists so we can update (not create)
  let sha;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: "README.md" });
    sha = data.sha;
  } catch {
    // File doesn't exist yet — that's fine, sha stays undefined
  }

  const encoded = Buffer.from(content).toString("base64");

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: "README.md",
    message: sha ? "docs: update README via readmeify" : "docs: add README via readmeify",
    content: encoded,
    ...(sha ? { sha } : {}),
  });
}
