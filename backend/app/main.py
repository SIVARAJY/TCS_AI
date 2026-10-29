from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .config import CORS_ORIGINS
from .api.routes import router

app = FastAPI(
    title="AI-Powered Canteen Queue and Counter Planning System API",
    description="Backend service for predicting canteen demand, optimizing counter openings, and planning peak-hour staffing.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits local frontend access from Vite on any port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API endpoints
app.include_router(router)

@app.get("/")
def root():
    return {
        "service": "AI-Powered Canteen Queue & Counter Planning System API",
        "status": "online",
        "docs_url": "/docs",
        "api_endpoints": [
            "/api/health",
            "/api/data/summary",
            "/api/data/preview",
            "/api/data/upload",
            "/api/predict",
            "/api/optimize",
            "/api/model/metrics",
            "/api/model/feature-importance",
            "/api/reports/predictions",
            "/api/reports/counters",
            "/api/reports/action-plan"
        ]
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": str(exc),
            "path": str(request.url.path)
        }
    )
