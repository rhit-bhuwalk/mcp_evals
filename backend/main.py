from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import api

app = FastAPI(title=settings.app_name)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(api.router, prefix=settings.api_prefix)

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.app_name}"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 