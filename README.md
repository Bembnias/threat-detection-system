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

2. Instalacja zależności

```bash
pip install -r requirements.txt
```

3. Uruchom backend FastAPI:

```bash
uvicorn main:app --reload
```

4. Włącz MongoDB (lokalnie)(inny terminal):

```bash
c:\mongodb\bin\mongod.exe
```

---

## 📝 Notatki

- Dokumentacja API po uruchomieniu dostępna pod `http://127.0.0.1:8000/docs`.
