import { Hono } from 'hono'
import { html } from 'hono/html'

const app = new Hono()

const page = html\`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>CMD Remote Control</title>
  </head>
  <body>
    <h2>Enter CMD Command</h2>
    <form onsubmit="sendCommand(event)">
      <input type="text" id="cmd" placeholder="dir" required />
      <button type="submit">Send</button>
    </form>
    <pre id="output">Waiting for response...</pre>

    <script type="module">
      async function sendCommand(e) {
        e.preventDefault()
        const cmd = document.getElementById('cmd').value
        const res = await fetch('/cmd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cmd })
        })
        const json = await res.json()
        document.getElementById('output').innerText = json.status
      }
    </script>
  </body>
  </html>
\`

app.get('/', (c) => c.html(page))

app.post('/cmd', async (c) => {
  const body = await c.req.json()
  const cmd = body.cmd

  const payload = JSON.stringify({ cmd, status: 'waiting...' })

  await fetch(
    'https://zylos-test-default-rtdb.firebaseio.com/commands/latest.json',
    {
      method: 'PUT',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
    }
  )

  return c.json({ status: 'Command sent!' })
})

export default app
