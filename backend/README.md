# DevDeck - Backend Service

## Overview
DevDeck is a collaborative code editor and project management platform. The backend is built with Node.js, Express, and MongoDB, providing real-time collaboration features through WebSockets and Server-Sent Events (SSE).

## Features

- **User Authentication** - JWT-based authentication with email/password
- **Project Management** - Create, read, update, and delete projects
- **Real-time Collaboration** - Multiple users can collaborate on the same project in real-time
- **Code Execution** - Sandboxed code execution environment
- **Chat** - Real-time chat for project collaboration
- **API Documentation** - Auto-generated API documentation using Swagger

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.IO, Server-Sent Events (SSE)
- **API Documentation**: Swagger
- **Validation**: Express Validator
- **Environment Management**: dotenv

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (v6.0 or higher)
- npm (v9.0.0 or higher)

### Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/devdeck
   JWT_SECRET=your_jwt_secret_here
   NODE_ENV=development
   ```

### Running the Server

- Development mode (with hot-reload):
  ```bash
  npm run dev
  ```

- Production mode:
  ```bash
  npm start
  ```

## API Documentation

API documentation is available at `/api-docs` when the server is running.

## Project Structure

```
src/
├── config/         # Configuration files
├── middleware/     # Express middlewares
├── models/         # MongoDB models
├── routes/         # API routes
├── services/       # Business logic
└── utils/          # Utility functions
```

## Environment Variables

- `PORT` - Port to run the server on (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT token generation
- `NODE_ENV` - Application environment (development/production)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
