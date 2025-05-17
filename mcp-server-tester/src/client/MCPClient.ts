import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ChildProcess, spawn } from 'child_process';
import { ConfigLoader, DEFAULT_CONFIG_FILENAME } from './ConfigLoader';
import { ToolResponse } from '../types';

/**
 * Client for interacting with MCP servers
 */
export class MCPClient {
  private client: Client | null = null;
  private serverProcess: ChildProcess | null = null;
  private configLoader = new ConfigLoader();

  /**
   * Connect to an MCP server
   * @param serverName Name of the server as defined in config
   * @param configPath Optional override path to the config file
   */
  async connect(serverName: string, configPath?: string): Promise<void> {
    // Load configuration (either custom path or default)
    const fileToLoad = configPath || DEFAULT_CONFIG_FILENAME;
    this.configLoader.loadConfig(fileToLoad);
    console.log(`Loaded config from: ${fileToLoad}`);

    // Lookup server settings
    const serverConfig = this.configLoader.getServerConfig(serverName);
    if (!serverConfig) {
      throw new Error(`Server not found in configuration: ${serverName}`);
    }

    const { command, args = [], env: serverEnv = {} } = serverConfig;
    console.log(`Starting server process: ${command} ${args.join(' ')}`);

    // Spawn the MCP server process
    this.serverProcess = spawn(command, args, {
      env: { ...process.env, ...serverEnv },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Log any stderr from the server
    this.serverProcess.stderr?.on('data', (chunk: Buffer) => {
      console.error(`[${serverName} stderr] ${chunk.toString().trim()}`);
    });

    // Create transport and client
    const transport = new StdioClientTransport({ command, args });
    this.client = new Client(
      { name: 'mcp-server-tester', version: '0.0.1' },
      { capabilities: { tools: {} } }
    );
    await this.client.connect(transport);

    // Give the server a moment to finish startup
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * List all available tools on the connected server
   */
  async listTools(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Not connected to an MCP server');
    }
    const { tools = [] } = await this.client.listTools();
    return tools;
  }

  /**
   * Execute a tool by name with given parameters
   */
  async executeTool(name: string, params: Record<string, any>): Promise<ToolResponse> {
    if (!this.client) {
      throw new Error('Not connected to an MCP server');
    }
    try {
      const response = await this.client.callTool({ name, arguments: params });
      return { status: 'success', data: response };
    } catch (error: any) {
      return {
        status: 'error',
        error: { message: error.message || 'Unknown error', code: error.code }
      };
    }
  }

  /**
   * Disconnect from the server and clean up the process
   */
  async disconnect(): Promise<void> {
    if (this.serverProcess) {
      console.log('Stopping server process...');
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    this.client = null;
  }

  /**
   * Get a list of all configured server names
   */
  listConfiguredServers(): string[] {
    return this.configLoader.getServerNames();
  }
}
