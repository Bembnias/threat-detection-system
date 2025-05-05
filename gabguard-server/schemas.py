from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import UploadFile, File

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

class FileAnalysisResponse(BaseModel):
    user_id: str
    description: str  # Changed from transcription to description to match endpoint
    toxicity_score: float

class ViolationRequest(BaseModel):
    user_id: str
    from_date: Optional[datetime] = Field(None, description="Start date for violations filter")
    to_date: Optional[datetime] = Field(None, description="End date for violations filter")

class ViolationRecord(BaseModel):
    timestamp: datetime
    violation_type: str  # e.g., "text", "audio", "file"
    content: Optional[str] = None
    toxicity_score: float

class ViolationResponse(BaseModel):
    user_id: str
    total_violations: int
    violations: List[ViolationRecord]