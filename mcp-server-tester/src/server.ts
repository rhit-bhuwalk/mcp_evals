import express, { Request, Response, RequestHandler } from "express";
import path from "path";
import fs, { existsSync } from "fs";
import dotenv from "dotenv";
import { MCPClient } from "./client/MCPClient";
import { ConfigLoader, DEFAULT_CONFIG_FILENAME } from "./client/ConfigLoader";
import { TestGenerator } from "./test-generator/TestGenerator";
import { ResponseValidator } from "./validator/ResponseValidator";
import { Reporter } from "./reporter/Reporter";
import { TesterConfig, TestResult } from "./types";
import { spawn } from "child_process";
import { writeFile, mkdir, readFile } from "fs/promises";

// Load environment variables from .env file
dotenv.config();

// Check for local .env in current working directory
const localEnvPath = path.join(process.cwd(), ".env");
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

// Default configuration
const DEFAULT_CONFIG = {
  numTestsPerTool: 3,
  timeoutMs: 10000,
  outputFormat: "console",
  verbose: false,
} as const;

const app = express();
const port = process.env.PORT || 3000;

// Middleware for JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
const publicPath = path.join(__dirname, "public");
// Create public directory if it doesn't exist
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
}
app.use(express.static(publicPath));

// Create test config from the full config
function createTestConfig(fullConfig: any): TesterConfig {
  return {
    servers: Object.keys(fullConfig.mcpServers || {}),
    numTestsPerTool:
      fullConfig.numTestsPerTool || DEFAULT_CONFIG.numTestsPerTool,
    timeoutMs: fullConfig.timeoutMs || DEFAULT_CONFIG.timeoutMs,
    outputFormat: fullConfig.outputFormat || DEFAULT_CONFIG.outputFormat,
    outputPath: fullConfig.outputPath,
    verbose:
      fullConfig.verbose !== undefined
        ? fullConfig.verbose
        : DEFAULT_CONFIG.verbose,
  };
}

// API endpoint to list available servers
app.get("/api/servers", (req: Request, res: Response) => {
  try {
    const configLoader = new ConfigLoader();
    configLoader.loadConfig();
    const serverNames = configLoader.getServerNames();

    if (serverNames.length === 0) {
      return res.json({
        status: "success",
        message: "No MCP servers found in config file.",
        servers: [],
      });
    }

    return res.json({ status: "success", servers: serverNames });
  } catch (error) {
    console.error("Error loading server list:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Failed to load server list" });
  }
});

// API endpoint to get server details
app.get("/api/servers/:serverName", (req: Request, res: Response) => {
  try {
    const { serverName } = req.params;
    const configLoader = new ConfigLoader();
    configLoader.loadConfig();
    const serverConfig = configLoader.getServerConfig(serverName);

    if (!serverConfig) {
      return res
        .status(404)
        .json({ status: "error", message: `Server '${serverName}' not found` });
    }

    return res.json({
      status: "success",
      server: { name: serverName, config: serverConfig },
    });
  } catch (error) {
    console.error(`Error getting server details:`, error);
    return res
      .status(500)
      .json({ status: "error", message: "Failed to get server details" });
  }
});

// API endpoint to list tools for a server
app.get(
  "/api/servers/:serverName/tools",
  async (req: Request, res: Response) => {
    let client: MCPClient | null = null;

    try {
      const { serverName } = req.params;
      client = new MCPClient();

      console.log(`Connecting to MCP server: ${serverName}...`);
      await client.connect(serverName);

      const tools = await client.listTools();
      return res.json({
        status: "success",
        serverName,
        toolCount: tools.length,
        tools,
      });
    } catch (error) {
      console.error(`Error listing tools:`, error);
      return res
        .status(500)
        .json({ status: "error", message: "Failed to list tools" });
    } finally {
      if (client) {
        await client.disconnect();
      }
    }
  }
);

