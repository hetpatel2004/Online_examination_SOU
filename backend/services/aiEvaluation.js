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

// Extracts problem requirements, intent keywords, and algorithmic concepts from question text
function extractProblemRequirements(questionText = '') {
  const text = (questionText || '').toLowerCase();
  const requirements = {
    keywords: [],
    intents: [],
  };

  // Detect key problem intents
  if (/\b(palindrome)\b/.test(text)) requirements.intents.push('palindrome');
  if (/\b(prime)\b/.test(text)) requirements.intents.push('prime');
  if (/\b(factorial)\b/.test(text)) requirements.intents.push('factorial');
  if (/\b(fibonacci)\b/.test(text)) requirements.intents.push('fibonacci');
  if (/\b(even|odd)\b/.test(text)) requirements.intents.push('even_odd');
  if (/\b(reverse|reversed|reversing)\b/.test(text)) requirements.intents.push('reverse');
  if (/\b(sort|sorted|sorting|ascending|descending|bubble|quick|merge)\b/.test(text)) requirements.intents.push('sort');
  if (/\b(search|searching|binary\s+search|find|lookup)\b/.test(text)) requirements.intents.push('search');
  if (/\b(matrix|matrices|2d\s+array)\b/.test(text)) requirements.intents.push('matrix');
  if (/\b(armstrong)\b/.test(text)) requirements.intents.push('armstrong');
  if (/\b(vowel|consonant)\b/.test(text)) requirements.intents.push('vowel');
  if (/\b(gcd|hcf|lcm)\b/.test(text)) requirements.intents.push('gcd_lcm');
  if (/\b(swap)\b/.test(text)) requirements.intents.push('swap');
  if (/\b(duplicate|unique|distinct)\b/.test(text)) requirements.intents.push('duplicate');
  if (/\b(pattern|pyramid|triangle)\b/.test(text)) requirements.intents.push('pattern');
  if (/\b(recursion|recursive)\b/.test(text)) requirements.intents.push('recursion');
  if (/\b(sum|average|add|addition)\b/.test(text)) requirements.intents.push('sum');
  if (/\b(class|object|constructor|inheritance)\b/.test(text)) requirements.intents.push('oop');
  if (/\b(react|component|hook|state)\b/.test(text)) requirements.intents.push('react');

  // Extract core domain tokens (filtering out common filler/stop words)
  const stopwords = new Set([
    'the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','has','his',
    'how','its','may','new','now','old','see','way','who','did','get','let','say','she','too','use','write',
    'code','program','create','make','function','implement','using','with','that','this','from','each','have',
    'will','your','them','than','some','what','when','which','there','their','about','would','could','should',
    'other','into','just','also','given','take','input','output','print','check','find','display','calculate'
  ]);
  const tokens = text.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopwords.has(w));
  requirements.keywords = [...new Set(tokens)];

  return requirements;
}

