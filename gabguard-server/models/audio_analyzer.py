import openai
import tempfile
import os
from pydub import AudioSegment
from models.text_classifier import analyze_text
from config_api import OpenAI_api

openai.api_key = OpenAI_api

def analyze_audio(file):
    # Utworzenie katalogu tymczasowego dla plików większego rozmiaru
    temp_dir = tempfile.mkdtemp()
    try:
        # Zapisz cały plik do tymczasowego pliku
        input_path = os.path.join(temp_dir, "input_audio.mp3")
        with open(input_path, "wb") as tmp:
            tmp.write(file.read())
        
        # Konwersja do WAV z obsługą dużych plików
        audio = AudioSegment.from_file(input_path)
        wav_path = os.path.join(temp_dir, "output_audio.wav")
        
        # Ustawienie parametrów dla WAV, aby zmniejszyć rozmiar pliku
        # przy zachowaniu akceptowalnej jakości dźwięku
        audio = audio.set_channels(1)  # Mono zamiast stereo
        audio = audio.set_frame_rate(16000)  # Niższa częstotliwość próbkowania
        audio = audio.set_sample_width(2)  # 16-bit zamiast 24/32-bit
        
        # Eksport z parametrami kompresji
        audio.export(wav_path, format="wav")
        
        # Sprawdzenie rozmiaru pliku WAV
        wav_size = os.path.getsize(wav_path)
        
        # Jeśli plik jest zbyt duży dla API OpenAI (>25MB), dzielimy go na części
        if wav_size > 25 * 1024 * 1024:
            transcription = process_large_audio_file(audio, temp_dir)
        else:
            # Standardowe przetwarzanie dla mniejszych plików
            with open(wav_path, "rb") as audio_file:
                transcription = openai.Audio.transcribe("whisper-1", audio_file)["text"]
        
        # Analiza transkrypcji pod kątem toksyczności
        score, gpt_score = analyze_text(transcription)
        
        return transcription, score, gpt_score
    
    finally:
        # Czyszczenie plików tymczasowych
        for root, dirs, files in os.walk(temp_dir, topdown=False):
            for name in files:
                os.remove(os.path.join(root, name))
        os.rmdir(temp_dir)

def process_large_audio_file(audio, temp_dir):
    """Przetwarza duże pliki audio dzieląc je na mniejsze fragmenty."""
    # Długość segmentu w milisekundach (5 minut)
    segment_length = 5 * 60 * 1000
    
    # Obliczenie liczby segmentów
    audio_length = len(audio)
    segments = []
    
    # Podział audio na segmenty
    for i in range(0, audio_length, segment_length):
        segment = audio[i:i + segment_length]
        segment_path = os.path.join(temp_dir, f"segment_{i//segment_length}.wav")
        segment.export(segment_path, format="wav")
        segments.append(segment_path)
    
    # Transkrypcja każdego segmentu
    transcriptions = []
    for segment_path in segments:
        with open(segment_path, "rb") as audio_file:
            segment_transcription = openai.Audio.transcribe("whisper-1", audio_file)["text"]
            transcriptions.append(segment_transcription)
    
    # Połączenie wszystkich transkrypcji
    return " ".join(transcriptions)