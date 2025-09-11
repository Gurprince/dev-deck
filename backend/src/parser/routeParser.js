// backend/src/parser/routeParser.js
import { parse } from "acorn";
import { simple } from "acorn-walk";

export const parseRoutes = (code) => {
  const routes = [];
  try {
    const ast = parse(code, { ecmaVersion: 2020, sourceType: "module" });
    simple(ast, {
      CallExpression(node) {
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.name === "app" &&
          ["get", "post", "put", "delete"].includes(node.callee.property.name)
        ) {
          const method = node.callee.property.name.toUpperCase();
          const path = node.arguments[0]?.value || "";
          routes.push({
            method,
            path,
            description: `Auto-detected ${method} route`,
            operationId: `${method.toLowerCase()}${path.replace(
              /\/|\//g,
              "_"
            )}`,
          });
        }
      },
    });
  } catch (error) {
    console.error("Route parsing error:", error);
  }
  return routes;
};
