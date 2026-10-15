"""Serve an opt-in static TanStack SPA from the same process as the API."""

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles


class FrontendFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            response = await super().get_response(path, scope)
            if path.startswith("assets/"):
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response
        except HTTPException as error:
            # Only application routes receive the shell; missing API/assets remain 404.
            route = path.strip("/")
            is_route = route in {"", ".", "investigate", "compare", "methodology", "about"}
            is_report = (
                route.startswith("investigations/")
                and len(route.split("/")) == 2
                and bool(route.split("/")[1])
            )
            if error.status_code != 404 or not (is_route or is_report):
                raise
            response = await super().get_response("_shell.html", scope)
            response.headers["Cache-Control"] = "no-cache"
            return response
