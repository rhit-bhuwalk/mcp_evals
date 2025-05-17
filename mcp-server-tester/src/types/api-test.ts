export interface ApiEndpoint {
  path: string;
  method: string;
  parameters?: {
    query?: Record<string, any>;
    path?: Record<string, any>;
    body?: Record<string, any>;
  };
  responses?: Record<string, any>;
  description?: string;
}

export interface ApiDocument {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  paths: Record<string, Record<string, ApiEndpoint>>;
}

export interface ApiTestResult {
  endpoint: string;
  method: string;
  success: boolean;
  statusCode?: number;
  response?: any;
  error?: string;
  testCase: {
    input: any;
    expectedOutput?: any;
  };
}

export interface ApiTestReport {
  documentInfo: {
    title?: string;
    version?: string;
  };
  results: ApiTestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    duration: number;
  };
} 