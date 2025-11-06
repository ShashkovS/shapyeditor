const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 63343);
const SITE_PREFIX = '/';
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

function sendError(res, statusCode, message) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cache-Control': 'no-store',
  });
  res.end(message);
}

function resolvePath(pathname) {
  if (pathname === '/' || pathname === '/index.html') {
    return path.join(ROOT_DIR, 'src', 'htmls', 'demo.html');
  }
  let relativePath = pathname;
  if (relativePath.startsWith(SITE_PREFIX)) {
    relativePath = relativePath.slice(SITE_PREFIX.length);
  } else if (relativePath.startsWith('/')) {
    relativePath = relativePath.slice(1);
  }
  if (!relativePath) {
    return path.join(ROOT_DIR, 'src', 'htmls', 'demo.html');
  }
  const normalizedPath = path.normalize(relativePath);
  const candidatePaths = [
    path.join(ROOT_DIR, normalizedPath),
    path.join(ROOT_DIR, 'src', normalizedPath),
    path.join(ROOT_DIR, 'src', 's', normalizedPath),
  ];
  for (const candidate of candidatePaths) {
    if (!candidate.startsWith(ROOT_DIR)) {
      continue;
    }
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (error) {
      // ignore and try next candidate
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  try {
    if (!req.url) {
      sendError(res, 400, 'Bad Request');
      return;
    }
    const requestUrl = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
    const filePath = resolvePath(requestUrl.pathname);
    if (!filePath) {
      sendError(res, 403, 'Forbidden');
      return;
    }
    fs.stat(filePath, (err, stats) => {
      if (err) {
        sendError(res, 404, 'Not Found');
        return;
      }
      const resolvedPath = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
      fs.readFile(resolvedPath, (readErr, data) => {
        if (readErr) {
          if (readErr.code === 'ENOENT') {
            sendError(res, 404, 'Not Found');
          } else {
            sendError(res, 500, 'Internal Server Error');
          }
          return;
        }
        const ext = path.extname(resolvedPath).toLowerCase();
        const headers = {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cache-Control': 'no-store',
        };
        res.writeHead(200, headers);
        res.end(data);
      });
    });
  } catch (error) {
    console.error('Server error:', error);
    sendError(res, 500, 'Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`Static server is running at http://localhost:${PORT}/htmls/demo.html`);
});
