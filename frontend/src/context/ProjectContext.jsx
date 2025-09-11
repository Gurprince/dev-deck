// frontend/src/context/ProjectContext.jsx
import { createContext, useState } from "react";
import { defaultExpressCode } from "../constants/boilerplate";
export const ProjectContext = createContext();

export const ProjectProvider = ({ children }) => {
  const [code, setCode] = useState(defaultExpressCode);
  const [routes, setRoutes] = useState([
    {
      method: "GET",
      path: "/api/users",
      description: "Fetch all users",
      operationId: "getUsers",
    },
    {
      method: "POST",
      path: "/api/users",
      description: "Create a user",
      operationId: "createUser",
    },
  ]);
  const [projectId, setProjectId] = useState(null); // Add projectId state

  return (
    <ProjectContext.Provider
      value={{ code, setCode, routes, setRoutes, projectId, setProjectId }}
    >
      {children}
    </ProjectContext.Provider>
  );
};
