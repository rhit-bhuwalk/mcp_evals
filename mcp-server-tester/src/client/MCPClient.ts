import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ChildProcess, spawn } from 'child_process';
import { ConfigLoader } from './ConfigLoader';
import { ToolResponse } from '../types';

/**
 * Client for interacting with MCP servers
 */
export class MCPClient {
  private client: Client | null = null;
  private serverProcess: ChildProcess | null = null;
  private configLoader: ConfigLoader = new ConfigLoader();
  
  /**
   * Connect to an MCP server
   * @param serverPathOrName Server path or named configuration
   * @param configPath Optional path to config file
   */
  async connect(serverPathOrName: string, configPath?: string): Promise<void> {
    console.log(`Connecting to MCP server: ${serverPathOrName}`);
    
    if (configPath) {
      this.configLoader.loadConfig(configPath);
    }
    
    // Check if this is a server name from our configuration
    const serverConfig = this.configLoader.getServerConfig(serverPathOrName);
    
    if (serverConfig) {
      // This is a configured server, spawn it
      console.log(`Starting server process: ${serverConfig.command} ${serverConfig.args.join(' ')}`);
      
      // Set up environment variables
      const env = {
        ...process.env,
        ...serverConfig.env
      };
      
      this.serverProcess = spawn(serverConfig.command, serverConfig.args, { 
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Handle stderr output
      if (this.serverProcess.stderr) {
        this.serverProcess.stderr.on('data', (data: Buffer) => {
          console.error(`Server stderr: ${data.toString()}`);
        });
      }
      
      // Create transport using the command
      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args
      });
      
      // Create client
      this.client = new Client(
        {
          name: "mcp-server-tester",
          version: "0.0.1"
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );
      
      // Connect to the transport
      await this.client.connect(transport);
      
      // Wait for server to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      throw new Error(`Server not found in configuration: ${serverPathOrName}`);
    }
  }
  
  /**
   * List all available tools
   * @returns Array of tool definitions
   */
  async listTools(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Not connected to an MCP server');
    }
    
    const toolsResult = await this.client.listTools();
    return toolsResult.tools || [];
  }
  
  /**
   * Execute a tool
   * @param name Tool name
   * @param params Tool parameters
   * @returns Tool response
   */
  async executeTool(name: string, params: Record<string, any>): Promise<ToolResponse> {
    if (!this.client) {
      throw new Error('Not connected to an MCP server');
    }
    
    try {
      const response = await this.client.callTool({
        name,
        arguments: params
      });
      
      return {
        status: 'success',
        data: response
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: {
          message: error.message || 'Unknown error',
          code: error.code
        }
      };
    }
  }
  
  /**
   * Disconnect from the server
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
   * List all configured servers
   * @returns Array of server names
   */
  listConfiguredServers(): string[] {
    return this.configLoader.getServerNames();
  }
} 