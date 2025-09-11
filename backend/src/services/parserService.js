import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

/**
 * Parse JavaScript/TypeScript code and extract API endpoints
 * @param {string} code - The source code to parse
 * @returns {Array} Array of endpoint objects
 */
export const parseCodeForEndpoints = (code) => {
  const endpoints = [];
  
  try {
    // Parse the code with Babel
    const ast = parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'objectRestSpread',
        'optionalChaining',
        'nullishCoalescingOperator'
      ]
    });

    // Traverse the AST to find Express.js route handlers
    traverse.default(ast, {
      CallExpression(path) {
        const { node } = path;
        
        // Check if it's an Express route method (app.get, app.post, etc.)
        if (
          t.isMemberExpression(node.callee) &&
          t.isIdentifier(node.callee.object, { name: 'app' }) &&
          t.isIdentifier(node.callee.property) &&
          ['get', 'post', 'put', 'delete', 'patch', 'all'].includes(node.callee.property.name) &&
          node.arguments.length >= 2
        ) {
          const method = node.callee.property.name.toUpperCase();
          const pathNode = node.arguments[0];
          const handlerNode = node.arguments[1];
          
          // Extract the path (if it's a string literal)
          let path = '';
          if (t.isStringLiteral(pathNode)) {
            path = pathNode.value;
          } else if (t.isTemplateLiteral(pathNode) && pathNode.quasis.length > 0) {
            path = pathNode.quasis[0].value.raw;
          }
          
          if (!path) return;
          
          // Extract parameters from the path
          const params = [];
          const paramRegex = /:([^/]+)/g;
          let match;
          while ((match = paramRegex.exec(path)) !== null) {
            params.push({
              name: match[1],
              in: 'path',
              required: true,
              type: 'string',
              description: `URL parameter: ${match[1]}`
            });
          }
          
          // Try to extract parameters from the handler function (best-effort; ignore traversal errors)
          try {
            if (t.isFunction(handlerNode) && handlerNode.params.length > 0) {
              // Safely traverse only within a synthetic Program wrapper to satisfy traverse requirements
              const syntheticProgram = t.program([
                t.expressionStatement(handlerNode)
              ]);
              traverse.default(syntheticProgram, {
                MemberExpression(innerPath) {
                  if (
                    t.isIdentifier(innerPath.node.object, { name: 'req' }) &&
                    t.isIdentifier(innerPath.node.property, { name: 'params' }) &&
                    t.isMemberExpression(innerPath.parent) &&
                    t.isIdentifier(innerPath.parent.property)
                  ) {
                    const paramName = innerPath.parent.property.name;
                    if (!params.some(p => p.name === paramName)) {
                      params.push({
                        name: paramName,
                        in: 'path',
                        required: true,
                        type: 'string',
                        description: `URL parameter: ${paramName}`
                      });
                    }
                  }
                }
              });
            }
          } catch (e) {
            // Ignore extraction errors; continue with detected path params only
          }
          
          // Generate a description from the handler function
          let description = `Handles ${method} ${path}`;
          if (t.isBlockStatement(handlerNode.body) && handlerNode.body.body.length > 0) {
            const firstStatement = handlerNode.body.body[0];
            if (t.isExpressionStatement(firstStatement) && t.isStringLiteral(firstStatement.expression)) {
              description = firstStatement.expression.value;
            }
          }
          
          // Add the endpoint to our results
          endpoints.push({
            path,
            method,
            description,
            parameters: params,
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        message: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          });
        }
      }
    });
    
    return endpoints;
  } catch (error) {
    console.error('Error parsing code:', error);
    return [];
  }
};

/**
 * Format endpoints as OpenAPI/Swagger specification
 * @param {Array} endpoints - Array of endpoint objects
 * @returns {Object} OpenAPI specification
 */
export const generateOpenAPISpec = (endpoints = []) => {
  const paths = {};
  
  endpoints.forEach(endpoint => {
    const { path, method, ...rest } = endpoint;
    
    if (!paths[path]) {
      paths[path] = {};
    }
    
    paths[path][method.toLowerCase()] = rest;
  });
  
  return {
    openapi: '3.0.0',
    info: {
      title: 'API Documentation',
      version: '1.0.0',
      description: 'Automatically generated API documentation'
    },
    paths
  };
};
