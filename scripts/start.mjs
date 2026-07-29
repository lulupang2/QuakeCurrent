import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { createGzip } from "node:zlib";

const root = process.cwd();
const clientRoot = path.resolve(root, "dist", "client");
const serverEntry = path.resolve(root, "dist", "server", "index.js");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOSTNAME ?? "0.0.0.0";
const { default: app } = await import(pathToFileURL(serverEntry).href);

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const COMPRESSIBLE = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".mjs",
  ".svg",
]);

function resolveStaticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const candidate = path.resolve(clientRoot, `.${decoded}`);
  if (
    candidate !== clientRoot &&
    !candidate.startsWith(`${clientRoot}${path.sep}`)
  ) {
    return null;
  }
  return candidate;
}

async function getStaticFile(pathname) {
  const filePath = resolveStaticPath(pathname);
  if (!filePath) return null;

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return null;
    return { filePath, fileStat };
  } catch {
    return null;
  }
}

function sendStatic(req, res, pathname, file) {
  const extension = path.extname(file.filePath).toLowerCase();
  const contentType =
    CONTENT_TYPES.get(extension) ?? "application/octet-stream";
  const isHashedAsset = pathname.startsWith("/assets/");
  const etag = `W/"${file.fileStat.size}-${Math.floor(file.fileStat.mtimeMs)}"`;
  const cacheControl = isHashedAsset
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, { ETag: etag, "Cache-Control": cacheControl });
    res.end();
    return;
  }

  const shouldGzip =
    file.fileStat.size >= 1_024 &&
    COMPRESSIBLE.has(extension) &&
    req.headers["accept-encoding"]?.includes("gzip");
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };

  if (shouldGzip) {
    headers["Content-Encoding"] = "gzip";
    headers.Vary = "Accept-Encoding";
  } else {
    headers["Content-Length"] = String(file.fileStat.size);
  }

  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const fileStream = createReadStream(file.filePath);
  if (shouldGzip) fileStream.pipe(createGzip({ level: 6 })).pipe(res);
  else fileStream.pipe(res);
}

function toRequest(req) {
  const requestUrl = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? `localhost:${port}`}`,
  );
  const init = {
    method: req.method,
    headers: req.headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req);
    init.duplex = "half";
  }

  return new Request(requestUrl, init);
}

async function assetFetch(request) {
  const requestUrl = new URL(request.url);
  const file = await getStaticFile(requestUrl.pathname);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(Readable.toWeb(createReadStream(file.filePath)), {
    headers: {
      "Content-Type":
        CONTENT_TYPES.get(path.extname(file.filePath).toLowerCase()) ??
        "application/octet-stream",
    },
  });
}

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? `localhost:${port}`}`,
    ).pathname;
    const staticFile = await getStaticFile(pathname);
    if (staticFile && (req.method === "GET" || req.method === "HEAD")) {
      sendStatic(req, res, pathname, staticFile);
      return;
    }

    const response = await app.fetch(
      toRequest(req),
      { ASSETS: { fetch: assetFetch } },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );

    const responseHeaders = Object.fromEntries(response.headers);
    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length) responseHeaders["set-cookie"] = cookies;
    res.writeHead(response.status, responseHeaders);

    if (!response.body || req.method === "HEAD") {
      res.end();
      return;
    }
    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`QuakeCurrent production server: http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
