import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import YAML from 'yamljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load API specification from YAML file
const swaggerDocument = YAML.load(join(process.cwd(), 'api', 'openapi.yaml'));

// Options for the swagger specification
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DevDeck API',
      version: '1.0.0',
      description: 'API documentation for DevDeck - A next-gen developer playground',
      contact: {
        name: 'DevDeck Team',
        url: 'https://devdeck.example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Path to the API docs
  apis: ['./src/routes/*.js', './src/models/*.js'],
};

const specs = swaggerJsdoc(options);

const swaggerDocs = (app) => {
  // Swagger page
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // Docs in JSON format
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log(`📚 API Documentation available at http://localhost:3000/api-docs`);
};

export default swaggerDocs;
