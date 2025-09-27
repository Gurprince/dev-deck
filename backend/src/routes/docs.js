import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const router = express.Router();

/**
 * @swagger
 * /api/docs/spec:
 *   get:
 *     summary: Get the OpenAPI specification
 *     description: Returns the complete OpenAPI specification for the API
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: OpenAPI specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       500:
 *         description: Server error
 */
router.get('/spec', (req, res) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const specPath = join(__dirname, '..', '..', 'api', 'openapi.yaml');
    
    if (!fs.existsSync(specPath)) {
      return res.status(404).json({ error: 'API specification not found' });
    }
    
    const spec = fs.readFileSync(specPath, 'utf8');
    res.setHeader('Content-Type', 'application/yaml');
    res.send(spec);
  } catch (error) {
    console.error('Error serving API spec:', error);
    res.status(500).json({ error: 'Failed to load API specification' });
  }
});

export default router;
