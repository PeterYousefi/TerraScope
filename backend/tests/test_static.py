from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_hosted_frontend_and_api_routes(tmp_path):
    frontend = tmp_path / "frontend"
    frontend.mkdir()
    (frontend / "_shell.html").write_text("<html>SiteSignal shell</html>")
    (frontend / "styles.css").write_text("body { color: black }")
    settings = Settings(
        database_url=f"sqlite:///{tmp_path}/hosted.db", static_dir=str(frontend)
    )
    with TestClient(create_app(settings)) as client:
        for route in ("/", "/investigate", "/compare", "/investigations/saved-id"):
            response = client.get(route)
            assert response.status_code == 200
            assert "SiteSignal shell" in response.text
            assert response.headers["cache-control"] == "no-cache"
        assert client.get("/styles.css").headers["content-type"].startswith("text/css")
        assert client.get("/api/health").json()["status"] == "ok"
        for route in ("/api/unknown", "/assets/missing.js", "/.env", "/unknown"):
            assert client.get(route).status_code == 404
