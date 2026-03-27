import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "records.json");

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/records", (req, res) => {
    try {
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      res.json(JSON.parse(data));
    } catch (error) {
      res.status(500).json({ error: "Failed to read records" });
    }
  });

  app.post("/api/records", (req, res) => {
    try {
      const newRecord = req.body;
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      const records = JSON.parse(data);
      records.unshift(newRecord);
      fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
      res.status(201).json(newRecord);
    } catch (error) {
      res.status(500).json({ error: "Failed to save record" });
    }
  });

  app.delete("/api/records/:id", (req, res) => {
    try {
      const { id } = req.params;
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      let records = JSON.parse(data);
      records = records.filter((r: any) => r.id !== id);
      fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete record" });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
