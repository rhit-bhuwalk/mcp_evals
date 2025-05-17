# MCP Evaluations API

This is the backend API for MCP Evaluations built with FastAPI.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python run.py
```

The API will be available at `http://localhost:8000`.

## API Documentation

FastAPI automatically generates interactive API documentation:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Project Structure

- `main.py`: The main FastAPI application
- `config.py`: Application configuration
- `routers/`: API route definitions
- `run.py`: Script to run the application 