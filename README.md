<p align="center">
  <img src="https://github.com/Bembnias/threat-detection-system/blob/a4265ff742112a0c0740e5b3afb109fbfc4df63f/gabguard-server/logo/Logo_GabGuard.png" alt="GabGuard Logo" width="250"/>
  <h1>GabGuard: Twój Strażnik Bezpiecznej Komunikacji Online 🛡️</h1>
  <h3>System AI do analizy rozmów i wykrywania gróźb, wulgaryzmów oraz mowy nienawiści</h3>
</p>

## Autorzy

<p align="center">
  <table>
    <tr>
      <td align="center">
        <a href="https://github.com/Bembnias">
            <img src="https://avatars.githubusercontent.com/u/35929872?v=4" width="50px" alt="Mateusz Bienias"/>
            <br />
            <sub><b>Mateusz Bienias</b></sub>
        </a>
      </td>
      <td align="center">
        <a href="https://github.com/Marcin177">
            <img src="https://avatars.githubusercontent.com/u/115288855?v=4" width="50px" alt="Marcin Gonciarz"/>
            <br />
            <sub><b>Marcin Gonciarz</b></sub>
        </a>
      </td>
    </tr>
  </table>
</p>

---

## Krótki opis

GabGuard to innowacyjny projekt oparty na sztucznej inteligencji, którego celem jest automatyczna analiza komunikacji online w czasie rzeczywistym i wykrywanie szkodliwych treści, takich jak groźby, wulgaryzmy oraz mowa nienawiści. Stworzony z myślą o bezpieczniejszych interakcjach cyfrowych, stanowi odpowiedź na rosnące wyzwania w cyfrowym świecie.

---

## Spis Treści

