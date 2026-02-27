import { Octokit } from "@octokit/rest";

function decode(content) {
  return Buffer.from(content, "base64").toString("utf-8");
}

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

export async function getRepoContext(accessToken, owner, repo, subdir = null) {
  const octokit = new Octokit({ auth: accessToken });

  // Get the full file tree, scoped to subdir if provided
  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: "HEAD",
    recursive: "1",
  });

  // Filter to subdir if specified
  const allFiles = treeData.tree.filter((f) => f.type === "blob");
  const scopedFiles = subdir
    ? allFiles.filter((f) => f.path.startsWith(subdir + "/"))
    : allFiles;

  const tree = scopedFiles
    .slice(0, 120)
    .map((f) => (subdir ? f.path.replace(subdir + "/", "") : f.path))
    .join("\n");

  // Look for config files — check subdir first, then root
  const contextSnippets = [];
  const searchPaths = subdir
    ? CONTEXT_FILES.map((f) => `${subdir}/${f}`).concat(CONTEXT_FILES)
    : CONTEXT_FILES;

  for (const filepath of searchPaths) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: filepath });
      if (data.content) {
        const content = decode(data.content).slice(0, 1500);
        contextSnippets.push(`=== ${filepath} ===\n${content}`);
      }
    } catch {
      // doesn't exist, skip
    }
    if (contextSnippets.length >= 2) break;
  }

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

export async function getRepoTree(accessToken, owner, repo) {
  const octokit = new Octokit({ auth: accessToken });
  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: "HEAD",
    recursive: "1",
  });
  // Return dirs and files, max 200 entries
  return treeData.tree
    .filter((f) => f.path.split("/").length <= 4) // max 4 levels deep
    .slice(0, 200)
    .map((f) => ({ path: f.path, type: f.type }));
}

export async function commitReadme(accessToken, owner, repo, content, subdir = null) {
  const octokit = new Octokit({ auth: accessToken });
  const filePath = subdir ? `${subdir}/README.md` : "README.md";

  let sha;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
    sha = data.sha;
  } catch {
    // file doesn't exist yet
  }

  const encoded = Buffer.from(content).toString("base64");

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: sha
      ? `docs: update ${filePath} via readmeify`
      : `docs: add ${filePath} via readmeify`,
    content: encoded,
    ...(sha ? { sha } : {}),
  });
}