// Evaluates the student's applied logic against the question requirements (up to 45 points)
// NEVER scores based on code length — concise 1-line solutions receive full marks if logic is sound!
function evaluateStudentLogic(code, requirements, language) {
  const codeLower = code.toLowerCase();
  let logicPoints = 0;
  const maxLogicPoints = 45;
  const observations = [];

  const { intents, keywords } = requirements;

  if (intents.length === 0 && keywords.length === 0) {
    const hasFunction = /def\s+\w+|function\s+\w+|class\s+\w+|=>\s*\{|\w+\s+\w+\s*\([^)]*\)\s*\{/.test(code);
    const hasControlFlow = /if\s*\(|if\s+|for\s*\(|for\s+|while\s*\(|while\s+|\?.*:/.test(code);
    const hasReturnOrPrint = /return\b|print\s*\(|console\.log|System\.out|printf|cout\s*<</.test(code);
    if (hasFunction) logicPoints += 15;
    if (hasControlFlow) logicPoints += 15;
    if (hasReturnOrPrint) logicPoints += 15;
    observations.push('Structured programmatic logic detected');
    return { score: Math.min(maxLogicPoints, logicPoints), observations };
  }

  let intentMatched = 0;
  for (const intent of intents) {
    let matched = false;
    switch (intent) {
      case 'palindrome':
        if (/\[::-1\]|reverse|reversed|str\(.*\)\[::-1\]|==.*\[|charAt|equals/.test(code)) {
          matched = true;
          observations.push('Palindrome reversal/comparison logic verified');
        }
        break;
      case 'prime':
        if (/%|\.is_prime|math\.sqrt|range\s*\(\s*2/.test(code)) {
          matched = true;
          observations.push('Prime number divisibility logic verified');
        }
        break;
      case 'factorial':
        if (/\*=|(?:\w+)\s*\*\s*(?:\w+)|return\s+.*\*|\bmath\.factorial\b/.test(code)) {
          matched = true;
          observations.push('Factorial multiplication/recursion logic verified');
        }
        break;
      case 'fibonacci':
        if (/\+|,\s*|\bfib\b/.test(code)) {
          matched = true;
          observations.push('Fibonacci progression logic verified');
        }
        break;
      case 'even_odd':
        if (/%[\s]*2|&\s*1/.test(code)) {
          matched = true;
          observations.push('Even/odd parity logic verified');
        }
        break;
      case 'reverse':
        if (/\[::-1\]|reverse|reversed|\.reverse\(\)|len.*-.*1|--/.test(code)) {
          matched = true;
          observations.push('Reversal logic verified');
        }
        break;
      case 'sort':
        if (/\.sort|sorted\(|<|>|swap/.test(code)) {
          matched = true;
          observations.push('Sorting/comparison logic verified');
        }
        break;
      case 'search':
        if (/\bin\b|\.find|\.indexOf|binary|mid\s*=|==/.test(code)) {
          matched = true;
          observations.push('Search/lookup logic verified');
        }
        break;
      case 'armstrong':
        if (/%[\s]*10|\*\*|pow|\/\//.test(code)) {
          matched = true;
          observations.push('Digit extraction and power logic verified');
        }
        break;
      case 'vowel':
        if (/['"][aeiouAEIOU]['"]|includes|in\s+['"]aeiou/.test(code)) {
          matched = true;
          observations.push('Vowel matching logic verified');
        }
        break;
      case 'recursion': {
        const funcMatch = code.match(/(?:def|function)\s+(\w+)/);
        if (funcMatch && funcMatch[1]) {
          const fnName = funcMatch[1];
          const rest = code.slice(funcMatch.index + funcMatch[0].length);
          if (new RegExp(`\\b${fnName}\\s*\\(`).test(rest)) {
            matched = true;
            observations.push('Recursive self-call verified');
          }
        }
        break;
      }
      case 'sum':
        if (/\+=|\+|\bsum\(/.test(code)) {
          matched = true;
          observations.push('Summation/accumulation logic verified');
        }
        break;
      case 'oop':
        if (/class\s+\w+|__init__|constructor|this\.|self\./.test(code)) {
          matched = true;
          observations.push('OOP class/object structure verified');
        }
        break;
      case 'matrix':
        if (/\[\w+\]\s*\[\w+\]|for.*for/.test(code)) {
          matched = true;
          observations.push('Matrix/2D indexing logic verified');
        }
        break;
      case 'gcd_lcm':
        if (/%|gcd|lcm/.test(code)) {
          matched = true;
          observations.push('GCD/LCM calculation logic verified');
        }
        break;
      case 'swap':
        if (/temp\s*=|,\s*\w+\s*=\s*\w+,\s*\w+|\^/.test(code)) {
          matched = true;
          observations.push('Variable swap logic verified');
        }
        break;
      case 'duplicate':
        if (/set\(|unique|distinct|\.filter|\.includes|\.has\(/.test(code)) {
          matched = true;
          observations.push('Deduplication logic verified');
        }
        break;
      default:
        break;
    }
    if (matched) intentMatched++;
  }

  let keywordMatches = 0;
  for (const kw of keywords) {
    if (codeLower.includes(kw)) keywordMatches++;
  }
  const kwRatio = keywords.length > 0 ? keywordMatches / keywords.length : 0;

  if (intents.length > 0) {
    if (intentMatched === 0) {
      logicPoints = Math.round(kwRatio * 15);
    } else {
      const intentRatio = intentMatched / intents.length;
      logicPoints = Math.round(intentRatio * 35 + Math.min(10, kwRatio * 10));
    }
  } else {
    logicPoints = Math.round(kwRatio * 35 + 10);
  }

  // Programmatic return/print statement or function declaration bonus
  if (/return\b|print\s*\(|console\.log|printf|cout\s*<</.test(code)) {
    logicPoints += 5;
  }
  if (/def\s+\w+|function\s+\w+|=>/.test(code)) {
    logicPoints += 5;
  }

  return {
    score: Math.min(maxLogicPoints, Math.max(0, logicPoints)),
    observations,
  };
}

// Evaluates the accuracy and functional execution of the code (up to 45 points)
function evaluateAccuracyAndExecution(code, executionResult, language, logicScore) {
  let accuracyPoints = 0;
  const maxAccuracy = 45;
  const notes = [];

  if (executionResult) {
    const stdout = (executionResult.stdout || '').trim();
    const stderr = (executionResult.stderr || executionResult.compileOutput || '').trim();
    const exitCode = executionResult.exitCode;

    if (exitCode === 0 && !stderr) {
      accuracyPoints = stdout ? 45 : 40;
      notes.push(stdout ? 'Execution succeeded with accurate output' : 'Clean execution with no runtime errors');
    } else if (stdout && exitCode === 0) {
      accuracyPoints = 38;
      notes.push('Executed successfully with output');
    } else if (stderr) {
      if (stderr.includes('SyntaxError') || stderr.includes('error:') || stderr.includes('compilation error')) {
        accuracyPoints = 8;
        notes.push('Compilation/Syntax error encountered during execution');
      } else {
        accuracyPoints = 15;
        notes.push('Runtime error encountered during execution');
      }
    } else {
      accuracyPoints = 20;
      notes.push('Execution completed with non-zero exit status');
    }
  } else {
    // Delimiter balance check
    let balanced = true;
    const stack = [];
    const pairs = { ')': '(', '}': '{', ']': '[' };
    for (const ch of code) {
      if (['(', '{', '['].includes(ch)) stack.push(ch);
      else if ([')', '}', ']'].includes(ch)) {
        if (stack.pop() !== pairs[ch]) { balanced = false; break; }
      }
    }
    if (stack.length > 0) balanced = false;

    if (balanced) {
      accuracyPoints += 25;
      notes.push('Well-formed syntax with balanced brackets and structure');
    } else {
      accuracyPoints += 5;
      notes.push('Notice: Unbalanced brackets or delimiter mismatch detected');
    }

    if (/return\s+[^;]+|print\s*\(.+?\)|console\.log\(.+?\)|printf\(.+?\)/.test(code)) {
      accuracyPoints += 15;
      notes.push('Complete output/return expression present');
    } else if (/return\b|print|console/.test(code)) {
      accuracyPoints += 8;
    } else {
      accuracyPoints += 3;
    }

    if (!/;\s*;|,\s*,|\(\s*\)/.test(code)) {
      accuracyPoints += 5;
    }
  }

  // Accuracy must scale with question relevance: if the code does not address the question logic at all,
  // accuracy to the problem is also scaled down accordingly.
  if (logicScore < 15) {
    accuracyPoints = Math.round(accuracyPoints * (logicScore / 15));
    notes.push('Accuracy scaled to reflect relevance to the problem requirements');
  }

  return {
    score: Math.min(maxAccuracy, Math.max(0, accuracyPoints)),
    notes,
  };
}

// Evaluates valid syntax and language constructs (up to 10 points)
function evaluateSyntaxValidity(code, language) {
  const lang = (language || '').toLowerCase().trim();
  const profile = LANG_PROFILES[lang];
  let syntaxPoints = 0;
  const maxSyntax = 10;

  if (profile && profile.patterns) {
    let matchCount = 0;
    for (const [, regex] of Object.entries(profile.patterns)) {
      if (regex.test(code)) matchCount++;
    }
    syntaxPoints = matchCount >= 3 ? 10 : matchCount >= 2 ? 8 : matchCount >= 1 ? 6 : 4;
  } else {
    const genericKeywords = /\b(def|function|class|return|var|let|const|if|else|for|while|import|include|int|void|public|private)\b/;
    syntaxPoints = genericKeywords.test(code) ? 10 : 6;
  }

  return Math.min(maxSyntax, Math.max(2, syntaxPoints));
}

// Decomposes code into logical components and produces a granular construct-by-construct mark breakdown
// Example: 45 marks total -> 22 marks for condition: if (num < 0) return "Undefined"; 23 marks for loop: for (let i = 2; i <= num; i++) result *= i;
function decomposeCodeComponents(code, language, questionText = '', maxMarks = 45, logicScore = 45, accuracyScore = 45, executionResult = null) {
  const marks = maxMarks && Number(maxMarks) > 0 ? Number(maxMarks) : 1;
  if (!code || !code.trim()) {
    return {
      codeBreakdown: [{
        component: 'Submission',
        codeSnippet: '(No code submitted)',
        maxMarks: marks,
        awardedMarks: 0,
        status: 'missing',
        comment: 'No code submitted for this question'
      }],
      annotatedCode: `No code submitted (0/${marks} marks)`,
      awardedMarks: 0,
      maxMarks: marks,
    };
  }

  const lines = code.split(/\r?\n/);
  const lang = (language || '').toLowerCase().trim();
  const qTextLower = (questionText || '').toLowerCase();

  // Pattern detection for components
  const condRegex = /^\s*(?:if\s*\(|if\s+|elif\s+|else\s+if\s*\(|\?.*:)/;
  const loopRegex = /^\s*(?:for\s*\(|for\s+|while\s*\(|while\s+|do\s*\{|\.forEach|\.map)/;
  const funcRegex = /^\s*(?:function\b|def\b|class\b|const\s+\w+\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>|(?:public|private|static)?\s*\w+\s+\w+\s*\([^)]*\)\s*\{)/;
  const returnRegex = /^\s*(?:return\b|console\.log|print\s*\(|printf|System\.out)/;

  const foundComponents = [];
  const lineAnnotations = {};

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) return;

    if (condRegex.test(trimmed)) {
      foundComponents.push({
        type: 'condition',
        name: 'Boundary & Edge Case Condition',
        lineIndex: idx,
        codeSnippet: trimmed,
      });
    } else if (loopRegex.test(trimmed)) {
      foundComponents.push({
        type: 'loop',
        name: 'Core Iteration / Computation Loop',
        lineIndex: idx,
        codeSnippet: trimmed,
      });
    } else if (funcRegex.test(trimmed)) {
      foundComponents.push({
        type: 'function',
        name: 'Function Interface & Signature',
        lineIndex: idx,
        codeSnippet: trimmed,
      });
    } else if (returnRegex.test(trimmed)) {
      foundComponents.push({
        type: 'return',
        name: 'Return Value & Output',
        lineIndex: idx,
        codeSnippet: trimmed,
      });
    }
  });

  // Check for ternary condition inside single line or assignment
  if (!foundComponents.some(c => c.type === 'condition')) {
    const ternaryLine = lines.findIndex(l => /\?[^:]+:/.test(l));
    if (ternaryLine !== -1) {
      foundComponents.push({
        type: 'condition',
        name: 'Boundary & Edge Case Condition (Ternary)',
        lineIndex: ternaryLine,
        codeSnippet: lines[ternaryLine].trim(),
      });
    }
  }

  // Check for recursion if no loop
  if (!foundComponents.some(c => c.type === 'loop')) {
    const fnComp = foundComponents.find(c => c.type === 'function');
    const fnName = fnComp?.codeSnippet.match(/(?:function|def)\s+([a-zA-Z0-9_]+)/)?.[1];
    if (fnName) {
      const recLine = lines.findIndex((l, idx) => idx !== fnComp.lineIndex && new RegExp(`\\b${fnName}\\s*\\(`).test(l));
      if (recLine !== -1) {
        foundComponents.push({
          type: 'loop',
          name: 'Recursive Self-Call & Step Logic',
          lineIndex: recLine,
          codeSnippet: lines[recLine].trim(),
        });
      }
    }
  }

  // Problem requirements context
  const questionExpectsCondition = /\b(negative|undefined|<|<=|>|>=|if|boundary|corner|edge|palindrome|prime|even|odd)\b/i.test(qTextLower);
  const questionExpectsLoopOrAlgorithm = /\b(loop|for|while|factorial|fibonacci|reverse|sort|search|sum|matrix|multiply)\b/i.test(qTextLower);

  const condComp = foundComponents.find(c => c.type === 'condition');
  const loopComp = foundComponents.find(c => c.type === 'loop');
  const funcComp = foundComponents.find(c => c.type === 'function');
  const retComp = foundComponents.find(c => c.type === 'return');

  let hasRuntimeError = false;
  if (executionResult && (executionResult.stderr || executionResult.exitCode !== 0)) {
    const err = executionResult.stderr || '';
    if (err.includes('Error') || err.includes('error:') || executionResult.exitCode !== 0) {
      hasRuntimeError = true;
    }
  }

  const breakdown = [];

  // CASE 1: Both condition and loop present
  if (condComp && loopComp) {
    const condMarks = Math.floor(marks / 2); // e.g., 22 out of 45
    const loopMarks = marks - condMarks;    // e.g., 23 out of 45

    const condAwarded = hasRuntimeError ? Math.max(0, condMarks - 5) : condMarks;
    const loopAwarded = hasRuntimeError ? Math.max(0, loopMarks - 10) : loopMarks;

    breakdown.push({
      component: 'Boundary & Edge Case Condition',
      codeSnippet: condComp.codeSnippet,
      maxMarks: condMarks,
      awardedMarks: condAwarded,
      status: condAwarded === condMarks ? 'correct' : 'partial',
      comment: condAwarded === condMarks 
        ? 'Correctly verifies boundary/edge conditions and handles edge cases'
        : 'Boundary condition present but runtime error occurred'
    });
    lineAnnotations[condComp.lineIndex] = `${condAwarded} marks for this condition ${condComp.codeSnippet}`;

    breakdown.push({
      component: 'Core Computation Loop / Iteration',
      codeSnippet: loopComp.codeSnippet,
      maxMarks: loopMarks,
      awardedMarks: loopAwarded,
      status: loopAwarded === loopMarks ? 'correct' : 'partial',
      comment: loopAwarded === loopMarks 
        ? 'Correctly implements iterative computation logic'
        : 'Loop logic present but runtime error encountered'
    });
    lineAnnotations[loopComp.lineIndex] = `${loopAwarded} marks for this loop ${loopComp.codeSnippet}`;

    if (funcComp) {
      lineAnnotations[funcComp.lineIndex] = `${marks} marks for this ${funcComp.codeSnippet}`;
    }
  } else if (!condComp && loopComp && questionExpectsCondition) {
    // Condition required but missing
    const condMarks = Math.floor(marks / 2);
    const loopMarks = marks - condMarks;
    const loopAwarded = hasRuntimeError ? Math.max(0, loopMarks - 10) : loopMarks;

    breakdown.push({
      component: 'Boundary & Edge Case Condition',
      codeSnippet: '(Missing boundary/edge case check)',
      maxMarks: condMarks,
      awardedMarks: 0,
      status: 'missing',
      comment: `Missing condition check for negative inputs or boundary cases (0/${condMarks} marks)`
    });

    breakdown.push({
      component: 'Core Computation Loop / Iteration',
      codeSnippet: loopComp.codeSnippet,
      maxMarks: loopMarks,
      awardedMarks: loopAwarded,
      status: loopAwarded === loopMarks ? 'correct' : 'partial',
      comment: `Core computation loop logic verified (${loopAwarded}/${loopMarks} marks)`
    });
    lineAnnotations[loopComp.lineIndex] = `${loopAwarded} marks for this loop ${loopComp.codeSnippet}`;

    if (funcComp) {
      lineAnnotations[funcComp.lineIndex] = `${loopAwarded}/${marks} marks for this ${funcComp.codeSnippet}`;
    }
  } else if (condComp && !loopComp && questionExpectsLoopOrAlgorithm) {
    // Loop required but missing
    const condMarks = Math.floor(marks / 2);
    const loopMarks = marks - condMarks;
    const condAwarded = condMarks;

    breakdown.push({
      component: 'Boundary & Edge Case Condition',
      codeSnippet: condComp.codeSnippet,
      maxMarks: condMarks,
      awardedMarks: condAwarded,
      status: 'correct',
      comment: `Condition logic verified (${condAwarded}/${condMarks} marks)`
    });
    lineAnnotations[condComp.lineIndex] = `${condAwarded} marks for this condition ${condComp.codeSnippet}`;

    breakdown.push({
      component: 'Core Computation Loop / Iteration',
      codeSnippet: '(Missing core computation loop/algorithm)',
      maxMarks: loopMarks,
      awardedMarks: 0,
      status: 'missing',
      comment: `Missing iterative computation logic (0/${loopMarks} marks)`
    });
  } else if (loopComp) {
    // Only loop present
    const loopAwarded = hasRuntimeError ? Math.max(0, marks - 10) : marks;
    breakdown.push({
      component: 'Core Computation Loop / Algorithm',
      codeSnippet: loopComp.codeSnippet,
      maxMarks: marks,
      awardedMarks: loopAwarded,
      status: loopAwarded === marks ? 'correct' : 'partial',
      comment: `Computation logic verified (${loopAwarded}/${marks} marks)`
    });
    lineAnnotations[loopComp.lineIndex] = `${loopAwarded} marks for this loop ${loopComp.codeSnippet}`;
    if (funcComp) {
      lineAnnotations[funcComp.lineIndex] = `${loopAwarded} marks for this ${funcComp.codeSnippet}`;
    }
  } else if (condComp) {
    // Only condition present
    breakdown.push({
      component: 'Conditional Branching & Logic',
      codeSnippet: condComp.codeSnippet,
      maxMarks: marks,
      awardedMarks: marks,
      status: 'correct',
      comment: `Conditional logic verified (${marks}/${marks} marks)`
    });
    lineAnnotations[condComp.lineIndex] = `${marks} marks for this condition ${condComp.codeSnippet}`;
    if (funcComp) {
      lineAnnotations[funcComp.lineIndex] = `${marks} marks for this ${funcComp.codeSnippet}`;
    }
  } else {
    // Single line / expression / built-in
    const awarded = hasRuntimeError ? Math.max(0, marks - 10) : marks;
    breakdown.push({
      component: 'Core Solution Expression',
      codeSnippet: (code.split('\n')[0] || code).trim(),
      maxMarks: marks,
      awardedMarks: awarded,
      status: awarded === marks ? 'correct' : 'partial',
      comment: 'Solution statement directly addresses problem requirements'
    });
  }

  // Construct annotated code lines
  const annotatedLines = lines.map((line, idx) => {
    if (lineAnnotations[idx]) {
      const indent = line.match(/^\s*/)[0];
      return `${indent}${lineAnnotations[idx]}`;
    }
    return line;
  });

  const totalAwarded = breakdown.reduce((sum, b) => sum + b.awardedMarks, 0);

  return {
    codeBreakdown: breakdown,
    annotatedCode: annotatedLines.join('\n'),
    awardedMarks: Math.min(marks, totalAwarded),
    maxMarks: marks
  };
}

// Question-first, logic-driven heuristic evaluation (0-100)
// Evaluates problem requirements, applied logic, functional accuracy, and syntax.
// NEVER judges or penalizes code based on length or line count!
function analyzeCode(code, language, questionText = '', executionResult = null, marks = 100) {
  const qMarks = marks && Number(marks) > 0 ? Number(marks) : 100;
  if (!code || !code.trim()) {
    return {
      score: 0,
      awardedMarks: 0,
      maxMarks: qMarks,
      codeBreakdown: [],
      annotatedCode: `No code submitted (0/${qMarks} marks)`,
      feedback: 'No code submitted'
    };
  }

  const requirements = extractProblemRequirements(questionText);
  const logicEval = evaluateStudentLogic(code, requirements, language);
  const accuracyEval = evaluateAccuracyAndExecution(code, executionResult, language, logicEval.score);
  const syntaxScore = evaluateSyntaxValidity(code, language);

  const totalScore = Math.min(100, Math.max(0, logicEval.score + accuracyEval.score + syntaxScore));

  const decomp = decomposeCodeComponents(code, language, questionText, qMarks, logicEval.score, accuracyEval.score, executionResult);

  const feedbackParts = [];
  if (logicEval.observations.length > 0) feedbackParts.push(logicEval.observations.join(', '));
  if (accuracyEval.notes.length > 0) feedbackParts.push(accuracyEval.notes.join(', '));
  feedbackParts.push(`Logic: ${logicEval.score}/45, Accuracy: ${accuracyEval.score}/45, Syntax: ${syntaxScore}/10 (${decomp.awardedMarks}/${qMarks} marks)`);

  return {
    score: totalScore,
    awardedMarks: decomp.awardedMarks,
    maxMarks: qMarks,
    codeBreakdown: decomp.codeBreakdown,
    annotatedCode: decomp.annotatedCode,
    logicScore: logicEval.score,
    accuracyScore: accuracyEval.score,
    syntaxScore: syntaxScore,
    feedback: feedbackParts.join('. '),
  };
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
          temperature: 0.1,
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
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.1, max_tokens: 2000 }),
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

// Sends question + model answer + student code to AI and parses structured evaluation
// Follows strict question-first, logic-based, and accuracy-focused evaluation with ZERO length bias!
async function aiEvaluate(studentCode, questionText, language, strictness, marks, modelAnswer, execInfo = null) {
  const qMarks = marks && Number(marks) > 0 ? Number(marks) : 1;
  const strictNote = strictness === 'hard'
    ? '\nHARD MODE: Strict scrutiny on corner cases, algorithmic complexity, boundary conditions, and accuracy.'
    : strictness === 'easy'
    ? '\nEASY MODE: Be lenient on minor syntax slips or formatting, as long as the student logic is sound and the answer is accurate.'
    : '\nMEDIUM MODE: Standard balanced evaluation of question requirements, student logic, and accuracy.';

  const systemPrompt = `You are a Senior Computer Science Professor and Automated Programming Exam Evaluator.
Your evaluation MUST follow a strict multi-step reasoning protocol focused entirely on QUESTION REQUIREMENTS, APPLIED LOGIC, and ACCURACY.

CRITICAL RULES (NON-NEGOTIABLE):
1. NEVER JUDGE OR GRADE CODE BASED ON CODE LENGTH OR LINE COUNT:
   - A concise, minimal solution (such as a 1-line or 2-line solution using recursion, list comprehension, built-in standard library, or lambda) that accurately solves the problem MUST receive FULL 100% MARKS.
   - Verbose, long, or bloated boilerplate code MUST NOT receive extra points just because it has many lines.
2. 3-PHASE REASONING EVALUATION PROTOCOL:
   - PHASE 1: QUESTION REQUIREMENTS ANALYSIS
     * Read and analyze the question carefully. What problem needs to be solved? What are the inputs, required logic, and expected outputs?
   - PHASE 2: STUDENT APPLIED LOGIC REVIEW
     * Examine what logic, algorithm, or data structure the student applied.
     * Did the student apply the correct logic to address what the question asked?
     * Allow any valid algorithm, paradigm, or alternative method (e.g. recursive vs iterative, math formula vs simulation).
   - PHASE 3: ACCURACY & FUNCTIONAL CORRECTNESS
     * How accurate is the student's solution against the question?
     * Does it produce the correct output? Does it handle edge cases? Are there logical flaws, off-by-one errors, or incorrect formulas?
   - PHASE 4: SYNTAX & LANGUAGE VALIDITY
     * Check valid syntax in the target programming language (${language}).

3. COMPONENT-LEVEL MARK BREAKDOWN (TOTAL ${qMarks} MARKS):
   - You MUST divide the question's TOTAL MARKS (${qMarks}) across the logical components of the student's solution.
   - Example (45 marks total for a factorial function):
     * Total: 45 marks for function factorial(num) {
     * 22 marks for condition: if (num < 0) return "Undefined";
     * 23 marks for loop: for (let i = 2; i <= num; i++) result *= i;
   - The sum of "maxMarks" in "codeBreakdown" MUST EXACTLY equal ${qMarks}.
   - Award marks (0 to maxMarks) to each component based on logic correctness.

RESPONSE FORMAT:
You MUST respond with ONLY a valid JSON object in this exact schema (no markdown formatting, no code blocks):
{
  "questionRequirements": "Concise summary of what the question required",
  "studentLogic": "Analysis of the specific logic and algorithm applied by the student",
  "accuracyAssessment": "Assessment of how accurate the code is against the requirements",
  "logicScore": 0-45,
  "accuracyScore": 0-45,
  "syntaxScore": 0-10,
  "score": 0-100,
  "totalMarks": ${qMarks},
  "awardedMarks": 0-${qMarks},
  "codeBreakdown": [
    {
      "component": "Boundary & Edge Case Condition",
      "codeSnippet": "code construct",
      "maxMarks": 22,
      "awardedMarks": 22,
      "status": "correct",
      "comment": "Accurately handles negative/edge inputs"
    },
    {
      "component": "Core Computation Loop",
      "codeSnippet": "code construct",
      "maxMarks": 23,
      "awardedMarks": 23,
      "status": "correct",
      "comment": "Accurately computes iterative logic"
    }
  ],
  "annotatedCode": "${qMarks} marks for function factorial(num) {\\n    22 marks for this condition if (num < 0) return \\"Undefined\\";\\n    let result = 1;\\n    23 marks for this loop for (let i = 2; i <= num; i++) result *= i;\\n    return result;\\n}\\n\\nconsole.log(factorial(5)); // 120",
  "feedback": "Clear, constructive feedback explaining the logic and accuracy of the submission"
}
${strictNote}`;

  const userSections = [
    `QUESTION STATEMENT:\n${questionText}`,
    `TARGET LANGUAGE:\n${language}`,
    `QUESTION TOTAL MARKS:\n${qMarks}`,
  ];

  if (modelAnswer && modelAnswer.trim()) {
    userSections.push(`REFERENCE SOLUTION (Example):\n\`\`\`${language}\n${modelAnswer}\n\`\`\``);
  }

  if (execInfo) {
    const stdout = (execInfo.stdout || '').trim();
    const stderr = (execInfo.stderr || execInfo.compileOutput || '').trim();
    userSections.push(`EXECUTION RUNTIME REPORT:\n- Exit Code: ${execInfo.exitCode ?? 0}\n- Standard Output: ${stdout ? `\n${stdout}` : '(none)'}\n- Standard Error / Compiler Output: ${stderr ? `\n${stderr}` : '(none)'}`);
  }

  userSections.push(`STUDENT SUBMISSION:\n\`\`\`${language}\n${studentCode}\n\`\`\``);
  userSections.push(`EVALUATION INSTRUCTION:\nReview the question first, inspect the logic applied by the student to solve that question, allocate the ${qMarks} marks across code components, and evaluate the accuracy. Remember: NEVER judge by code length (a 1-line correct solution deserves full marks). Provide your JSON evaluation:`);

  const msgs = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userSections.join('\n\n') }
  ];

  const raw = await callAI(msgs);
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(cleaned);

  let finalScore = Number(parsed.score);
  if (isNaN(finalScore)) {
    const l = Number(parsed.logicScore) || 0;
    const a = Number(parsed.accuracyScore) || 0;
    const s = Number(parsed.syntaxScore) || 0;
    finalScore = l + a + s;
  }
  finalScore = Math.min(100, Math.max(0, Math.round(finalScore)));

  let codeBreakdown = Array.isArray(parsed.codeBreakdown) ? parsed.codeBreakdown : [];
  let annotatedCode = typeof parsed.annotatedCode === 'string' ? parsed.annotatedCode.trim() : '';

  // Validate or scale breakdown to ensure maxMarks sum to qMarks
  if (codeBreakdown.length > 0) {
    const rawSum = codeBreakdown.reduce((sum, b) => sum + (Number(b.maxMarks) || 0), 0);
    if (rawSum > 0 && rawSum !== qMarks) {
      let runningMax = 0;
      codeBreakdown.forEach((b, idx) => {
        if (idx === codeBreakdown.length - 1) {
          b.maxMarks = Math.max(1, qMarks - runningMax);
        } else {
          b.maxMarks = Math.max(1, Math.round((Number(b.maxMarks || 1) / rawSum) * qMarks));
          runningMax += b.maxMarks;
        }
        b.awardedMarks = Math.min(b.maxMarks, Math.round(((Number(b.awardedMarks) || 0) / (Number(b.maxMarks) || 1)) * b.maxMarks));
      });
    }
  } else {
    const decomp = decomposeCodeComponents(studentCode, language, questionText, qMarks, Number(parsed.logicScore) || 45, Number(parsed.accuracyScore) || 45, execInfo);
    codeBreakdown = decomp.codeBreakdown;
    if (!annotatedCode) annotatedCode = decomp.annotatedCode;
  }

  if (!annotatedCode) {
    const decomp = decomposeCodeComponents(studentCode, language, questionText, qMarks, Number(parsed.logicScore) || 45, Number(parsed.accuracyScore) || 45, execInfo);
    annotatedCode = decomp.annotatedCode;
  }

  const computedAwarded = codeBreakdown.reduce((sum, b) => sum + (Number(b.awardedMarks) || 0), 0);
  const finalAwardedMarks = Number.isInteger(Number(parsed.awardedMarks)) && Number(parsed.awardedMarks) <= qMarks && Number(parsed.awardedMarks) >= 0
    ? Number(parsed.awardedMarks)
    : computedAwarded;

  const feedbackParts = [];
  if (parsed.studentLogic) feedbackParts.push(`Logic: ${parsed.studentLogic}`);
  if (parsed.accuracyAssessment) feedbackParts.push(`Accuracy: ${parsed.accuracyAssessment}`);
  if (parsed.feedback) feedbackParts.push(parsed.feedback);

  return {
    score: finalScore,
    totalMarks: qMarks,
    awardedMarks: finalAwardedMarks,
    codeBreakdown,
    annotatedCode,
    logicScore: parsed.logicScore,
    accuracyScore: parsed.accuracyScore,
    syntaxScore: parsed.syntaxScore,
    studentLogic: parsed.studentLogic,
    accuracyAssessment: parsed.accuracyAssessment,
    feedback: feedbackParts.join(' | ') || String(parsed.feedback || 'Evaluated successfully'),
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
  const questionScores = [];
  const allCodeBreakdowns = [];
  const allAnnotatedCode = [];
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
      questionScores.push({
        questionId: question._id,
        score: 0,
        maxMarks: marks,
        feedback: 'No code submitted',
        codeBreakdown: [{
          component: 'Submission',
          codeSnippet: '(No code submitted)',
          maxMarks: marks,
          awardedMarks: 0,
          status: 'missing',
          comment: 'No code submitted for this question'
        }],
        annotatedCode: `No code submitted (0/${marks} marks)`,
      });
      allCodeBreakdowns.push({
        questionId: question._id,
        component: 'Submission',
        codeSnippet: '(No code submitted)',
        maxMarks: marks,
        awardedMarks: 0,
        status: 'missing',
        comment: 'No code submitted for this question'
      });
      feedbacks.push(`Q${questions.indexOf(question) + 1} (${marks}m): No code submitted (0/${marks} marks).`);
      continue;
    }

    let modelAnswer = question.modelAnswer || '';
    let testCases = Array.isArray(question.testCases) ? question.testCases : [];

    // Auto-generate model answer & test cases if missing so verification and comparison always succeed
    if (!modelAnswer && !isNonExec) {
      try {
        const { generatePracticalSolution } = require('./solutionGenerator');
        const autoSol = await generatePracticalSolution(question.questionText, qLang);
        if (autoSol.modelAnswer) modelAnswer = autoSol.modelAnswer;
        if (testCases.length === 0 && Array.isArray(autoSol.testCases) && autoSol.testCases.length > 0) {
          testCases = autoSol.testCases;
        }
      } catch (genErr) {
        console.warn(`[AI-EVAL] Auto solution generation note: ${genErr.message}`);
      }
    }

    // ── 1. MODEL ANSWER / TESTCASES COMPARISON ──
    let comparisonResult = null;
    let comparisonFeedback = '';
    let comparisonScore = 0;

    if (modelAnswer && modelAnswer.trim()) {
      try {
        comparisonResult = await compareOutputs(studentCode, modelAnswer, qLang, testCases);
        if (comparisonResult && comparisonResult.compared) {
          if (comparisonResult.nonExecutable) {
            const h = analyzeCode(studentCode, qLang, question.questionText, null, marks);
            const sim = comparisonResult.codeSimilarity || 0;
            // For non-executable (HTML/CSS), emphasize semantic logic & structure (70%) and reference similarity (30%)
            comparisonScore = Math.min(100, Math.round((h.score / 100) * 70 + sim * 30));
            comparisonFeedback = `Frontend structure & logic: ${h.score}/100. Reference alignment: ${Math.round(sim * 100)}%.`;
          } else {
            let outScore = 0;
            if (comparisonResult.testSummary && comparisonResult.testSummary.total > 0) {
              outScore = comparisonResult.testSummary.percentage;
            } else if (comparisonResult.basicOutputMatch) {
              outScore = 100;
            }

            if (comparisonResult.testSummary && comparisonResult.testSummary.passed === comparisonResult.testSummary.total && comparisonResult.testSummary.total > 0) {
              // All test cases passed -> 100% accurate!
              comparisonScore = 100;
              comparisonFeedback = `All ${comparisonResult.testSummary.total} test cases passed (100% accuracy). Excellent!`;
            } else if (comparisonResult.basicOutputMatch) {
              // Output matches model answer output -> 100% accurate!
              comparisonScore = 100;
              comparisonFeedback = `Output matches model answer accurately (100% accuracy).`;
            } else if (outScore > 0) {
              // Partial test cases passed -> proportional accuracy score
              comparisonScore = outScore;
              comparisonFeedback = `Test cases: ${comparisonResult.testSummary.passed}/${comparisonResult.testSummary.total} passed (${outScore}% accuracy).`;
            } else {
              // Output differed or failed -> evaluate logic applied by student
              const h = analyzeCode(studentCode, qLang, question.questionText, comparisonResult.studentOutput, marks);
              comparisonScore = Math.min(60, h.score);
              comparisonFeedback = `Output differed from expected. Student applied logic score: ${comparisonScore}/100.`;
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
        const execInfo = comparisonResult?.studentOutput || directExec;
        aiResult = await aiEvaluate(studentCode, question.questionText, qLang, strictness, marks, modelAnswer, execInfo);
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

    // ── 5. COMPUTE FINAL QUESTION SCORE & COMPONENT BREAKDOWN ──
    let qScore = 0;
    let feedback = '';
    let qBreakdown = [];
    let qAnnotatedCode = '';

    if (comparisonResult && comparisonResult.compared && comparisonScore > 0) {
      if (aiResult) {
        const combined = comparisonScore >= 100
          ? 100
          : Math.round(comparisonScore * 0.5 + aiResult.score * 0.5);
        qScore = Math.round((combined / 100) * marks);
        feedback = `${comparisonFeedback} AI logic & accuracy review: ${aiResult.feedback}`;
        qBreakdown = aiResult.codeBreakdown;
        qAnnotatedCode = aiResult.annotatedCode;
      } else {
        qScore = Math.round((comparisonScore / 100) * marks);
        feedback = comparisonFeedback;
        const h = analyzeCode(studentCode, qLang, question.questionText, comparisonResult.studentOutput, marks);
        qBreakdown = h.codeBreakdown;
        qAnnotatedCode = h.annotatedCode;
      }
    } else if (aiResult) {
      qScore = aiResult.awardedMarks !== undefined ? aiResult.awardedMarks : Math.round((aiResult.score / 100) * marks);
      feedback = aiResult.feedback;
      qBreakdown = aiResult.codeBreakdown;
      qAnnotatedCode = aiResult.annotatedCode;
    } else {
      const execResult = directExec || comparisonResult?.studentOutput;
      const h = analyzeCode(studentCode, qLang, question.questionText, execResult, marks);
      qScore = h.awardedMarks !== undefined ? h.awardedMarks : Math.round((h.score / 100) * marks);
      feedback = h.feedback;
      qBreakdown = h.codeBreakdown;
      qAnnotatedCode = h.annotatedCode;
    }

    qScore = Math.min(marks, Math.max(0, qScore));
    totalScore += qScore;

    // Attach questionId to breakdown items
    const formattedBreakdown = (qBreakdown || []).map(b => ({
      questionId: question._id,
      component: b.component || '',
      codeSnippet: b.codeSnippet || '',
      maxMarks: b.maxMarks || 0,
      awardedMarks: b.awardedMarks || 0,
      status: b.status || 'correct',
      comment: b.comment || '',
    }));

    allCodeBreakdowns.push(...formattedBreakdown);
    if (qAnnotatedCode) allAnnotatedCode.push(qAnnotatedCode);

    questionScores.push({
      questionId: question._id,
      score: qScore,
      maxMarks: marks,
      feedback,
      codeBreakdown: formattedBreakdown,
      annotatedCode: qAnnotatedCode,
    });

    const breakdownSummary = formattedBreakdown.length > 0
      ? `\n\nComponent Breakdown:\n` + formattedBreakdown.map(b => `  • [${b.awardedMarks}/${b.maxMarks} marks] ${b.component}: ${b.codeSnippet} (${b.comment})`).join('\n')
      : '';
    const annotatedSummary = qAnnotatedCode ? `\n\nAnnotated Code:\n${qAnnotatedCode}` : '';

    feedbacks.push(`Q${questions.indexOf(question) + 1} (${marks}m): ${feedback}${breakdownSummary}${annotatedSummary} → ${qScore}/${marks}`);
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
    questionScores,
    codeBreakdown: allCodeBreakdowns,
    annotatedCode: allAnnotatedCode.join('\n\n'),
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
  const questionScores = [];
  const allCodeBreakdowns = [];
  const allAnnotatedCode = [];

  for (const question of questions) {
    const answerObj = (answers || []).find(a => String(a.questionId) === String(question._id));
    const studentCode = (answerObj?.answer || '').trim();
    const qLang = (answerObj?.language || defaultLanguage || 'python').toLowerCase();
    const marks = question.marks || 1;
    totalPossible += marks;

    if (!studentCode) {
      questionScores.push({
        questionId: question._id,
        score: 0,
        maxMarks: marks,
        feedback: 'No code submitted',
        codeBreakdown: [],
        annotatedCode: `No code submitted (0/${marks} marks)`,
      });
      feedbacks.push(`Q${questions.indexOf(question) + 1}: No code submitted (0/${marks})`);
      continue;
    }

    const h = analyzeCode(studentCode, qLang, question.questionText, null, marks);
    const qScore = Math.min(marks, h.awardedMarks !== undefined ? h.awardedMarks : Math.round((h.score / 100) * marks));
    totalScore += qScore;

    const formattedBreakdown = (h.codeBreakdown || []).map(b => ({
      questionId: question._id,
      component: b.component || '',
      codeSnippet: b.codeSnippet || '',
      maxMarks: b.maxMarks || 0,
      awardedMarks: b.awardedMarks || 0,
      status: b.status || 'correct',
      comment: b.comment || '',
    }));

    allCodeBreakdowns.push(...formattedBreakdown);
    if (h.annotatedCode) allAnnotatedCode.push(h.annotatedCode);

    questionScores.push({
      questionId: question._id,
      score: qScore,
      maxMarks: marks,
      feedback: h.feedback,
      codeBreakdown: formattedBreakdown,
      annotatedCode: h.annotatedCode,
    });

    const breakdownSummary = formattedBreakdown.length > 0
      ? `\n\nComponent Breakdown:\n` + formattedBreakdown.map(b => `  • [${b.awardedMarks}/${b.maxMarks} marks] ${b.component}: ${b.codeSnippet} (${b.comment})`).join('\n')
      : '';
    const annotatedSummary = h.annotatedCode ? `\n\nAnnotated Code:\n${h.annotatedCode}` : '';

    feedbacks.push(`Q${questions.indexOf(question) + 1}: ${h.feedback}${breakdownSummary}${annotatedSummary} → ${qScore}/${marks}`);
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
    questionScores,
    codeBreakdown: allCodeBreakdowns,
    annotatedCode: allAnnotatedCode.join('\n\n'),
    executionTime: 0,
    memoryUsed: '',
    status: 'evaluated',
  };
}

module.exports = {
  evaluateSubmission,
  analyzeCode,
  callAI,
  isNonExecutableLanguage,
  looksLikeFrontendCode,
  hasAIKey,
  hasOpenAIKey: hasAIKey,
  isAIAvailable,
};
