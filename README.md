# Remote CMD Server with Hono + Firebase
A Cloudflare Worker using Hono that accepts CMD commands from a web interface, stores them in Firebase, and expects a local Python script to execute and return the result.

- Server: Cloudflare Worker + Hono
- Database: Firebase Realtime Database
- Client: Embedded HTML
- Listener: Python script (run locally)
