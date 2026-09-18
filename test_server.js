const http = require('http');
const url = require('url');

const posts = new Map();
let postIdCounter = 1;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (req.method === 'GET' && parsedUrl.pathname === '/submit') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Test Submission Portal</title></head>
      <body>
        <h1>Submit SEO Content</h1>
        <form action="/submit" method="POST">
          <div><label>Title:</label> <input type="text" name="title" id="title" required /></div>
          <div><label>Summary:</label> <textarea name="description" id="desc"></textarea></div>
          <div><label>Content:</label> <textarea name="content" id="content" required></textarea></div>
          <div><label>Target URL:</label> <input type="text" name="url" id="url" /></div>
          <div><button type="submit" id="submit-btn">Publish Article</button></div>
        </form>
      </body>
      </html>
    `);
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/submit') {
    let body = '';
    req.on('data', (chunk) => (body += chunk.toString()));
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const title = params.get('title') || 'Untitled';
      const content = params.get('content') || '';
      const targetUrl = params.get('url') || '';

      const id = postIdCounter++;
      posts.set(id, { id, title, content, targetUrl, createdAt: new Date() });

      // Redirect to published page URL
      res.writeHead(302, { Location: `/post/${id}` });
      res.end();
    });
    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname.startsWith('/post/')) {
    const id = parseInt(parsedUrl.pathname.split('/post/')[1], 10);
    const post = posts.get(id);

    if (!post) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>${post.title}</title></head>
      <body>
        <h1 id="article-title">${post.title}</h1>
        <div id="article-body">${post.content}</div>
        <p>Reference: <a href="${post.targetUrl}" id="target-link">${post.targetUrl}</a></p>
      </body>
      </html>
    `);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(3000, () => {
  console.log('Test submission server listening on http://localhost:3000/submit');
});
