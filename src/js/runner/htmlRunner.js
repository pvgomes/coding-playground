// HTML Preview Runner
function createFullHtml(content) {
  // If content already has html/body tags, use as-is
  if (content.trim().toLowerCase().startsWith('<!doctype') ||
      content.trim().toLowerCase().startsWith('<html')) {
    return content;
  }

  // If content has body tag, wrap with minimal html
  if (content.trim().toLowerCase().includes('<body')) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>HTML Preview</title>
</head>
${content}
</html>`;
  }

  // Otherwise, wrap content in a basic HTML structure
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>HTML Preview</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 20px;
      background: #fff;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

export function createHtmlRunner({ onStdout, onStderr, onSystem }) {
  async function load() {
    onSystem('HTML renderer ready.');
  }

  async function run(code) {
    try {
      const fullHtml = createFullHtml(code);

      // Open in new window/tab for preview
      const previewWindow = window.open('', '_blank');
      if (previewWindow) {
        previewWindow.document.write(fullHtml);
        previewWindow.document.close();
        onStdout('HTML preview opened in new tab/window');
      } else {
        // Fallback: show HTML source if popup blocked
        onStdout('Popup blocked. Here\'s the HTML source:\n\n' + fullHtml);
      }
    } catch (err) {
      onStderr('Error rendering HTML: ' + err.message);
    }
  }

  return {
    load,
    run,
    isReady: () => true
  };
}