const { executeCode } = require('./codeExecution');

const NON_EXECUTABLE_LANGUAGES = new Set([
  'react', 'jsx', 'tsx', 'vue', 'svelte',
  'html', 'css', 'scss', 'sass', 'less',
  'svg', 'markdown', 'xml',
]);

function isNonExecutable(lang) {
  return NON_EXECUTABLE_LANGUAGES.has((lang || '').toLowerCase());
}

function normalizeOutput(output) {
  return (output || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+$/gm, '')
    .replace(/^\s+/gm, '')
    .trim();
}

function exactMatch(actual, expected) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

function tokenize(code) {
  const tokens = (code || '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"[^"]*"/g, '"STR"')
    .replace(/'[^']*'/g, "'STR'")
    .replace(/`[^`]*`/g, '`STR`')
    .split(/\s+|(\b\w+\b)|([{}();,=+\-*/<>!&|^~?:.[\]@#])/);
  return tokens.filter(t => t && t.trim());
}

function calcTokenSimilarity(codeA, codeB) {
  const tokensA = tokenize(codeA);
  const tokensB = tokenize(codeB);
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function lineDiffSimilarity(codeA, codeB) {
  const linesA = (codeA || '').split('\n').filter(l => l.trim());
  const linesB = (codeB || '').split('\n').filter(l => l.trim());
  if (!linesA.length && !linesB.length) return 1;
  if (!linesA.length || !linesB.length) return 0;
  let matchCount = 0;
  const normA = linesA.map(l => l.trim());
  const normB = linesB.map(l => l.trim());
  for (const la of normA) {
    if (normB.includes(la)) matchCount++;
  }
  return (matchCount / Math.max(linesA.length, linesB.length)) * 0.5 +
    (matchCount / Math.max(linesA.length, linesB.length)) * 0.5;
}

function calcCodeSimilarity(codeA, codeB) {
  if (!codeA || !codeB) return 0;
  if (codeA === codeB) return 1;
  const normalizedA = normalizeOutput(codeA);
  const normalizedB = normalizeOutput(codeB);
  if (normalizedA === normalizedB) return 1;
  const tokenScore = calcTokenSimilarity(normalizedA, normalizedB);
  const lineScore = lineDiffSimilarity(normalizedA, normalizedB);
  return tokenScore * 0.6 + lineScore * 0.4;
}

async function compareOutputs(studentCode, modelAnswer, language, testCases) {
  const isNonExec = isNonExecutable(language);
  const results = [];

  if (!modelAnswer || !modelAnswer.trim()) {
    return { compared: false, reason: 'No model answer provided', results: [] };
  }

  if (!studentCode || !studentCode.trim()) {
    return { compared: false, reason: 'No student code submitted', results: [] };
  }

  if (isNonExec) {
    const similarity = calcCodeSimilarity(studentCode, modelAnswer);
    return {
      compared: true,
      nonExecutable: true,
      results: [],
      codeSimilarity: similarity,
      message: `Code similarity: ${Math.round(similarity * 100)}% (language cannot be executed)`,
    };
  }

  const modelOutput = {
    stdout: '', stderr: '', exitCode: -1, time: null, memory: null,
  };
  try {
    const modelRun = await executeCode(modelAnswer, language);
    modelOutput.stdout = modelRun.stdout || '';
    modelOutput.stderr = modelRun.stderr || '';
    modelOutput.exitCode = modelRun.exitCode ?? -1;
    modelOutput.time = modelRun.time;
    modelOutput.memory = modelRun.memory;
  } catch (err) {
    modelOutput.stderr = `Model execution error: ${err.message}`;
  }

  const studentOutput = {
    stdout: '', stderr: '', exitCode: -1, time: null, memory: null,
  };
  try {
    const studentRun = await executeCode(studentCode, language);
    studentOutput.stdout = studentRun.stdout || '';
    studentOutput.stderr = studentRun.stderr || '';
    studentOutput.exitCode = studentRun.exitCode ?? -1;
    studentOutput.time = studentRun.time;
    studentOutput.memory = studentRun.memory;
  } catch (err) {
    studentOutput.stderr = `Student execution error: ${err.message}`;
  }

  const noStdinMatch = exactMatch(studentOutput.stdout, modelOutput.stdout);

  let passedTests = 0;
  let totalTests = 0;

  if (testCases && testCases.length > 0) {
    for (const tc of testCases) {
      totalTests++;
      try {
        const modelRun = await executeCode(modelAnswer, language, tc.input);
        const studentRun = await executeCode(studentCode, language, tc.input);
        const expected = modelRun.stdout || '';
        const actual = studentRun.stdout || '';
        const passed = exactMatch(actual, expected);
        if (passed) passedTests++;
        results.push({
          input: tc.input,
          expectedOutput: expected,
          actualOutput: actual,
          passed,
          modelError: modelRun.stderr || '',
          studentError: studentRun.stderr || '',
        });
      } catch (err) {
        results.push({
          input: tc.input,
          expectedOutput: '',
          actualOutput: '',
          passed: false,
          modelError: '',
          studentError: err.message,
        });
      }
    }
  }

  const codeSimilarity = calcCodeSimilarity(studentCode, modelAnswer);

  return {
    compared: true,
    nonExecutable: false,
    results,
    codeSimilarity,
    basicOutputMatch: noStdinMatch,
    modelOutput,
    studentOutput,
    testSummary: testCases && testCases.length > 0 ? {
      passed: passedTests,
      total: totalTests,
      percentage: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
    } : null,
  };
}

module.exports = {
  compareOutputs,
  calcCodeSimilarity,
  normalizeOutput,
  exactMatch,
  isNonExecutable,
};
