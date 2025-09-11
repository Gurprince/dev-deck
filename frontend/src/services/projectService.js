// frontend/src/services/projectService.js
import axios from "axios";

export const saveProject = async (code, routes) => {
  const response = await axios.post("http://localhost:3000/api/projects", {
    code,
    name: "Untitled Project",
  });
  return response.data;
};

export const loadProject = async (id) => {
  const response = await axios.get(`http://localhost:3000/api/projects/${id}`);
  return response.data;
};

export const getVersions = async (projectId) => {
  const response = await axios.get(
    `http://localhost:3000/api/projects/${projectId}/versions`
  );
  return response.data;
};

export const rollbackVersion = async (projectId, versionId) => {
  const response = await axios.post(
    `http://localhost:3000/api/projects/${projectId}/rollback/${versionId}`
  );
  return response.data;
};

export const deployProject = async (projectId) => {
  const response = await axios.post(
    `http://localhost:3000/api/projects/${projectId}/deploy`
  );
  return response.data;
};
