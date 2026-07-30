import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".pytest_cache",
  ".ruff_cache",
  ".venv",
  ".vinext",
  ".wrangler",
  "__pycache__",
  "coverage",
  "dist",
  "node_modules",
  "outputs",
  "work",
]);
const linkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;
const failures = [];
let checkedLinks = 0;

async function findMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      files.push(...(await findMarkdownFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files;
}

const markdownFiles = await findMarkdownFiles(repositoryRoot);

for (const markdownFile of markdownFiles) {
  const content = await readFile(markdownFile, "utf8");

  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1].trim();
    const target = rawTarget.startsWith("<")
      ? rawTarget.slice(1, rawTarget.indexOf(">"))
      : rawTarget.split(/\s+["']/u, 1)[0];

    if (
      !target ||
      target.startsWith("#") ||
      target.startsWith("/") ||
      /^[a-z][a-z\d+.-]*:/iu.test(target)
    ) {
      continue;
    }

    const relativeTarget = decodeURIComponent(target.split(/[?#]/u, 1)[0]);
    const resolvedTarget = path.resolve(
      path.dirname(markdownFile),
      relativeTarget,
    );
    checkedLinks += 1;

    try {
      await access(resolvedTarget);
    } catch {
      const line =
        content.slice(0, match.index).split(/\r?\n/u).length;
      failures.push(
        `${path.relative(repositoryRoot, markdownFile)}:${line} -> ${target}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("깨진 로컬 문서 링크를 찾았습니다.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `문서 링크 검사 통과: ${markdownFiles.length}개 파일, ${checkedLinks}개 로컬 링크`,
  );
}
