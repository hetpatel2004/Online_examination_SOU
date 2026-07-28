/**
 * Code Execution Service - Reusable Piston API wrapper
 * 
 * Executes code in a sandboxed environment using the Piston API.
 * Never uses eval() or any unsafe execution method.
 */

const https = require('https');

const PISTON_LANGUAGES = {
  'python': 'python', 'python3': 'python', 'javascript': 'javascript',
  'js': 'javascript', 'node': 'javascript', 'typescript': 'typescript',
  'ts': 'typescript', 'java': 'java', 'c': 'c', 'cpp': 'c++',
  'c++': 'c++', 'csharp': 'c#', 'c#': 'c#', 'ruby': 'ruby',
  'go': 'go', 'rust': 'rust', 'php': 'php', 'swift': 'swift',
  'kotlin': 'kotlin', 'r': 'r', 'scala': 'scala', 'perl': 'perl',
  'lua': 'lua', 'dart': 'dart', 'sql': 'sql', 'bash': 'bash',
  'shell': 'bash', 'haskell': 'haskell', 'elixir': 'elixir',
  'erlang': 'erlang', 'clojure': 'clojure', 'lisp': 'lisp',
  'assembly': 'assembly', 'nasm': 'assembly', 'fortran': 'fortran',
  'cobol': 'cobol', 'pascal': 'pascal', 'objective-c': 'objective-c',
  'objc': 'objective-c',
};

function callPiston(code, language, stdin = '') {
  return new Promise((resolve, reject) => {
    const pistonLang = PISTON_LANGUAGES[(language || '').toLowerCase()] || (language || '').toLowerCase();

    const postData = JSON.stringify({
      language: pistonLang,
      version: '*',
      files: [{ content: code }],
      stdin
    });

    const options = {
      hostname: 'emkc.org',
      port: 443,
      path: '/api/v2/piston/execute',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode !== 200) {
            reject(new Error(`Piston API returned ${res.statusCode}. Language "${pistonLang}" may not be supported.`));
            return;
          }
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Failed to parse Piston response'));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Code execution timed out (30s limit)')); });
    req.write(postData);
    req.end();
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
  const result = await callPiston(code, language, stdin);
  const compileOut = result.compile?.stdout || result.compile?.stderr || '';
  const runErr = result.run?.stderr || '';
  const exitCode = result.run?.code ?? -1;

  // Combine error info for clear reporting
  let combinedError = '';
  if (compileOut) combinedError += `Compile Error: ${compileOut}`;
  if (runErr) combinedError += `${combinedError ? '\n' : ''}Runtime Error: ${runErr}`;
  if (exitCode !== 0 && !combinedError) combinedError = `Process exited with code ${exitCode}`;

  return {
    stdout: result.run?.stdout || '',
    stderr: combinedError || '',
    compileOutput: compileOut,
    exitCode,
    language: result.language || language,
    version: result.version || '',
    time: result.run?.time || null,
    memory: result.run?.memory || null,
  };
}

module.exports = { executeCode, PISTON_LANGUAGES };
