import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';

const STARTER_TEMPLATES = {
  python: `# Write your Python code here
def solve():
    print("Hello from Python!")

if __name__ == "__main__":
    solve()
`,
  java: `// Write your Java code here
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}
`,
  c: `// Write your C code here
#include <stdio.h>

int main() {
    printf("Hello from C!\\n");
    return 0;
}
`,
  cpp: `// Write your C++ code here
#include <iostream>
using namespace std;

int main() {
    cout << "Hello from C++!" << endl;
    return 0;
}
`,
  csharp: `using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello from C#!");
    }
}
`,
  javascript: `// Write your JavaScript code here
function solve() {
    console.log("Hello from JavaScript!");
}
solve();
`,
  typescript: `// Write your TypeScript code here
function greet(name: string): string {
    return \`Hello, \${name}!\`;
}
console.log(greet("TypeScript"));
`,
  jsx: `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>React Component</h2>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
`,
  html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    h1 { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Hello World</h1>
  <p>Practical exam page</p>
</body>
</html>
`,
  css: `/* Write your CSS styling here */
body {
  margin: 0;
  padding: 20px;
  font-family: sans-serif;
  background: #f8fafc;
}
`,
  php: `<?php
// Write your PHP code here
echo "Hello from PHP!\\n";
?>
`,
  sql: `-- Write your SQL query here
SELECT * FROM students;
`,
  go: `package main

import "fmt"

func main() {
    fmt.Println("Hello from Go!")
}
`,
  rust: `fn main() {
    println!("Hello from Rust!");
}
`,
  bash: `#!/bin/bash
# Write your bash script here
echo "Hello from Bash!"
`
};

const LANG_FILENAME_MAP = {
  python: 'solution.py',
  java: 'Main.java',
  c: 'program.c',
  cpp: 'solution.cpp',
  csharp: 'Program.cs',
  javascript: 'solution.js',
  typescript: 'solution.ts',
  jsx: 'App.jsx',
  tsx: 'App.tsx',
  html: 'index.html',
  css: 'styles.css',
  php: 'index.php',
  sql: 'query.sql',
  go: 'main.go',
  rust: 'main.rs',
  ruby: 'main.rb',
  kotlin: 'Main.kt',
  swift: 'main.swift',
  bash: 'script.sh'
};

export default function CodeEditor({
  questionId,
  code = '',
  onChange,
  language = 'python',
  onLanguageChange,
  onRun,
  running = false,
  output = null,
  onClearOutput
}) {
  const [stdin, setStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // Sync scroll between textarea and line numbers gutter
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Support Tab key indentation (4 spaces)
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const val = e.target.value;
      const newVal = val.substring(0, start) + '    ' + val.substring(end);
      onChange(newVal);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  // Copy & Paste (Ctrl+C, Ctrl+V, Ctrl+X) are fully enabled during practical exams
  const handlePaste = (e) => {
    // Allowed - native paste executes cleanly
  };

  const handleCopy = (e) => {
    // Allowed - native copy executes cleanly
  };

  // Load starter template
  const handleResetTemplate = () => {
    const template = STARTER_TEMPLATES[language] || `// Write your ${language} code here\n`;
    onChange(template);
    toast.info(`Loaded starter template for ${language}`);
  };

  // Line count for gutter
  const lines = (code || '').split('\n');
  const lineCount = Math.max(1, lines.length);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  const fileName = LANG_FILENAME_MAP[language] || `solution.${language}`;

  return (
    <div className="ide-container">
      {/* IDE Top Navigation / Tool Bar */}
      <div className="ide-header">
        <div className="ide-header-left">
          <div className="ide-file-tab">
            <span className="ide-file-icon">📄</span>
            <span className="ide-file-name">{fileName}</span>
          </div>

          <div className="ide-lang-select-wrap">
            <label className="ide-lang-label">Language:</label>
            <select
              className="ide-lang-select"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
            >
              <optgroup label="Popular Languages">
                <option value="python">Python 3</option>
                <option value="java">Java (OpenJDK)</option>
                <option value="c">C (GCC)</option>
                <option value="cpp">C++ (G++)</option>
                <option value="javascript">JavaScript (Node)</option>
              </optgroup>
              <optgroup label="Web & Frontend">
                <option value="jsx">React (JSX)</option>
                <option value="html">HTML5</option>
                <option value="css">CSS3</option>
                <option value="tsx">React (TSX)</option>
                <option value="typescript">TypeScript</option>
              </optgroup>
              <optgroup label="Backend & Systems">
                <option value="csharp">C#</option>
                <option value="php">PHP</option>
                <option value="go">Go (Golang)</option>
                <option value="rust">Rust</option>
                <option value="kotlin">Kotlin</option>
                <option value="swift">Swift</option>
                <option value="ruby">Ruby</option>
              </optgroup>
              <optgroup label="Database & Scripting">
                <option value="sql">SQL</option>
                <option value="bash">Bash</option>
              </optgroup>
            </select>
          </div>
        </div>

        <div className="ide-header-right">
          <button
            type="button"
            className={`ide-btn-tool ${showStdin ? 'active' : ''}`}
            onClick={() => setShowStdin(!showStdin)}
            title="Provide custom input (stdin) for programs that read inputs"
          >
            ⌨️ Input {showStdin ? '▲' : '▼'}
          </button>

          <button
            type="button"
            className="ide-btn-tool"
            onClick={handleResetTemplate}
            title="Reset to starter template"
          >
            ↺ Template
          </button>

          <button
            type="button"
            className="ide-btn-run"
            onClick={() => onRun(questionId, code, language, stdin)}
            disabled={running}
            title="Compile & Run code in sandbox"
          >
            {running ? (
              <>
                <span className="ide-spinner"></span>
                <span>Compiling...</span>
              </>
            ) : (
              <>
                <span className="ide-play-icon">▶</span>
                <span>Compile & Run</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Custom Input (stdin) Panel */}
      {showStdin && (
        <div className="ide-stdin-panel">
          <div className="ide-stdin-header">
            <span>Standard Input (stdin) — Inputs for <code>input()</code>, <code>scanf</code>, <code>cin</code>:</span>
            <button
              type="button"
              className="ide-stdin-close"
              onClick={() => setShowStdin(false)}
            >
              ✕
            </button>
          </div>
          <textarea
            className="ide-stdin-textarea"
            placeholder="Type input values here (e.g. 5 or numbers separated by space/newline)..."
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={2}
          />
        </div>
      )}

      {/* Editor Body: Line Numbers + Code Textarea */}
      <div className="ide-editor-body">
        <div className="ide-line-numbers" ref={lineNumbersRef}>
          {lineNumbers.map((num) => (
            <div key={num} className="ide-line-num">
              {num}
            </div>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          className="ide-code-textarea"
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder={`// Enter your ${language} solution here...\n// Press Tab to indent (4 spaces)\n// Ctrl+C and Ctrl+V are enabled\n// Click 'Compile & Run' to test your code`}
          spellCheck="false"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
        />
      </div>

      {/* Editor Footer / Info Bar */}
      <div className="ide-footer">
        <div className="ide-footer-left">
          <span className="ide-status-indicator"></span>
          <span>{running ? 'Compiling in sandbox...' : 'Ready'}</span>
          <span style={{ marginLeft: '12px', color: '#38A169', fontSize: '11px', fontWeight: 600 }}>
            📋 Ctrl+C / Ctrl+V Enabled
          </span>
        </div>
        <div className="ide-footer-right">
          <span>{lineCount} lines</span>
          <span>•</span>
          <span>{(code || '').length} chars</span>
        </div>
      </div>

      {/* Compiler Terminal / Execution Output Console */}
      {output && (
        <div
          className={`ide-terminal ${
            output.isError
              ? 'terminal-error'
              : output.isPreview
              ? 'terminal-preview'
              : 'terminal-success'
          }`}
        >
          <div className="ide-terminal-header">
            <div className="ide-terminal-title">
              {output.running ? (
                <span className="terminal-badge badge-running">
                  <span className="ide-spinner"></span>
                  Compiling & Executing Code...
                </span>
              ) : output.isPreview ? (
                <span className="terminal-badge badge-preview">
                  🌐 Live Web Component Preview
                </span>
              ) : output.isError ? (
                <span className="terminal-badge badge-error">
                  ✕ Compilation / Runtime Error
                </span>
              ) : (
                <span className="terminal-badge badge-success">
                  ✓ Compilation Successful (Output)
                </span>
              )}
            </div>

            <div className="ide-terminal-actions">
              <span className="ide-terminal-lang-tag">
                {output.language || language}
              </span>
              {onClearOutput && (
                <button
                  type="button"
                  className="ide-terminal-clear-btn"
                  onClick={onClearOutput}
                  title="Clear console output"
                >
                  ✕ Clear Console
                </button>
              )}
            </div>
          </div>

          <div className="ide-terminal-body">
            {output.running ? (
              <div className="terminal-loading-state">
                <div className="ide-spinner-large"></div>
                <p>Compiling source code in secure sandbox...</p>
              </div>
            ) : output.isPreview ? (
              <div className="ide-preview-wrapper">
                <iframe
                  title="Live Preview"
                  srcDoc={output.previewHTML}
                  className="ide-preview-frame"
                  sandbox="allow-scripts"
                />
              </div>
            ) : (
              <pre className="ide-terminal-code">
                {output.output || '(Program executed successfully with no output)'}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
