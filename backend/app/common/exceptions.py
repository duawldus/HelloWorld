from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """모든 비즈니스 예외의 부모. 응답 형식: {"code": ..., "message": ...}"""

    status_code = 400
    code = "BAD_REQUEST"

    def __init__(self, message: str = "잘못된 요청입니다.", code: str | None = None):
        self.message = message
        if code:
            self.code = code
        super().__init__(message)


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class ValidationError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message})

    @app.exception_handler(NotImplementedError)
    async def _not_implemented(_: Request, exc: NotImplementedError):
        # 아직 담당자가 구현하지 않은 TODO 기능 → 501
        return JSONResponse(
            status_code=501,
            content={"code": "NOT_IMPLEMENTED", "message": str(exc) or "아직 구현되지 않은 기능입니다."},
        )
