/**
 * AI Evaluation Service — auto-grades practical (code) submissions.
 * Pipeline (3-tier):
 *   1. Execute code & compare against the model answer (output + similarity)
 *   2. AI review (Gemini 1.5 Flash / GPT-4o-mini) when GEMINI_API_KEY or OPENAI_API_KEY is configured
 *   3. Intelligent heuristic/pattern analysis as fallback (never fails a submission)
 */
const { executeCode } = require('./codeExecution');
const { compareOutputs, calcCodeSimilarity, isNonExecutable } = require('./codeComparisonService');

// Frontend/static languages can't run in the sandbox — scored by similarity/AI/heuristic
const NON_EXECUTABLE_LANGUAGES = new Set([
  'react', 'jsx', 'tsx', 'vue', 'svelte',
  'html', 'css', 'scss', 'sass', 'less',
  'svg', 'markdown', 'xml',
]);

function isNonExecutableLanguage(lang) {
  return NON_EXECUTABLE_LANGUAGES.has((lang || '').toLowerCase());
}

function hasAIKey() {
  const gemini = process.env.GEMINI_API_KEY;
  if (gemini && gemini.length > 10 && !gemini.startsWith('your_')) return true;
  const openai = process.env.OPENAI_API_KEY;
  if (openai && openai.length > 10 && !openai.startsWith('your_')) return true;
  return false;
}

function isAIAvailable() {
  try { return hasAIKey() && typeof fetch === 'function'; } catch { return false; }
}

