/**
 * Code Execution Service
 * 
 * Executes code in a secure sandboxed environment using Judge0 API,
 * with local execution fallback for common languages (Python, JavaScript/Node).
 */

const https = require('https');
const { execFile } = require('child_process');

const JUDGE0_LANGUAGES = {
  'python': 71,
  'python3': 71,
  'javascript': 97,
  'js': 97,
  'node': 97,
  'typescript': 94,
  'ts': 94,
  'java': 91,
  'c': 50,
  'cpp': 54,
  'c++': 54,
  'csharp': 51,
  'c#': 51,
  'ruby': 72,
  'go': 95,
  'rust': 73,
  'php': 98,
  'swift': 83,
  'kotlin': 78,
  'r': 80,
  'scala': 81,
  'sql': 82,
  'bash': 46,
  'shell': 46,
  'haskell': 61,
  'elixir': 57,
  'erlang': 58,
  'clojure': 86,
  'dart': 90,
  'lua': 64,
  'perl': 85,
  'pascal': 67,
  'fortran': 59,
  'assembly': 45,
};

function callJudge0(code, language, stdin = '') {
  return new Promise((resolve, reject) => {
    const langKey = (language || '').toLowerCase().trim();
    const langId = JUDGE0_LANGUAGES[langKey] || JUDGE0_LANGUAGES['python'];

    const postData = JSON.stringify({
      language_id: langId,
      source_code: code,
      stdin: stdin || ''
    });

    const options = {
      hostname: 'ce.judge0.com',
      port: 443,
      path: '/submissions?wait=true',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OnlineExam/1.0',
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Judge0 API returned HTTP ${res.statusCode}`));
            return;
          }
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Failed to parse Judge0 response: ' + e.message));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Judge0 request timed out (15s limit)'));
    });
    req.write(postData);
    req.end();
  });
}

function executeLocal(code, language, stdin = '') {
  return new Promise((resolve, reject) => {
    const lang = (language || '').toLowerCase().trim();
    let cmd, args;

    if (lang.includes('python')) {
      cmd = 'python';
      args = ['-c', code];
    } else if (lang.includes('node') || lang.includes('javascript') || lang === 'js') {
      cmd = 'node';
      args = ['-e', code];
    } else {
      return reject(new Error(`Local execution not available for ${language}`));
    }

    let resolved = false;
    const child = execFile(cmd, args, { timeout: 6000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (resolved) return;
      resolved = true;
      if (err && err.killed) {
        resolve({
          stdout: '',
          stderr: 'Execution timed out (6s limit)',
          exitCode: -1,
        });
      } else {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: err ? (err.code || 1) : 0,
        });
      }
    });

    if (stdin && child.stdin) {
      try {
        child.stdin.write(stdin);
        child.stdin.end();
      } catch (writeErr) {
        // Child process may have already exited
      }
    }
  });
}

/**
 * Execute code and return structured result
 * @param {string} code - Source code to execute
 * @param {string} language - Programming language
 * @param {string} stdin - Standard input (optional)
 * @returns {object} { stdout, stderr, compileOutput, exitCode, time, memory }
 */
async function executeCode(code, language, stdin = '') {
  const langKey = (language || '').toLowerCase().trim();

  // Try Judge0 sandbox first
  try {
    const result = await callJudge0(code, language, stdin);
    const compileOut = result.compile_output || '';
    const runErr = result.stderr || '';
    const exitCode = result.status?.id === 3 ? 0 : (result.exit_code ?? (result.status?.id ? result.status.id : -1));

    let combinedError = '';
    if (compileOut) combinedError += `Compile Error: ${compileOut.trim()}`;
    if (runErr) combinedError += `${combinedError ? '\n' : ''}Runtime Error: ${runErr.trim()}`;
    if (!combinedError && result.status?.id && result.status.id > 3) {
      combinedError = result.status.description || `Exited with status ${result.status.id}`;
    }

    return {
      stdout: result.stdout || '',
      stderr: combinedError || '',
      compileOutput: compileOut,
      exitCode,
      language,
      time: result.time || null,
      memory: result.memory || null,
    };
  } catch (judge0Err) {
    console.warn(`[CODE-EXEC] Judge0 API failed (${judge0Err.message}), trying local fallback...`);

    // Fallback to local interpreter if available
    try {
      const localResult = await executeLocal(code, language, stdin);
      return {
        stdout: localResult.stdout || '',
        stderr: localResult.stderr || '',
        compileOutput: '',
        exitCode: localResult.exitCode,
        language,
        time: null,
        memory: null,
      };
    } catch (localErr) {
      return {
        stdout: '',
        stderr: `Execution unavailable: ${judge0Err.message}. Local: ${localErr.message}`,
        compileOutput: '',
        exitCode: -1,
        language,
        time: null,
        memory: null,
      };
    }
  }
}

module.exports = { executeCode, JUDGE0_LANGUAGES };
