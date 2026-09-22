import express from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import Project from '../models/Project.js';
import { authenticateToken } from '../middleware/auth.js';
import { parseCodeForEndpoints, generateOpenAPISpec } from '../services/parserService.js';
import { killProcess, runningServers } from '../services/executionService.js';
import {
  ensureExecutionTemplate,
  linkOrCopyDependencies,
} from '../services/executionEnvCache.js';
import {
  createLegacyWorkspace,
  getEntryFileContent,
  getWorkspaceCodeBundle,
} from '../utils/workspace.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse code and extract endpoints
router.post('/parse', authenticateToken, async (req, res, next) => {
  try {
    const socketIO = (req.app && typeof req.app.get === 'function') ? req.app.get('io') : null;
    const { code, files, entryFilePath } = req.body;

    if (!code && (!Array.isArray(files) || files.length === 0)) {
      return res.status(400).json({ message: 'Code or files are required' });
    }

    const workspace = getWorkspaceCodeBundle({ files, entryFilePath, code });
    const endpoints = parseCodeForEndpoints(workspace.bundle || workspace.code);
    res.json({ endpoints });
  } catch (error) {
    next(error);
  }
});

// Generate OpenAPI spec for a project's current code
router.get('/openapi/:projectId', authenticateToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const workspace = getWorkspaceCodeBundle({
      files: project.files,
      entryFilePath: project.entryFilePath,
      code: project.code,
    });
    const endpoints = parseCodeForEndpoints(workspace.bundle || workspace.code);
    const spec = generateOpenAPISpec(endpoints);
    res.json(spec);
  } catch (error) {
    next(error);
  }
});

// Generate OpenAPI spec from provided code (no need to save first)
router.post('/openapi', authenticateToken, async (req, res, next) => {
  try {
    const { code, files, entryFilePath } = req.body;
    if (!code && (!Array.isArray(files) || files.length === 0)) {
      return res.status(400).json({ message: 'Code or files are required' });
    }
    const workspace = getWorkspaceCodeBundle({ files, entryFilePath, code });
    const endpoints = parseCodeForEndpoints(workspace.bundle || workspace.code);
    const spec = generateOpenAPISpec(endpoints);
    res.json(spec);
  } catch (error) {
    next(error);
  }
});

