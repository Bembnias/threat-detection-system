from transformers import pipeline
from googletrans import Translator
from config_app import OpenAI_api
import openai

# Inicjalizacja klasyfikatora toksyczności
classifier = pipeline("text-classification", model="unitary/toxic-bert")

# Inicjalizacja tłumacza
translator = Translator()

# Ustawienie klucza API OpenAI
openai.api_key = OpenAI_api


def gpt_check_toxicity(text: str):
    #Zapytanie do gpt
    prompt = f"Please assess the toxicity level of the following text on a scale from 0 to 1, where 0 means no toxicity and 1 means the highest level of toxicity. Consider the context of the text in your assessment. Answer with only a single number between 0 and 1.\n\nText: {text}"

    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "user", "content": prompt}
        ],
        max_tokens=100,
        temperature=0.2
    )

    try:
        toxicity_score_str = response.choices[0].message["content"].strip()
        toxicity_score = float(toxicity_score_str)
        return toxicity_score
    except (ValueError, IndexError):
        print(f"Error parsing GPT response: {response}")
        return None


def analyze_text(text: str):
    # Tłumaczenie tekstu na angielski
    translated_text = translator.translate(text, src='auto', dest='en').text

    # Wstępna analiza tekstu przy użyciu BERT
    result = classifier(translated_text)[0]

    # Podwójna weryfikacja z GPT
    gpt_result = gpt_check_toxicity(translated_text)

    # Wyświetlenie wyników
    return result['score'], gpt_result # Zwracamy jako krotkę (trzy wartości)