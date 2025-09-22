// backend/src/routes/projectRoutes.js
import express from 'express';
import mongoose from 'mongoose';
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
router.post('/:id/collaborators', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['editor', 'viewer']).withMessage('Invalid role')
], authenticateToken, checkProjectAccess, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, role = 'editor' } = req.body;
    
    // Find user by email
    const User = mongoose.model('User');
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found with this email' 
      });
    }

    const userId = user._id;
    const projectId = req.params.id;

    // Check if user is the project owner
    if (req.project.owner.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'User is the project owner'
      });
    }

    // If already collaborator
    const isAlreadyCollaborator = req.project.collaborators.some(
      c => c.user?.toString() === userId.toString()
    );
    
    if (isAlreadyCollaborator) {
      return res.status(400).json({ 
        success: false,
        message: 'User is already a collaborator on this project' 
      });
    }

    // If already invited and pending
    const hasPendingInvite = req.project.invitations?.some(
      inv => inv.user?.toString() === userId.toString() && inv.status === 'pending'
    );
    
    if (hasPendingInvite) {
      return res.status(400).json({ 
        success: false,
        message: 'Invitation is already pending for this user' 
      });
    }

    // Create invitation
    const invitation = {
      user: userId,
      email: user.email,
      role,
      status: 'pending',
      invitedBy: req.user.userId,
      invitedAt: new Date()
    };

    // Add to invitations array
    await Project.findByIdAndUpdate(
      projectId,
      { $push: { invitations: invitation } },
      { new: true, runValidators: true }
    );
    
    // Get updated project with populated data
    const updatedProject = await Project.findById(projectId)
      .populate('collaborators.user', 'name email')
      .populate('owner', 'name email');
    
    // Get updated collaborators list
    const collaborators = await getProjectCollaborators(projectId);
    
    // Emit update to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.to(projectId).emit('collaborator-update', collaborators);
    }
    
    res.status(201).json({ 
      success: true,
      message: 'Invitation sent successfully',
      data: {
        invitation,
        collaborators
      }
    });
    
  } catch (error) {
    console.error('Error adding collaborator:', error);
    
    // More specific error handling
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to send invitation',
      error: error.message
    });
  }
});

// Helper function to get project collaborators with user data
async function getProjectCollaborators(projectId) {
  const project = await Project.findById(projectId)
    .populate('collaborators.user', 'name email')
    .populate('owner', 'name email');

  if (!project) return [];

  const collaborators = [];
  const seenUserIds = new Set();
  
  // Add owner as a collaborator with admin role
  if (project.owner) {
    const ownerId = project.owner._id.toString();
    collaborators.push({
      userId: ownerId,
      name: project.owner.name || 'Project Owner',
      email: project.owner.email,
      role: 'owner',
      status: 'online',
      avatarText: project.owner.name ? project.owner.name.charAt(0).toUpperCase() : 'U',
      color: stringToColor(ownerId)
    });
    seenUserIds.add(ownerId);
  }
  
  // Add other collaborators
  for (const collab of project.collaborators) {
    if (!collab.user) continue;
    
    const userId = collab.user._id.toString();
    if (seenUserIds.has(userId) || userId === project.owner?._id?.toString()) continue;
    
    const name = collab.user.name || `User ${userId.slice(-4)}`;
    collaborators.push({
      userId,
      name,
      email: collab.user.email,
      role: collab.role || 'editor',
      status: 'online',
      avatarText: name.charAt(0).toUpperCase(),
      color: stringToColor(userId)
    });
    
    seenUserIds.add(userId);
  }
  
  return collaborators;
}

// Utility function to generate consistent colors for user avatars
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}
// List invitations for a project (owner/admin/editor)
router.get('/:id/invitations', authenticateToken, checkProjectAccess, async (req, res, next) => {
  try {
    res.json(req.project.invitations || []);
  } catch (error) {
    next(error);
  }
});

