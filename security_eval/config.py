from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "MCP Evaluations API"
    debug: bool = True
    
    # Database configurations can be added here
    
    # API configurations
    api_prefix: str = "/api/v1"
    
    class Config:
        env_file = ".env"

settings = Settings() 