const { executeCode } = require('./codeExecution');
const { compareOutputs, calcCodeSimilarity, isNonExecutable } = require('./codeComparisonService');

const NON_EXECUTABLE_LANGUAGES = new Set([
  'react', 'jsx', 'tsx', 'vue', 'svelte',
  'html', 'css', 'scss', 'sass', 'less',
  'svg', 'markdown', 'xml',
]);

function isNonExecutableLanguage(lang) {
  return NON_EXECUTABLE_LANGUAGES.has((lang || '').toLowerCase());
}

function hasOpenAIKey() {
  const key = process.env.OPENAI_API_KEY;
  return key && key.length > 10 && !key.startsWith('your_');
}

function isOpenAIAvailable() {
  try { return hasOpenAIKey() && typeof fetch === 'function'; } catch { return false; }
}

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
LANG_PROFILES.kotlin = LANG_PROFILES.java;
LANG_PROFILES.scala = LANG_PROFILES.java;
LANG_PROFILES.go = LANG_PROFILES.c;
LANG_PROFILES.rust = LANG_PROFILES.c;
LANG_PROFILES.ruby = LANG_PROFILES.python;
LANG_PROFILES.php = LANG_PROFILES.javascript;
LANG_PROFILES.swift = LANG_PROFILES.java;