// API endpoint to run tests for a server
app.post(
  "/api/servers/:serverName/test",
  async (req: Request, res: Response) => {
    let client: MCPClient | null = null;

    try {
      const { serverName } = req.params;
      const { numTestsPerTool, timeoutMs } = req.body;

      // Validate request parameters
      const testConfig: TesterConfig = {
        servers: [serverName],
        numTestsPerTool: numTestsPerTool || DEFAULT_CONFIG.numTestsPerTool,
        timeoutMs: timeoutMs || DEFAULT_CONFIG.timeoutMs,
        outputFormat: "json",
        verbose: false,
      };

      // Check for API key
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          status: "error",
          message:
            "Anthropic API key is required. Set it using the ANTHROPIC_API_KEY environment variable or in a .env file.",
        });
      }

      // Check if server exists in config
      const configLoader = new ConfigLoader();
      configLoader.loadConfig();
      if (!configLoader.hasServer(serverName)) {
        return res.status(404).json({
          status: "error",
          message: `Server '${serverName}' not found in configuration`,
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
        setTimeout(
          () => reject(new Error("Connection timeout")),
          testConfig.timeoutMs
        );
      });

      // Wait for connection or timeout
      await Promise.race([connectionPromise, timeoutPromise]);

      // Get available tools
      const tools = await client.listTools();

      if (tools.length === 0) {
        return res.json({
          status: "success",
          message: "No tools found in the MCP server. Nothing to test.",
          results: [],
        });
      }

      // Initialize components
      const validator = new ResponseValidator();
      const testGenerator = new TestGenerator(apiKey);

      // Generate tests
      console.log(`Generating ${testConfig.numTestsPerTool} tests per tool...`);
      const testCases = await testGenerator.generateTests(tools, testConfig);

      // Run tests
      console.log("Running tests...");
      const results: TestResult[] = [];

      for (const testCase of testCases) {
        console.log(`Testing ${testCase.toolName}: ${testCase.description}`);

        try {
          // Execute the tool with timeout
          const startTime = Date.now();

          const toolPromise = client.executeTool(
            testCase.toolName,
            testCase.inputs
          );
          const toolTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error("Tool execution timeout")),
              testConfig.timeoutMs
            );
          });

          const response = await Promise.race([
            toolPromise,
            toolTimeoutPromise,
          ]);
          const executionTime = Date.now() - startTime;

          // Validate the response
          const validationResult = validator.validateResponse(
            response,
            testCase
          );

          // Create test result
          const testResult: TestResult = {
            testCase,
            passed: validationResult.valid,
            response,
            executionTime,
            validationErrors: validationResult.errors,
          };

          results.push(testResult);
        } catch (error) {
          // Handle test execution error
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          const testResult: TestResult = {
            testCase,
            passed: false,
            validationErrors: [errorMessage],
          };

          results.push(testResult);
        }
      }

      // Return results
      return res.json({
        status: "success",
        serverName,
        testCount: results.length,
        passCount: results.filter((r) => r.passed).length,
        failCount: results.filter((r) => !r.passed).length,
        results,
      });
    } catch (error) {
      console.error(`Error running tests:`, error);
      return res.status(500).json({
        status: "error",
        message: "Failed to run tests",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      if (client) {
        await client.disconnect();
      }
    }
  }
);

// API endpoint to execute a single tool
app.post(
  "/api/servers/:serverName/tools/:toolName/execute",
  async (req: Request, res: Response) => {
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
        status: "success",
        serverName,
        toolName,
        inputs,
        response,
      });
    } catch (error) {
      console.error(`Error executing tool:`, error);
      return res.status(500).json({
        status: "error",
        message: "Failed to execute tool",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      if (client) {
        await client.disconnect();
      }
    }
  }
);

interface ConfigItem {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface SpecConfig {
  [key: string]: ConfigItem;
}

interface JsonRequestBody {
  spec_name: string;
  spec_data: any;
  spec_config: SpecConfig;
}

interface McpServersConfig {
  numTestsPerTool: number;
  timeoutMs: number;
  outputFormat: string;
  outputPath: string;
  verbose: boolean;
  mcpServers: {
    [key: string]: ConfigItem;
  };
}

interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

// Helper function to execute commands
const executeCommand = (
  command: string,
  args: string[],
  cwd: string
): Promise<CommandResult> => {
  return new Promise((resolve) => {
    const process = spawn(command, args, { cwd });
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
      console.log(`${data}`);
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
      console.error(`${data}`);
    });

    process.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        code: code || 0,
      });
    });
  });
};

