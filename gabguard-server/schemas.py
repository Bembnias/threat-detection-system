from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class TextRequest(BaseModel):
    text: str
    user_id: str

class TextResponse(BaseModel):
    user_id: str
    text: str
    toxicity_score: float

class AudioResponse(BaseModel):
    user_id: str
    transcription: str
    toxicity_score: float

class VideoResponse(BaseModel):
    user_id: str
    description: str
    toxicity_score: float

class Violation(BaseModel):
    id: Optional[str] = Field(alias="_id")
    user_id: str
    type: str
    content: str
    score: float
    timestamp: datetime

class RecentViolationsResponse(BaseModel):
    violations: List[Violation]