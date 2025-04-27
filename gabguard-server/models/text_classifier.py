# from transformers import pipeline
# from googletrans import Translator


# # Inicjalizacja klasyfikatora toksyczności
# classifier = pipeline("text-classification", model="unitary/toxic-bert")

# # Inicjalizacja tłumacza
# translator = Translator()


# def analyze_text(text: str):
#     # Tłumaczenie tekstu na angielski
#     translated_text = translator.translate(text, src='auto', dest='en').text

#     # Analiza tekstu
#     result = classifier(translated_text)[0]

#     return result['score'], result['label']


#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
from transformers import pipeline
from googletrans import Translator
from config import OpenAI_api
import openai

# Inicjalizacja klasyfikatora toksyczności
classifier = pipeline("text-classification", model="unitary/toxic-bert")

# Inicjalizacja tłumacza
translator = Translator()

# Ustawienie klucza API OpenAI
openai.api_key = OpenAI_api


def gpt_check_toxicity(text: str):
    """
    Funkcja używająca GPT-4 do podwójnej weryfikacji toksyczności.
    """
    prompt = f"Please classify if the following text is toxic or not. Answer only with 'toxic' or 'not toxic'.\n\nText: {text}"

    response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": prompt}
    ],
    max_tokens=1000,
    temperature=0
)


    return response.choices[0].message["content"].strip()



def analyze_text(text: str):
    # Tłumaczenie tekstu na angielski
    translated_text = translator.translate(text, src='auto', dest='en').text

    # Wstępna analiza tekstu przy użyciu BERT
    result = classifier(translated_text)[0]

    # Podwójna weryfikacja z GPT
    gpt_result = gpt_check_toxicity(translated_text)

    # Wyświetlenie wyników
    return {
        result['score'],
        result['label'],
        gpt_result
    }
