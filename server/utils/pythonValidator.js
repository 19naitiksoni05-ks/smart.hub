// ============================================================
// SMART HUB — Genuine Python Code Validator
// Ensures uploaded Python files contain genuine, syntactically valid Python code
// ============================================================

const { spawnSync } = require('child_process');

/**
 * Validates whether a file content buffer or string is genuine Python code.
 * @param {Buffer|string} content - The file content
 * @param {string} filename - The name of the file
 * @returns {{ valid: boolean, error?: string, lineCount?: number }}
 */
function validatePythonCode(content, filename = 'script.py') {
  if (!content) {
    return { valid: false, error: `File '${filename}' is empty.` };
  }

  // Convert buffer to UTF-8 string
  let text = typeof content === 'string' ? content : content.toString('utf8');

  // 1. Binary check: reject null bytes or binary executable headers
  if (text.includes('\0') || /[\x00-\x08\x0E-\x1F]/.test(text.substring(0, 512))) {
    return { valid: false, error: `File '${filename}' contains binary data. Genuine text-based Python script required.` };
  }

  // 2. Reject obvious non-Python foreign language markers
  const trimmed = text.trim();
  if (/^<!DOCTYPE/i.test(trimmed) || /^<html/i.test(trimmed)) {
    return { valid: false, error: `File '${filename}' is an HTML document, not a Python file.` };
  }
  if (/^<\?php/i.test(trimmed)) {
    return { valid: false, error: `File '${filename}' contains PHP code, not Python.` };
  }
  if (/^#include\s*<[a-z0-9_.]+>/i.test(trimmed) || /^using\s+namespace\s+std;/i.test(trimmed)) {
    return { valid: false, error: `File '${filename}' appears to be C/C++ source, not Python.` };
  }

  // 3. Attempt Python AST Syntax Validation using system Python (fast and 100% accurate)
  try {
    const pyResult = spawnSync('python', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], {
      input: text,
      encoding: 'utf8',
      timeout: 3000
    });

    if (pyResult.status === 0) {
      const lineCount = text.split('\n').length;
      return { valid: true, lineCount };
    }

    // If Python returned an error, format the syntax error
    if (pyResult.stderr) {
      const errLine = pyResult.stderr.split('\n').filter(l => l.includes('SyntaxError') || l.includes('IndentationError') || l.includes('Error'))[0] || 'Invalid Python syntax';
      return {
        valid: false,
        error: `File '${filename}' failed Python syntax validation: ${errLine.trim()}`
      };
    }
  } catch (procErr) {
    // If python subprocess fails to spawn, fallback to lexical validation below
    console.warn('[PythonValidator] Subprocess check skipped, using heuristic fallback:', procErr.message);
  }

  // 4. Heuristic Fallback Check (if python executable unavailable)
  const pythonKeywords = /\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|lambda|yield|raise|pass|break|continue|print|global|nonlocal|async|await)\b/;
  const pythonConstructs = /(:$|#|""".*?"""|'''.*?'''|\bself\b|\b__name__\b|\b__init__\b|\.append\(|\.split\()/m;

  const hasKeywords = pythonKeywords.test(text);
  const hasConstructs = pythonConstructs.test(text);

  if (!hasKeywords && !hasConstructs && trimmed.length > 20) {
    return {
      valid: false,
      error: `File '${filename}' does not contain recognized Python statements, functions, or syntax.`
    };
  }

  const lineCount = text.split('\n').length;
  return { valid: true, lineCount };
}

/**
 * Checks whether a filename represents a Python file.
 */
function isPythonFile(filename = '') {
  const lower = filename.toLowerCase();
  return lower.endsWith('.py') || lower.endsWith('.pyw') || lower.endsWith('.pyi');
}

module.exports = {
  validatePythonCode,
  isPythonFile
};
