from fastapi import FastAPI, UploadFile, File
from schemas import TextRequest, TextResponse, AudioResponse
from models.text_classifier import analyze_text
from models.audio_analyzer import analyze_audio
from db.mongodb import report_violation, init_db
from websocket.socket_handler import websocket_endpoint
from fastapi import WebSocket
app = FastAPI()

@app.on_event("startup")
async def startup_db():
    init_db()

@app.post("/analyze_text", response_model=TextResponse)
async def analyze_text_route(request: TextRequest):
    bert_score, gpt_score = analyze_text(request.text)
    score = (bert_score + gpt_score)/2
    if score > 0.85:
        report_violation(user_id=request.user_id, content=request.text, type="text", score=score)
    return {"toxicity_score": score}

@app.post("/analyze_audio", response_model=AudioResponse)
async def analyze_audio_route(file: UploadFile = File(...), user_id: str = "unknown"):
    transcription, bert_score, gpt_score= analyze_audio(file.file)
    score = (bert_score + gpt_score)/2
    if score > 0.85:
        report_violation(user_id=user_id, content=transcription, type="audio", score=score)
    return {"transcription": transcription, "toxicity_score": score}

@app.websocket("/ws/audio")
async def audio_socket(websocket: WebSocket):
    await websocket_endpoint(websocket)