- [Autorzy](#autorzy)
- [Krótki opis](#krótki-opis)
- [Spis Treści](#spis-treści)
- [O Projekcie](#o-projekcie)
- [Problem, który rozwiązujemy](#problem-który-rozwiązujemy)
- [Jak działa GabGuard?](#jak-działa-gabguard)
- [Kluczowe Cechy](#kluczowe-cechy)
- [Technologie](#technologie)
- [Instalacja, Uruchomienie i Użycie](#instalacja-uruchomienie-i-użycie)
  - [Uruchomienie za pomocą Docker Compose](#uruchomienie-za-pomocą-docker-compose)
  - [Dodawanie bota do serwera Discord](#dodawanie-bota-do-serwera-discord)
  - [Korzystanie z bota](#korzystanie-z-bota)

---

## O Projekcie

**GabGuard** to zaawansowany system wykorzystujący sztuczną inteligencję do monitorowania i analizy treści komunikacyjnych w środowiskach online. Naszym głównym celem jest zapewnienie bezpieczniejszej przestrzeni cyfrowej poprzez automatyczne identyfikowanie i sygnalizowanie potencjalnie szkodliwych wypowiedzi. Projekt został opracowany w ramach pracy zaliczeniowej na Akademii Nauk Stosowanych w Nowym Sączu, stanowiąc odpowiedź na rosnące wyzwania związane z cyberprzemocą i negatywnymi treściami w internecie.

Projekt GabGuard bazuje na koncepcji wzmocnienia bezpieczeństwa cyfrowego, wychodząc naprzeciw problemowi coraz częstszych przypadków mowy nienawiści, gróźb czy wulgaryzmów w sieci. Dzięki zastosowaniu najnowszych osiągnięć w dziedzinie sztucznej inteligencji i widzenia maszynowego, system ma za zadanie działać prewencyjnie i interwencyjnie, tworząc bardziej pozytywne środowisko dla wszystkich użytkowników.

## Problem, który rozwiązujemy

W obliczu ekspansji platform komunikacyjnych, problem szkodliwych treści – mowy nienawiści, cyberprzemocy i gróźb – staje się coraz poważniejszy. Istniejące metody moderacji często nie nadążają za skalą problemu, co prowadzi do negatywnych konsekwencji dla użytkowników. GabGuard dostarcza inteligentne, proaktywne rozwiązanie, które wspiera tworzenie zdrowego i bezpiecznego ekosystemu online.

Nacisk kładziemy na to, że obecne rozwiązania (np. ręczna moderacja) są czasochłonne i mało efektywne. GabGuard ma na celu automatyzację tego procesu, jednocześnie zachowując wysoką skuteczność w wykrywaniu subtelnych, kontekstowych niuansów językowych.

## Jak działa GabGuard?

GabGuard wykorzystuje nowoczesne modele AI do analizy zarówno tekstu, jak i mowy. System nieustannie monitoruje komunikację, identyfikując subtelne wzorce językowe wskazujące na groźby, wulgaryzmy czy mowę nienawiści. Po wykryciu niepożądanej treści, GabGuard może automatycznie podjąć zdefiniowane akcje, takie jak powiadomienie moderatora, usunięcie wiadomości, a nawet tymczasowe zablokowanie użytkownika.

**Szczegółowy schemat działania:**

1.  **Moduł Wejściowy:**
    - System odbiera dane z różnych źródeł, początkowo skupiając się na platformie Discord. Dane mogą być w formie tekstowej (wiadomości z czatów) lub audio (strumienie głosowe z kanałów).
2.  **Moduł Transkrypcji (dla audio):**
    - Dla danych audio wykorzystywane są zaawansowane modele Speech-to-Text, takie jak **Whisper OpenAI**. Mowa jest precyzyjnie transkrybowana na tekst, co umożliwia dalszą analizę.
3.  **Moduł Analizy Językowej (NLP):**
    - Transkrybowany tekst (lub bezpośrednio dane tekstowe) jest przesyłany do modeli przetwarzania języka naturalnego (NLP), opartych o architekturę **Transformerów z biblioteki Hugging Face**. Modele te analizują kontekst, słowa kluczowe, składnię i semantykę, aby zrozumieć intencje wypowiedzi.
4.  **Moduł Wykrywania Treści Szkodliwych:**
    - Na podstawie analizy NLP, specjalnie wytrenowane modele klasyfikują treści pod kątem obecności gróźb, wulgaryzmów oraz mowy nienawiści. System potrafi rozróżnić subtelne różnice w języku.
5.  **Moduł Reakcji:**
    - Po wykryciu szkodliwej treści, system może podjąć szereg predefiniowanych działań, zgodnie z konfiguracją:
      - Wysłanie powiadomienia do moderatorów.
      - Automatyczne usunięcie problematycznej wiadomości.
      - Ostrzeżenie użytkownika.
6.  **Moduł Logowania i Raportowania:**
    - Incydenty, wykryte treści i podjęte akcje są szczegółowo logowane w bazie danych. Umożliwia to późniejsze analizy, generowanie raportów i stałe doskonalenie algorytmów.

## Kluczowe Cechy

- 🗣️ **Wykrywanie Gróźb:** Wykorzystujemy zaawansowane modele, które analizują wzorce językowe, intonację (w przypadku analizy audio) oraz kontekst, aby precyzyjnie identyfikować intencje agresywne i bezpośrednie groźby.
- 🤬 **Detekcja Wulgaryzmów:** Skuteczne rozpoznawanie i kategoryzacja niecenzuralnego słownictwa, z uwzględnieniem kontekstu, aby unikać fałszywych alarmów.
- 🚫 **Analiza Mowy Nienawiści:** Identyfikacja treści promujących dyskryminację, nienawiść lub przemoc na tle rasowym, etnicznym, religijnym, seksualnym itp.
- 🎮 **Integracja z Discordem:** Początkowo skupiamy się na platformie Discord, oferując bota moderacyjnego, który płynnie integruje się z istniejącymi serwerami.
- 🧩 **Modułowa Architektura:** System został zaprojektowany z myślą o modułowości, co ułatwia jego rozbudowę, dodawanie nowych funkcji oraz integrację z innymi platformami komunikacyjnymi w przyszłości.
- 🔒 **Zgodność z RODO:** Projekt uwzględnia kluczowe aspekty prawne związane z ochroną danych osobowych (RODO), zapewniając bezpieczeństwo i prywatność danych użytkowników.

## Technologie

GabGuard został zbudowany z wykorzystaniem nowoczesnych, skalowalnych i wydajnych technologii, aby zapewnić niezawodność i efektywność:

- **Backend:**
  - [FastAPI](https://fastapi.tiangolo.com/) (Python) - Nowoczesny, szybki (wysoka wydajność) framework webowy do budowania API w Pythonie, idealny do obsługi modeli AI.
- **Baza Danych:**
  - [MongoDB](https://www.mongodb.com/) - Elastyczna baza danych NoSQL, pozwalająca na przechowywanie danych w formacie JSON/BSON, idealna do skalowalnych aplikacji.
- **Sztuczna Inteligencja / Uczenie Maszynowe:**
  - [Whisper (OpenAI)](https://openai.com/index/whisper/) - Zaawansowany model do transkrypcji mowy na tekst, wspierający wiele języków.
  - [Transformers (Hugging Face)](https://huggingface.co/docs/transformers/index) - Biblioteka do budowy i trenowania najnowocześniejszych modeli NLP, takich jak BERT, GPT, T5, wykorzystywana do analizy semantycznej tekstu.
- **Komunikacja:**
  - [Discord.js](https://discord.js.org/) - Potężna biblioteka JavaScript do interakcji z API Discorda i tworzenia zaawansowanych botów.
  - [@discordjs/voice](https://www.npmjs.com/package/@discordjs/voice) - Moduł do obsługi połączeń

## Instalacja, Uruchomienie i Użycie

### Uruchomienie za pomocą Docker Compose

GabGuard został zaprojektowany z myślą o łatwym uruchomieniu w środowisku Docker. Aby uruchomić cały system (baza danych, serwer i bot Discord):

1. **Przygotuj plik zmiennych środowiskowych**

   Utwórz plik `.env` w głównym katalogu projektu z następującymi zmiennymi:

   ```
   BOT_TOKEN=twój_token_bota_discord
   OPENAI_API_KEY=twój_klucz_api_openai
   ADMIN_USER_IDS=id_admina_1,id_admina_2
   TOXICITY_THRESHOLD_WARN=0.6
   TOXICITY_THRESHOLD_DELETE=0.8
   ADMIN_NOTIFICATION_CHANNEL_ID=id_kanału_powiadomień
   COMMAND_PREFIX=!
   ```

2. **Upewnij się, że masz certyfikaty HTTPS**

   Certyfikaty powinny znajdować się w katalogu `gabguard-server/https/`:

   - `cert.pem` - plik certyfikatu
   - `key.pem` - plik klucza prywatnego

   Możesz wygenerować certyfikaty self-signed dla celów testowych:

   ```bash
   mkdir -p gabguard-server/https
   openssl req -x509 -newkey rsa:4096 -keyout gabguard-server/https/key.pem -out gabguard-server/https/cert.pem -days 365 -nodes
   ```

3. **Uruchom system za pomocą Docker Compose**

   ```bash
   docker-compose up -d
   ```

   Aby wyświetlić logi:

   ```bash
   docker-compose logs -f
   ```

   Aby zatrzymać system:

   ```bash
   docker-compose down
   ```

4. **Sprawdź, czy wszystko działa poprawnie**

   - Serwer API powinien być dostępny pod adresem `https://localhost/`
   - Bot Discord powinien być online i gotowy do używania na serwerach Discord

### Dodawanie bota do serwera Discord

1. Przejdź do [portalu deweloperskiego Discord](https://discord.com/developers/applications)
2. Wybierz swoją aplikację i przejdź do sekcji "OAuth2"
3. W zakładce "URL Generator" wybierz scope "bot" oraz wymagane uprawnienia
4. Skopiuj wygenerowany link i wklej go w przeglądarce
5. Wybierz serwer, na którym chcesz dodać bota i potwierdź

### Korzystanie z bota

Po dodaniu bota do serwera Discord, możesz używać następujących komend:

- `!joinvoice` - Bot dołączy do kanału głosowego i zacznie nasłuchiwać
- `!leavevoice` - Bot opuści kanał głosowy
- `!checkuser <user_id>` - Zwróci raport PDF dla wybranego użytkownika
- `!settoxicity 0.7` - Zmieni próg toksyczności (tylko dla administratorów)

Bot automatycznie analizuje wiadomości tekstowe i pliki oraz wypowiedzi głosowe pod kątem treści szkodliwych.
