import { v4 as uuidv4 } from 'uuid';
import { Claude } from '../llm/Claude';
import { ToolDefinition, TestCase, ValidationRule } from '../types';

export class TestGenerator {
  private claude: Claude;

  constructor(apiKey: string) {
    this.claude = new Claude(apiKey);
  }

  /**
   * Generate test cases for a tool
   * @param tool Tool definition to generate tests for
   * @param numTests Number of test cases to generate
   * @returns Array of test cases
   */
  async generateTests(tool: ToolDefinition, numTests: number): Promise<TestCase[]> {
    try {
      console.log(`Generating ${numTests} test cases for tool: ${tool.name}`);
      
      const testCases: TestCase[] = [];
      for (let i = 0; i < numTests; i++) {
        const { testCase, naturalLanguageQuery } = await this.generateSingleTest(tool, i + 1);
        testCases.push({
          ...testCase,
          naturalLanguageQuery
        });
      }
      
      return testCases;
    } catch (error) {
      console.error(`Error generating tests for tool ${tool.name}:`, error);
      throw new Error(`Failed to generate tests for tool ${tool.name}: ${error}`);
    }
  }

  /**
   * Generate a single test case for a tool
   * @param tool Tool definition
   * @param testNumber Test number (for logging)
   * @returns Generated test case
   */
  private async generateSingleTest(tool: ToolDefinition, testNumber: number): Promise<{ testCase: Omit<TestCase, 'naturalLanguageQuery'>, naturalLanguageQuery: string }> {
    try {
      // Generate a natural language query that would use this tool
      const naturalLanguageQuery = await this.claude.generateNaturalLanguageQuery(tool);
      
      // Generate test inputs based on the tool schema
      const inputs = await this.claude.generateTestInputs(tool, naturalLanguageQuery);
      
      // Generate expected outcome and validation rules
      const { expectedOutcome, validationRules } = await this.claude.generateValidationRules(tool, inputs);
      
      // Create the test case
      const testCase: Omit<TestCase, 'naturalLanguageQuery'> = {
        id: uuidv4(),
        toolName: tool.name,
        description: `Test ${testNumber}: ${expectedOutcome}`,
        inputs,
        expectedOutcome,
        validationRules
      };
      
      console.log(`Created test case: ${testCase.description}`);
      return { testCase, naturalLanguageQuery };
    } catch (error) {
      console.error(`Error generating test case:`, error);
      throw new Error(`Failed to generate test case: ${error}`);
    }
  }
} 