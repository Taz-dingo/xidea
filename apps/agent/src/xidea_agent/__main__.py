from xidea_agent.llm import _ensure_env

_ensure_env()

from xidea_agent.api import create_app  # noqa: E402

app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)

