import openai
import tempfile
from pydub import AudioSegment
from models.text_classifier import analyze_text
from config import OpenAI_api

openai.api_key = OpenAI_api

def analyze_audio(file):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp.write(file.read())
        tmp.flush()
        audio = AudioSegment.from_file(tmp.name)
        wav_path = tmp.name.replace(".mp3", ".wav")
        audio.export(wav_path, format="wav")

    with open(wav_path, "rb") as audio_file:
        transcription = openai.Audio.transcribe("whisper-1", audio_file)["text"]

    # Użyj poprawnie analyze_text
    result = analyze_text(transcription)
    score = result["bert_score"]
    label = result["bert_label"]

    return transcription, score, label
