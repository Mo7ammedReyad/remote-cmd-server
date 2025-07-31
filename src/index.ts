import { Hono } from 'hono';
import { initializeApp, FirebaseError } from 'firebase/app';
import { getDatabase, ref, set, get, remove } from 'firebase/database';

const app = new Hono();

const firebaseConfig = {
    apiKey: "AIzaSyC07Gs8L5vxlUmC561PKbxthewA1mrxYDk",
    authDomain: "zylos-test.firebaseapp.com",
    databaseURL: "https://zylos-test-default-rtdb.firebaseio.com",
    projectId: "zylos-test",
    storageBucket: "zylos-test.firebasestorage.app",
    messagingSenderId: "553027007913",
    appId: "1:553027007913:web:2daa37ddf2b2c7c20b00b8"
};

// تهيئة Firebase في متغير يمكننا التحقق منه
let firebaseApp;
let database;
try {
    firebaseApp = initializeApp(firebaseConfig);
    database = getDatabase(firebaseApp);
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.error("CRITICAL: Failed to initialize Firebase!", error);
    // إذا فشلت التهيئة، لن يعمل أي شيء آخر
}

// ... كود الواجهة الأمامية يبقى كما هو من النسخة المحدثة السابقة ...
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
          #status { color: #f44336; font-weight: bold; }
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
  
              const data = await response.json();
              if (!response.ok) {
                // عرض الخطأ الذي أرسله السيرفر
                throw new Error(data.error || 'Unknown error from server');
              }
              
              input.value = '';
              statusDiv.textContent = 'Command sent. Waiting for result...';
  
              if (pollingInterval) clearInterval(pollingInterval);
              pollingInterval = setInterval(fetchResult, 3000);
  
            } catch (error) {
              statusDiv.textContent = 'Error: ' + error.message;
            }
          });
  
          async function fetchResult() {
            try {
              const response = await fetch('/api/result');
              if (!response.ok) return;
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

// Endpoint إرسال الأوامر مع معالجة أخطاء أفضل
app.post('/api/command', async (c) => {
  console.log("Request received on /api/command.");

  // تحقق مما إذا كانت تهيئة Firebase قد نجحت
  if (!database) {
    console.error("Firebase not initialized. Cannot process request.");
    return c.json({ error: 'Server configuration error: Firebase not available.' }, 500);
  }

  try {
    const { cmd } = await c.req.json();
    console.log(`Attempting to write command to Firebase: "${cmd}"`);

    // الكتابة في Firebase داخل try/catch
    await set(ref(database, 'command/'), { cmd: cmd });
    console.log("Successfully wrote command to Firebase.");
    await set(ref(database, 'result/'), null); // مسح النتيجة القديمة
    
    return c.json({ message: 'Command sent successfully' });
  } catch (error) {
    // طباعة الخطأ في سجلات Cloudflare
    console.error("!!! FIREBASE WRITE FAILED !!!", error);
    
    let errorMessage = "Failed to write to Firebase.";
    if (error instanceof FirebaseError) {
        errorMessage = `Firebase Error: ${error.code} - ${error.message}`;
    }
    
    // إرسال رسالة خطأ واضحة للمتصفح
    return c.json({ error: errorMessage }, 500);
  }
});

// باقي الـ Endpoints تبقى كما هي من التحديث السابق...
app.get('/api/get-command', async (c) => {
    if (!database) return c.json({ error: 'Server not ready' }, 503);
    const snapshot = await get(ref(database, 'command/'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      await remove(ref(database, 'command/'));
      return c.json(data);
    }
    return c.json({});
});

app.post('/api/post-result', async (c) => {
    if (!database) return c.json({ error: 'Server not ready' }, 503);
    const { output } = await c.req.json();
    await set(ref(database, 'result/'), { output });
    return c.json({ message: 'Result posted' });
});

app.get('/api/result', async (c) => {
    if (!database) return c.json({ error: 'Server not ready' }, 503);
    const snapshot = await get(ref(database, 'result/'));
    if (snapshot.exists()) {
        return c.json(snapshot.val());
    }
    return c.json({ output: null });
});


export default app