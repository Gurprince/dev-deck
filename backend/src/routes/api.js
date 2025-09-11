import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import Project from '../models/Project.js';
import { authenticateToken } from '../middleware/auth.js';
import { parseCodeForEndpoints } from '../services/parserService.js';

const router = express.Router();
const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse code and extract endpoints
router.post('/parse', authenticateToken, async (req, res, next) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Code is required' });
    }

    const endpoints = parseCodeForEndpoints(code);
    res.json({ endpoints });
  } catch (error) {
    next(error);
  }
});

// Execute code and get output
router.post('/execute', authenticateToken, async (req, res, next) => {
  console.log('Execute request body:', req.body);
  const { code, projectId } = req.body;
  
  if (!code) {
    return res.status(400).json({ message: 'Code is required' });
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
  const tempFilePath = path.join(tempDirPath, 'index.js');
  
  try {
    // Create package.json with required dependencies
    const packageJson = {
      name: `execution-${path.basename(tempDirPath)}`,
      version: '1.0.0',
      private: true,
      main: 'index.js',
      dependencies: {
        express: '^4.18.2',
        cors: '^2.8.5',
        'body-parser': '^1.20.2',
        'express-validator': '^7.0.1'
      }
    };

    // Write package.json and install dependencies
    fs.writeFileSync(path.join(tempDirPath, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    // Write the user's code to index.js
    fs.writeFileSync(tempFilePath, code);

    // Install dependencies
    await execPromise('npm install', { cwd: tempDirPath });

    // Execute the code with a timeout of 10 seconds (kill process on timeout)
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const io = req.app.get('io');
    await new Promise((resolve, reject) => {
      const child = exec('node index.js', {
        cwd: tempDirPath,
        env: { ...process.env, PORT: 0 },
      });

      if (child.stdout) child.stdout.on('data', (d) => {
        stdout += d;
        if (io && projectId) io.to(projectId).emit('executionLog', String(d));
      });
      if (child.stderr) child.stderr.on('data', (d) => {
        stderr += d;
        if (io && projectId) io.to(projectId).emit('executionLog', String(d));
      });

      const timer = setTimeout(() => {
        timedOut = true;
        try { child.kill('SIGKILL'); } catch {}
        // Resolve after killing the long-running process, treating as successful run with captured logs
        resolve(null);
      }, 10000);

      child.on('exit', () => {
        clearTimeout(timer);
        resolve(null);
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // Clean up (safe remove with retry for Windows EPERM)
    try {
      fs.rmSync(tempDirPath, { recursive: true, force: true });
    } catch (e) {
      setTimeout(() => { try { fs.rmSync(tempDirPath, { recursive: true, force: true }); } catch {} }, 2000);
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
      timedOut
    });
  } catch (error) {
    // Clean up temp directory if it exists
    try {
      if (tempDirPath && fs.existsSync(tempDirPath)) {
        fs.rmSync(tempDirPath, { recursive: true, force: true });
      }
    } catch (e) {
      setTimeout(() => { try { fs.rmSync(tempDirPath, { recursive: true, force: true }); } catch {} }, 2000);
    }
    
    // Handle execution error
    console.error('Execution error:', error);
    res.status(400).json({ 
      success: false,
      error: 'Execution failed',
      message: error.message,
      stderr: error.stderr || error.message
    });
  }
});

// Test an API endpoint
router.post('/test-endpoint', authenticateToken, async (req, res, next) => {
  try {
    const { url, method = 'GET', headers = {}, body = null } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const responseData = await response.json().catch(() => ({}));
    
    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData
    });
  } catch (error) {
    next(error);
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
        { 'collaborators.user': req.user.userId, 'collaborators.role': { $in: ['admin', 'editor'] } }
      ]
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

export default router;
