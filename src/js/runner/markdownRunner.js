// Simple markdown renderer (basic implementation)
function parseMarkdown(text) {
  // Basic markdown parser - converts common elements to HTML
  return text
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Lists
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    // Wrap in paragraph if not already wrapped
    .replace(/^([^<].*)$/gm, '<p>$1</p>')
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<br>)*<\/p>/g, '');
}

export function createMarkdownRunner({ onStdout, onStderr, onSystem }) {
  async function load() {
    onSystem('Markdown renderer ready.');
  }

  async function run(code) {
    try {
      const html = parseMarkdown(code);
      // Create a simple HTML document structure
      const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Markdown Preview</title>
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
    h1, h2, h3 { color: #2c3e50; margin-top: 1.5em; margin-bottom: 0.5em; }
    h1 { border-bottom: 2px solid #3498db; padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid #bdc3c7; padding-bottom: 0.2em; }
    code {
      background: #f8f8f8;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f8f8f8;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      border: 1px solid #e1e1e1;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid #3498db;
      margin: 0;
      padding-left: 15px;
      color: #555;
    }
    a { color: #3498db; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul, ol { padding-left: 20px; }
    li { margin: 5px 0; }
    p { margin: 1em 0; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

      // Render in console window using iframe
      const consoleOutput = document.getElementById('console-output');
      
      // Remove existing iframe if any
      const existingIframe = consoleOutput.querySelector('iframe');
      if (existingIframe) {
        existingIframe.remove();
      }
      
      // Create iframe for markdown preview using data URL
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '400px';
      iframe.style.border = '1px solid #3c3c3c';
      iframe.style.borderRadius = '4px';
      iframe.style.marginTop = '8px';
      iframe.style.marginBottom = '8px';
      iframe.sandbox.add('allow-links');
      
      // Use data URL to set the iframe content
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml);
      iframe.src = dataUrl;
      
      consoleOutput.appendChild(iframe);
      onStdout('Markdown preview rendered in console');
    } catch (err) {
      onStderr('Error rendering markdown: ' + err.message);
    }
  }

  return {
    load,
    run,
    isReady: () => true
  };
}