// frontend/src/services/parserService.js
import axios from "axios";

export const parseRoutes = async (code) => {
  const response = await axios.post("http://localhost:3000/api/parse", {
    code,
  });
  return response.data;
};

export const generateSwaggerSpec = (routes) => {
  return {
    openapi: "3.0.0",
    info: { title: "DevDeck API", version: "1.0.0" },
    paths: routes.reduce(
      (acc, route) => ({
        ...acc,
        [route.path]: {
          [route.method.toLowerCase()]: {
            summary: route.description,
            operationId: route.operationId,
            responses: { 200: { description: "Successful response" } },
          },
        },
      }),
      {}
    ),
  };
};
