declare module '@modelcontextprotocol/sdk' {
  export interface ToolDefinition {
    name: string;
    description?: string;
    parameters: {
      type: string;
      properties?: Record<string, any>;
      required?: string[];
    };
  }

  export interface TransportMessage {
    id: string;
    type: string;
    [key: string]: any;
  }

  export interface Transport {
    send(message: any): Promise<void>;
    receive(): Promise<any>;
    close?(): Promise<void>;
  }

  export interface MCPServerOptions {
    transport: Transport;
  }

  export interface StdioTransportOptions {
    stdin: NodeJS.WritableStream;
    stdout: NodeJS.ReadableStream;
  }

  export interface SocketTransportOptions {
    host?: string;
    port?: number;
  }

  export interface ServerSession {
    id: string;
    listTools(): Promise<ToolDefinition[]>;
    callTool(name: string, params: Record<string, any>): Promise<any>;
    close(): Promise<void>;
  }

  export class MCPServer {
    constructor(options: MCPServerOptions);
    createSession(): Promise<ServerSession>;
    close(): Promise<void>;
  }

  export function createStdioTransport(options: StdioTransportOptions): Transport;
  export function createSocketTransport(options?: SocketTransportOptions): Transport;
} 