from fastapi import FastAPI, UploadFile, File, Query, Request, HTTPException, WebSocket
from fastapi.responses import StreamingResponse
from schemas import TextRequest, TextResponse, AudioResponse, FileAnalysisResponse
from models.text_classifier import analyze_text
from models.audio_analyzer import analyze_audio
from models.file_analyzer import analyze_file_content
from db.mongodb import report_violation, init_db, get_violations_by_user_and_days
from websocket.socket_handler import websocket_endpoint
from report.report_generator import generate_violation_pdf
from io import BytesIO
from globals import toxicity_score as toxic_score
import uvicorn
import os
import ssl

app = FastAPI()

@app.on_event("startup")
async def startup_db():
    init_db()

@app.post("/analyze_text", response_model=TextResponse)
async def analyze_text_route(request: TextRequest):
    global toxic_score
    print(toxic_score)
    bert_score, gpt_score = analyze_text(request.text)
    score = (bert_score + gpt_score)/2
    if score > toxic_score:
        report_violation(user_id=request.user_id, content=request.text, type="text", score=score)
    return {"user_id": request.user_id, "text": request.text, "toxicity_score": score}

@app.post("/analyze_audio", response_model=AudioResponse)
async def analyze_audio_route(file: UploadFile = File(...), user_id: str = Query(..., description="ID of the user")):
    global toxic_score
    transcription, bert_score, gpt_score = analyze_audio(file.file)
    score = (bert_score + gpt_score)/2
    if score > toxic_score:
        report_violation(user_id=user_id, content=transcription, type="audio", score=score)
    return {"user_id": user_id, "transcription": transcription, "toxicity_score": score}

@app.post("/analyze-file/", response_model=FileAnalysisResponse)
async def analyze_file_endpoint(file: UploadFile = File(...), user_id: str = Query(..., description="ID of the user uploading the file")):
    global toxic_score
    result = await analyze_file_content(file.file, file.filename)
    
    description = result.get("description", "No description available.")
    score = result.get("toxicity_score", -1)
    
    if score > toxic_score:
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
    global toxic_score
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

@app.put("/toxicity/{score_value}")
def update_toxicity_score(score_value: float):
    global toxic_score
    toxic_score = score_value
    return {"message": "Toxicity score updated", "toxicity_score": toxic_score}

@app.websocket("/ws/audio")
async def audio_socket(websocket: WebSocket):
    await websocket_endpoint(websocket)

if __name__ == "__main__":
    # SSL context setup
    ssl_certfile = os.path.join("https", "cert.pem")  # Path to your certificate file
    ssl_keyfile = os.path.join("https", "key.pem")    # Path to your key file
    
    # Check if the certificate and key files exist
    if not os.path.exists(ssl_certfile):
        print(f"Certificate file not found at {ssl_certfile}")
        exit(1)
    if not os.path.exists(ssl_keyfile):
        print(f"Key file not found at {ssl_keyfile}")
        exit(1)
    
    # Create SSL context
    ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    ssl_context.load_cert_chain(certfile=ssl_certfile, keyfile=ssl_keyfile)
    
    # Run the server with HTTPS
    uvicorn.run(
        "main:app",
        host="localhost",
        port=443,  # Standard HTTPS port
        ssl_certfile=ssl_certfile,
        ssl_keyfile=ssl_keyfile
    )