import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import openapiTS, { astToString } from "openapi-typescript";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(packageRoot, "..", "..");
const schemaPath = path.join(packageRoot, "openapi.json");
const typesPath = path.join(packageRoot, "src", "openapi.generated.ts");
const localPythonPath =
  process.platform === "win32"
    ? path.join(
        repositoryRoot,
        "apps",
        "api",
        ".venv",
        "Scripts",
        "python.exe",
      )
    : path.join(repositoryRoot, "apps", "api", ".venv", "bin", "python");

const generatedHeader = `/**
 * FastAPI OpenAPI 문서에서 자동 생성했습니다.
 *
 * 직접 수정하지 말고 \`npm run generate:api-contract\`를 실행하세요.
 * WebSocket 프레임은 OpenAPI 범위 밖이므로 \`ws-schema.ts\`에서 관리합니다.
 */`;

function normalizeLineEndings(value) {
  return value.replaceAll("\r\n", "\n");
}

function pythonCandidates() {
  const candidates = [];
  if (process.env.QUAKECURRENT_PYTHON) {
    candidates.push({
      command: process.env.QUAKECURRENT_PYTHON,
      prefixArgs: [],
    });
  }

  candidates.push({ command: localPythonPath, prefixArgs: [] });
  if (process.platform === "win32") {
    candidates.push(
      { command: "python", prefixArgs: [] },
      { command: "py", prefixArgs: ["-3.12"] },
    );
  } else {
    candidates.push(
      { command: "python3", prefixArgs: [] },
      { command: "python", prefixArgs: [] },
    );
  }
  return candidates;
}

export function exportOpenApiSchema() {
  const failures = [];

  for (const candidate of pythonCandidates()) {
    const result = spawnSync(
      candidate.command,
      [
        ...candidate.prefixArgs,
        "-m",
        "quakecurrent.openapi_export",
      ],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        windowsHide: true,
      },
    );

    if (result.status === 0) {
      return normalizeLineEndings(result.stdout);
    }

    if (result.error?.code !== "ENOENT") {
      failures.push(
        `${candidate.command}: ${result.stderr?.trim() || result.error?.message || "실행 실패"}`,
      );
    }
  }

  throw new Error(
    [
      "FastAPI OpenAPI 문서를 내보낼 Python 환경을 찾지 못했습니다.",
      "apps/api 개발 의존성을 설치하거나 QUAKECURRENT_PYTHON을 지정하세요.",
      ...failures,
    ].join("\n"),
  );
}

export async function renderTypeScript(schemaText) {
  const document = JSON.parse(schemaText);
  const ast = await openapiTS(document, {
    alphabetize: true,
  });
  return normalizeLineEndings(`${generatedHeader}\n\n${astToString(ast)}`);
}

export function changedArtifacts(expected, actual) {
  return Object.entries(expected)
    .filter(
      ([name, value]) =>
        normalizeLineEndings(actual[name] ?? "") !==
        normalizeLineEndings(value),
    )
    .map(([name]) => name);
}

async function readCurrentArtifacts() {
  const [schema, types] = await Promise.all([
    readFile(schemaPath, "utf8").catch(() => ""),
    readFile(typesPath, "utf8").catch(() => ""),
  ]);
  return { schema, types };
}

async function createExpectedArtifacts() {
  const schema = exportOpenApiSchema();
  const types = await renderTypeScript(schema);
  return { schema, types };
}

async function createExpectedTypes() {
  const schema = normalizeLineEndings(await readFile(schemaPath, "utf8"));
  const types = await renderTypeScript(schema);
  return { types };
}

async function writeArtifacts(artifacts) {
  const current = await readCurrentArtifacts();
  const changed = changedArtifacts(artifacts, current);

  if (changed.includes("schema")) {
    await writeFile(schemaPath, artifacts.schema, "utf8");
  }
  if (changed.includes("types")) {
    await writeFile(typesPath, artifacts.types, "utf8");
  }
  return changed;
}

async function main() {
  const mode = process.argv[2];
  if (
    mode !== "--write" &&
    mode !== "--check" &&
    mode !== "--check-types"
  ) {
    throw new Error(
      "사용법: node scripts/openapi-contract.mjs --write|--check|--check-types",
    );
  }

  if (mode === "--write") {
    const expected = await createExpectedArtifacts();
    const changed = await writeArtifacts(expected);
    if (changed.length === 0) {
      console.log("OpenAPI 계약 생성물이 이미 최신입니다.");
    } else {
      console.log(`OpenAPI 계약 생성물 갱신: ${changed.join(", ")}`);
    }
    return;
  }

  const expected =
    mode === "--check-types"
      ? await createExpectedTypes()
      : await createExpectedArtifacts();
  const current = await readCurrentArtifacts();
  const changed = changedArtifacts(expected, current);
  if (changed.length > 0) {
    throw new Error(
      [
        `OpenAPI 계약 drift 감지: ${changed.join(", ")}`,
        "`npm run generate:api-contract` 실행 후 생성물을 커밋하세요.",
      ].join("\n"),
    );
  }

  console.log("OpenAPI 계약과 TypeScript 생성물이 일치합니다.");
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
