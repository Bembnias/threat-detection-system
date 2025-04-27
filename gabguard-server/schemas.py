from pydantic import BaseModel
from typing import Optional

class TextRequest(BaseModel):
    text: str
    user_id: str

class TextResponse(BaseModel):
    toxicity_score: float

class AudioResponse(BaseModel):
    transcription: str
    toxicity_score: float