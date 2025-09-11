// backend/src/services/projectService.js
import { Project } from "../models/projectModel.js";
import { parseRoutes } from "../parser/routeParser.js";

export const saveProject = async (code, name = "Untitled Project") => {
  const routes = parseRoutes(code);
  const project = await Project.create({
    name,
    versions: [{ name: `Version ${Date.now()}`, code, routes }],
    collaborators: [],
  });
  return project;
};

export const loadProject = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");
  return project;
};

export const getVersions = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");
  return project.versions;
};

export const rollbackVersion = async (projectId, versionId) => {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");
  const version = project.versions.id(versionId);
  if (!version) throw new Error("Version not found");
  return { code: version.code, routes: version.routes };
};

export const deployProject = async (projectId) => {
  // Mock deployment (replace with Docker logic later)
  return {
    status: "deployed",
    url: `https://sandbox.devdeck.com/${projectId}`,
  };
};

export const updateCollaborators = async (projectId, collaborators) => {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");
  project.collaborators = collaborators;
  await project.save();
  return project.collaborators;
};
