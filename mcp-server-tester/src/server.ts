import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { MCPClient } from './client/MCPClient';
import { ConfigLoader, DEFAULT_CONFIG_FILENAME } from './client/ConfigLoader';
import { TestGenerator } from './test-generator/TestGenerator';
import { ResponseValidator } from './validator/ResponseValidator';
import { Reporter } from './reporter/Reporter';
import { TesterConfig, TestResult } from './types';

// Load environment variables from .env file
dotenv.config();

// Check for local .env in current working directory
const localEnvPath = path.join(process.cwd(), '.env');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

// Default configuration
const DEFAULT_CONFIG = {
  numTestsPerTool: 3,
  timeoutMs: 10000,
  outputFormat: 'console',
  verbose: false
} as const;

const app = express();
const port = process.env.PORT || 3000;

// Middleware for JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
const publicPath = path.join(__dirname, 'public');
// Create public directory if it doesn't exist
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
}
app.use(express.static(publicPath));

// Create test config from the full config
function createTestConfig(fullConfig: any): TesterConfig {
  return {
    servers: Object.keys(fullConfig.mcpServers || {}),
    numTestsPerTool: fullConfig.numTestsPerTool || DEFAULT_CONFIG.numTestsPerTool,
    timeoutMs: fullConfig.timeoutMs || DEFAULT_CONFIG.timeoutMs,
    outputFormat: fullConfig.outputFormat || DEFAULT_CONFIG.outputFormat,
    outputPath: fullConfig.outputPath,
    verbose: fullConfig.verbose !== undefined ? fullConfig.verbose : DEFAULT_CONFIG.verbose
  };
}

// API endpoint to list available servers
app.get('/api/servers', (req: Request, res: Response) => {
  try {
    const configLoader = new ConfigLoader();
    configLoader.loadConfig();
    const serverNames = configLoader.getServerNames();
    
    if (serverNames.length === 0) {
      return res.json({ status: 'success', message: 'No MCP servers found in config file.', servers: [] });
    }
    
    return res.json({ status: 'success', servers: serverNames });
  } catch (error) {
    console.error('Error loading server list:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to load server list' });
  }
});

// API endpoint to get server details
app.get('/api/servers/:serverName', (req: Request, res: Response) => {
  try {
    const { serverName } = req.params;
    const configLoader = new ConfigLoader();
    configLoader.loadConfig();
    const serverConfig = configLoader.getServerConfig(serverName);
    
    if (!serverConfig) {
      return res.status(404).json({ status: 'error', message: `Server '${serverName}' not found` });
    }
    
    return res.json({ status: 'success', server: { name: serverName, config: serverConfig } });
  } catch (error) {
    console.error(`Error getting server details:`, error);
    return res.status(500).json({ status: 'error', message: 'Failed to get server details' });
  }
});

// API endpoint to list tools for a server
app.get('/api/servers/:serverName/tools', async (req: Request, res: Response) => {
  let client: MCPClient | null = null;
  
  try {
    const { serverName } = req.params;
    client = new MCPClient();
    
    console.log(`Connecting to MCP server: ${serverName}...`);
    await client.connect(serverName);
    
    const tools = await client.listTools();
    return res.json({ status: 'success', serverName, toolCount: tools.length, tools });
  } catch (error) {
    console.error(`Error listing tools:`, error);
    return res.status(500).json({ status: 'error', message: 'Failed to list tools' });
  } finally {
    if (client) {
      await client.disconnect();
    }
  }
});

