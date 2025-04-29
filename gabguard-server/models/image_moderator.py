import openai
import base64
from config_api import OpenAI_api
from typing import Dict

# Ustawienie klucza API OpenAI
openai.api_key = OpenAI_api

# Funkcja generująca opis obrazu
async def generate_image_description(image_bytes: bytes) -> str:
    """Generuje opis obrazu na podstawie jego danych binarnych."""
    try:
        # Kodowanie obrazu na base64
        image_data = base64.b64encode(image_bytes).decode("utf-8")
        
        # Wysłanie żądania do OpenAI API dla analizy obrazu
        # Używamy aktualnego modelu gpt-4o zamiast przestarzałego gpt-4-vision-preview
        response = await openai.ChatCompletion.acreate(
            model="gpt-4o",  # Aktualny model z możliwością analizy obrazów
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Describe the content of this image in detail:"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_data}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=300
        )
        
        # Odbieranie odpowiedzi
        if response.choices and len(response.choices) > 0:
            description = response.choices[0].message.content
            return description
        else:
            return "No description available."
    except Exception as e:
        return f"No description available. Error: {str(e)}"

# Funkcja oceniająca toksyczność tekstu
async def evaluate_toxicity(description: str) -> float:
    """Ocena toksyczności tekstu, zwraca wartość od 0 (brak toksyczności) do 1 (wysoka toksyczność)."""
    try:
        # Tworzymy zapytanie do analizy toksyczności tekstu
        response = await openai.ChatCompletion.acreate(
            model="gpt-4o",  # Użycie modelu GPT-4 do analizy toksyczności
            messages=[
                {"role": "system", "content": "Assess the following text for inappropriate content (violence, hate speech, racism, etc.). Provide only a score from 0 to 1, where 0 means no inappropriate content, and 1 means highly inappropriate."},
                {"role": "user", "content": description}
            ],
            temperature=0.2,
            max_tokens=5
        )
        
        # Odczytanie odpowiedzi i próba parsowania wyniku
        toxicity_score = response.choices[0].message.content.strip()
        try:
            score = float(toxicity_score)
            return max(0.0, min(1.0, score))  # Upewniamy się, że wynik mieści się w przedziale 0-1
        except ValueError:
            return 0.5  # Domyślna wartość, jeśli nie uda się sparsować wyniku
    except Exception as e:
        return 0.5

# Główna funkcja analizująca obraz
async def analyze_image(image_bytes: bytes) -> Dict:
    """Analizuje obraz, generuje jego opis i ocenia toksyczność opisanego tekstu."""
    description = await generate_image_description(image_bytes)
    toxicity_score = await evaluate_toxicity(description)
    
    return {"description": description, "toxicity_score": toxicity_score}