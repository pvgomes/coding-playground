function stripFormatting(text) {
  return text
    // Code blocks (must be before inline code)
    .replace(/```[\s\S]*?```/g, match => match.replace(/```\w*\n?/g, '').trim())
    // Inline code
    .replace(/`([^`]+)`/g, '$1')
    // Headers
    .replace(/^#{1,6}\s+/gm, '')
    // Bold + italic (*** or ___)
    .replace(/(\*{3}|_{3})(.*?)\1/g, '$2')
    // Bold (** or __)
    .replace(/(\*{2}|_{2})(.*?)\1/g, '$2')
    // Italic (* or _)
    .replace(/([*_])(.*?)\1/g, '$2')
    // Links [text](url)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Blockquotes
    .replace(/^>\s+/gm, '')
    // Unordered list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    // Ordered list markers
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // HTML tags
    .replace(/<[^>]+>/g, '')
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createPlaintextRunner({ onStdout, onStderr, onSystem }) {
  async function load() {
    onSystem('Plain text renderer ready.');
  }

  async function run(code) {
    try {
      const plain = stripFormatting(code);

      const escaped = plain
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Plain Text Preview</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #fff;
    }
    .label {
      font-size: 0.75em;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 16px;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 8px;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      font-family: inherit;
      font-size: 1em;
    }
  </style>
</head>
<body>
  <div class="label">Plain text preview without formatting</div>
  <pre>${escaped}</pre>
</body>
</html>`;

      const consoleOutput = document.getElementById('console-output');

      const existingIframe = consoleOutput.querySelector('iframe');
      if (existingIframe) existingIframe.remove();

      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '400px';
      iframe.style.border = '1px solid #3c3c3c';
      iframe.style.borderRadius = '4px';
      iframe.style.marginTop = '8px';
      iframe.style.marginBottom = '8px';
      iframe.sandbox.add('allow-same-origin');

      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml);
      consoleOutput.appendChild(iframe);
      onStdout('Plain text preview rendered');
    } catch (err) {
      onStderr('Error rendering plain text: ' + err.message);
    }
  }

  return {
    load,
    run,
    isReady: () => true
  };
}
