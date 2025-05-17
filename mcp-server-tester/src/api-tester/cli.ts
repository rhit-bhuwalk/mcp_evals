import { ApiTester } from './index';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

dotenv.config();

async function startServer(serverConfig: any, serverName: string): Promise<{ process: any; port: number }> {
  return new Promise((resolve, reject) => {
    const port = serverConfig.port || 3000;
    const args = [...serverConfig.args];
    let env = { ...process.env, ...serverConfig.env };

    if (serverName === 'filesystem') {
      env.PORT = port.toString();
    } else {
      // Remove any existing port argument
      const portIndex = args.findIndex(arg => arg.includes('--port'));
      if (portIndex !== -1) {
        args.splice(portIndex, 2);
      }
      args.push('--port', port.toString());
    }

    console.log(`Starting server with command: ${serverConfig.command} ${args.join(' ')}`);

    const server = spawn(serverConfig.command, args, { env });

    let serverStarted = false;
    let errorOutput = '';

    server.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Server: ${output}`);
      // For GitHub server, the stdio message indicates it's running
      if (output.includes('Server running') || output.includes('Listening') || 
          (serverName === 'github' && output.includes('running on stdio'))) {
        serverStarted = true;
        resolve({ process: server, port });
      }
    });

    server.stderr.on('data', (data) => {
      const error = data.toString();
      // Don't treat stdio message as an error for GitHub server
      if (!(serverName === 'github' && error.includes('running on stdio'))) {
        console.error(`Server Error: ${error}`);
        errorOutput += error;
      }
    });

    // Wait for server to start or fail
    setTimeout(() => {
      if (!serverStarted) {
        server.kill();
        reject(new Error(`Server failed to start. Error: ${errorOutput}`));
      }
    }, 5000);
  });
}

async function main() {
  const args = process.argv.slice(3);
  
  if (args.length < 2) {
    console.error('Usage: mcp-server-tester api-test <api-doc-path> <server-name>');
    process.exit(1);
  }

  const [apiDocPath, serverName] = args;
  
  // Load API document
  const apiDoc = JSON.parse(readFileSync(resolve(apiDocPath), 'utf-8'));
  
  // Load MCP server configuration
  const mcpConfig = JSON.parse(readFileSync(resolve('mcp-servers.json'), 'utf-8'));
  const serverConfig = mcpConfig.mcpServers[serverName];
  
  if (!serverConfig) {
    console.error(`Server "${serverName}" not found in mcp-servers.json`);
    process.exit(1);
  }

  // Get required API keys from environment
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    console.error('ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!githubToken) {
    console.error('GITHUB_PERSONAL_ACCESS_TOKEN environment variable is required');
    process.exit(1);
  }

  try {
    // Initialize API tester
    const tester = new ApiTester('https://api.github.com', anthropicApiKey, githubToken);
    
    console.log(`Testing API document against GitHub API...`);
    const report = await tester.testApiDocument(apiDoc);
    
    // Print summary
    console.log('\nTest Summary:');
    console.log('-------------');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Duration: ${report.summary.duration}ms`);
    
    // Print detailed results
    console.log('\nDetailed Results:');
    console.log('-----------------');
    report.results.forEach(result => {
      console.log(`\n${result.method.toUpperCase()} ${result.endpoint}`);
      console.log(`Status: ${result.success ? 'PASS' : 'FAIL'}`);
      if (!result.success) {
        console.log(`Error: ${result.error}`);
        if (result.response) {
          console.log('Response:', JSON.stringify(result.response, null, 2));
        }
      }
    });
    
  } catch (error) {
    console.error('Error during API testing:', error);
    process.exit(1);
  }
}

main().catch(console.error); 