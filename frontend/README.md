# DevDeck - Frontend

## Overview
DevDeck is a modern, collaborative code editor and project management platform built with React and Vite. The frontend provides a responsive and intuitive interface for real-time code collaboration, project management, and team communication.

## Features

- **Code Editor** - Monaco Editor with syntax highlighting and IntelliSense
- **Real-time Collaboration** - Multiple users can edit code simultaneously
- **Project Management** - Create, organize, and manage coding projects
- **User Authentication** - Secure login and registration
- **Real-time Chat** - Built-in chat for team communication
- **Responsive Design** - Works on desktop and tablet devices
- **Themes** - Light and dark mode support

## Tech Stack

- **Framework**: React 18+
- **Bundler**: Vite
- **State Management**: React Query (TanStack Query)
- **Styling**: Tailwind CSS
- **UI Components**: Headless UI, Hero Icons
- **Code Editor**: Monaco Editor
- **Real-time**: Socket.IO Client
- **Routing**: React Router v6
- **Form Handling**: React Hook Form
- **Notifications**: React Hot Toast

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9.0.0 or higher)
- Backend server (see [backend README](../backend/README.md))

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the frontend root directory with the following variables:
   ```env
   VITE_API_URL=http://localhost:5000
   VITE_WS_URL=ws://localhost:5000
   ```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view it in your browser.

### Building for Production

```bash
npm run build
```

This will create a `dist` directory with the production build.

## Project Structure

```
src/
├── assets/         # Static assets (images, icons, etc.)
├── components/     # Reusable UI components
│   ├── common/     # Common components used across the app
│   ├── editor/     # Code editor related components
│   ├── layout/     # Layout components
│   └── ui/         # Base UI components
├── constants/      # Application constants
├── context/        # React context providers
├── hooks/          # Custom React hooks
├── pages/          # Page components
├── services/       # API and service layer
├── styles/         # Global styles and Tailwind config
└── utils/          # Utility functions
```

## Environment Variables

- `VITE_API_URL` - Base URL for API requests (default: `http://localhost:5000`)
- `VITE_WS_URL` - WebSocket URL for real-time features (default: `ws://localhost:5000`)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


