# GabGuard – Uruchamianie serwera 

## 📁 Utworzenie wymaganych katalogów

```bash
mkdir C:\data\db
```

---

## 📦 Przejście do katalogu

```bash
cd .\gabguard-server\
```

---


## ▶️ Uruchomienie aplikacji

1. Aktywuj środowisko wirtualne:

```bash
.\.venv\Scripts\activate
```

2. Włącz MongoDB (lokalnie)(inny terminal):

```bash
c:\mongodb\bin\mongod.exe
```

3. Instalacja zależności

```bash
pip install -r requirements.txt
```

4. Uruchom backend FastAPI:

```bash
uvicorn main:app --reload
```

---

## 📝 Notatki

- Dokumentacja API po uruchomieniu dostępna pod `http://127.0.0.1:8000/docs`.

---

## ⚙️ Endpointy API

Poniżej znajduje się lista dostępnych endpointów API wraz z opisem ich funkcjonalności i struktury zwracanych danych.

1. `/analyze_text` - **Analiza Tekstu**

Ten endpoint służy do analizy dostarczonego tekstu.

**Metoda**: POST

**Zapytanie**: Tekst do analizy przesyłany jest jako plaintext w ciele żądania (request body).

**Przykład zapytania (JSON)**:
```JSON
{"text": "Przykładowy tekst do analizy."}
```

**Zwracane dane (JSON)**:
```JSON
{
  "user_id": "string",
  "text": "string",
  "toxicity_score": 0
}
```
* `user_id`: Identyfikator użytkownika, który wysłał tekst.
* `text`: Przetworzony tekst.
* `toxicity_score`: Współczynnik toksyczności tekstu. Wartość `0` oznacza brak toksyczności. W przypadku wystąpienia błędu podczas analizy przez model AI, zwracana jest wartość `-1`.

2. `/analyze_audio` - **Analiza Audio**

Ten endpoint umożliwia analizę plików audio.

**Metoda**: POST

**Zapytanie**: Plik audio (w formacie .mp3 lub .wav) przesyłany jest jako plik w formularzu (multipart/form-data).

**Zwracane dane (JSON)**:
```JSON
{
  "user_id": "string",  
  "transcription": "string",  
  "toxicity_score": 0
}
```
* `user_id`: Identyfikator użytkownika, który przesłał plik audio.
* `transcription`: Transkrypcja zawartości pliku audio na tekst.
* `toxicity_score`: Współczynnik toksyczności transkrybowanego tekstu. Wartość `0` oznacza brak toksyczności. W przypadku wystąpienia błędu podczas analizy przez model * AI, zwracana jest wartość `-1`.

3. `/analyze-file/` - **Analiza Plików**

Ten endpoint służy do ogólnej analizy plików różnego typu.

**Metoda**: POST

**Zapytanie**: Dowolny typ pliku przesyłany jest jako plik w formularzu (multipart/form-data).

**Zwracane dane (JSON)**:
```JSON
{
  "user_id": "string",  
  "description": "string",  
  "toxicity_score": 0
}
```
* `user_id`: Identyfikator użytkownika, który przesłał plik.
* `description`: Opis zawartości pliku lub wyekstrahowany tekst (jeśli to możliwe).
* `toxicity_score`: Współczynnik toksyczności wyekstrahowanego tekstu (jeśli dotyczy). Wartość `0` oznacza brak toksyczności. W przypadku wystąpienia błędu podczas analizy przez model AI, zwracana jest wartość `-1`.

4. `/users/{user_id}/violations/recent` - **Generowanie Raportu Naruszeń Użytkownika**

Ten endpoint generuje raport w formacie PDF dla konkretnego użytkownika.  Dostępny jest dla administratorów systemu.

**Metoda**: GET

**Parametry** URL:

* `user_id`: Identyfikator użytkownika, dla którego ma zostać wygenerowany raport. Należy go umieścić bezpośrednio w ścieżce URL, np. `/users/123/violations/recent`.

**Zwracane dane**:

Plik PDF zawierający raport naruszeń dla danego użytkownika.

### Ważne:

W przypadku wszystkich endpointów analizujących tekst ( `/analyze_text`, `/analyze_audio`, `/analyze-file/`), jeżeli wartość `toxicity_score` wynosi `-1`, oznacza to, że wystąpił błąd podczas przetwarzania i analizy tekstu/pliku przez model sztucznej inteligencji.