// API endpoint to run tests for a server
app.post('/api/servers/:serverName/test', async (req: Request, res: Response) => {
  let client: MCPClient | null = null;
  
  try {
    const { serverName } = req.params;
    const { numTestsPerTool, timeoutMs } = req.body;
    
    // Validate request parameters
    const testConfig: TesterConfig = {
      servers: [serverName],
      numTestsPerTool: numTestsPerTool || DEFAULT_CONFIG.numTestsPerTool,
      timeoutMs: timeoutMs || DEFAULT_CONFIG.timeoutMs,
      outputFormat: 'json',
      verbose: false
    };
    
    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Anthropic API key is required. Set it using the ANTHROPIC_API_KEY environment variable or in a .env file.' 
      });
    }
    
    // Check if server exists in config
    const configLoader = new ConfigLoader();
    configLoader.loadConfig();
    if (!configLoader.hasServer(serverName)) {
      return res.status(404).json({
        status: 'error',
        message: `Server '${serverName}' not found in configuration`
      });
    }
    
    // Add the API key to the config for internal use only
    testConfig.anthropicApiKey = apiKey;
    
    // Initialize client
    client = new MCPClient();
    console.log(`Connecting to MCP server: ${serverName}...`);
    
    // Connect to server with timeout
    const connectionPromise = client.connect(serverName);
    
    // Set up timeout for connection
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), testConfig.timeoutMs);
    });
    
    // Wait for connection or timeout
    await Promise.race([connectionPromise, timeoutPromise]);
    
    // Get available tools
    const tools = await client.listTools();
    
    if (tools.length === 0) {
      return res.json({ 
        status: 'success', 
        message: 'No tools found in the MCP server. Nothing to test.',
        results: []
      });
    }

    // Initialize components
    const validator = new ResponseValidator();
    const testGenerator = new TestGenerator(apiKey);
    
    // Generate tests
    console.log(`Generating ${testConfig.numTestsPerTool} tests per tool...`);
    const testCases = await testGenerator.generateTests(tools, testConfig);
    
    // Run tests
    console.log('Running tests...');
    const results: TestResult[] = [];

    for (const testCase of testCases) {
      console.log(`Testing ${testCase.toolName}: ${testCase.description}`);
      
      try {
        // Execute the tool with timeout
        const startTime = Date.now();
        
        const toolPromise = client.executeTool(testCase.toolName, testCase.inputs);
        const toolTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Tool execution timeout')), testConfig.timeoutMs);
        });
        
        const response = await Promise.race([toolPromise, toolTimeoutPromise]);
        const executionTime = Date.now() - startTime;
        
        // Validate the response
        const validationResult = validator.validateResponse(response, testCase);
        
        // Create test result
        const testResult: TestResult = {
          testCase,
          passed: validationResult.valid,
          response,
          executionTime,
          validationErrors: validationResult.errors
        };
        
        results.push(testResult);
      } catch (error) {
        // Handle test execution error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        const testResult: TestResult = {
          testCase,
          passed: false,
          validationErrors: [errorMessage]
        };
        
        results.push(testResult);
      }
    }
    
    // Return results
    return res.json({ 
      status: 'success', 
      serverName,
      testCount: results.length,
      passCount: results.filter(r => r.passed).length,
      failCount: results.filter(r => !r.passed).length,
      results
    });
  } catch (error) {
    console.error(`Error running tests:`, error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Failed to run tests',
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  } finally {
    if (client) {
      await client.disconnect();
    }
  }
});

// API endpoint to execute a single tool
app.post('/api/servers/:serverName/tools/:toolName/execute', async (req: Request, res: Response) => {
  let client: MCPClient | null = null;
  
  try {
    const { serverName, toolName } = req.params;
    const inputs = req.body;
    
    // Initialize client
    client = new MCPClient();
    console.log(`Connecting to MCP server: ${serverName}...`);
    await client.connect(serverName);
    
    // Execute the tool
    const response = await client.executeTool(toolName, inputs);
    
    return res.json({ 
      status: 'success', 
      serverName,
      toolName,
      inputs,
      response
    });
  } catch (error) {
    console.error(`Error executing tool:`, error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Failed to execute tool',
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  } finally {
    if (client) {
      await client.disconnect();
    }
  }
});

// Serve the main app for all other routes
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`MCP Server Tester API running on port ${port}`);
  console.log(`Web interface available at http://localhost:${port}`);
  console.log(`API endpoints:`);
  console.log(`  GET  /api/servers - List all available servers`);
  console.log(`  GET  /api/servers/:serverName - Get server details`);
  console.log(`  GET  /api/servers/:serverName/tools - List tools for a server`);
  console.log(`  POST /api/servers/:serverName/test - Run tests for a server`);
  console.log(`  POST /api/servers/:serverName/tools/:toolName/execute - Execute a tool`);
}); 