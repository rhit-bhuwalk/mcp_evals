import { ApiDocument, ApiTestResult, ApiTestReport } from '../types/api-test';
import { Anthropic } from '@anthropic-ai/sdk';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export class ApiTester {
  private anthropic: Anthropic;
  private serverUrl: string;
  private githubToken: string;

  constructor(serverUrl: string, anthropicApiKey: string, githubToken: string) {
    this.serverUrl = serverUrl;
    this.anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });
    this.githubToken = githubToken;
  }

  async testApiDocument(apiDoc: ApiDocument): Promise<ApiTestReport> {
    const startTime = Date.now();
    const results: ApiTestResult[] = [];
    
    // Process each endpoint in the API document
    for (const [path, methods] of Object.entries(apiDoc.paths)) {
      for (const [method, endpoint] of Object.entries(methods)) {
        const testCases = await this.generateTestCases(endpoint);
        
        for (const testCase of testCases) {
          try {
            const result = await this.executeTestCase(path, method, testCase);
            results.push(result);
          } catch (error) {
            results.push({
              endpoint: path,
              method,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              testCase,
            });
          }
        }
      }
    }

    const endTime = Date.now();
    const passedTests = results.filter(r => r.success).length;

    return {
      documentInfo: {
        title: apiDoc.info?.title,
        version: apiDoc.info?.version,
      },
      results,
      summary: {
        totalTests: results.length,
        passedTests,
        failedTests: results.length - passedTests,
        duration: endTime - startTime,
      },
    };
  }

  private async generateTestCases(endpoint: any): Promise<any[]> {
    const prompt = `Given this GitHub API endpoint definition:
    ${JSON.stringify(endpoint, null, 2)}
    
    Generate 3 test cases that cover different scenarios. For each test case, provide:
    1. Input parameters (query, path, body)
    2. Expected response
    
    For GitHub API endpoints:
    - Use real GitHub repositories like "microsoft/vscode", "facebook/react", "tensorflow/tensorflow"
    - For issues endpoints, use repositories that are known to have issues
    - Include both successful and error cases
    
    Return ONLY a JSON array of test cases, with no markdown formatting or additional text. Each test case should have this structure:
    {
      "input": {
        "query": {},
        "path": {
          "owner": "repository-owner",
          "repo": "repository-name"
        },
        "body": {}
      },
      "expectedOutput": {
        "statusCode": 200,
        "response": {
          // Expected response structure
        }
      }
    }`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    try {
      const content = response.content[0];
      if ('text' in content) {
        // Extract JSON from the response, handling potential markdown formatting
        const jsonMatch = content.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const testCases = JSON.parse(jsonMatch[0]);
          
          // Validate test cases
          return testCases.map((testCase: any) => {
            // Ensure path parameters are present for GitHub API endpoints
            if (!testCase.input.path) {
              testCase.input.path = {};
            }
            
            // Set default values if not provided
            if (!testCase.input.path.owner) {
              testCase.input.path.owner = 'microsoft';
            }
            if (!testCase.input.path.repo) {
              testCase.input.path.repo = 'vscode';
            }
            
            return testCase;
          });
        }
        throw new Error('No valid JSON array found in response');
      }
      throw new Error('Invalid response format from Claude');
    } catch (error) {
      console.error('Failed to parse test cases:', error);
      // Return a default test case with valid GitHub repository
      return [{
        input: {
          query: {},
          path: {
            owner: 'microsoft',
            repo: 'vscode'
          },
          body: {}
        },
        expectedOutput: {
          statusCode: 200,
          response: {}
        }
      }];
    }
  }

  private async executeTestCase(
    path: string,
    method: string,
    testCase: any
  ): Promise<ApiTestResult> {
    try {
      // Replace path parameters
      let finalPath = path;
      if (testCase.input.path) {
        Object.entries(testCase.input.path).forEach(([key, value]) => {
          finalPath = finalPath.replace(`{${key}}`, value as string);
        });
      }

      // Check if all path parameters were replaced
      const remainingParams = finalPath.match(/\{([^}]+)\}/g);
      if (remainingParams) {
        throw new Error(`Missing required path parameters: ${remainingParams.join(', ')}`);
      }

      // Use GitHub API directly
      const url = `https://api.github.com${finalPath}`;
      const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${this.githubToken}`,
        'X-Request-ID': uuidv4(),
      };

      console.log(`Making ${method.toUpperCase()} request to ${url}`);
      console.log('Request parameters:', {
        query: testCase.input.query,
        path: testCase.input.path,
        body: testCase.input.body
      });

      const response = await axios({
        method: method.toLowerCase(),
        url,
        headers,
        data: testCase.input.body,
        params: testCase.input.query,
      });

      return {
        endpoint: path,
        method,
        success: true,
        statusCode: response.status,
        response: response.data,
        testCase,
      };
    } catch (error: unknown) {
      console.error('Test case execution failed:', error);
      const axiosError = error as { response?: { status?: number; data?: any } };
      return {
        endpoint: path,
        method,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        testCase,
        statusCode: axiosError.response?.status,
        response: axiosError.response?.data
      };
    }
  }
} 