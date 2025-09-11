// backend/src/routes/projectRoutes.js
import express from 'express';
import { body, validationResult } from 'express-validator';
import Project from '../models/Project.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware to check project ownership or collaboration
const checkProjectAccess = async (req, res, next) => {
  try {
    const currentUserId = req.user?.userId?.toString();
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isOwner = project.owner && project.owner.toString() === currentUserId;
    const isCollaborator = project.collaborators?.some(
      (c) => c.user?.toString() === currentUserId
    );
    const isPublic = Boolean(project.isPublic);

    // If no owner is set yet, claim ownership for current user to fix legacy records
    if (!project.owner && currentUserId) {
      project.owner = currentUserId;
      try { await project.save(); } catch {}
      req.project = project;
      return next();
    }

    // Allow if owner/collaborator/public
    if (isOwner || isCollaborator || isPublic) {
      req.project = project;
      return next();
    }

    return res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    next(error);
  }
};

// Create a new project
router.post('/', authenticateToken, [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('description').optional().trim(),
  body('isPublic').optional().isBoolean()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const project = new Project({
      ...req.body,
      owner: req.user.userId
    });

    await project.save();
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

// Get all projects for the authenticated user
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    console.log('Fetching projects for user:', req.user.userId);
    
    const projects = await Project.find({
      $or: [
        { owner: req.user.userId },
        { 'collaborators.user': req.user.userId }
      ]
    }).sort({ updatedAt: -1 });

    console.log(`Found ${projects.length} projects for user ${req.user.userId}`);
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    next(error);
  }
});

// Get a single project
router.get('/:id', authenticateToken, checkProjectAccess, (req, res) => {
  res.json(req.project);
});

// Update project
router.put('/:id', authenticateToken, checkProjectAccess, async (req, res, next) => {
  try {
    // Allow owner or collaborators with admin/editor role; if owner is missing, claim ownership on first update
    const isOwner = req.project.owner && req.project.owner.toString() === req.user.userId;
    const isPrivilegedCollaborator = req.project.collaborators?.some(
      (c) => c.user?.toString() === req.user.userId && ['admin', 'editor'].includes(c.role)
    );

    // Determine requested updates
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'description', 'isPublic', 'code', 'endpoints'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));
    if (!isValidOperation) {
      return res.status(400).json({ message: 'Invalid updates' });
    }

    // If no owner, claim ownership
    if (!req.project.owner) {
      req.project.owner = req.user.userId;
    }

    // If not owner/privileged but updating only safe fields, allow it
    const safeUpdates = ['code', 'name', 'description'];
    const isSafeOnly = updates.every((u) => safeUpdates.includes(u));
    if (!isOwner && !isPrivilegedCollaborator && !isSafeOnly) {
      return res.status(403).json({ message: 'Only the project owner can update this project' });
    }

    updates.forEach(update => req.project[update] = req.body[update]);
    await req.project.save();
    
    res.json(req.project);
  } catch (error) {
    next(error);
  }
});

// Delete project (MVP: any authenticated user with access can delete)
router.delete('/:id', authenticateToken, checkProjectAccess, async (req, res, next) => {
  try {
    await Project.deleteOne({ _id: req.params.id });
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Add collaborator to project
router.post('/:id/collaborators', authenticateToken, checkProjectAccess, async (req, res, next) => {
  try {
    const { userId, role } = req.body;
    
    if (!userId || !role) {
      return res.status(400).json({ message: 'User ID and role are required' });
    }

    // Check if user is already a collaborator
    const collaboratorExists = req.project.collaborators.some(
      collab => collab.user.toString() === userId
    );

    if (collaboratorExists) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    req.project.collaborators.push({ user: userId, role });
    await req.project.save();
    
    res.status(201).json(req.project);
  } catch (error) {
    next(error);
  }
});

// Remove collaborator from project
router.delete('/:id/collaborators/:userId', authenticateToken, checkProjectAccess, async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Only owner can remove collaborators
    if (req.project.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Only the project owner can remove collaborators' });
    }

    req.project.collaborators = req.project.collaborators.filter(
      collab => collab.user.toString() !== userId
    );
    
    await req.project.save();
    res.json({ message: 'Collaborator removed successfully' });
  } catch (error) {
    next(error);
  }
});

// Get version history for a project
router.get('/:id/versions', authenticateToken, checkProjectAccess, async (req, res, next) => {
  try {
    // Implement version history logic here
    res.json({ message: 'Version history endpoint' });
  } catch (error) {
    next(error);
  }
});

// Rollback to a previous version
router.post('/:id/rollback/:versionId', authenticateToken, checkProjectAccess, async (req, res, next) => {
  try {
    // Implement rollback logic here
    res.json({ message: 'Rollback endpoint' });
  } catch (error) {
    next(error);
  }
});

// Deploy project
router.post('/:id/deploy', authenticateToken, checkProjectAccess, async (req, res, next) => {
  try {
    // Implement deployment logic here
    res.json({ message: 'Deployment endpoint' });
  } catch (error) {
    next(error);
  }
});

// Run project
router.post('/:id/run', authenticateToken, checkProjectAccess, async (req, res, next) => {
  try {
    const { method, path } = req.body;
    // Implement run logic here
    res.json({ message: 'Run endpoint' });
  } catch (error) {
    next(error);
  }
});

export default router;
