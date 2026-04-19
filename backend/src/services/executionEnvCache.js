import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** Bump when dependencies change so a fresh npm install runs */
const TEMPLATE_VERSION = 'v1';
const TEMPLATE_DIR = path.join(os.tmpdir(), `dev-deck-exec-template-${TEMPLATE_VERSION}`);
const READY_MARKER = path.join(TEMPLATE_DIR, '.deps-installed');

export const DEFAULT_PACKAGE_JSON = {
  name: 'dev-deck-exec-template',
  version: '1.0.0',
  private: true,
  main: 'index.js',
  dependencies: {
    express: '^4.18.2',
    cors: '^2.8.5',
    'body-parser': '^1.20.2',
    'express-validator': '^7.0.1',
  },
};

let preparePromise = null;

/**
 * Ensures a shared template dir exists with node_modules installed once.
 * Avoids running `npm install` on every execute request (major latency win).
 */
export function ensureExecutionTemplate() {
  if (!preparePromise) {
    preparePromise = prepareTemplateInner();
  }
  return preparePromise;
}

async function prepareTemplateInner() {
  await fs.promises.mkdir(TEMPLATE_DIR, { recursive: true });
  const pkgPath = path.join(TEMPLATE_DIR, 'package.json');
  await fs.promises.writeFile(pkgPath, JSON.stringify(DEFAULT_PACKAGE_JSON, null, 2));

  if (fs.existsSync(READY_MARKER)) {
    return;
  }

  await execAsync('npm install --omit=dev --no-audit --no-fund --loglevel=error', {
    cwd: TEMPLATE_DIR,
    shell: true,
    env: process.env,
    timeout: 600000,
  });

  await fs.promises.writeFile(READY_MARKER, new Date().toISOString());
}

/**
 * Copy package.json from template and link (or copy) node_modules into the run directory.
 */
export function linkOrCopyDependencies(runDir) {
  const templatePkg = path.join(TEMPLATE_DIR, 'package.json');
  const runPkg = path.join(runDir, 'package.json');
  fs.copyFileSync(templatePkg, runPkg);

  const nmTarget = path.join(TEMPLATE_DIR, 'node_modules');
  const nmDest = path.join(runDir, 'node_modules');

  if (!fs.existsSync(nmTarget)) {
    throw new Error(
      'Execution dependencies are not ready yet. Try again in a few seconds.'
    );
  }

  if (fs.existsSync(nmDest)) {
    fs.rmSync(nmDest, { recursive: true, force: true });
  }

  try {
    if (process.platform === 'win32') {
      fs.symlinkSync(nmTarget, nmDest, 'junction');
    } else {
      fs.symlinkSync(nmTarget, nmDest, 'dir');
    }
  } catch (err) {
    console.warn('[executionEnvCache] Symlink node_modules failed, copying:', err.message);
    fs.cpSync(nmTarget, nmDest, { recursive: true, dereference: false });
  }
}