// Execute code and get output
router.post('/execute', authenticateToken, async (req, res, next) => {
  console.log('Execute request body:', req.body);
  const { code, projectId, files, entryFilePath } = req.body;
  const socketIO = (req.app && typeof req.app.get === 'function') ? req.app.get('io') : null;

  if (!code && (!Array.isArray(files) || files.length === 0)) {
    return res.status(400).json({ message: 'Code or files are required' });
  }

  try {
    await ensureExecutionTemplate();
  } catch (prepErr) {
    console.error('Execution template preparation failed:', prepErr);
    return res.status(500).json({
      message: prepErr.message || 'Failed to prepare execution environment',
    });
  }

  // Create a secure per-run temp directory (avoids permission issues on Windows)
  const tempPrefix = path.join(os.tmpdir(), 'dev-deck-');
  let tempDirPath = '';
  try {
    tempDirPath = fs.mkdtempSync(tempPrefix);
  } catch (mkErr) {
    console.error('Failed to create temp dir:', mkErr);
    return res.status(500).json({ message: mkErr.message || 'Failed to create temp directory' });
  }
  const workspace = Array.isArray(files) && files.length > 0
    ? getEntryFileContent({ files, entryFilePath, code })
    : createLegacyWorkspace(code);

  try {
    const runStarted = Date.now();

    linkOrCopyDependencies(tempDirPath);
    workspace.files.forEach((item) => {
      const targetPath = path.join(tempDirPath, item.path);
      if (item.type === 'folder') {
        fs.mkdirSync(targetPath, { recursive: true });
        return;
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, item.content || '');
    });
    const tempFilePath = path.join(tempDirPath, workspace.entryFilePath);

    // Always bind via ephemeral port (0). Reusing project.runPort caused EADDRINUSE when the
    // previous run was still listening or another process held that port. User code should use
    // process.env.PORT (see boilerplate); we still persist the discovered port after a successful run.
    const bindPort = 0;

    // Execute the code with a timeout (kill process on timeout)
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    await new Promise((resolve, reject) => {
      const child = exec(`node "${workspace.entryFilePath}"`, {
        cwd: tempDirPath,
        env: { ...process.env, PORT: String(bindPort) },
      });

      if (child.stdout) child.stdout.on('data', (d) => {
        stdout += d;
        if (socketIO && projectId) socketIO.to(projectId).emit('executionLog', String(d));
      });
      if (child.stderr) child.stderr.on('data', (d) => {
        stderr += d;
        if (socketIO && projectId) socketIO.to(projectId).emit('executionLog', String(d));
      });

      const timer = setTimeout(() => {
        timedOut = true;
        try { child.kill('SIGKILL'); } catch { }
        // Resolve after killing the long-running process, treating as successful run with captured logs
        resolve(null);
      }, 60000);

      child.on('exit', async () => {
        clearTimeout(timer);
        // If a dynamic port was selected, parse it from stdout and persist to project.runPort
        try {
          if (projectId) {
            const match = stdout.match(/http:\/\/127\.0\.0\.1:(\d+)/) || stdout.match(/port\s+(\d+)/i);
            const port = match ? Number(match[1]) : null;
            if (port) {
              await Project.findByIdAndUpdate(projectId, { runPort: port });
            }
          }
        } catch { }
        resolve(null);
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // If port in use (e.g. user hardcoded a port), retry once with ephemeral port only
    const portBusy =
      /EADDRINUSE/i.test(stderr) ||
      /EADDRINUSE/i.test(stdout);
    if (portBusy) {
      stdout += '\n[DevDeck] Port conflict — retrying with PORT=0 (use process.env.PORT in your code).\n';
      let retryStdout = '';
      let retryStderr = '';
      await new Promise((resolve) => {
        const child = exec(`node "${workspace.entryFilePath}"`, {
          cwd: tempDirPath,
          env: { ...process.env, PORT: '0' },
        });
        if (child.stdout) child.stdout.on('data', (d) => {
          retryStdout += d;
          if (socketIO && projectId) socketIO.to(projectId).emit('executionLog', String(d));
        });
        if (child.stderr) child.stderr.on('data', (d) => {
          retryStderr += d;
          if (socketIO && projectId) socketIO.to(projectId).emit('executionLog', String(d));
        });
        child.on('exit', async () => {
          try {
            if (projectId) {
              const match = retryStdout.match(/http:\/\/127\.0\.0\.1:(\d+)/) || retryStdout.match(/port\s+(\d+)/i);
              const port = match ? Number(match[1]) : null;
              if (port) await Project.findByIdAndUpdate(projectId, { runPort: port });
            }
          } catch { }
          stdout += retryStdout;
          stderr += retryStderr;
          resolve(null);
        });
      });
    }

    // Clean up (safe remove with retry for Windows EPERM)
    try {
      fs.rmSync(tempDirPath, { recursive: true, force: true });
    } catch (e) {
      setTimeout(() => { try { fs.rmSync(tempDirPath, { recursive: true, force: true }); } catch { } }, 2000);
    }

    // Save execution log if projectId is provided
    if (projectId) {
      await Project.findByIdAndUpdate(projectId, {
        $push: {
          logs: {
            type: 'execution',
            output: stdout || stderr,
            timestamp: new Date()
          }
        }
      });
    }

    res.json({
      success: true,
      output: stdout || stderr,
      stderr: stderr || '',
      timedOut,
      durationMs: Date.now() - runStarted,
    });
  } catch (error) {
    // Clean up temp directory if it exists
    try {
      if (tempDirPath && fs.existsSync(tempDirPath)) {
        fs.rmSync(tempDirPath, { recursive: true, force: true });
      }
    } catch (e) {
      setTimeout(() => { try { fs.rmSync(tempDirPath, { recursive: true, force: true }); } catch { } }, 2000);
    }

    // Handle execution error
    console.error('Execution error:', error);
    res.status(400).json({
      success: false,
      error: 'Execution failed',
      message: error.message,
      stderr: error.stderr || error.message,
    });
  }
});

// Test an API endpoint — proxies requests from the browser so that
// localhost servers and CORS restrictions are handled server-side.
router.post('/test-endpoint', authenticateToken, async (req, res) => {
  const { url, method = 'GET', headers = {}, body = null } = req.body;

  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }

  // Validate URL — only http/https to avoid SSRF via file:// etc.
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ message: 'Invalid URL format' });
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ message: 'Only http and https URLs are allowed' });
  }

  try {
    const fetchOptions = {
      method: method.toUpperCase(),
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: AbortSignal.timeout(15_000),
    };
    if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    let responseData;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json().catch(() => ({}));
    } else {
      const text = await response.text().catch(() => '');
      try { responseData = JSON.parse(text); } catch { responseData = text; }
    }

    return res.json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
    });
  } catch (error) {
    const cause = error?.cause || error;
    const code = cause?.code || '';

    if (code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'connection_refused',
        message: `Could not connect to ${parsedUrl.host}. Make sure your project server is running by clicking Run first.`,
        url,
      });
    }
    if (code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'host_not_found',
        message: `Host "${parsedUrl.hostname}" could not be resolved. Check the base URL.`,
        url,
      });
    }
    if (error.name === 'TimeoutError' || code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
      return res.status(504).json({ error: 'timeout', message: `Request to ${url} timed out after 15 seconds.`, url });
    }
    if (error.name === 'AbortError') {
      return res.status(499).json({ error: 'aborted', message: 'Request was aborted.', url });
    }

    console.error('[test-endpoint] Unexpected error:', error);
    return res.status(500).json({
      error: 'request_failed',
      message: error.message || 'An unexpected error occurred.',
      url,
    });
  }
});

