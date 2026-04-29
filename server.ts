import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.use(express.json({ limit: '10mb' }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/proxy", async (req, res) => {
    const { url, method = "GET", headers = {}, body = null } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      console.log(`[Proxy] ${method} ${url}`);
      const response = await fetch(url, {
        method,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          ...headers,
        },
        body: body ? JSON.stringify(body) : null,
      });

      const contentType = response.headers.get("content-type");
      const status = response.status;
      
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        res.status(status).json(data);
      } else {
        const text = await response.text();
        res.status(status).send(text);
      }
    } catch (error: any) {
      console.error(`[Proxy Error] ${url}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Simple scheduler simulation
  // Note: In this environment, the server restarts when code changes.
  // For persistent scheduling, we'd rely on external triggers or persistent state.
  setInterval(async () => {
    // Logic to check Firestore for scheduled jobs would go here.
    // Since we can't easily import the crawler logic here without refactoring
    // to separate server/client code, we'll keep it as a placeholder for now.
  }, 60000);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