// Get pending invitations for the current user
router.get('/invitations/me', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;
    
    // Find all projects where the user has a pending invitation
    // First, validate the user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Find all projects where the user has a pending invitation
    const projects = await Project.aggregate([
      {
        $match: {
          'invitations': {
            $elemMatch: {
              $or: [
                { user: new mongoose.Types.ObjectId(userId), status: 'pending' },
                { email: userEmail, status: 'pending' }
              ]
            }
          }
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          owner: 1,
          invitations: {
            $filter: {
              input: '$invitations',
              as: 'invite',
              cond: {
                $and: [
                  { $eq: ['$$invite.status', 'pending'] },
                  {
                    $or: [
                      { $eq: ['$$invite.user', new mongoose.Types.ObjectId(userId)] },
                      { $eq: ['$$invite.email', userEmail] }
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    // Format the response to include project details with invitations
    const invitations = projects.flatMap(project => {
      return project.invitations.map(invite => ({
        _id: invite._id,
        project: {
          _id: project._id.toString(),
          name: project.name,
          description: project.description || '',
          owner: project.owner?.toString() || ''
        },
        role: invite.role,
        invitedBy: invite.invitedBy?.toString() || '',
        invitedAt: invite.invitedAt
      }));
    });

    res.json(invitations);
  } catch (error) {
    console.error('Error fetching user invitations:', error);
    next(error);
  }
});

// Accept or decline invitation by invited user
router.post('/:id/invitations/:invitationId/:action', authenticateToken, async (req, res, next) => {
  // Validate action parameter
  if (!['accept', 'decline'].includes(req.params.action)) {
    return res.status(400).json({ message: 'Invalid action. Must be either "accept" or "decline"' });
  }
  
  try {
    const { id, invitationId, action } = req.params;
    const userId = req.user.userId;
    
    // Find the project and populate necessary fields
    const project = await Project.findById(id)
      .populate('collaborators.user', 'email')
      .populate('owner', 'email');
      
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Find the invitation
    const invitation = project.invitations.id(invitationId);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }
    
    // Verify the invitation is for the current user
    try {
      // Get user email from database if not in token
      if (!req.user.email) {
        const userDoc = await mongoose.model('User').findById(userId).select('email');
        if (userDoc) {
          req.user.email = userDoc.email;
        }
      }

      console.log('Verifying invitation access:', {
        invitationUserId: invitation.user?.toString(),
        currentUserId: userId,
        invitationEmail: invitation.email,
        userEmail: req.user.email,
        rawInvitation: JSON.stringify(invitation)
      });

      // Check user ID match (if invitation has a user ID)
      let isUserMatch = false;
      if (invitation.user) {
        // Convert both to strings for comparison
        const invitationUserId = invitation.user.toString();
        isUserMatch = invitationUserId === userId.toString();
      }
      
      // Check email match (if invitation has an email)
      let isEmailMatch = false;
      if (invitation.email && req.user.email) {
        const invitationEmail = invitation.email.toString().trim().toLowerCase();
        const userEmail = req.user.email.toString().trim().toLowerCase();
        isEmailMatch = invitationEmail === userEmail;
      }
      
      // Always grant access if the user is the project owner
      const isProjectOwner = project.owner && 
        (project.owner._id?.toString() === userId.toString() || project.owner.toString() === userId.toString());
      
      // If the invitation user ID matches the current user ID exactly, always grant access
      // This handles the case where the IDs are the same but the comparison fails
      const exactIdMatch = invitation.user && userId && 
        invitation.user.toString() === userId.toString();
      
      const hasAccess = isUserMatch || isEmailMatch || isProjectOwner || exactIdMatch;
      
      console.log('Access check result:', {
        isUserMatch,
        isEmailMatch,
        isProjectOwner,
        exactIdMatch,
        hasAccess,
        userFieldType: typeof invitation.user,
        userFieldValue: invitation.user?.toString(),
        userIdValue: userId.toString()
      });
      
      if (!hasAccess) {
        const errorDetails = {
          message: 'Invitation access denied',
          details: {
            invitationUserId: invitation.user?.toString(),
            currentUserId: userId.toString(),
            invitationEmail: invitation.email,
            userEmail: req.user.email,
            isUserMatch,
            isEmailMatch,
            isProjectOwner,
            exactIdMatch
          }
        };
        console.error('Invitation verification failed:', errorDetails);
        return res.status(403).json(errorDetails);
      }
    } catch (error) {
      console.error('Error during invitation verification:', error);
      return res.status(500).json({ 
        message: 'Error verifying invitation',
        error: error.message,
        details: {
          invitationUserId: invitation.user?.toString(),
          currentUserId: userId,
          invitationEmail: invitation.email,
          userEmail: req.user.email
        }
      });
    }
    
    // Update invitation status
    invitation.status = action === 'accept' ? 'accepted' : 'declined';
    
    if (action === 'accept') {
      // Check if user is already a collaborator
      const isAlreadyCollaborator = project.collaborators.some(
        c => c.user && c.user._id.toString() === userId
      );
      
      if (!isAlreadyCollaborator) {
        project.collaborators.push({
          user: userId,
          role: invitation.role || 'editor'
        });
      }
    }
    
    await project.save();
    
    // Emit update to all connected clients
    req.app.get('io').to(id).emit('collaborator-update', 
      await getProjectCollaborators(project._id));
    
    res.json({ 
      message: `Invitation ${invitation.status}`, 
      project: project.toObject() 
    });
  } catch (error) {
    next(error);
  }
});

// Remove collaborator from project
router.delete('/:id/collaborators/:userId', authenticateToken, checkProjectAccess, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    
    // Find the project with populated collaborators
    const project = await Project.findById(req.params.id)
      .populate('collaborators.user', 'email')
      .populate('owner', 'email');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is the owner (owners can't be removed this way)
    if (project.owner?._id.toString() === userId) {
      return res.status(400).json({ message: 'Project owner cannot be removed as collaborator' });
    }
    
    // Check if the current user is the owner or an admin
    const isOwner = project.owner?._id.toString() === currentUserId;
    const isAdmin = project.collaborators.some(
      c => c.user?._id.toString() === currentUserId && c.role === 'admin'
    );
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Only project owner or admin can remove collaborators' });
    }
    
    // Remove from collaborators
    const initialCount = project.collaborators.length;
    project.collaborators = project.collaborators.filter(
      c => c.user?._id.toString() !== userId
    );
    
    if (project.collaborators.length === initialCount) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }
    
    await project.save();
    
    // Emit update to all connected clients
    req.app.get('io').to(project._id.toString()).emit('collaborator-update', 
      await getProjectCollaborators(project._id));
    
    res.json({ message: 'Collaborator removed successfully' });
  } catch (error) {
    console.error('Error removing collaborator:', error);
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
