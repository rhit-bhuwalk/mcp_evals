# Contributing to MCP Server Tester

Thank you for your interest in contributing to the MCP Server Tester! This project is under active development, and we welcome contributions from the community.

## Development Status

⚠️ **IMPORTANT**: This project is currently in early development. The API, architecture, and features may change significantly between versions. Please be aware of this before investing significant time in contributions.

## How to Contribute

There are several ways you can contribute to this project:

1. **Reporting Issues**: If you find a bug or have a suggestion for improvement, please open an issue on GitHub.

2. **Contributing Code**: If you'd like to contribute code:
   - Fork the repository
   - Create a feature branch (`git checkout -b feature/amazing-feature`)
   - Commit your changes (`git commit -m 'Add some amazing feature'`)
   - Push to the branch (`git push origin feature/amazing-feature`)
   - Open a Pull Request

3. **Documentation**: Help improve the documentation by fixing errors or adding examples.

4. **Testing**: Help test the tool with different MCP servers and configurations.

## Development Setup

Follow these steps to set up a development environment:

```bash
# Clone the repository
git clone https://github.com/r-huijts/mcp-server-tester.git
cd mcp-server-tester

# Install dependencies
npm install

# Create your .env file
cp .env.example .env
# Edit .env and add your API key

# Build the project
npm run build

# Run in development mode
npm run dev
```

## Code Style

We follow standard TypeScript best practices:

- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Use clear and descriptive names
- Write JSDoc comments for public APIs
- Format your code with Prettier before submitting

## Pull Request Process

1. Ensure that your code adheres to the existing style
2. Update the README.md if your changes require documentation
3. Your PR should focus on a single concern/feature
4. Write clear commit messages that explain the "why" not just the "what"
5. Be responsive to feedback and questions in your PR

## License

By contributing to the MCP Server Tester, you agree that your contributions will be licensed under the same [MIT License](LICENSE) that covers the project. 