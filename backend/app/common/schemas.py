from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """SQLAlchemy 모델에서 바로 변환 가능한 응답 스키마의 부모."""

    model_config = ConfigDict(from_attributes=True)


class ErrorResponse(BaseModel):
    code: str
    message: str


class MessageResponse(BaseModel):
    message: str
