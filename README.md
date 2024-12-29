# Distributed File Storage System

This system is a simplified version of Google Drive with limited features. It focuses on file storage, consistency, and availability using a distributed architecture.

## Features

- **File Storage**: Supports public and private file management.
- **Distributed Architecture**: Files are distributed across multiple servers.
- **Consistency and Availability**: Ensures private files are available on at least one server while public files are shared across all peers.

## Project Structure

```
|--frontend/
|   ...
|--backend/
|   ...
|--server_A_FileSystem/
|   |-- public/
|   |   |-- {username}/
|   |   |   |-- file1
|   |   |   |-- file2
|   |-- private/
|   |   |-- {username}/
|   |   |   |-- file1
|   |   |   |-- file2
|--server_B_FileSystem/
|   ...
|--server_C_FileSystem/
|   ...
```

### Frontend

The frontend is a single-page application (SPA) built with React.js.

### Backend

- **Load Balancer (Nginx)**: Distributes incoming requests across three Node.js servers.
- **Node.js Servers**:
  - Each server manages its own file system with `public` and `private` directories.
  - Files are organized by username within these directories.
  - Servers handle file upload and management.

#### File Distribution

- **Public Files**: Shared across all peers.
- **Private Files**: Stored on specific servers, ensuring that each user's private files are stored on at least one server.

## How to Start the Project

### Step 1: Prepare File Systems

1. In the root directory of this project, create your own copies of file systems for each server.
2. Follow the exact directory structure and naming patterns as described above.

### Step 2: Configure and Start Nginx

1. Replace the `nginx.config` file with the provided configuration file.
2. Move the updated file to the `conf` folder inside your Nginx setup directory.
3. Start Nginx.

### Step 3: Start the Node.js Servers

1. Navigate to the backend directory:
   cd ./backend
2. Start each server in a new terminal window:
   - Server A:
     node app.js 3000 "server_A"
   - Server B:
     node app.js 3001 "server_B"
   - Server C:
     node app.js 3002 "server_C"
3. (Optional) Add more servers by following the naming conventions and updating `backend/src/config.js` with the new server details.

### Step 4: Start the Frontend

1. Navigate to the frontend directory:
   cd ./frontend
2. Start the application:
   npm start

### Step 5: Connect Clients

You can run multiple clients by repeating Step 4 in separate terminal windows.

## Notes

- Ensure the file system directories and configurations match the defined structure.
- Verify that Nginx is properly configured to route requests to the respective servers.
- Use unique usernames for directory organization to avoid conflicts.

---

