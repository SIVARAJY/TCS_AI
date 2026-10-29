import os
import sys
import uvicorn

# Ensure the backend directory is in the Python module search path
backend_dir = os.path.join(os.path.dirname(__file__), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"Starting server on {host}:{port}...")
    uvicorn.run("app.main:app", host=host, port=port, log_level="info")