function analyzeCode(code, language, questionText) {
  if (!code || !code.trim()) return { score: 0, feedback: 'No code submitted' };
  const lang = (language || '').toLowerCase();
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
  const matchedKeywords = [];
  for (const kw of uniqueQWords) {
    if (codeLower.includes(kw)) { keywordHits++; matchedKeywords.push(kw); }
  }
  const relevanceRatio = uniqueQWords.length > 0 ? keywordHits / uniqueQWords.length : 0;
  if (relevanceRatio < 0.05 && uniqueQWords.length >= 3) {
    feedback.push(`Very low question relevance (${keywordHits}/${uniqueQWords.length} keywords matched)`);
  } else if (relevanceRatio < 0.15) {
    feedback.push(`Low question relevance (${keywordHits}/${uniqueQWords.length} keywords matched)`);
  } else if (relevanceRatio >= 0.3) {
    feedback.push(`Good question relevance (${keywordHits}/${uniqueQWords.length} keywords matched)`);
  }
  if (len >= 500) { score += 10; feedback.push('Substantial code'); }
  else if (len >= 300) { score += 8; feedback.push('Good code length'); }
  else if (len >= 150) { score += 6; feedback.push('Moderate code'); }
  else if (len >= 50) { score += 4; feedback.push('Short code'); }
  else { score += 1; feedback.push('Very short'); }
  if (profile && profile.patterns) {
    let patternScore = 0;
    for (const [category, regex] of Object.entries(profile.patterns)) {
      const matches = code.match(regex);
      const count = matches ? matches.length : 0;
      if (count === 0) continue;
      if (['component', 'hooks', 'jsxReturn', 'jsxElements', 'state', 'effect', 'className', 'events', 'keys', 'props'].includes(category)) {
        patternScore += Math.min(count * 1.5, 3);
      } else if (['functions', 'classes', 'methods', 'imports', 'loops', 'conditions', 'errorHandling', 'tryCatch', 'oop', 'annotations', 'includes', 'pointers', 'structs', 'macros'].includes(category)) {
        patternScore += Math.min(count * 1, 2.5);
      } else if (['arrayMethods', 'dictMethods', 'comprehensions', 'fstrings', 'typeHints', 'generics', 'streams', 'collections', 'modules', 'dom', 'templateLiterals', 'flexbox', 'variables', 'animations', 'decorators'].includes(category)) {
        patternScore += Math.min(count * 1, 2);
      } else {
        patternScore += Math.min(count * 0.5, 1.5);
      }
    }
    patternScore = Math.min(patternScore, 25);
    score += patternScore;
    feedback.push(`Language patterns: ${Math.round(patternScore)}/25`);
  } else {
    const hasFunc = /function\s+\w+|def\s+\w+|class\s+\w+|=>\s*{|void\s+\w+\s*\(/.test(code);
    const hasImports = /import\s|require\s*\(|#include|from\s+['"]/.test(code);
    const hasLoops = /for\s*\(|while\s*\(|\.map\(|\.filter\(/.test(code);
    const hasConditions = /if\s*\(|switch\s*\(|\?[^:]+:/.test(code);
    if (hasFunc) score += 5;
    if (hasImports) score += 3;
    if (hasLoops) score += 3;
    if (hasConditions) score += 3;
    feedback.push('Generic evaluation (unknown language)');
  }
  const uniqueWords = new Set(code.match(/\b[A-Za-z_]\w*\b/g) || []).size;
  if (uniqueWords >= 25) score += 10;
  else if (uniqueWords >= 15) score += 7;
  else if (uniqueWords >= 8) score += 4;
  else score += 1;
  if (lineCount >= 25) score += 3;
  else if (lineCount >= 15) score += 2;
  else if (lineCount >= 8) score += 1;
  if (relevanceRatio >= 0.4) { score += 5; feedback.push('Strong question relevance'); }
  else if (relevanceRatio >= 0.25) { score += 2; }
  if (relevanceRatio < 0.05 && uniqueQWords.length >= 3) {
    score = Math.max(0, score - 10);
    feedback.push('Penalty: code appears unrelated to question');
  }
  const final = Math.min(50, Math.max(5, score));
  feedback.push(`Heuristic score: ${final}/100`);
  return { score: final, feedback: feedback.join(', ') };
}

async function callOpenAI(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
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
  return data.choices[0].message.content.trim();
}

async function aiEvaluate(studentCode, questionText, language, strictness, marks, modelAnswer) {
  const strictNote = strictness === 'hard'
    ? '\n\nHARD MODE: Be extremely strict. Only give high scores if code correctly solves the problem.'
    : strictness === 'easy'
    ? '\n\nEASY MODE: Be lenient on style/formatting but still require correctness.'
    : '\n\nMEDIUM MODE: Balanced evaluation.';

  const content = modelAnswer && modelAnswer.trim()
    ? `QUESTION: ${questionText}\n\nLANGUAGE: ${language}\n\nMODEL ANSWER (correct solution):\n\`\`\`${language}\n${modelAnswer}\n\`\`\`\n\nSTUDENT CODE:\n\`\`\`${language}\n${studentCode}\n\`\`\`\n\nCompare the student code against the model answer. How similar are they in logic, approach, and output? Return JSON with score (0-100) and feedback. Score should reflect how closely the student's solution matches the correct solution.`
    : `QUESTION: ${questionText}\n\nLANGUAGE: ${language}\n\nSTUDENT CODE:\n\`\`\`${language}\n${studentCode}\n\`\`\`\n\nEvaluate this code. Does it actually solve the specific question asked? Return JSON with score (0-100) and feedback.`;

  const msgs = [
    { role: 'system', content: `You are a STRICT code reviewer. Return JSON only: { "score": 0-100, "feedback": "string" }` + strictNote },
    { role: 'user', content }
  ];

  const raw = await callOpenAI(msgs);
  const cleaned = raw.replace(/^```json\n?/gm, '').replace(/```$/gm, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    score: Math.min(100, Math.max(0, Number(parsed.score || parsed.qualityScore) || 0)),
    feedback: String(parsed.feedback || ''),
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

async function evaluateSubmission({ questions, answers, language, strictness = 'medium' }) {
  const isNonExec = isNonExecutableLanguage(language);
  const useAI = isOpenAIAvailable();
  console.log(`[AI-EVAL] START: lang=${language} nonExec=${isNonExec} openAI=${useAI} strict=${strictness} qs=${questions.length}`);

  try {
    return await _evaluate(questions, answers, language, strictness, isNonExec, useAI);
  } catch (err) {
    console.error(`[AI-EVAL] UNEXPECTED ERROR:`, err.message);
    return _fallbackEvaluate(questions, answers, language);
  }
}

async function _evaluate(questions, answers, language, strictness, isNonExec, useAI) {
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
    const answerObj = answers.find(a => String(a.questionId) === String(question._id));
    const studentCode = (answerObj?.answer || '').trim();
    const marks = question.marks || 1;
    totalPossible += marks;

    submittedCode.push({ questionId: question._id, code: studentCode, language });

    if (!studentCode) {
      generatedSolution.push({ questionId: question._id, solution: '' });
      expectedOutput.push({ questionId: question._id, output: '' });
      studentOutput.push({ questionId: question._id, output: '', error: 'No code submitted' });
      feedbacks.push(`Q: No code submitted. 0/${marks} marks.`);
      continue;
    }

    const modelAnswer = question.modelAnswer || '';
    const testCases = question.testCases || [];

    // ── MODEL ANSWER COMPARISON (output + similarity) ──
    let comparisonResult = null;
    let comparisonFeedback = '';
    let comparisonScore = 0;

    if (modelAnswer && modelAnswer.trim()) {
      try {
        comparisonResult = await compareOutputs(studentCode, modelAnswer, language, testCases);
        if (comparisonResult.compared) {
          if (comparisonResult.nonExecutable) {
            const sim = comparisonResult.codeSimilarity || 0;
            comparisonScore = Math.round(sim * 100);
            comparisonFeedback = `Code similarity with model answer: ${Math.round(sim * 100)}%`;
          } else {
            let outScore = 0;
            if (comparisonResult.testSummary && comparisonResult.testSummary.total > 0) {
              outScore = comparisonResult.testSummary.percentage;
            } else if (comparisonResult.basicOutputMatch) {
              outScore = 100;
            }
            const sim = comparisonResult.codeSimilarity || 0;
            comparisonScore = Math.round(outScore * 0.6 + sim * 100 * 0.25);
            comparisonFeedback = comparisonResult.testSummary
              ? `Test cases: ${comparisonResult.testSummary.passed}/${comparisonResult.testSummary.total} passed. Code similarity: ${Math.round(sim * 100)}%.`
              : comparisonResult.basicOutputMatch
              ? `Output matches model answer. Code similarity: ${Math.round(sim * 100)}%.`
              : `Output differs from model answer. Code similarity: ${Math.round(sim * 100)}%.`;
          }
        }
      } catch (err) {
        comparisonFeedback = `Comparison error: ${err.message}`;
      }
    }

    // ── AI EVALUATION (supplementary) ──
    let aiResult = null;
    if (useAI) {
      try {
        let evalCode = studentCode;
        const shouldSkipExecution = isNonExec || looksLikeFrontendCode(studentCode);
        if (!shouldSkipExecution) {
          try {
            const result = await executeCode(studentCode, language);
            const out = result.stdout || '';
            const err = result.stderr || result.compileOutput || '';
            if (result.time) executionTime += Number(result.time) * 1000;
            if (result.memory && !memoryUsed) memoryUsed = `${result.memory} KB`;
            if (!comparisonResult || !comparisonResult.compared) {
              studentOutput[studentOutput.length - 1] = { output: out, error: err };
            }
            if (err) evalCode += `\n\n// EXECUTION OUTPUT:\n// stdout: ${out}\n// stderr: ${err}`;
            else evalCode += `\n\n// EXECUTION OUTPUT:\n// stdout: ${out}`;
          } catch (execErr) {
            if (!comparisonResult || !comparisonResult.compared) {
              studentOutput[studentOutput.length - 1] = { output: '', error: execErr.message };
            }
            evalCode += `\n\n// EXECUTION ERROR: ${execErr.message}`;
          }
        }
        aiResult = await aiEvaluate(evalCode, question.questionText, language, strictness, marks, modelAnswer);
      } catch (err) {
        console.log(`[AI-EVAL] Q${question._id}: AI failed (${err.message})`);
      }
    }

    // ── STORE EXPECTED/STUDENT OUTPUT ──
    generatedSolution.push({ questionId: question._id, solution: modelAnswer });
    if (comparisonResult && comparisonResult.compared) {
      if (comparisonResult.nonExecutable) {
        expectedOutput.push({ questionId: question._id, output: '(Model answer - non-executable language)' });
        studentOutput.push({ questionId: question._id, output: studentCode.substring(0, 500), error: '' });
      } else {
        expectedOutput.push({ questionId: question._id, output: comparisonResult.modelOutput?.stdout || '' });
        studentOutput.push({
          questionId: question._id,
          output: comparisonResult.studentOutput?.stdout || '',
          error: comparisonResult.studentOutput?.stderr || '',
        });
      }
    } else {
      expectedOutput.push({ questionId: question._id, output: '' });
      studentOutput.push({ questionId: question._id, output: '', error: '' });
    }

    // ── COMPUTE FINAL SCORE ──
    let qScore = 0;
    let feedback = '';
    let usedMethod = 'none';

    if (comparisonResult && comparisonResult.compared && comparisonScore > 0) {
      qScore = Math.round((comparisonScore / 100) * marks);
      feedback = comparisonFeedback;
      usedMethod = 'model-comparison';
      if (aiResult) {
        const aiScorePct = aiResult.score;
        const combined = Math.round(comparisonScore * 0.7 + aiScorePct * 0.3);
        qScore = Math.round((combined / 100) * marks);
        feedback += ` AI: ${aiResult.feedback}`;
        usedMethod = 'model-comparison+ai';
      }
    } else if (aiResult) {
      qScore = Math.round((aiResult.score / 100) * marks);
      feedback = aiResult.feedback;
      usedMethod = 'ai';
    } else {
      const h = analyzeCode(studentCode, language, question.questionText);
      qScore = Math.round((h.score / 100) * marks);
      feedback = h.feedback;
      usedMethod = 'heuristic';
    }

    totalScore += qScore;
    feedbacks.push(`Q: ${feedback}`);
  }

  const finalMarks = Math.min(totalScore, totalPossible);
  const pct = totalPossible > 0 ? Math.round((finalMarks / totalPossible) * 100) : 0;

  console.log(`[AI-EVAL] DONE: ${finalMarks}/${totalPossible} (${pct}%)`);

  return {
    submittedCode, generatedSolution, expectedOutput, studentOutput,
    correctnessScore: pct, qualityScore: pct,
    finalMarks, totalMarks: totalPossible,
    aiFeedback: feedbacks.join('\n\n'),
    executionTime: Math.round(executionTime),
    memoryUsed, status: 'evaluated',
  };
}

function _fallbackEvaluate(questions, answers, language) {
  let totalScore = 0;
  let totalPossible = 0;
  const feedbacks = ['Fallback evaluation — heuristic scoring'];
  for (const question of questions) {
    const answerObj = answers.find(a => String(a.questionId) === String(question._id));
    const studentCode = (answerObj?.answer || '').trim();
    const marks = question.marks || 1;
    totalPossible += marks;
    if (!studentCode) { feedbacks.push(`Q: No code. 0/${marks}`); continue; }
    const h = analyzeCode(studentCode, language, question.questionText);
    const qScore = Math.round((h.score / 100) * marks);
    totalScore += qScore;
    feedbacks.push(`Q: ${h.feedback} → ${qScore}/${marks}`);
  }
  return {
    submittedCode: answers.map(a => ({ questionId: a.questionId, code: a.answer || '', language })),
    generatedSolution: questions.map(q => ({ questionId: q._id, solution: '' })),
    expectedOutput: questions.map(q => ({ questionId: q._id, output: '' })),
    studentOutput: answers.map(a => ({ questionId: a.questionId, output: '', error: '' })),
    correctnessScore: totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0,
    qualityScore: 0,
    finalMarks: Math.min(totalScore, totalPossible),
    totalMarks: totalPossible,
    aiFeedback: feedbacks.join('\n\n'),
    executionTime: 0, memoryUsed: '', status: 'evaluated',
  };
}

module.exports = {
  evaluateSubmission,
  analyzeCode,
  isNonExecutableLanguage,
  looksLikeFrontendCode,
  hasOpenAIKey,
};
