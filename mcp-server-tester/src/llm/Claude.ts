import { Anthropic } from '@anthropic-ai/sdk';
import { ToolDefinition, ValidationRule } from '../types';

export class Claude {
  private anthropic: Anthropic;
  private model: string = process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219';

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });
  }

  /**
   * Generate a natural language query that would use this tool
   * @param tool Tool definition
   * @returns Natural language query
   */
  async generateNaturalLanguageQuery(tool: ToolDefinition): Promise<string> {
    const systemPrompt = `You are helping to generate test cases for an LLM tool called "${tool.name}".
Generate a natural language query that a user might ask that would lead an LLM to use this tool.
The query should be realistic and relate to the tool's purpose.
Only return the query text with no additional explanation or formatting.`;

    const userPrompt = `Tool Name: ${tool.name}
Description: ${tool.description || 'No description provided'}
Parameters: ${JSON.stringify(tool.inputSchema?.properties || {}, null, 2)}

Please generate a natural language query that would lead an LLM to use this tool.`;

    try {
      const response = await this.sendPrompt(systemPrompt, userPrompt);
      return response.trim();
    } catch (error) {
      console.error('Error generating natural language query:', error);
      throw new Error(`Failed to generate natural language query: ${error}`);
    }
  }

  /**
   * Generate test inputs for a tool based on its schema
   * @param tool Tool definition
   * @param naturalLanguageQuery Natural language query context
   * @returns Generated inputs
   */
  async generateTestInputs(tool: ToolDefinition, naturalLanguageQuery: string): Promise<Record<string, any>> {
    const systemPrompt = `You are an AI assistant helping to generate test cases for an LLM tool called "${tool.name}".
Your task is to generate realistic test inputs for this tool based on its JSON schema and the natural language query context.
Return valid JSON with no explanation or comments.`;

    const userPrompt = `Tool Name: ${tool.name}
Description: ${tool.description || 'No description provided'}
Parameters: ${JSON.stringify(tool.inputSchema?.properties || {}, null, 2)}
Natural Language Query: "${naturalLanguageQuery}"

Generate valid inputs for this tool as a JSON object. Ensure the generated inputs conform to the schema requirements.
Only return the JSON object with no additional explanation or formatting.`;

    try {
      const responseText = await this.sendPrompt(systemPrompt, userPrompt);
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract valid JSON from response');
      }
      
      const inputs = JSON.parse(jsonMatch[0]);
      return inputs;
    } catch (error) {
      console.error('Error generating test inputs:', error);
      throw new Error(`Failed to generate test inputs: ${error}`);
    }
  }

  /**
   * Generate validation rules for a test case
   * @param tool Tool definition
   * @param inputs Test inputs
   * @returns Expected outcome and validation rules
   */
  async generateValidationRules(
    tool: ToolDefinition, 
    inputs: Record<string, any>
  ): Promise<{ expectedOutcome: string; validationRules: ValidationRule[] }> {
    const systemPrompt = `You are an AI assistant helping to generate test cases for an LLM tool called "${tool.name}".
Your task is to create validation rules for testing this tool with the provided inputs.
First, describe the expected outcome in a single sentence.
Then, list 2-4 specific validation rules to verify the tool's response is correct.`;

    const userPrompt = `Tool Name: ${tool.name}
Description: ${tool.description || 'No description provided'}
Parameters: ${JSON.stringify(tool.inputSchema?.properties || {}, null, 2)}
Test Inputs: ${JSON.stringify(inputs, null, 2)}

Please provide:
1. A brief (one sentence) description of the expected outcome
2. 2-4 validation rules to verify the tool's response

Format your response as valid JSON with this structure:
{
  "expectedOutcome": "Brief description of what should happen",
  "validationRules": [
    {
      "type": "contains",
      "target": "path.to.field",
      "value": "expected value",
      "message": "Error message if validation fails"
    }
  ]
}

Only return the JSON with no additional explanation.`;

    try {
      const responseText = await this.sendPrompt(systemPrompt, userPrompt);
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract valid JSON from response');
      }
      
      const validationData = JSON.parse(jsonMatch[0]);
      return validationData;
    } catch (error) {
      console.error('Error generating validation rules:', error);
      throw new Error(`Failed to generate validation rules: ${error}`);
    }
  }

  /**
   * Send a prompt to Claude and get the response
   * @param systemPrompt System prompt
   * @param userPrompt User prompt
   * @returns Response text
   */
  private async sendPrompt(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const message = await this.anthropic.messages.create({
        model: this.model,
        system: systemPrompt,
        max_tokens: 1024,
        messages: [{ role: 'user', content: userPrompt }],
      });

      // Find the first text block in the content
      const textBlock = message.content.find(block => 'text' in block);
      
      if (textBlock && 'text' in textBlock) {
        return textBlock.text;
      } else {
        throw new Error('No text content in the response');
      }
    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      throw new Error(`Failed to get response from Claude: ${error}`);
    }
  }
} 