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

// Pull markdown cells + meaningful code cells from a .ipynb file
function extractNotebookText(raw) {
  try {
    const nb = JSON.parse(raw);
    const cells = nb.cells || nb.worksheets?.[0]?.cells || [];
    const lines = [];
    for (const cell of cells) {
      const src = Array.isArray(cell.source)
        ? cell.source.join("")
        : cell.source || "";
      if (!src.trim()) continue;
      if (cell.cell_type === "markdown") {
        lines.push(src.trim());
      } else if (cell.cell_type === "code") {
        const meaningful = src
          .split("\n")
          .filter((l) => l.trim() && !l.trim().startsWith("#"))
          .join("\n");
        if (meaningful.length > 30) {
          lines.push("```python\n" + src.trim() + "\n```");
        }
      }
      if (lines.join("\n").length > 4000) break;
    }
    return lines.join("\n\n");
  } catch {
    return null;
  }
}

export async function getRepoContext(accessToken, owner, repo, subdir = null) {
  const octokit = new Octokit({ auth: accessToken });

  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: "HEAD",
    recursive: "1",
  });

  const allFiles = treeData.tree.filter((f) => f.type === "blob");
  const scopedFiles = subdir
    ? allFiles.filter((f) => f.path.startsWith(subdir + "/"))
    : allFiles;

  const tree = scopedFiles
    .slice(0, 120)
    .map((f) => (subdir ? f.path.replace(subdir + "/", "") : f.path))
    .join("\n");

  // Config files
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
    } catch {}
    if (contextSnippets.length >= 2) break;
  }

  // Jupyter notebooks — read up to 3, extract markdown + code cells
  const notebookSnippets = [];
  const notebookFiles = scopedFiles
    .filter((f) => f.path.endsWith(".ipynb"))
    .slice(0, 3);

  for (const nb of notebookFiles) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: nb.path });
      if (data.content) {
        const raw = decode(data.content);
        const extracted = extractNotebookText(raw);
        if (extracted) {
          const displayPath = subdir ? nb.path.replace(subdir + "/", "") : nb.path;
          notebookSnippets.push(`=== ${displayPath} (notebook) ===\n${extracted}`);
        }
      }
    } catch {}
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
    notebookContent: notebookSnippets.join("\n\n"),
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
  return treeData.tree
    .filter((f) => f.path.split("/").length <= 4)
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
  } catch {}

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