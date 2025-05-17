import { 
  ResponseValidatorInterface, 
  TestCase, 
  ToolResponse, 
  ValidationResult,
  ValidationRule
} from '../types';

/**
 * Validator for tool responses
 */
export class ResponseValidator implements ResponseValidatorInterface {
  /**
   * Validate a tool response against a test case
   * @param response Tool response to validate
   * @param testCase Test case to validate against
   */
  validateResponse(response: ToolResponse, testCase: TestCase): ValidationResult {
    const errors: string[] = [];
    
    // Check basic status
    if (response.status === 'error') {
      errors.push(`Tool execution failed: ${response.error?.message || 'Unknown error'}`);
      return { valid: false, errors };
    }
    
    // Validate the content using the validation rules
    if (testCase.validationRules && testCase.validationRules.length > 0) {
      const validationErrors = this.validateRules(response.data, testCase.validationRules);
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
      }
    } else {
      // If no validation rules are specified, just check that we have data
      if (!response.data) {
        errors.push('No data in response');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate data against a set of rules
   * @param data Data to validate
   * @param rules Validation rules
   * @returns Array of error messages
   */
  private validateRules(data: any, rules: any[]): string[] {
    const errors: string[] = [];
    
    for (const rule of rules) {
      switch (rule.type) {
        case 'contains':
          if (!this.validateContains(data, rule.target, rule.value)) {
            errors.push(rule.message);
          }
          break;
          
        case 'matches':
          if (!this.validateMatches(data, rule.target, rule.value)) {
            errors.push(rule.message);
          }
          break;
          
        case 'hasProperty':
          if (!this.validateHasProperty(data, rule.target)) {
            errors.push(rule.message);
          }
          break;
          
        case 'custom':
          if (rule.custom && !rule.custom(data)) {
            errors.push(rule.message);
          }
          break;
          
        default:
          errors.push(`Unknown rule type: ${rule.type}`);
      }
    }
    
    return errors;
  }
  
  /**
   * Validate that data contains a value
   * @param data Data to validate
   * @param target Target property path
   * @param value Value to check for
   * @returns True if valid
   */
  private validateContains(data: any, target: string, value: any): boolean {
    const targetValue = this.getValueByPath(data, target);
    
    if (typeof targetValue === 'string' && typeof value === 'string') {
      return targetValue.includes(value);
    }
    
    if (Array.isArray(targetValue)) {
      return targetValue.includes(value);
    }
    
    return false;
  }
  
  /**
   * Validate that data matches a value or regex
   * @param data Data to validate
   * @param target Target property path
   * @param value Value or pattern to match
   * @returns True if valid
   */
  private validateMatches(data: any, target: string, value: any): boolean {
    const targetValue = this.getValueByPath(data, target);
    
    if (typeof targetValue === 'string' && typeof value === 'string') {
      // Try to handle as regex if the value is enclosed in forward slashes
      if (value.startsWith('/') && value.endsWith('/')) {
        const regexStr = value.slice(1, -1);
        const regex = new RegExp(regexStr);
        return regex.test(targetValue);
      }
      
      // Otherwise, do an exact match
      return targetValue === value;
    }
    
    // For non-strings, do a deep equality check
    return JSON.stringify(targetValue) === JSON.stringify(value);
  }
  
  /**
   * Validate that data has a property
   * @param data Data to validate
   * @param target Target property path
   * @returns True if valid
   */
  private validateHasProperty(data: any, target: string): boolean {
    if (!target) return false;
    
    const parts = target.split('.');
    let current = data;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return false;
      }
      
      if (typeof current !== 'object') {
        return false;
      }
      
      if (!(part in current)) {
        return false;
      }
      
      current = current[part];
    }
    
    return true;
  }
  
  /**
   * Get a value by a dot-separated path
   * @param data Data object
   * @param path Dot-separated path
   * @returns Value or undefined
   */
  private getValueByPath(data: any, path?: string): any {
    if (!path) return data;
    
    const parts = path.split('.');
    let current = data;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      if (typeof current !== 'object') {
        return undefined;
      }
      
      current = current[part];
    }
    
    return current;
  }
} 