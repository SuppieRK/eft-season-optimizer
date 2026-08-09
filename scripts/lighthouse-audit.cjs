const { createReadStream, existsSync, mkdirSync, readFileSync, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, resolve, sep } = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const RUNS_PER_MODE = Number(process.env.LIGHTHOUSE_RUNS ?? 3);
if (!Number.isInteger(RUNS_PER_MODE) || RUNS_PER_MODE < 1) {
  throw new Error('LIGHTHOUSE_RUNS must be a positive integer.');
}
const HOST = '127.0.0.1';
const PORT = 4174;
const siteConfig = JSON.parse(readFileSync(resolve('site.config.json'), 'utf8'));
const url = new URL(siteConfig.basePath, `http://${HOST}:${PORT}`).href;
const outputDirectory = resolve('.tmp/lighthouse');
const lighthouseEntry = resolve('node_modules/lighthouse/cli/index.js');
const distDirectory = resolve('dist');
const chromePath = process.env.CHROME_PATH || chromium.executablePath();

function contentType(filePath) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.xml': 'application/xml; charset=utf-8',
  }[extname(filePath)] ?? 'application/octet-stream';
}

function createStaticServer() {
  return createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', url).pathname);
    if (!pathname.startsWith(siteConfig.basePath)) {
      response.writeHead(404).end();
      return;
    }
    let relativePath = pathname.slice(siteConfig.basePath.length);
    if (!relativePath || relativePath.endsWith('/')) relativePath += 'index.html';
    const filePath = resolve(distDirectory, relativePath);
    if ((!filePath.startsWith(`${distDirectory}${sep}`) && filePath !== distDirectory)
      || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType(filePath) });
    createReadStream(filePath).pipe(response);
  });
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function runAudit(mode, run) {
  const outputPath = resolve(outputDirectory, `${mode}-${run}.json`);
  const argumentsList = [
    lighthouseEntry,
    url,
    '--quiet',
    '--output=json',
    `--output-path=${outputPath}`,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
  ];
  if (mode === 'desktop') argumentsList.push('--preset=desktop');
  return new Promise((resolveRun, rejectRun) => {
    const processRun = spawn(process.execPath, argumentsList, {
      env: {
        ...process.env,
        CHROME_PATH: chromePath,
        TEMP: '/tmp',
        TMP: '/tmp',
        TMPDIR: '/tmp',
      },
    });
    let stdout = '';
    let stderr = '';
    processRun.stdout.setEncoding('utf8');
    processRun.stderr.setEncoding('utf8');
    processRun.stdout.on('data', (chunk) => { stdout += chunk; });
    processRun.stderr.on('data', (chunk) => { stderr += chunk; });
    processRun.once('error', rejectRun);
    processRun.once('close', (status) => {
      if (status !== 0) {
        rejectRun(new Error(`Lighthouse ${mode} run ${run} failed:\n${stderr || stdout}`));
        return;
      }
      const report = JSON.parse(readFileSync(outputPath, 'utf8'));
      resolveRun({
        performance: report.categories.performance.score * 100,
        accessibility: report.categories.accessibility.score * 100,
        bestPractices: report.categories['best-practices'].score * 100,
        seo: report.categories.seo.score * 100,
        lcpMs: report.audits['largest-contentful-paint'].numericValue,
        cls: report.audits['cumulative-layout-shift'].numericValue,
      });
    });
  });
}

async function main() {
  mkdirSync(outputDirectory, { recursive: true });
  const preview = createStaticServer();
  try {
    await new Promise((resolveListen, rejectListen) => {
      preview.once('error', rejectListen);
      preview.listen(PORT, HOST, resolveListen);
    });
    for (const mode of ['mobile', 'desktop']) {
      const runs = [];
      for (let run = 1; run <= RUNS_PER_MODE; run += 1) {
        process.stdout.write(`Running Lighthouse ${mode} ${run}/${RUNS_PER_MODE}...\n`);
        runs.push(await runAudit(mode, run));
      }
      const result = Object.fromEntries(Object.keys(runs[0]).map((metric) => [
        metric,
        median(runs.map((run) => run[metric])),
      ]));
      process.stdout.write(`${mode}: ${JSON.stringify(result)}\n`);
    }
  } finally {
    await new Promise((resolveClose) => preview.close(resolveClose));
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
