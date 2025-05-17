# MCP Server Tester - Server Mode

This document explains how to use the MCP Server Tester in server mode with a web interface for interacting with MCP servers.

## Overview

The MCP Server Tester can now be run as a standalone server with a web interface, allowing you to:

- List and select available MCP servers from your configuration
- View details about each MCP server
- List all tools available for a specific server
- Execute individual tools with custom inputs
- Run automated tests on all tools for a server

## Getting Started

### Prerequisites

- Node.js 18 or higher
- An Anthropic API key for generating test cases

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/r-huijts/mcp-server-tester.git
   cd mcp-server-tester
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Anthropic API key:
   ```bash
   echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
   ```

4. Build the project:
   ```bash
   npm run build
   ```

### Configuration

Before starting the server, make sure you have a `mcp-servers.json` file in the project root directory or create one using the command:

```bash
npm start -- --init
```

Then edit the generated file to add your MCP servers. See the main README for details on the configuration format.

## Running the Server

Start the server with:

```bash
npm run server
```

By default, the server will run on port 3000. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm run server
```

After starting the server, you can access the web interface at:
- http://localhost:3000 (or your custom port)

## Web Interface Usage

### Home Page
The home page shows all available MCP servers defined in your configuration. Click on a server card to select it.

### Server Details
After selecting a server, you'll see its details including:
- Server name
- Command and arguments used to start the server
- Environment variables

From this page, you can:
- Click "List Tools" to see all available tools for this server
- Click "Run Tests" to run automated tests on all tools

### Tools List
The tools list shows all tools available for the selected server, including:
- Tool name
- Tool description
- Input schema

For each tool, you can click "Execute" to test the tool with custom inputs.

### Execute Tool
The execute tool modal allows you to:
- Enter JSON inputs for the tool
- Execute the tool and see the response

### Test Results
When you run tests, you'll see a summary of the results including:
- Total number of tests
- Number of passed tests
- Number of failed tests
- Detailed results for each test

## API Endpoints

The server also provides REST API endpoints for programmatic access:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/servers` | GET | List all available servers |
| `/api/servers/:serverName` | GET | Get details for a specific server |
| `/api/servers/:serverName/tools` | GET | List all tools for a server |
| `/api/servers/:serverName/test` | POST | Run tests for a server |
| `/api/servers/:serverName/tools/:toolName/execute` | POST | Execute a specific tool |

### Example API Usage

```bash
# List all servers
curl http://localhost:3000/api/servers

# Get server details
curl http://localhost:3000/api/servers/filesystem

# List tools for a server
curl http://localhost:3000/api/servers/filesystem/tools

# Execute a tool
curl -X POST -H "Content-Type: application/json" -d '{"path": "./"}' \
  http://localhost:3000/api/servers/filesystem/tools/listFiles/execute

# Run tests
curl -X POST -H "Content-Type: application/json" -d '{"numTestsPerTool": 2}' \
  http://localhost:3000/api/servers/filesystem/test
```

## Production Deployment

When deploying to production, consider the following:

1. Set appropriate environment variables for security:
   ```bash
   PORT=8080 NODE_ENV=production ANTHROPIC_API_KEY=your-key-here npm run server
   ```

2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start npm --name "mcp-server-tester" -- run server
   ```

3. Set up a reverse proxy with Nginx or similar for HTTPS support.

## Troubleshooting

- **Can't access the web interface**: Make sure the server is running and check for any error messages in the console.
- **API key errors**: Ensure your Anthropic API key is correctly set in the `.env` file.
- **Connection errors**: Verify that your MCP servers configuration is correct and that the specified servers are accessible.
- **Testing failures**: Check the detailed test results for error messages that can help debug the issue.

For additional help, please refer to the main README or create an issue on GitHub. 