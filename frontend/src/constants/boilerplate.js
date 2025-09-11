export const defaultExpressCode = `const express = require("express");
const app = express();
const PORT = 5500;

app.get("/", (req, res) => {
  res.send("Hello from Express API 🚀");
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`;
