import {
  buildKotlinProject,
  kotlinRunUrl,
  parseKotlinOutput,
  collectKotlinDiagnostics,
  formatKotlinException
} from '../src/js/runner/kotlinRunner.js';

describe('buildKotlinProject', () => {
  it('wraps code in a single File.kt entry', () => {
    const project = buildKotlinProject('fun main() {}');
    expect(project.confType).to.equal('java');
    expect(project.files).to.have.length(1);
    expect(project.files[0].name).to.equal('File.kt');
    expect(project.files[0].text).to.equal('fun main() {}');
  });
});

describe('kotlinRunUrl', () => {
  it('builds the compiler run endpoint', () => {
    expect(kotlinRunUrl('2.1.0')).to.equal('https://api.kotlinlang.org/api/2.1.0/compiler/run');
  });
});

describe('parseKotlinOutput', () => {
  it('returns stdout and stderr segments in order', () => {
    const segments = parseKotlinOutput('<outStream>hello\n</outStream><errStream>oops\n</errStream>');
    expect(segments).to.deep.equal([
      { stream: 'stdout', text: 'hello' },
      { stream: 'stderr', text: 'oops' }
    ]);
  });

  it('returns an empty list when there is no output', () => {
    expect(parseKotlinOutput('')).to.deep.equal([]);
    expect(parseKotlinOutput('<outStream></outStream>')).to.deep.equal([]);
  });
});

describe('collectKotlinDiagnostics', () => {
  it('formats compiler errors with 1-based positions', () => {
    const diagnostics = collectKotlinDiagnostics({
      'File.kt': [{
        interval: { start: { line: 0, ch: 13 } },
        message: "Unresolved reference 'printlnx'.",
        severity: 'ERROR'
      }]
    });
    expect(diagnostics).to.have.length(1);
    expect(diagnostics[0].severity).to.equal('ERROR');
    expect(diagnostics[0].message).to.equal("File.kt:1:14 ERROR: Unresolved reference 'printlnx'.");
  });

  it('ignores missing or malformed error maps', () => {
    expect(collectKotlinDiagnostics(null)).to.deep.equal([]);
    expect(collectKotlinDiagnostics({ 'File.kt': null })).to.deep.equal([]);
  });
});

describe('formatKotlinException', () => {
  it('returns null when there is no exception', () => {
    expect(formatKotlinException(null)).to.equal(null);
  });

  it('renders the message, stack frames and cause', () => {
    const text = formatKotlinException({
      fullName: 'java.lang.IllegalStateException',
      message: 'boom',
      stackTrace: [
        { className: 'FileKt', methodName: 'main', fileName: 'File.kt', lineNumber: 1 },
        { className: 'jdk.internal.reflect.NativeMethodAccessorImpl', methodName: 'invoke0', fileName: null, lineNumber: -2 }
      ],
      cause: { fullName: 'java.lang.RuntimeException', message: 'root', stackTrace: [], cause: null }
    });
    expect(text).to.equal([
      'java.lang.IllegalStateException: boom',
      '    at FileKt.main(File.kt:1)',
      'Caused by: java.lang.RuntimeException: root'
    ].join('\n'));
  });
});
