from pydantic import BaseModel

class TextRequest(BaseModel):
    text: str
    user_id: str

class TextResponse(BaseModel):
    toxicity_score: float
    label: str

class AudioResponse(BaseModel):
    transcription: str
    toxicity_score: float
    label: str