// Middleware to parse JSON bodies
app.use(express.json({ limit: "10mb" }));

const jsonHandler: RequestHandler = async (req, res) => {
  try {
    const { spec_name, spec_data, spec_config } = req.body as JsonRequestBody;

    if (!spec_name || !spec_data || !spec_config) {
      res.status(400).json({
        error: "Missing required fields: spec_name, spec_data, and spec_config",
      });
      return;
    }

    // Validate spec_config structure
    if (Object.keys(spec_config).length === 0) {
      res.status(400).json({
        error: "spec_config must contain at least one configuration",
      });
      return;
    }

    // Validate each config item
    for (const [key, config] of Object.entries(spec_config)) {
      if (!config.command || !Array.isArray(config.args)) {
        res.status(400).json({
          error: `Invalid configuration for '${key}': must contain 'command' and 'args' array`,
        });
        return;
      }
    }

    // Validate spec_name to prevent directory traversal attacks
    if (!/^[a-zA-Z0-9_-]+$/.test(spec_name)) {
      res.status(400).json({
        error:
          "Invalid spec_name: Only alphanumeric characters, underscores, and hyphens are allowed",
      });
      return;
    }

    // Save spec_data to examples directory
    const filename = `${spec_name}.json`;
    const examplesDir = path.join(__dirname, "..", "examples");
    const exampleFilePath = path.join(examplesDir, filename);

    // Ensure examples directory exists
    if (!existsSync(examplesDir)) {
      await mkdir(examplesDir, { recursive: true });
    }

    // Write the spec_data to examples file
    await writeFile(exampleFilePath, JSON.stringify(spec_data, null, 2));

    // Update mcp-servers.json
    const mcpServersPath = path.join(__dirname, "..", "mcp-servers.json");
    let mcpServersConfig: McpServersConfig;

    try {
      const configContent = await readFile(mcpServersPath, "utf-8");
      mcpServersConfig = JSON.parse(configContent);
    } catch (error) {
      console.error("Error reading mcp-servers.json:", error);
      res.status(500).json({
        error: "Failed to read mcp-servers.json",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return;
    }

    // Append new configurations to mcpServers
    mcpServersConfig.mcpServers = {
      ...mcpServersConfig.mcpServers,
      ...spec_config,
    };

    // Write updated config back to file
    await writeFile(mcpServersPath, JSON.stringify(mcpServersConfig, null, 2));

    // Execute build and test commands
    const mcpTesterDir = path.join(__dirname, "..");

    try {
      // Run build command
      console.log("Building mcp-tester-server...");
      const buildResult = await executeCommand(
        "npm",
        ["run", "build"],
        mcpTesterDir
      );

      if (buildResult.code !== 0) {
        res.status(500).json({
          error: "Build failed",
          buildOutput: buildResult.stdout,
          buildError: buildResult.stderr,
        });
        return;
      }

      // Run test command
      console.log("Running API test...");
      const testResult = await executeCommand(
        "node",
        ["dist/index.js", "api-test", `examples/${filename}`, "github"],
        mcpTesterDir
      );

      // Return the test output directly
      if (testResult.code === 0) {
        res.send(testResult.stdout);
      } else {
        res.status(500).send(testResult.stderr || testResult.stdout);
      }
    } catch (error) {
      console.error("Error executing commands:", error);
      res.status(500).json({
        error: "Failed to execute build or test commands",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({
      error: "Failed to process request",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

app.post("/spec", jsonHandler);

// Serve the main app for all other routes
app.get("*", (req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Start the server
app.listen(port, () => {
  console.log(`MCP Server Tester API running on port ${port}`);
  console.log(`Web interface available at http://localhost:${port}`);
  console.log(`API endpoints:`);
  console.log(`  GET  /api/servers - List all available servers`);
  console.log(`  GET  /api/servers/:serverName - Get server details`);
  console.log(
    `  GET  /api/servers/:serverName/tools - List tools for a server`
  );
  console.log(`  POST /api/servers/:serverName/test - Run tests for a server`);
  console.log(
    `  POST /api/servers/:serverName/tools/:toolName/execute - Execute a tool`
  );
});
