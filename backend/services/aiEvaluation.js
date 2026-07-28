/**
 * AI Evaluation Service
 * - Language-specific heuristic scoring (works without API key)
 * - OpenAI-powered deep evaluation (when key configured)
 * - Never crashes, always returns valid scores
 */

const { executeCode } = require('./codeExecution');

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

// ============================================================
// LANGUAGE-SPECIFIC HEURISTIC PROFILES
// Each language has its own scoring rules
// ============================================================

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

  tsx: null, // inherit from jsx
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

  cpp: null, // inherit from c + extra
};

// Inherit profiles
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

  // ── QUESTION RELEVANCE CHECK (critical — catches fake/wrong code) ──
  // Extract meaningful keywords from question (3+ letters, exclude common words)
  const stopwords = new Set(['the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','has','his','how','its','may','new','now','old','see','way','who','did','get','let','say','she','too','use','write','code','program','create','make','function','implement','using','with','that','this','from','each','have','will','your','them','than','some','what','when','which','there','their','about','would','could','should','other','into','just','also']);
  const qWords = (questionText || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopwords.has(w));
  const uniqueQWords = [...new Set(qWords)];

  // Count how many question keywords appear in code
  let keywordHits = 0;
  const matchedKeywords = [];
  for (const kw of uniqueQWords) {
    if (codeLower.includes(kw)) {
      keywordHits++;
      matchedKeywords.push(kw);
    }
  }
  const relevanceRatio = uniqueQWords.length > 0 ? keywordHits / uniqueQWords.length : 0;

  // If code has almost no question keywords, it's likely irrelevant/fake
  if (relevanceRatio < 0.05 && uniqueQWords.length >= 3) {
    feedback.push(`Very low question relevance (${keywordHits}/${uniqueQWords.length} keywords matched) — code may not address the question`);
    // Still give some base points for having valid code structure, but cap hard
  } else if (relevanceRatio < 0.15) {
    feedback.push(`Low question relevance (${keywordHits}/${uniqueQWords.length} keywords matched)`);
  } else if (relevanceRatio >= 0.3) {
    feedback.push(`Good question relevance (${keywordHits}/${uniqueQWords.length} keywords matched)`);
  }

  // ── BASE SCORE: Code substance (max 10 points) ──
  if (len >= 500) { score += 10; feedback.push('Substantial code'); }
  else if (len >= 300) { score += 8; feedback.push('Good code length'); }
  else if (len >= 150) { score += 6; feedback.push('Moderate code'); }
  else if (len >= 50) { score += 4; feedback.push('Short code'); }
  else { score += 1; feedback.push('Very short'); }

  // ── LANGUAGE-SPECIFIC SCORING (max 25 points — structure only) ──
  if (profile && profile.patterns) {
    let patternScore = 0;

    for (const [category, regex] of Object.entries(profile.patterns)) {
      const matches = code.match(regex);
      const count = matches ? matches.length : 0;
      if (count === 0) continue;

      // Much lower per-pattern scoring — structure is NOT correctness
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

    // Cap language patterns at 25 points
    patternScore = Math.min(patternScore, 25);
    score += patternScore;
    feedback.push(`Language patterns: ${Math.round(patternScore)}/25`);
  } else {
    // Generic scoring for unknown languages — very conservative
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

  // ── COMPLEXITY BONUS (max 10 points) ──
  const uniqueWords = new Set(code.match(/\b[A-Za-z_]\w*\b/g) || []).size;

  if (uniqueWords >= 25) score += 10;
  else if (uniqueWords >= 15) score += 7;
  else if (uniqueWords >= 8) score += 4;
  else score += 1;

  if (lineCount >= 25) score += 3;
  else if (lineCount >= 15) score += 2;
  else if (lineCount >= 8) score += 1;

  // ── RELEVANCE BONUS/PENALTY ──
  // Boost if code clearly addresses the question
  if (relevanceRatio >= 0.4) {
    score += 5;
    feedback.push('Strong question relevance');
  } else if (relevanceRatio >= 0.25) {
    score += 2;
  }
  // Penalize if code seems completely unrelated
  if (relevanceRatio < 0.05 && uniqueQWords.length >= 3) {
    score = Math.max(0, score - 10);
    feedback.push('Penalty: code appears unrelated to question');
  }

  // ── CAP: max 50 for heuristic — AI needed for accurate scoring ──
  const final = Math.min(50, Math.max(5, score));
  feedback.push(`Heuristic score: ${final}/100 (AI recommended for accurate evaluation)`);

  return { score: final, feedback: feedback.join(', ') };
}

// ============================================================
// OPENAI-POWERED EVALUATION — language-specific prompts
// ============================================================

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

const AI_EVAL_PROMPTS = {
  jsx: `You are a STRICT React/JSX code reviewer. You MUST evaluate whether the code ACTUALLY SOLVES the question.

Return JSON only: { "score": 0-100, "feedback": "string" }

CRITICAL RULES:
- If the code does NOT match what the question asks, give 0-25 points MAXIMUM regardless of code quality
- Having React syntax (hooks, JSX, imports) is NOT enough — the code must SOLVE THE SPECIFIC PROBLEM
- Generic "counter app" or "todo app" code gets 0-15 if the question asks for something else
- Code that renders random content unrelated to the question gets 0-20

SCORING (100 points total):
1. QUESTION MATCH (50 points):
   - Does the code render/produce what the question specifically asks for?
   - Does it implement the exact features mentioned in the question?
   - Does it handle the specific data/props/state described?
   - 50 = perfectly matches all requirements
   - 30-40 = matches most requirements
   - 10-29 = partially matches but missing core features
   - 0-9 = does NOT match the question at all

2. FUNCTIONALITY (30 points):
   - Does the code actually work? (no errors, correct rendering)
   - Are hooks used correctly (useState, useEffect, etc.)?
   - Are event handlers properly implemented?
   - Is state managed correctly for the required features?

3. CODE QUALITY (20 points):
   - Proper imports and exports
   - Clean component structure
   - Meaningful variable names
   - No unnecessary complexity

REJECTION CRITERIA (score ≤ 25):
- Code answers a completely different question
- Generic template code with no relation to the question
- Code that would produce wrong output for the given requirements
- Code missing all core features mentioned in the question`,

  html: `You are a STRICT HTML code reviewer. You MUST evaluate whether the code ACTUALLY SOLVES the question.

Return JSON only: { "score": 0-100, "feedback": "string" }

CRITICAL RULE:
- If the HTML does NOT match what the question asks, give 0-25 points MAXIMUM
- Generic boilerplate HTML gets low scores unless the question specifically asks for boilerplate
- HTML that doesn't contain the elements/content described in the question gets 0-20

SCORING:
1. QUESTION MATCH (50 points): Does the HTML contain exactly what the question asks for? Required elements, text, structure?
2. STRUCTURE (25 points): DOCTYPE, proper nesting, semantic tags, closing tags
3. FORMS & CONTENT (15 points): If forms are asked, are inputs/labels/buttons correct?
4. ACCESSIBILITY (10 points): alt text, aria, heading hierarchy

REJECTION: HTML that doesn't address the question requirements gets ≤25.`,

  css: `You are a STRICT CSS code reviewer. You MUST evaluate whether the code ACTUALLY STYLES what the question asks.

Return JSON only: { "score": 0-100, "feedback": "string" }

CRITICAL RULE:
- If the CSS does NOT style the elements/components mentioned in the question, give 0-25 points MAXIMUM
- Generic CSS gets low scores unless the question specifically asks for generic styling

SCORING:
1. QUESTION MATCH (50 points): Does the CSS target and style exactly the elements/components the question describes?
2. SELECTORS & PROPERTIES (25 points): Correct selectors, appropriate property values
3. LAYOUT (15 points): Flexbox/Grid used correctly, responsive design
4. QUALITY (10 points): Organized code, variables, no redundancy

REJECTION: CSS that doesn't style the right elements gets ≤25.`,

  python: `You are a STRICT Python code reviewer. You MUST evaluate whether the code ACTUALLY SOLVES the question.

Return JSON only: { "score": 0-100, "feedback": "string" }

CRITICAL RULES:
- If the code does NOT solve the specific problem asked, give 0-25 points MAXIMUM
- Code that prints random output unrelated to the question gets 0-15
- Code that implements a different algorithm than what's asked gets 0-25
- Having valid Python syntax is NOT enough — it must solve THE RIGHT PROBLEM

SCORING:
1. QUESTION MATCH (50 points):
   - Does the code produce the exact output the question requires?
   - Does it use the correct algorithm/data structure?
   - Does it handle the specific input/output format described?
   - 50 = perfectly solves the problem
   - 30-40 = mostly correct, minor issues
   - 10-29 = has the right idea but wrong implementation
   - 0-9 = does NOT solve the problem asked

2. CORRECTNESS (30 points):
   - Would this code produce correct results for test cases?
   - Are edge cases handled?
   - Is the logic sound?

3. PYTHONIC CODE (20 points):
   - PEP 8 naming, proper structure, appropriate Python features

REJECTION: Code that doesn't solve the specific problem gets ≤25.`,

  java: `You are a STRICT Java code reviewer. You MUST evaluate whether the code ACTUALLY SOLVES the question.

Return JSON only: { "score": 0-100, "feedback": "string" }

CRITICAL RULE:
- If the code does NOT solve the specific problem asked, give 0-25 points MAXIMUM
- Having valid Java syntax and OOP structure is NOT enough — it must solve THE RIGHT PROBLEM

SCORING:
1. QUESTION MATCH (50 points): Does the code produce correct output for the specific problem? Correct algorithm?
2. CORRECTNESS (30 points): Would it compile and produce correct results? Edge cases?
3. CODE QUALITY (20 points): Naming, structure, OOP, error handling

REJECTION: Code that doesn't solve the problem gets ≤25.`,

  javascript: `You are a STRICT JavaScript code reviewer. You MUST evaluate whether the code ACTUALLY SOLVES the question.

Return JSON only: { "score": 0-100, "feedback": "string" }

CRITICAL RULE:
- If the code does NOT solve the specific problem asked, give 0-25 points MAXIMUM
- Having valid JavaScript syntax is NOT enough — it must solve THE RIGHT PROBLEM

SCORING:
1. QUESTION MATCH (50 points): Does the code produce correct output? Does it solve the specific problem?
2. CORRECTNESS (30 points): Does the logic work? Edge cases handled?
3. QUALITY (20 points): Modern JS, clean structure, proper error handling

REJECTION: Code that doesn't solve the problem gets ≤25.`,

  c: `You are a STRICT C/C++ code reviewer. You MUST evaluate whether the code ACTUALLY SOLVES the question.

Return JSON only: { "score": 0-100, "feedback": "string" }

CRITICAL RULE:
- If the code does NOT solve the specific problem asked, give 0-25 points MAXIMUM
- Having valid C syntax is NOT enough — it must solve THE RIGHT PROBLEM

SCORING:
1. QUESTION MATCH (50 points): Does the code produce correct output for the specific problem?
2. CORRECTNESS (30 points): Does it compile? Correct logic? Memory safety?
3. QUALITY (20 points): Naming, includes, proper main, no memory leaks

REJECTION: Code that doesn't solve the problem gets ≤25.`,

  default: `You are a STRICT programming code reviewer. You MUST evaluate whether the code ACTUALLY SOLVES the question.

Return JSON only: { "score": 0-100, "feedback": "string" }

CRITICAL RULE:
- If the code does NOT solve the specific problem asked, give 0-25 points MAXIMUM
- Having valid syntax is NOT enough — it must solve THE RIGHT PROBLEM

SCORING:
1. QUESTION MATCH (50 points): Does the code produce the correct result for what was specifically asked?
2. CORRECTNESS (30 points): Does the logic work? Edge cases handled?
3. QUALITY (20 points): Clean code, proper structure, good naming

REJECTION: Code that doesn't solve the specific problem gets ≤25.
- 80-100: Perfectly solves the question with clean code
- 60-79: Solves the question with minor issues
- 40-59: Partially solves it but missing key features
- 20-39: Has the right idea but implementation is wrong
- 0-19: Does NOT solve the question at all`,
};

function getAIPrompt(language) {
  const lang = (language || '').toLowerCase();
  return AI_EVAL_PROMPTS[lang] || AI_EVAL_PROMPTS.default;
}

async function aiEvaluate(studentCode, questionText, language, strictness, marks) {
  const systemPrompt = getAIPrompt(language);

  const strictNote = strictness === 'hard'
    ? '\n\nHARD MODE: Be extremely strict. Only give high scores for code that perfectly solves the question. Deduct heavily for any missing feature or incorrect implementation.'
    : strictness === 'easy'
    ? '\n\nEASY MODE: Be lenient on style/formatting but still require the code to actually solve the question. Code that produces the correct result gets decent scores.'
    : '\n\nMEDIUM MODE: Balanced evaluation. Code must solve the question correctly to get above 50 points.';

  const msgs = [
    { role: 'system', content: systemPrompt + strictNote },
    {
      role: 'user',
      content: `QUESTION: ${questionText}\n\nLANGUAGE: ${language}\n\nSTUDENT CODE:\n\`\`\`${language}\n${studentCode}\n\`\`\`\n\nEvaluate this code. Does it ACTUALLY solve the specific question asked? Return JSON with score (0-100) and feedback. Remember: code that doesn't address the question should score below 25.`
    }
  ];

  const raw = await callOpenAI(msgs);
  const cleaned = raw.replace(/^```json\n?/gm, '').replace(/```$/gm, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    score: Math.min(100, Math.max(0, Number(parsed.score || parsed.qualityScore) || 0)),
    feedback: String(parsed.feedback || ''),
  };
}

// ============================================================
// MAIN EVALUATION — never crashes
// ============================================================

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

    const shouldSkipExecution = isNonExec || looksLikeFrontendCode(studentCode);
    generatedSolution.push({ questionId: question._id, solution: '' });
    expectedOutput.push({ questionId: question._id, output: shouldSkipExecution ? '(N/A - frontend)' : '' });
    studentOutput.push({ questionId: question._id, output: '', error: '' });

    // Try AI evaluation first
    let qScore = 0;
    let feedback = '';
    let usedMethod = 'none';

    if (useAI) {
      try {
        let evalCode = studentCode;
        // For executable languages, try to run and include output in evaluation
        if (!shouldSkipExecution) {
          try {
            const result = await executeCode(studentCode, language);
            const out = result.stdout || '';
            const err = result.stderr || result.compileOutput || '';
            if (result.time) executionTime += Number(result.time) * 1000;
            if (result.memory && !memoryUsed) memoryUsed = `${result.memory} KB`;
            studentOutput[studentOutput.length - 1].output = out;
            studentOutput[studentOutput.length - 1].error = err;
            expectedOutput[expectedOutput.length - 1].output = out || '(no output)';
            if (err) evalCode += `\n\n// EXECUTION OUTPUT:\n// stdout: ${out}\n// stderr: ${err}`;
            else evalCode += `\n\n// EXECUTION OUTPUT:\n// stdout: ${out}`;
          } catch (execErr) {
            studentOutput[studentOutput.length - 1].error = execErr.message;
            evalCode += `\n\n// EXECUTION ERROR: ${execErr.message}`;
          }
        }
        const ai = await aiEvaluate(evalCode, question.questionText, language, strictness, marks);
        qScore = Math.round((ai.score / 100) * marks);
        feedback = ai.feedback;
        usedMethod = 'ai';
        console.log(`[AI-EVAL] Q${question._id}: AI=${ai.score}/100 → ${qScore}/${marks}`);
      } catch (err) {
        console.log(`[AI-EVAL] Q${question._id}: AI failed (${err.message})`);
        const h = analyzeCode(studentCode, language, question.questionText);
        qScore = Math.round((h.score / 100) * marks);
        feedback = `[Heuristic] ${h.feedback}`;
        usedMethod = 'heuristic';
        console.log(`[AI-EVAL] Q${question._id}: heuristic=${h.score}/100 → ${qScore}/${marks}`);
      }
    } else {
      // No AI — use heuristic
      if (!shouldSkipExecution) {
        try {
          const result = await executeCode(studentCode, language);
          const out = result.stdout || '';
          const err = result.stderr || result.compileOutput || '';
          if (result.time) executionTime += Number(result.time) * 1000;
          if (result.memory && !memoryUsed) memoryUsed = `${result.memory} KB`;
          studentOutput[studentOutput.length - 1].output = out;
          studentOutput[studentOutput.length - 1].error = err;
        } catch (execErr) {
          studentOutput[studentOutput.length - 1].error = execErr.message;
        }
      }
      const h = analyzeCode(studentCode, language, question.questionText);
      qScore = Math.round((h.score / 100) * marks);
      feedback = h.feedback;
      usedMethod = 'heuristic';
      console.log(`[AI-EVAL] Q${question._id}: heuristic=${h.score}/100 → ${qScore}/${marks}`);
    }

    totalScore += qScore;
    feedbacks.push(`Q: ${feedback}`);
  }

  const finalMarks = Math.min(totalScore, totalPossible);
  const pct = totalPossible > 0 ? Math.round((finalMarks / totalPossible) * 100) : 0;

  console.log(`[AI-EVAL] DONE: ${finalMarks}/${totalPossible} (${pct}%) [${useAI ? 'AI' : 'HEURISTIC'}]`);

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

function looksLikeFrontendCode(code) {
  if (!code) return false;
  return [
    /import.*from\s+['"]react['"]/, /className\s*=/, /useState|useEffect|useRef/,
    /<[A-Z]\w+/, /<div|<span|<button|<input|<form/, /<!DOCTYPE|<!doctype/,
    /<\/\w+>/, /export\s+default/, /style\s*=\s*\{\{/,
  ].some(p => p.test(code));
}

module.exports = {
  evaluateSubmission,
  analyzeCode,
  isNonExecutableLanguage,
  looksLikeFrontendCode,
  hasOpenAIKey,
};
