import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['admin', 'editor', 'viewer'],
      default: 'editor'
    }
  }],
  invitations: [{
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    role: { 
      type: String, 
      enum: ['admin', 'editor', 'viewer'], 
      default: 'editor' 
    },
    status: { 
      type: String, 
      enum: ['pending', 'accepted', 'declined'], 
      default: 'pending' 
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    invitedAt: {
      type: Date,
      default: Date.now
    }
  }],
  code: {
    type: String,
    default: '// Write your code here\n// This is a sample Express.js route\napp.get(\'/api/hello\', (req, res) => {\n  res.json({ message: \'Hello from DevDeck!\' });\n});'
  },
  endpoints: [{
    path: String,
    method: String,
    description: String,
    parameters: [{
      name: String,
      type: String,
      required: Boolean,
      description: String
    }],
    response: Object
  }],
  logs: [
    new mongoose.Schema({
      type: { type: String, default: 'execution' },
      output: { type: String, default: '' },
      timestamp: { type: Date, default: Date.now }
    }, { _id: false })
  ],
  isPublic: {
    type: Boolean,
    default: false
  },
  runPort: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
projectSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for better query performance
projectSchema.index({ owner: 1 });
projectSchema.index({ 'collaborators.user': 1 });
projectSchema.index({ name: 'text', description: 'text' });

const Project = mongoose.model('Project', projectSchema);

export default Project;
