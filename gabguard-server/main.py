from fastapi import FastAPI, UploadFile, File, Query, Request, HTTPException
from fastapi.responses import StreamingResponse
from schemas import TextRequest, TextResponse, AudioResponse, FileAnalysisResponse
from models.text_classifier import analyze_text
from models.audio_analyzer import analyze_audio
from models.file_analyzer import analyze_file_content
from db.mongodb import report_violation, init_db, get_violations_by_user_and_days
from websocket.socket_handler import websocket_endpoint
from report.report_generator import generate_violation_pdf
from fastapi import WebSocket
from io import BytesIO

app = FastAPI()

@app.on_event("startup")
async def startup_db():
    init_db()

@app.post("/analyze_text", response_model=TextResponse)
async def analyze_text_route(request: TextRequest):
    bert_score, gpt_score = analyze_text(request.text)
    score = (bert_score + gpt_score)/2
    if score > 0.8:
        report_violation(user_id=request.user_id, content=request.text, type="text", score=score)
    return {"user_id": request.user_id, "text": request.text, "toxicity_score": score}

@app.post("/analyze_audio", response_model=AudioResponse)
async def analyze_audio_route(file: UploadFile = File(...), user_id: str = Query(..., description="ID of the user")):
    transcription, bert_score, gpt_score = analyze_audio(file.file)
    score = (bert_score + gpt_score)/2
    if score > 0.8:
        report_violation(user_id=user_id, content=transcription, type="audio", score=score)
    return {"user_id": user_id, "transcription": transcription, "toxicity_score": score}

@app.post("/analyze-file/", response_model=FileAnalysisResponse)
async def analyze_file_endpoint(file: UploadFile = File(...), user_id: str = Query(..., description="ID of the user uploading the file")):
    result = await analyze_file_content(file.file, file.filename)
    
    description = result.get("description", "No description available.")
    score = result.get("toxicity_score", -1)
    
    if score > 0.8:
        report_violation(
            user_id=user_id,
            content=f"File content: {description}",
            type="file",
            score=score
        )
    
    return {
        "user_id": user_id,
        "description": description,
        "toxicity_score": score,
    }

@app.get("/users/{user_id}/violations/recent")
async def get_recent_user_violations(
    request: Request, 
    user_id: str, 
    days: int = Query(default=60, description="Number of days back for the PDF report"), 
    user_id_admin: str = Query(..., description="ID of the admin generating the report")
):
    violations_data = get_violations_by_user_and_days(user_id, days)
    if not violations_data:
        raise HTTPException(status_code=404, detail="No violations found for this user in the specified period.")

    pdf_buffer, filename = generate_violation_pdf(user_id, user_id_admin, violations_data, days)
    pdf_content = pdf_buffer.getvalue()

    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"',
        'Content-Type': 'application/pdf'
    }

    return StreamingResponse(BytesIO(pdf_content), headers=headers, media_type='application/pdf')

@app.websocket("/ws/audio")
async def audio_socket(websocket: WebSocket):
    await websocket_endpoint(websocket)