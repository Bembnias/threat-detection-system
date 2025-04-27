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
                transcription, bert_score, gpt_score = analyze_audio(open(tmp.name, "rb"))
                score = (bert_score + gpt_score)/2
            await websocket.send_json({"transcription": transcription, "toxicity_score": score})
            buffer.clear()
        else:
            buffer.extend(data)