// Per-language regex patterns for the heuristic scorer (functions, loops,
// OOP, imports...). Weights decide each category's contribution to the score.
const LANG_PROFILES = {
  jsx: {
    patterns: {
      component: /(?:export\s+(?:default\s+)?)?(?:const|function)\s+[A-Z]\w+/,
      hooks: /\b(useState|useEffect|useRef|useContext|useMemo|useCallback|useReducer)\b/g,
      props: /(?:props|{[^}]*}\s*=>|function\s+\w+\s*\([^)]*\)\s*(?:=>|{))/,
      jsxReturn: /return\s*[\s\S]*?</,
      jsxElements: /<(?:div|span|button|input|form|img|p|h[1-6]|ul|li|a|label|select|option|table|tr|td|th|section|article|header|footer|nav|main|aside)\b/g,
      imports: /import\s+.*from\s+['"](?:react|react-dom|.*\.(?:css|scss|svg))['"]/,
      export: /export\s+default/,
      state: /(?:useState|useReducer)\s*\(/,
      effect: /useEffect\s*\(/,
      className: /className\s*=/,
      style: /style\s*=\s*\{\{/,
      keys: /\bkey\s*=\s*\{/,
      events: /on(?:Click|Change|Submit|Load|Focus|Blur|KeyDown|KeyUp|MouseEnter|MouseLeave)\s*=/,
      conditional: /\?[^:]*:|&&\s*[<(]|\bif\s*\(/,
      lists: /\.map\s*\(|\.filter\s*\(|\.forEach\s*\(/,
    },
    weights: { structure: 25, react: 30, quality: 25, complexity: 20 },
  },
  tsx: null,
  react: null,
  html: {
    patterns: {
      doctype: /<!DOCTYPE|<!doctype/i,
      rootTag: /<html[\s>]/i,
      head: /<head[\s>]/i,
      body: /<body[\s>]/i,
      meta: /<meta\s+charset|<meta\s+name/i,
      title: /<title[\s>]/i,
      semantic: /<(?:header|footer|nav|main|section|article|aside|figure|figcaption)\b/gi,
      forms: /<(?:form|input|select|textarea|button)\b/gi,
      labels: /<(?:label)\b/gi,
      links: /<a\s+href/gi,
      images: /<img\s+[^>]*src/gi,
      lists: /<(?:ul|ol|dl)\b/gi,
      headings: /<h[1-6]\b/gi,
      divs: /<div\b/gi,
      css: /<style|<link\s+[^>]*rel=["']stylesheet|class\s*=/gi,
      scripts: /<script\b/gi,
      accessibility: /(?:alt|aria-|role|tabindex|for\s*=)/gi,
      responsive: /viewport|@media/gi,
      closeTags: /<\/\w+>/g,
    },
    weights: { structure: 20, semantic: 25, content: 30, quality: 25 },
  },
  css: {
    patterns: {
      selectors: /[.#][\w-]+/g,
      properties: /\b(?:color|background|margin|padding|display|font-size|border|width|height|position|flex|grid|overflow|opacity|transition|animation|transform)\b/g,
      values: /:\s*[\w#(.]+[^;]+;/g,
      media: /@media\b/g,
      flexbox: /display\s*:\s*flex|display\s*:\s*grid/g,
      responsive: /@media[^{]*max-width|@media[^{]*min-width/g,
      variables: /--[\w-]+\s*:/g,
      hover: /:hover|:focus|:active|:nth-child/g,
      pseudo: /::(?:before|after|first-line|placeholder)/g,
      classes: /\.[\w-]+/g,
      animations: /@keyframes|animation\s*:/g,
    },
    weights: { structure: 20, properties: 30, responsive: 25, quality: 25 },
  },
  python: {
    patterns: {
      functions: /\bdef\s+\w+\s*\(/g,
      classes: /\bclass\s+\w+/g,
      imports: /\b(?:import|from)\s+\w+/g,
      loops: /\b(?:for|while)\s+/g,
      conditions: /\b(?:if|elif|else)\s*[:(]/g,
      errorHandling: /\b(?:try|except|finally|raise)\b/g,
      comprehensions: /\[.*\bfor\b.*\bin\b.*\]/g,
      decorators: /@\w+/g,
      fstrings: /f['"]/g,
      lambdas: /\blambda\s+/g,
      generators: /\b(?:yield|yield\s+from)\b/g,
      dunder: /__\w+__/g,
      print: /\bprint\s*\(/g,
      return: /\breturn\b/g,
      listMethods: /\.(?:append|extend|pop|insert|remove|sort|reverse|index|count|map|filter|zip|enumerate)\(/g,
      dictMethods: /\.(?:keys|values|items|get|update|pop)\(/g,
      withStatement: /\bwith\s+\w+/g,
      typeHints: /:\s*(?:str|int|float|bool|list|dict|tuple|set|None)\b/g,
    },
    weights: { structure: 20, patterns: 30, quality: 25, complexity: 25 },
  },
  java: {
    patterns: {
      classes: /\bclass\s+\w+/g,
      methods: /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)+\w+\s*\([^)]*\)\s*(?:throws\s+\w+)?\s*[{]/g,
      imports: /\bimport\s+(?:static\s+)?[\w.]+;/g,
      loops: /\b(?:for|while|do)\s*[\({]/g,
      conditions: /\b(?:if|else|switch|case)\s*[\({]/g,
      tryCatch: /\b(?:try|catch|finally)\s*[\({]/g,
      oop: /\b(?:extends|implements|interface|enum|abstract|final)\b/g,
      annotations: /@\w+/g,
      generics: /<[A-Z]\w*(?:\s*,\s*[A-Z]\w*)*>/g,
      main: /public\s+static\s+void\s+main/g,
      sout: /System\.out\.print/g,
      streams: /\.stream\(\)|\.map\(|\.filter\(|\.collect\(/g,
      collections: /\b(?:ArrayList|HashMap|LinkedList|HashSet|TreeMap|List|Map|Set)\b/g,
    },
    weights: { structure: 25, oop: 25, quality: 25, complexity: 25 },
  },
  javascript: {
    patterns: {
      functions: /(?:function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|\w+\s*=>|function))/g,
      arrowFunctions: /=\s*>/g,
      classes: /\bclass\s+\w+/g,
      imports: /(?:import\s+.*from|const\s+.*=\s*require)\s*[\('"]/g,
      asyncAwait: /\b(?:async|await)\b/g,
      promises: /\.then\(|\.catch\(|new\s+Promise/g,
      loops: /\b(?:for|while|do)\s*[\({]/g,
      conditions: /\b(?:if|else|switch|case|ternary)\s*[\(?]/g,
      destructuring: /(?:const|let|var)\s*\{[^}]+\}\s*=/g,
      spread: /\.\.\./g,
      templateLiterals: /`[^`]*\$\{/g,
      arrayMethods: /\.(?:map|filter|reduce|find|some|every|forEach|flat)\(/g,
      console: /console\.(?:log|error|warn|info)\(/g,
      dom: /document\.(?:getElementById|querySelector|createElement)/g,
      tryCatch: /\btry\s*\{/g,
      modules: /export\s+(?:default\s+)?(?:const|function|class)/g,
    },
    weights: { structure: 20, patterns: 30, quality: 25, complexity: 25 },
  },
  c: {
    patterns: {
      functions: /\w+\s+\w+\s*\([^)]*\)\s*[{]/g,
      includes: /^#include\s*[<"][\w.]+[>"]/gm,
      pointers: /\*\w+|\w+\s*\*/g,
      arrays: /\w+\s*\[[\w]*\]/g,
      loops: /\b(?:for|while|do)\s*\(/g,
      conditions: /\b(?:if|else|switch|case|default)\s*[:(]/g,
      structs: /\bstruct\s+\w+/g,
      printf: /\bprintf\s*\(/g,
      scanf: /\bscanf\s*\(/g,
      malloc: /\b(?:malloc|calloc|realloc|free)\s*\(/g,
      main: /int\s+main/g,
      return: /\breturn\b/g,
      macros: /^#define\s/gm,
      typedef: /\btypedef\b/g,
    },
    weights: { structure: 25, memory: 20, quality: 30, complexity: 25 },
  },
  cpp: null,
};

LANG_PROFILES.tsx = LANG_PROFILES.jsx;
LANG_PROFILES.react = LANG_PROFILES.jsx;
LANG_PROFILES['c++'] = LANG_PROFILES.c;
LANG_PROFILES.csharp = LANG_PROFILES.c;
LANG_PROFILES['c#'] = LANG_PROFILES.c;
LANG_PROFILES.kotlin = LANG_PROFILES.java;
LANG_PROFILES.scala = LANG_PROFILES.java;
LANG_PROFILES.go = LANG_PROFILES.c;
LANG_PROFILES.rust = LANG_PROFILES.c;
LANG_PROFILES.ruby = LANG_PROFILES.python;
LANG_PROFILES.php = LANG_PROFILES.javascript;
LANG_PROFILES.swift = LANG_PROFILES.java;

// Robust heuristic scorer (0-100): Evaluates code syntax, problem relevance,
// structural complexity, and clean execution when external AI is unavailable.
function analyzeCode(code, language, questionText, executionResult = null) {
  if (!code || !code.trim()) return { score: 0, feedback: 'No code submitted' };
  const lang = (language || '').toLowerCase().trim();
  const profile = LANG_PROFILES[lang];
  const lines = code.split('\n').filter(l => l.trim());
  const len = code.length;
  const lineCount = lines.length;
  const codeLower = code.toLowerCase();
  let score = 0;
  const feedback = [];

  const stopwords = new Set(['the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','has','his','how','its','may','new','now','old','see','way','who','did','get','let','say','she','too','use','write','code','program','create','make','function','implement','using','with','that','this','from','each','have','will','your','them','than','some','what','when','which','there','their','about','would','could','should','other','into','just','also']);
  const qWords = (questionText || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopwords.has(w));
  const uniqueQWords = [...new Set(qWords)];
  let keywordHits = 0;
  for (const kw of uniqueQWords) {
    if (codeLower.includes(kw)) { keywordHits++; }
  }
  const relevanceRatio = uniqueQWords.length > 0 ? keywordHits / uniqueQWords.length : 0.5;

  // 1. Question relevance (up to 30 points)
  if (relevanceRatio >= 0.4) {
    score += 30;
    feedback.push(`Strong question relevance (${keywordHits}/${uniqueQWords.length} terms matched)`);
  } else if (relevanceRatio >= 0.2) {
    score += 20;
    feedback.push(`Moderate question relevance (${keywordHits}/${uniqueQWords.length} terms matched)`);
  } else if (relevanceRatio > 0) {
    score += 12;
    feedback.push(`Basic question relevance`);
  } else if (uniqueQWords.length >= 3) {
    score += 5;
    feedback.push('Low question relevance');
  } else {
    score += 20;
  }

  // 2. Code length and substance (up to 20 points)
  if (len >= 300 || lineCount >= 20) { score += 20; feedback.push('Substantial code length'); }
  else if (len >= 150 || lineCount >= 10) { score += 15; feedback.push('Good code length'); }
  else if (len >= 60 || lineCount >= 5) { score += 10; feedback.push('Moderate code length'); }
  else if (len >= 20) { score += 6; feedback.push('Short code'); }
  else { score += 2; feedback.push('Very short'); }

  // 3. Language patterns & syntax (up to 40 points)
  if (profile && profile.patterns) {
    let patternScore = 0;
    for (const [category, regex] of Object.entries(profile.patterns)) {
      const matches = code.match(regex);
      const count = matches ? matches.length : 0;
      if (count === 0) continue;
      if (['component', 'hooks', 'jsxReturn', 'jsxElements', 'state', 'effect', 'className', 'events', 'keys', 'props'].includes(category)) {
        patternScore += Math.min(count * 3, 7);
      } else if (['functions', 'classes', 'methods', 'imports', 'loops', 'conditions', 'errorHandling', 'tryCatch', 'oop', 'annotations', 'includes', 'pointers', 'structs', 'macros'].includes(category)) {
        patternScore += Math.min(count * 2.5, 7);
      } else if (['arrayMethods', 'dictMethods', 'comprehensions', 'fstrings', 'typeHints', 'generics', 'streams', 'collections', 'modules', 'dom', 'templateLiterals', 'flexbox', 'variables', 'animations', 'decorators'].includes(category)) {
        patternScore += Math.min(count * 2, 5);
      } else {
        patternScore += Math.min(count * 1, 3);
      }
    }
    patternScore = Math.min(patternScore, 40);
    score += patternScore;
    feedback.push(`Syntax/patterns: ${Math.round(patternScore)}/40`);
  } else {
    let genericPattern = 0;
    if (/function\s+\w+|def\s+\w+|class\s+\w+|=>\s*{|void\s+\w+\s*\(/.test(code)) genericPattern += 15;
    if (/import\s|require\s*\(|#include|from\s+['"]/.test(code)) genericPattern += 8;
    if (/for\s*\(|while\s*\(|\.map\(|\.filter\(/.test(code)) genericPattern += 9;
    if (/if\s*\(|switch\s*\(|\?[^:]+:/.test(code)) genericPattern += 8;
    score += Math.min(40, genericPattern);
    feedback.push(`General patterns: ${Math.min(40, genericPattern)}/40`);
  }

  // 4. Execution validity or vocabulary richness bonus (up to 10 points)
  if (executionResult) {
    if (executionResult.exitCode === 0 && !executionResult.stderr) {
      score += 10;
      feedback.push('Clean execution (no runtime errors)');
    } else if (executionResult.stdout && executionResult.stdout.trim()) {
      score += 5;
      feedback.push('Executed with output');
    }
  } else {
    const uniqueWords = new Set(code.match(/\b[A-Za-z_]\w*\b/g) || []).size;
    if (uniqueWords >= 20) score += 10;
    else if (uniqueWords >= 10) score += 6;
    else score += 2;
  }

  const final = Math.min(100, Math.max(0, Math.round(score)));
  feedback.push(`Evaluated score: ${final}/100`);
  return { score: final, feedback: feedback.join(', ') };
}

// Calls OpenAI or Google Gemini (OpenAI-compatible) chat completions
async function callAI(messages) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.length > 10 && !geminiKey.startsWith('your_')) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${geminiKey}`,
        },
        body: JSON.stringify({
          model: 'gemini-1.5-flash',
          messages,
          temperature: 0.2,
          max_tokens: 2000,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || '';
      }
    } catch (e) {
      console.warn('[AI-EVAL] Gemini API failed:', e.message);
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.length > 10 && !apiKey.startsWith('your_')) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.2, max_tokens: 2000 }),
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI ${response.status}: ${errBody.substring(0, 200)}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  }

  throw new Error('No valid AI key configured');
}

// Sends question + model answer + student code to AI and parses { score: 0-100, feedback }
async function aiEvaluate(studentCode, questionText, language, strictness, marks, modelAnswer) {
  const strictNote = strictness === 'hard'
    ? '\n\nHARD MODE: Be strict on edge cases and algorithm correctness.'
    : strictness === 'easy'
    ? '\n\nEASY MODE: Be lenient on syntax formatting as long as logic is sound.'
    : '\n\nMEDIUM MODE: Balanced evaluation of correctness and logic.';

  const content = modelAnswer && modelAnswer.trim()
    ? `QUESTION: ${questionText}\n\nLANGUAGE: ${language}\n\nMODEL ANSWER (correct solution):\n\`\`\`${language}\n${modelAnswer}\n\`\`\`\n\nSTUDENT CODE:\n\`\`\`${language}\n${studentCode}\n\`\`\`\n\nCompare the student code against the model answer. Evaluate if the student code achieves the correct logic and result. Return JSON only: { "score": 0-100, "feedback": "string explanation" }.`
    : `QUESTION: ${questionText}\n\nLANGUAGE: ${language}\n\nSTUDENT CODE:\n\`\`\`${language}\n${studentCode}\n\`\`\`\n\nEvaluate whether this code correctly solves the question asked. Return JSON only: { "score": 0-100, "feedback": "string explanation" }.`;

  const msgs = [
    { role: 'system', content: `You are an expert programming exam evaluator. Return ONLY valid JSON in format: { "score": 0-100, "feedback": "concise feedback" }` + strictNote },
    { role: 'user', content }
  ];

  const raw = await callAI(msgs);
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    score: Math.min(100, Math.max(0, Number(parsed.score ?? parsed.qualityScore) || 0)),
    feedback: String(parsed.feedback || 'Evaluated successfully'),
  };
}

function looksLikeFrontendCode(code) {
  if (!code) return false;
  return [
    /import.*from\s+['"]react['"]/, /className\s*=/, /useState|useEffect|useRef/,
    /<[A-Z]\w+/, /<div|<span|<button|<input|<form/, /<!DOCTYPE|<!doctype/,
    /<\/\w+>/, /export\s+default/, /style\s*=\s*\{\{/,
  ].some(p => p.test(code));
}

/**
 * Main entry point used by routes/exams.js after a practical exam is submitted.
 * Evaluates each question with execution, AI review (if available), and heuristic fallback.
 */
async function evaluateSubmission({ questions, answers, language = 'python', strictness = 'medium' }) {
  const useAI = isAIAvailable();
  console.log(`[AI-EVAL] START: defaultLang=${language} openAI/Gemini=${useAI} strict=${strictness} qs=${questions.length}`);

  try {
    return await _evaluate(questions, answers, language, strictness, useAI);
  } catch (err) {
    console.error(`[AI-EVAL] UNEXPECTED ERROR:`, err.message);
    return _fallbackEvaluate(questions, answers, language);
  }
}

async function _evaluate(questions, answers, defaultLanguage, strictness, useAI) {
  let totalScore = 0;
  let totalPossible = 0;
  const submittedCode = [];
  const generatedSolution = [];
  const expectedOutput = [];
  const studentOutput = [];
  const feedbacks = [];
  let executionTime = 0;
  let memoryUsed = '';

  for (const question of questions) {
    const answerObj = (answers || []).find(a => String(a.questionId) === String(question._id));
    const studentCode = (answerObj?.answer || '').trim();
    const qLang = (answerObj?.language || defaultLanguage || 'python').toLowerCase();
    const isNonExec = isNonExecutableLanguage(qLang);
    const marks = question.marks || 1;
    totalPossible += marks;

    submittedCode.push({ questionId: question._id, code: studentCode, language: qLang });

    if (!studentCode) {
      generatedSolution.push({ questionId: question._id, solution: question.modelAnswer || '' });
      expectedOutput.push({ questionId: question._id, output: '' });
      studentOutput.push({ questionId: question._id, output: '', error: 'No code submitted' });
      feedbacks.push(`Q: No code submitted (0/${marks} marks).`);
      continue;
    }

    const modelAnswer = question.modelAnswer || '';
    const testCases = Array.isArray(question.testCases) ? question.testCases : [];

    // ── 1. MODEL ANSWER / TESTCASES COMPARISON ──
    let comparisonResult = null;
    let comparisonFeedback = '';
    let comparisonScore = 0;

    if (modelAnswer && modelAnswer.trim()) {
      try {
        comparisonResult = await compareOutputs(studentCode, modelAnswer, qLang, testCases);
        if (comparisonResult && comparisonResult.compared) {
          if (comparisonResult.nonExecutable) {
            const sim = comparisonResult.codeSimilarity || 0;
            const h = analyzeCode(studentCode, qLang, question.questionText);
            comparisonScore = Math.min(100, Math.round(sim * 50 + (h.score / 100) * 50));
            comparisonFeedback = `Frontend code similarity: ${Math.round(sim * 100)}%, syntax score: ${h.score}/100.`;
          } else {
            let outScore = 0;
            if (comparisonResult.testSummary && comparisonResult.testSummary.total > 0) {
              outScore = comparisonResult.testSummary.percentage;
            } else if (comparisonResult.basicOutputMatch) {
              outScore = 100;
            }
            const sim = comparisonResult.codeSimilarity || 0;

            if (comparisonResult.testSummary && comparisonResult.testSummary.passed === comparisonResult.testSummary.total && comparisonResult.testSummary.total > 0) {
              // All test cases passed -> 100% score!
              comparisonScore = 100;
              comparisonFeedback = `All ${comparisonResult.testSummary.total} test cases passed. Excellent!`;
            } else if (comparisonResult.basicOutputMatch) {
              // Output matches model answer output -> 90-100% score
              comparisonScore = Math.min(100, Math.max(90, Math.round(90 + sim * 10)));
              comparisonFeedback = `Output matches model answer. Code similarity: ${Math.round(sim * 100)}%.`;
            } else if (outScore > 0) {
              // Partial test cases passed (80% tests + 20% similarity)
              comparisonScore = Math.min(100, Math.round(outScore * 0.8 + sim * 100 * 0.2));
              comparisonFeedback = `Test cases: ${comparisonResult.testSummary.passed}/${comparisonResult.testSummary.total} passed. Code similarity: ${Math.round(sim * 100)}%.`;
            } else {
              // Output differed or failed
              const cleanRun = comparisonResult.studentOutput && comparisonResult.studentOutput.exitCode === 0 && !comparisonResult.studentOutput.stderr;
              const h = analyzeCode(studentCode, qLang, question.questionText, comparisonResult.studentOutput);
              comparisonScore = Math.min(60, Math.round((h.score / 100) * 50 + sim * 100 * 0.3 + (cleanRun ? 10 : 0)));
              comparisonFeedback = `Output differed from expected. Code logic score: ${comparisonScore}/100.`;
            }
          }
        }
      } catch (err) {
        console.warn(`[AI-EVAL] Comparison failed:`, err.message);
        comparisonFeedback = `Comparison note: ${err.message}`;
      }
    }

    // ── 2. EXECUTION INFO (when not already run) ──
    let directExec = null;
    if (!comparisonResult?.compared && !isNonExec && !looksLikeFrontendCode(studentCode)) {
      try {
        directExec = await executeCode(studentCode, qLang);
        if (directExec.time) executionTime += Number(directExec.time) * 1000;
        if (directExec.memory && !memoryUsed) memoryUsed = `${directExec.memory} KB`;
      } catch (execErr) {
        directExec = { stdout: '', stderr: execErr.message, exitCode: -1 };
      }
    }

    // ── 3. AI EVALUATION (Gemini / OpenAI) ──
    let aiResult = null;
    if (useAI) {
      try {
        let evalCode = studentCode;
        const execInfo = comparisonResult?.studentOutput || directExec;
        if (execInfo) {
          const out = execInfo.stdout || '';
          const err = execInfo.stderr || execInfo.compileOutput || '';
          if (err) evalCode += `\n\n// EXECUTION OUTPUT:\n// stdout: ${out}\n// stderr: ${err}`;
          else if (out) evalCode += `\n\n// EXECUTION OUTPUT:\n// stdout: ${out}`;
        }
        aiResult = await aiEvaluate(evalCode, question.questionText, qLang, strictness, marks, modelAnswer);
      } catch (err) {
        console.warn(`[AI-EVAL] Q${question._id}: AI review skipped (${err.message})`);
      }
    }

    // ── 4. RECORD OUTPUT DATA ──
    generatedSolution.push({ questionId: question._id, solution: modelAnswer });
    if (comparisonResult && comparisonResult.compared) {
      if (comparisonResult.nonExecutable) {
        expectedOutput.push({ questionId: question._id, output: '(Model answer - non-executable)' });
        studentOutput.push({ questionId: question._id, output: studentCode.substring(0, 500), error: '' });
      } else {
        expectedOutput.push({ questionId: question._id, output: comparisonResult.modelOutput?.stdout || '' });
        studentOutput.push({
          questionId: question._id,
          output: comparisonResult.studentOutput?.stdout || '',
          error: comparisonResult.studentOutput?.stderr || '',
        });
      }
    } else if (directExec) {
      expectedOutput.push({ questionId: question._id, output: '' });
      studentOutput.push({
        questionId: question._id,
        output: directExec.stdout || '',
        error: directExec.stderr || '',
      });
    } else {
      expectedOutput.push({ questionId: question._id, output: '' });
      studentOutput.push({ questionId: question._id, output: '', error: '' });
    }

    // ── 5. COMPUTE FINAL QUESTION SCORE ──
    let qScore = 0;
    let feedback = '';

    if (comparisonResult && comparisonResult.compared && comparisonScore > 0) {
      if (aiResult) {
        // Blend execution comparison (70%) with AI code quality (30%)
        const combined = comparisonScore >= 95
          ? comparisonScore // Don't downgrade 100% passing code
          : Math.round(comparisonScore * 0.7 + aiResult.score * 0.3);
        qScore = Math.round((combined / 100) * marks);
        feedback = `${comparisonFeedback} AI review: ${aiResult.feedback}`;
      } else {
        qScore = Math.round((comparisonScore / 100) * marks);
        feedback = comparisonFeedback;
      }
    } else if (aiResult) {
      qScore = Math.round((aiResult.score / 100) * marks);
      feedback = aiResult.feedback;
    } else {
      // Heuristic analysis with execution awareness
      const execResult = directExec || comparisonResult?.studentOutput;
      const h = analyzeCode(studentCode, qLang, question.questionText, execResult);
      qScore = Math.round((h.score / 100) * marks);
      feedback = h.feedback;
    }

    qScore = Math.min(marks, Math.max(0, qScore));
    totalScore += qScore;
    feedbacks.push(`Q${questions.indexOf(question) + 1} (${marks}m): ${feedback} → ${qScore}/${marks}`);
  }

  const finalMarks = Math.min(totalScore, totalPossible);
  const pct = totalPossible > 0 ? Math.round((finalMarks / totalPossible) * 100) : 0;

  console.log(`[AI-EVAL] FINISHED: ${finalMarks}/${totalPossible} (${pct}%)`);

  return {
    submittedCode,
    generatedSolution,
    expectedOutput,
    studentOutput,
    correctnessScore: pct,
    qualityScore: pct,
    finalMarks,
    totalMarks: totalPossible,
    aiFeedback: feedbacks.join('\n\n'),
    executionTime: Math.round(executionTime),
    memoryUsed,
    status: 'evaluated',
  };
}

// Fallback scoring if any unexpected exception arises — never fails a submission
function _fallbackEvaluate(questions, answers, defaultLanguage) {
  let totalScore = 0;
  let totalPossible = 0;
  const feedbacks = ['Auto evaluation completed'];

  for (const question of questions) {
    const answerObj = (answers || []).find(a => String(a.questionId) === String(question._id));
    const studentCode = (answerObj?.answer || '').trim();
    const qLang = (answerObj?.language || defaultLanguage || 'python').toLowerCase();
    const marks = question.marks || 1;
    totalPossible += marks;

    if (!studentCode) {
      feedbacks.push(`Q${questions.indexOf(question) + 1}: No code submitted (0/${marks})`);
      continue;
    }

    const h = analyzeCode(studentCode, qLang, question.questionText);
    const qScore = Math.min(marks, Math.round((h.score / 100) * marks));
    totalScore += qScore;
    feedbacks.push(`Q${questions.indexOf(question) + 1}: ${h.feedback} → ${qScore}/${marks}`);
  }

  const pct = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
  return {
    submittedCode: (answers || []).map(a => ({ questionId: a.questionId, code: a.answer || '', language: a.language || defaultLanguage })),
    generatedSolution: questions.map(q => ({ questionId: q._id, solution: q.modelAnswer || '' })),
    expectedOutput: questions.map(q => ({ questionId: q._id, output: '' })),
    studentOutput: (answers || []).map(a => ({ questionId: a.questionId, output: '', error: '' })),
    correctnessScore: pct,
    qualityScore: pct,
    finalMarks: Math.min(totalScore, totalPossible),
    totalMarks: totalPossible,
    aiFeedback: feedbacks.join('\n\n'),
    executionTime: 0,
    memoryUsed: '',
    status: 'evaluated',
  };
}

module.exports = {
  evaluateSubmission,
  analyzeCode,
  isNonExecutableLanguage,
  looksLikeFrontendCode,
  hasAIKey,
  isAIAvailable,
};
