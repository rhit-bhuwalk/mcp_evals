import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ChildProcess } from 'child_process';
import { TesterConfig } from '../types';

/**
 * Default config file name
 */
export const DEFAULT_CONFIG_FILENAME = 'mcp-servers.json';

/**
 * Configuration for an MCP server
 */
export interface MCPServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Complete configuration file format
 */
export interface CompleteConfig extends TesterConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * Loads and manages MCP server configurations
 */
export class ConfigLoader {
  private config: CompleteConfig | null = null;
  private defaultConfigPath: string;
  
  /**
   * Create a new config loader
   */
  constructor() {
    // Default config path is in the project root
    this.defaultConfigPath = path.join(process.cwd(), DEFAULT_CONFIG_FILENAME);
  }
  
  /**
   * Load configuration from file
   * @param customPath Optional custom path to config file
   */
  loadConfig(customPath?: string): CompleteConfig | null {
    const configPath = customPath || this.defaultConfigPath;
    
    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        this.config = JSON.parse(configData);
        console.log(`Loaded configuration from: ${configPath}`);
        return this.config;
      } else {
        console.log(`No configuration file found at: ${configPath}`);
        return null;
      }
    } catch (error) {
      console.error(`Error loading configuration from ${configPath}:`, error);
      return null;
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): CompleteConfig | null {
    return this.config;
  }
  
  /**
   * Creates the default config file if it doesn't exist
   * @returns Path to the created config file or null if already exists
   */
  createDefaultConfigIfNeeded(): string | null {
    if (fs.existsSync(this.defaultConfigPath)) {
      return null; // Already exists
    }
    
    try {
      // Check if example file exists and copy it
      const examplePath = path.join(process.cwd(), `${DEFAULT_CONFIG_FILENAME}.example`);
      let configContent = '';
      
      if (fs.existsSync(examplePath)) {
        // Copy from example file
        configContent = fs.readFileSync(examplePath, 'utf8');
      } else {
        // Create minimal default config
        const defaultConfig: CompleteConfig = {
          servers: ["filesystem"],
          numTestsPerTool: 3,
          timeoutMs: 10000,
          outputFormat: "console",
          verbose: false,
          mcpServers: {
            "filesystem": {
              "command": "npx",
              "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"],
              "env": {}
            }
          }
        };
        
        configContent = JSON.stringify(defaultConfig, null, 2);
      }
      
      fs.writeFileSync(this.defaultConfigPath, configContent);
      console.log(`Created default config file at: ${this.defaultConfigPath}`);
      return this.defaultConfigPath;
    } catch (error) {
      console.error(`Failed to create default config:`, error);
      return null;
    }
  }
  
  /**
   * Get list of server names from the loaded config
   */
  getServerNames(): string[] {
    if (!this.config || !this.config.mcpServers) {
      return [];
    }
    
    return Object.keys(this.config.mcpServers);
  }
  
  /**
   * Get server configuration by name
   */
  getServerConfig(name: string): MCPServerConfig | null {
    if (!this.config || !this.config.mcpServers || !this.config.mcpServers[name]) {
      return null;
    }
    
    return this.config.mcpServers[name];
  }
  
  /**
   * Check if a server exists in the config
   */
  hasServer(name: string): boolean {
    return !!this.config?.mcpServers?.[name];
  }
  
  /**
   * Spawn a server process based on config
   */
  spawnServerProcess(name: string): ChildProcess | null {
    const config = this.getServerConfig(name);
    if (!config) {
      return null;
    }
    
    try {
      // Combine current process env with server-specific env
      const env = { ...process.env, ...config.env };
      
      return spawn(config.command, config.args, { 
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      console.error(`Failed to spawn server process:`, error);
      return null;
    }
  }
} 