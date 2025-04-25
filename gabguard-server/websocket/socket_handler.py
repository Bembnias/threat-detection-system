from fastapi import WebSocket
from models.audio_analyzer import analyze_audio
import tempfile

async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    buffer = bytearray()

    while True:
        data = await websocket.receive_bytes()
        if data == b"__END__":
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                tmp.write(buffer)
                tmp.flush()
                transcription, score, label = analyze_audio(open(tmp.name, "rb"))
            await websocket.send_json({"transcription": transcription, "toxicity_score": score, "label": label})
            buffer.clear()
        else:
            buffer.extend(data)
