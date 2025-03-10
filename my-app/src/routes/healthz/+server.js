// src/routes/healthz/+server.js

export function GET() {
  return new Response("OK", { status: 200 });
}
