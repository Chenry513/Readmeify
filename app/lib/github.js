import { Octokit } from "@octokit/rest";

function decode(content) {
  return Buffer.from(content, "base64").toString("utf-8");
}

const CONFIG_FILES = [
  "package.json",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "composer.json",
  "Gemfile",
  "pyproject.toml",
];

// Extensions worth reading for context
const SOURCE_EXTENSIONS = [
  ".py", ".js", ".ts", ".jsx", ".tsx", ".r", ".R",
  ".sql", ".sh", ".java", ".cpp", ".c", ".cs", ".go",
  ".rb", ".rs", ".swift", ".kt", ".scala", ".m",
];

// Files to always skip — no useful context
const SKIP_PATTERNS = [
  /node_modules/, /\.git\//, /dist\//, /build\//, /\.next\//,
  /\.pyc$/, /\.min\.js$/, /package-lock\.json$/, /yarn\.lock$/,
  /\.png$/, /\.jpg$/, /\.jpeg$/, /\.gif$/, /\.svg$/, /\.ico$/,
  /\.pdf$/, /\.zip$/, /\.tar$/, /\.gz$/,
  // Skip Next.js API routes and boilerplate — plumbing, not useful context
  /app\/api\//, /app\/components\//, /app\/layout\./, /Providers\./,
  // But NOT page.js — that's the main UI and has the most useful context,
];

function shouldSkip(path) {
  return SKIP_PATTERNS.some((p) => p.test(path));
}

// Extract markdown + code cells + outputs from a .ipynb
function extractNotebookText(raw) {
  try {
    const nb = JSON.parse(raw);
    const cells = nb.cells || nb.worksheets?.[0]?.cells || [];
    const lines = [];

    for (const cell of cells) {
      const src = Array.isArray(cell.source)
        ? cell.source.join("")
        : cell.source || "";

      if (cell.cell_type === "markdown" && src.trim()) {
        lines.push(src.trim());
      } else if (cell.cell_type === "code") {
        if (src.trim()) {
          const meaningful = src
            .split("\n")
            .filter((l) => l.trim() && !l.trim().startsWith("#"))
            .join("\n");
          if (meaningful.length > 30) {
            lines.push("```python\n" + src.trim() + "\n```");
          }
        }
        // Cell outputs — where accuracy scores, print results etc. live
        const outputs = cell.outputs || [];
        for (const out of outputs) {
          if (out.output_type === "stream" && out.text) {
            const txt = Array.isArray(out.text) ? out.text.join("") : out.text;
            if (txt.trim()) lines.push("[output]\n" + txt.trim());
          }
          if (
            (out.output_type === "execute_result" || out.output_type === "display_data") &&
            out.data
          ) {
            const txt = out.data["text/plain"];
            if (txt) {
              const t = Array.isArray(txt) ? txt.join("") : txt;
              if (t.trim()) lines.push("[result]\n" + t.trim());
            }
          }
        }
      }
      if (lines.join("\n").length > 3000) break;
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

  // --- Config files first ---
  const configSnippets = [];
  const searchPaths = subdir
    ? CONFIG_FILES.map((f) => `${subdir}/${f}`).concat(CONFIG_FILES)
    : CONFIG_FILES;

  for (const filepath of searchPaths) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: filepath });
      if (data.content) {
        const content = decode(data.content).slice(0, 1500);
        configSnippets.push(`=== ${filepath} ===\n${content}`);
      }
    } catch {}
    if (configSnippets.length >= 2) break;
  }

  // --- Notebooks ---
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

  // --- Source files ---
  // Read up to 8 source files, 1000 chars each, skip generated/binary files
  const sourceSnippets = [];
  const sourceFiles = scopedFiles
    .filter((f) => {
      if (shouldSkip(f.path)) return false;
      const ext = "." + f.path.split(".").pop().toLowerCase();
      return SOURCE_EXTENSIONS.includes(ext);
    })
    .slice(0, 5);

  for (const file of sourceFiles) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: file.path });
      if (data.content) {
        const content = decode(data.content).slice(0, 600);
        const displayPath = subdir ? file.path.replace(subdir + "/", "") : file.path;
        sourceSnippets.push(`=== ${displayPath} ===\n${content}`);
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
    configFiles: configSnippets.join("\n\n"),
    notebookContent: notebookSnippets.join("\n\n"),
    sourceFiles: sourceSnippets.join("\n\n"),
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