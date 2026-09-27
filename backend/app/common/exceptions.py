from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


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


def _field(loc) -> str:
    """("body", "items", 0, "name") → "items.0.name" """
    return ".".join(str(p) for p in loc if p not in ("body", "query", "path", "header"))


def register_exception_handlers(app: FastAPI) -> None:
    """모든 에러를 {"code": ..., "message": ...} 한 가지 모양으로 돌려준다 (FE가 한 방식으로 처리할 수 있게)."""

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message})

    @app.exception_handler(RequestValidationError)
    async def _request_validation(_: Request, exc: RequestValidationError):
        # 요청 값 검사(Pydantic) 실패. errors 에 필드별 사유를 담는다
        errors = [{"field": _field(e["loc"]), "message": e["msg"].removeprefix("Value error, ")} for e in exc.errors()]
        first = errors[0] if errors else {"field": "", "message": "요청 값이 올바르지 않습니다."}
        message = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
        return JSONResponse(status_code=422, content={"code": "VALIDATION_ERROR", "message": message, "errors": errors})

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        # 없는 주소(404), 허용 안 된 메서드(405) 등 FastAPI 기본 에러
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
        return JSONResponse(
            status_code=exc.status_code, content={"code": code, "message": str(exc.detail)}, headers=exc.headers
        )

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception):
        # 예상 못 한 서버 오류. 앱에는 일반 문구만 보낸다 (traceback 은 Starlette 가 다시 raise 해서 서버 로그에 남는다)
        message = "서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요."
        return JSONResponse(status_code=500, content={"code": "INTERNAL_ERROR", "message": message})

    @app.exception_handler(NotImplementedError)
    async def _not_implemented(_: Request, exc: NotImplementedError):
        # 아직 담당자가 구현하지 않은 TODO 기능 → 501
        return JSONResponse(
            status_code=501,
            content={"code": "NOT_IMPLEMENTED", "message": str(exc) or "아직 구현되지 않은 기능입니다."},
        )
