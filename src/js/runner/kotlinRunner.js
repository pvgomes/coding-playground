const KOTLIN_API_BASE = 'https://api.kotlinlang.org/api';
const KOTLIN_VERSION = '2.1.0';
const KOTLIN_FILE_NAME = 'File.kt';

export function buildKotlinProject(code, { fileName = KOTLIN_FILE_NAME, args = '' } = {}) {
  return {
    args,
    files: [{ name: fileName, text: code, publicId: '' }],
    confType: 'java'
  };
}

export function kotlinRunUrl(version = KOTLIN_VERSION) {
  return `${KOTLIN_API_BASE}/${version}/compiler/run`;
}

export function parseKotlinOutput(text) {
  if (!text) return [];
  const segments = [];
  const pattern = /<(outStream|errStream)>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const stream = match[1] === 'errStream' ? 'stderr' : 'stdout';
    const body = match[2].replace(/\n$/, '');
    if (body.length) segments.push({ stream, text: body });
  }
  return segments;
}

export function collectKotlinDiagnostics(errors) {
  if (!errors || typeof errors !== 'object') return [];
  const diagnostics = [];
  for (const [file, list] of Object.entries(errors)) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const line = (item?.interval?.start?.line ?? 0) + 1;
      const ch = (item?.interval?.start?.ch ?? 0) + 1;
      const severity = item?.severity || 'ERROR';
      diagnostics.push({
        severity,
        message: `${file}:${line}:${ch} ${severity}: ${item?.message || 'Unknown problem'}`
      });
    }
  }
  return diagnostics;
}

export function formatKotlinException(exception) {
  if (!exception) return null;
  const header = [exception.fullName, exception.message].filter(Boolean).join(': ');
  const frames = Array.isArray(exception.stackTrace)
    ? exception.stackTrace
        .filter(frame => frame?.fileName)
        .map(frame => `    at ${frame.className}.${frame.methodName}(${frame.fileName}:${frame.lineNumber})`)
    : [];
  const cause = exception.cause ? formatKotlinException(exception.cause) : null;
  return [header, ...frames, cause ? `Caused by: ${cause}` : null].filter(Boolean).join('\n');
}

export function createKotlinRunner({ onStdout, onStderr, onSystem }) {
  async function load() {
    onSystem('Kotlin runner ready (compiles remotely via api.kotlinlang.org).');
  }

  async function run(code) {
    if (!code || !code.trim()) {
      onSystem('(no code to run)');
      return;
    }

    onSystem(`Compiling Kotlin ${KOTLIN_VERSION} remotely...`);

    let result;
    try {
      const response = await fetch(kotlinRunUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildKotlinProject(code))
      });
      if (!response.ok) {
        throw new Error(`Kotlin compile service returned ${response.status}`);
      }
      result = await response.json();
    } catch (err) {
      onStderr(`Kotlin run failed: ${err && err.message ? err.message : String(err)}`);
      onSystem('Kotlin needs an internet connection to compile.');
      return;
    }

    const diagnostics = collectKotlinDiagnostics(result.errors);
    const hasBlockingErrors = diagnostics.some(d => d.severity === 'ERROR');
    diagnostics.forEach(d => {
      if (d.severity === 'ERROR') onStderr(d.message);
      else onSystem(d.message);
    });

    if (hasBlockingErrors) return;

    const segments = parseKotlinOutput(result.text);
    segments.forEach(segment => {
      if (segment.stream === 'stderr') onStderr(segment.text);
      else onStdout(segment.text);
    });

    const exception = formatKotlinException(result.exception);
    if (exception) {
      onStderr(exception);
      return;
    }

    if (!segments.length) onSystem('(no output)');
  }

  return {
    load,
    run,
    isReady: () => true
  };
}
