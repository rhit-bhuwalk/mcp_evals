import { Anthropic } from '@anthropic-ai/sdk';
import { 
  TestGeneratorInterface,
  ToolDefinition,
  TestCase,
  TesterConfig
} from '../types';

/**
 * Generator for test cases using Claude
 */
export class TestGenerator implements TestGeneratorInterface {
  private anthropic: Anthropic;
  private model: string = process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219';

  /**
   * Create a new test generator
   * @param apiKey Anthropic API key
   */
  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Generate test cases for the given tools
   * @param tools Tool definitions to generate tests for
   * @param config Tester configuration
   */
  async generateTests(tools: ToolDefinition[], config: TesterConfig): Promise<TestCase[]> {
    const allTests: TestCase[] = [];
    const testsPerTool = config.numTestsPerTool || 3;

    for (const tool of tools) {
      try {
        console.log(`Generating tests for tool: ${tool.name}`);
        const prompt = this.createPrompt(tool, testsPerTool);
        
        const response = await this.anthropic.completions.create({
          model: this.model,
          max_tokens_to_sample: 4000,
          prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
          temperature: 0.7
        });

        const testCases = this.parseResponse(response.completion, tool.name);
        allTests.push(...testCases);
        
        console.log(`Generated ${testCases.length} tests for ${tool.name}`);
      } catch (error) {
        console.error(`Error generating tests for tool ${tool.name}:`, error);
      }
    }

    return allTests;
  }

  /**
   * Create a prompt for Claude to generate test cases
   * @param tool Tool definition to generate tests for
   * @param testsPerTool Number of tests to generate per tool
   */
  createPrompt(tool: ToolDefinition, testsPerTool: number): string {
    return `
You are an expert in generating test cases for APIs. I'm providing you with a tool definition from an MCP (Model Context Protocol) server, and I need you to generate ${testsPerTool} diverse test cases for it.

## Tool Definition
Name: ${tool.name}
Description: ${tool.description}
Parameters: ${JSON.stringify(tool.inputSchema?.properties, null, 2)}

## Instructions
1. Generate ${testsPerTool} diverse test cases that cover:
   - Happy path (valid inputs, expected behavior)
   - Edge cases (boundary values, special characters, etc.)
   - Error cases (invalid inputs, missing required parameters)

2. For each test case, provide:
   - A brief description of what the test is checking
   - Input parameters with realistic values
   - Expected outcome (success or error)
   - Any validation rules for checking the response

## Output Format
Provide the test cases in the following JSON format:
\`\`\`json
[
  {
    "description": "Test case description",
    "inputs": {
      "param1": "value1",
      "param2": "value2"
    },
    "expectedOutcome": {
      "status": "success|error",
      "validationRules": [
        {
          "type": "contains|matches|hasProperty",
          "target": "path.to.property",
          "value": "expected value",
          "message": "Validation error message"
        }
      ]
    }
  }
]
\`\`\`

Please return ONLY the JSON array of test cases, nothing else.
`;
  }

  /**
   * Parse Claude's response into test cases
   * @param responseText Claude's response text
   * @param toolName Name of the tool being tested
   */
  parseResponse(responseText: string, toolName: string): TestCase[] {
    try {
      // Extract JSON content between backticks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : responseText;
      
      // Parse the JSON
      const parsedTests = JSON.parse(jsonContent);
      
      // Validate and convert to TestCase format
      return parsedTests.map((test: any) => ({
        toolName,
        description: test.description,
        inputs: test.inputs,
        expectedOutcome: {
          status: test.expectedOutcome.status,
          validationRules: test.expectedOutcome.validationRules || []
        }
      }));
    } catch (error) {
      console.error('Error parsing Claude response:', error);
      console.error('Response text:', responseText);
      return [];
    }
  }
} 