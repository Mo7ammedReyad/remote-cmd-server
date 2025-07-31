import { Hono } from 'hono';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove } from 'firebase/database';

const app = new Hono();

//  !مهم: بيانات الاتصال بقاعدة بيانات Firebase التي قدمتها
const firebaseConfig = {
  apiKey: "AIzaSyC07Gs8L5vxlUmC561PKbxthewA1mrxYDk",
  authDomain: "zylos-test.firebaseapp.com",
  databaseURL: "https://zylos-test-default-rtdb.firebaseio.com",
  projectId: "zylos-test",
  storageBucket: "zylos-test.firebasestorage.app",
  messagingSenderId: "553027007913",
  appId: "1:553027007913:web:2daa37ddf2b2c7c20b00b8"
};

// تهيئة Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// الصفحة الرئيسية التي تحتوي على واجهة الإدخال
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
        #result { white-space: pre-wrap; background-color: #1e1e1e; padding: 15px; margin-top: 20px; border: 1px solid #3c3c3c; min-height: 100px; font-family: monospace; }
        #status { color: #8a8a8a; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Execute CMD Command</h1>
        <form id="cmd-form">
          <input type="text" id="cmd-input" placeholder="Enter command (e.g., dir)" required />
          <button type="submit">Execute</button>
        </form>
        <p id="status">Waiting for command...</p>
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
          
          // إرسال الأمر إلى السيرفر
          await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cmd: command }),
          });
          
          input.value = '';
          statusDiv.textContent = 'Command sent. Waiting for result...';

          // بدء التحقق من وجود نتيجة كل 3 ثوان
          if (pollingInterval) clearInterval(pollingInterval);
          pollingInterval = setInterval(fetchResult, 3000);
        });

        async function fetchResult() {
          const response = await fetch('/api/result');
          const data = await response.json();
          if (data && data.output) {
            resultDiv.textContent = data.output;
            statusDiv.textContent = 'Result received. Ready for new command.';
            clearInterval(pollingInterval); // إيقاف التحقق بعد استلام النتيجة
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Endpoint لإرسال أمر جديد من واجهة الويب
app.post('/api/command', async (c) => {
  try {
    const { cmd } = await c.req.json();
    if (!cmd) {
      return c.json({ error: 'Command is required' }, 400);
    }
    // مسح النتيجة القديمة وتعيين الأمر الجديد
    await set(ref(database, 'result/'), null); // مسح النتيجة السابقة
    await set(ref(database, 'command/'), { cmd: cmd });
    return c.json({ message: 'Command sent successfully' });
  } catch (error) {
    return c.json({ error: 'Failed to send command' }, 500);
  }
});

// Endpoint لجلب النتيجة وعرضها في المتصفح
app.get('/api/result', async (c) => {
  try {
    const snapshot = await get(ref(database, 'result/'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      return c.json({ output: data.output });
    }
    return c.json({ output: null });
  } catch (error) {
    return c.json({ error: 'Failed to fetch result' }, 500);
  }
});

// Endpoint لسكربت البايثون لسحب الأوامر
app.get('/api/get-command', async (c) => {
  try {
    const commandRef = ref(database, 'command/');
    const snapshot = await get(commandRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      await remove(commandRef); // حذف الأمر بعد قراءته لمنع إعادة تنفيذه
      return c.json(data);
    }
    return c.json({}); // إرجاع كائن فارغ إذا لم يكن هناك أمر
  } catch (error) {
    return c.json({ error: 'Failed to get command' }, 500);
  }
});

// Endpoint لسكربت البايثون لإرسال النتائج
app.post('/api/post-result', async (c) => {
  try {
    const { output } = await c.req.json();
    await set(ref(database, 'result/'), { output: output });
    return c.json({ message: 'Result posted' });
  } catch (error) {
    return c.json({ error: 'Failed to post result' }, 500);
  }
});

export default app;