export const defaultExpressCode = `const express = require("express");
const app = express();

// DevDeck sets PORT in the environment; use 0 to let the OS pick a free port (avoids EADDRINUSE on repeat runs)
const raw = process.env.PORT;
const PORT =
  raw !== undefined && raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : 0;

app.get("/", (req, res) => {
  res.send("Hello from Express API 🚀");
});

const server = app.listen(PORT, () => {
  const addr = server.address();
  const p = typeof addr === "object" && addr ? addr.port : PORT;
  console.log(\`Server running on http://127.0.0.1:\${p}\`);
});
`;

export const projectTemplates = {
  express: {
    id: 'express',
    name: 'Express API',
    description: 'A clean Express server with health and hello routes.',
    code: defaultExpressCode,
  },
  rest: {
    id: 'rest',
    name: 'REST Starter',
    description: 'CRUD-style routes for a small in-memory resource.',
    code: `const express = require("express");
const app = express();

app.use(express.json());

const raw = process.env.PORT;
const PORT =
  raw !== undefined && raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : 0;

let tasks = [
  { id: 1, title: "Design API", done: false },
  { id: 2, title: "Ship dashboard", done: true },
];

app.get("/api/tasks", (req, res) => {
  res.json(tasks);
});

app.post("/api/tasks", (req, res) => {
  const task = { id: Date.now(), title: req.body.title, done: false };
  tasks.push(task);
  res.status(201).json(task);
});

app.patch("/api/tasks/:id", (req, res) => {
  const task = tasks.find((item) => item.id === Number(req.params.id));
  if (!task) return res.status(404).json({ message: "Task not found" });
  Object.assign(task, req.body);
  res.json(task);
});

app.delete("/api/tasks/:id", (req, res) => {
  tasks = tasks.filter((item) => item.id !== Number(req.params.id));
  res.status(204).send();
});

const server = app.listen(PORT, () => {
  const addr = server.address();
  const p = typeof addr === "object" && addr ? addr.port : PORT;
  console.log(\`Server running on http://127.0.0.1:\${p}\`);
});
`,
  },
  auth: {
    id: 'auth',
    name: 'Auth Middleware',
    description: 'Protected-route example with token-style middleware.',
    code: `const express = require("express");
const app = express();

app.use(express.json());

const raw = process.env.PORT;
const PORT =
  raw !== undefined && raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : 0;

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token !== "devdeck-demo-token") {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

app.get("/api/public", (req, res) => {
  res.json({ message: "Anyone can reach this route." });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ id: "user-demo", role: "editor" });
});

const server = app.listen(PORT, () => {
  const addr = server.address();
  const p = typeof addr === "object" && addr ? addr.port : PORT;
  console.log(\`Server running on http://127.0.0.1:\${p}\`);
});
`,
  },
  blank: {
    id: 'blank',
    name: 'Blank Project',
    description: 'Start from an empty Express-compatible file.',
    code: `const express = require("express");
const app = express();

const raw = process.env.PORT;
const PORT =
  raw !== undefined && raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : 0;

app.get("/", (req, res) => {
  res.json({ message: "Ready to build with Dev Deck" });
});

const server = app.listen(PORT, () => {
  const addr = server.address();
  const p = typeof addr === "object" && addr ? addr.port : PORT;
  console.log(\`Server running on http://127.0.0.1:\${p}\`);
});
`,
  },
};

export const getProjectTemplate = (templateId) =>
  projectTemplates[templateId] || projectTemplates.express;
