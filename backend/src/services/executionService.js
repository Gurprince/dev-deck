// backend/src/services/executionService.js
import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CACHE_DIR = path.join(os.tmpdir(), 'dev-deck-cache');
const EXECUTION_TIMEOUT = 10000; // 10 seconds
const MEMORY_LIMIT = '256m'; // 256MB memory limit
const MAX_CONCURRENT = 3; // Max concurrent executions

// Track running servers
const runningServers = new Map();

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  points: 20, // 20 requests
  duration: 60, // per 60 seconds
});

class ExecutionQueue {
  constructor() {
    this.queue = [];
    this.running = 0;
  }

  async add(job) {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          this.running++;
          const result = await job();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.next();
        }
      };

      this.queue.push(execute);
      this.next();
    });
  }

  next() {
    if (this.queue.length === 0 || this.running >= MAX_CONCURRENT) return;
    const job = this.queue.shift();
    job();
  }
}

const executionQueue = new ExecutionQueue();

// Function to kill a process by PID
const killProcess = (pid) => {
  try {
    if (process.platform === 'win32') {
      execa('taskkill', ['/F', '/PID', pid.toString()]);
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch (error) {
    console.error('Error killing process:', error);
  }
};

// Cleanup function to kill all running servers
const cleanupServers = () => {
  for (const [id, server] of runningServers.entries()) {
    try {
      killProcess(server.pid);
      runningServers.delete(id);
    } catch (error) {
      console.error(`Error cleaning up server ${id}:`, error);
    }
  }
};

// Handle process termination
process.on('SIGTERM', cleanupServers);
process.on('SIGINT', cleanupServers);

const setupProcessCleanup = (childProcess, executionId) => {
  const cleanup = () => {
    try {
      if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGTERM');
      }
      runningServers.delete(executionId);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  // Handle various termination signals
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  process.on('exit', cleanup);

  // Return cleanup function
  return cleanup;
};

export async function executeCode(code, language = 'javascript') {
  try {
    // Apply rate limiting
    await rateLimiter.consume('global', 1);
    
    return await executionQueue.add(async () => {
      const executionId = uuidv4();
      const tempDir = path.join(CACHE_DIR, executionId);
      
      try {
        // Create temp directory
        fs.mkdirSync(tempDir, { recursive: true });
        const tempFile = path.join(tempDir, 'code.js');
        
        // Write code to file with a cleanup mechanism
        const safeCode = `
          // Store server reference for cleanup
          let server;
          const cleanup = () => {
            if (server) {
              server.close();
              process.exit(0);
            }
          };
          
          // Handle process termination
          process.on('SIGTERM', cleanup);
          process.on('SIGINT', cleanup);
          
          // Override app.listen to track the server
          const originalListen = app.listen;
          app.listen = function() {
            server = originalListen.apply(this, arguments);
            // Send the port number back to the parent process
            console.log('SERVER_STARTED:' + (arguments[0] || 3000));
            return server;
          };
          
          // User's code
          ${code}
        `;
        
        fs.writeFileSync(tempFile, safeCode);
        
        // Execute with Node.js
        const child = execa('node', [tempFile], {
          timeout: EXECUTION_TIMEOUT,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          env: { 
            NODE_ENV: 'production',
            NODE_OPTIONS: '--max-old-space-size=256'
          }
        });

        // Set up cleanup
        const cleanup = setupProcessCleanup(child, executionId);

        let output = '';
        let errorOutput = '';
        let serverStarted = false;
        let serverPort = null;

        // Handle stdout
        child.stdout.on('data', (data) => {
          const dataStr = data.toString();
          // Check for server start message
          if (dataStr.startsWith('SERVER_STARTED:')) {
            serverStarted = true;
            serverPort = parseInt(dataStr.split(':')[1].trim(), 10);
            runningServers.set(executionId, { pid: child.pid, port: serverPort });
            output += `Server started on port ${serverPort}\n`;
          } else {
            output += dataStr;
          }
        });

        // Handle stderr
        child.stderr.on('data', (data) => {
          const errorMsg = data.toString();
          errorOutput += errorMsg;
          output += `[ERROR] ${errorMsg}`;
        });

        // Handle process exit
        await new Promise((resolve) => {
          child.on('exit', (code) => {
            if (code !== 0 && !serverStarted) {
              errorOutput = `Process exited with code ${code}\n${errorOutput}`;
            }
            // Clean up the process
            cleanup();
            resolve();
          });
        });

        return { 
          success: !errorOutput,
          output: output.trim(),
          error: errorOutput || null,
          executionId: serverStarted ? executionId : null,
          port: serverPort
        };
      } finally {
        // Cleanup temp directory
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
          console.error('Error cleaning up temp dir:', e);
        }
      }
    });
  } catch (error) {
    if (error.remainingPoints !== undefined) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    throw error;
  }
}

// Clean up any running servers when the module is unloaded
process.on('exit', cleanupServers);

// Export for testing
export const __test__ = {
  killProcess,
  cleanupServers,
  runningServers
};