import { Hono } from 'hono'

const app = new Hono()

// صفحة الويب تبقى كما هي
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head><title>CMD Executor - DEBUG MODE</title></head>
    <body>
      <h1>Debug Mode</h1>
      <p>This is a test to see if the server responds at all.</p>
      <form id="cmd-form">
        <input id="cmd-input" value="test-command" />
        <button type="submit">Send Test</button>
      </form>
      <h3 id="status">Ready</h3>
      <script>
        document.getElementById('cmd-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const status = document.getElementById('status');
          status.textContent = 'Sending request to /api/command...';
          try {
            const response = await fetch('/api/command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cmd: "test" }),
            });
            const data = await response.json();
            if(response.ok) {
              status.textContent = 'SUCCESS! Server responded: ' + data.message;
            } else {
              status.textContent = 'ERROR! Server responded with an error: ' + data.message;
            }
          } catch (err) {
            status.textContent = 'FATAL ERROR! Could not fetch. Is the server running? Details: ' + err.message;
          }
        });
      </script>
    </body>
    </html>
  `)
})


// Endpoint بسيط جدا للتحقق من الاتصال
app.post('/api/command', (c) => {
  console.log("DEBUG: /api/command was hit successfully!");
  return c.json({ message: 'I am alive and I received your request!' });
})

export default app