// Save endpoints to project
router.post('/:projectId/endpoints', authenticateToken, async (req, res, next) => {
  try {
    const { endpoints } = req.body;
    const { projectId } = req.params;

    if (!endpoints || !Array.isArray(endpoints)) {
      return res.status(400).json({ message: 'Endpoints array is required' });
    }

    const project = await Project.findOne({
      _id: projectId,
      $or: [
        { owner: req.user.userId },
        { 'collaborators.user': req.user.userId, 'collaborators.role': { $in: ['admin', 'editor'] } },
      ],
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    project.endpoints = endpoints;
    await project.save();
    res.json(project);
  } catch (error) {
    next(error);
  }
});

router.post('/stop-execution', authenticateToken, (req, res) => {
  const { executionId } = req.body;
  if (!executionId) {
    return res.status(400).json({ message: 'Execution ID is required' });
  }

  const server = runningServers.get(executionId);
  if (!server) {
    return res.status(404).json({ message: 'No running server found with this ID' });
  }

  try {
    killProcess(server.pid);
    runningServers.delete(executionId);
    res.json({ success: true, message: 'Server stopped successfully' });
  } catch (error) {
    console.error('Error stopping server:', error);
    res.status(500).json({ message: 'Failed to stop server' });
  }
});

// backend/src/routes/api.js
// Add this new route
router.get('/execution-status/:executionId', authenticateToken, (req, res) => {
  const { executionId } = req.params;
  const server = runningServers.get(executionId);

  if (!server) {
    return res.status(404).json({
      isRunning: false,
      message: 'No running server found with this ID'
    });
  }

  res.json({
    isRunning: true,
    port: server.port,
    pid: server.pid
  });
});

export default router;
