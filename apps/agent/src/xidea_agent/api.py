from fastapi import FastAPI

from xidea_agent.graph import describe_graph


def create_app() -> FastAPI:
    app = FastAPI(title="Xidea Agent")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/graph")
    def graph() -> dict[str, object]:
        return describe_graph()

    return app

