# Vibe — sklep z bluzami i koszulkami

Lekki sklep internetowy w **czystym Node.js** (zero zależności — nie trzeba `npm install`).
Katalog produktów, modal produktu z wyborem rozmiaru/koloru, koszyk (localStorage)
i składanie zamówień z walidacją po stronie serwera.

> **Adres docelowy:** `http://85.215.197.199:8080` — osobny port na istniejącym serwerze,
> działa obok aktualnego web servera, nic nie nadpisuje.

---

## Stos

- **Backend:** Node.js (wbudowany moduł `http`, bez frameworków)
- **Frontend:** statyczny HTML/CSS/JS (vanilla), obrazki produktów generowane jako SVG
- **Dane:** `data/products.json` (katalog), zamówienia zapisywane do `data/orders.json`
- **Wdrożenie:** `git` + `systemd` na porcie 8080

---

## Struktura

```
vibe-sklep/
├── server.js              # serwer HTTP + API (/api/products, /api/orders, /api/health)
├── package.json
├── data/
│   └── products.json      # katalog bluz i koszulek (edytuj tutaj produkty)
├── public/                # frontend
│   ├── index.html
│   ├── css/styles.css
│   ├── js/app.js
│   └── img/favicon.svg
├── pages/                # osobne podstrony (renderowane z SEO przez serwer)
│   ├── produkt.html      # szablon strony produktu (/produkt/<id>)
│   ├── dostawa-zwroty.html
│   ├── tabela-rozmiarow.html
│   └── kontakt.html
└── deploy/
    ├── setup.sh           # instalator na serwer (systemd + firewall)
    ├── vibe-sklep.service # wzorcowy unit systemd
    └── nginx-vibe.conf.example  # opcjonalnie: domena przez nginx
```

## SEO

- Jasny, minimalistyczny UI (motyw light).
- Osobne strony produktów z własnym URL: `/produkt/<id>` (np. `/produkt/bluza-classic`).
- Dane strukturalne JSON-LD: `Store` + `ItemList` (strona główna), `Product` +
  `AggregateRating` + `BreadcrumbList` (strony produktów), `Organization` z social media.
- Per-produktowy obrazek Open Graph generowany na bieżąco: `/img/produkt/<id>.svg`.
- Katalog renderowany po stronie serwera (linki do produktów widoczne dla robotów bez JS).
- `/robots.txt` i `/sitemap.xml` (strona główna + podstrony + wszystkie produkty).

## Konta, panele i baza danych

- **Baza:** SQLite (wbudowany `node:sqlite`) — plik `data/vibe.db`. Wymaga **Node ≥ 22**
  uruchomionego z flagą `--experimental-sqlite` (skrypt instalacyjny ustawia to sam).
- **Rejestracja/logowanie:** klienci rejestrują się e-mailem (`/rejestracja`, `/logowanie`).
- **Panel klienta** (`/konto`): dane konta + historia zamówień (zamówienia wiążą się z kontem).
- **Panel admina** (`/admin`) z bocznym menu jak w prawdziwym sklepie:
  - **Pulpit** — KPI (obrót, zamówienia, nowe, klienci), wykres sprzedaży 7 dni, ostatnie
    zamówienia, alerty niskich stanów, **bestsellery** (najczęściej kupowane).
  - **Zamówienia** — filtr po statusie + wyszukiwarka, zmiana statusu, dane klienta,
    **eksport do CSV**.
  - **Produkty** — dodawanie / edycja / usuwanie, stany magazynowe.
  - **Klienci** — lista z liczbą zamówień i wydaną kwotą, wyszukiwarka, **zmiana roli
    (klient↔admin) i usuwanie konta** (z zabezpieczeniami: nie można usunąć siebie ani
    ostatniego admina).
  - **Wiadomości** — zgłoszenia z formularza kontaktowego, z możliwością usuwania.
  - **Kody rabatowe** — tworzenie kodów procentowych/kwotowych, włączanie/wyłączanie, usuwanie;
    działają w koszyku (walidacja i naliczanie po stronie serwera).
  - **Ustawienia** — próg darmowej dostawy, koszt dostawy, tekst paska promo, dane kontaktowe
    (zmiany działają od razu w całym sklepie).
  - **Szczegóły zamówienia** — notatka wewnętrzna, wydruk (paragon), rozbicie dostawa/rabat.
  - **Zdjęcia produktów** — upload (PNG/JPG/WebP) w panelu; jeśli brak, używana jest grafika SVG.
  - Admin loguje się **loginem `admin`** + hasłem z konfiguracji (`ADMIN_PASSWORD`).
- **Produkty w bazie:** tabela `products` (zamiast pliku). `products.json` służy tylko jako
  zasiew przy pierwszym uruchomieniu (gdy tabela pusta). Zmiany z panelu admina są od razu
  widoczne w katalogu, na stronach produktów, w `sitemap.xml` i danych strukturalnych.
- **Magazyn:** każdy produkt ma stan (`stock`). Przy zamówieniu stan jest sprawdzany i zdejmowany;
  przy 0 produkt jest oznaczony „Wyprzedane" i nie można go kupić. Admin ustawia stan w panelu.
- **Wyszukiwarka + sortowanie** na stronie głównej (po nazwie; sort: polecane / cena / nazwa),
  obok filtrów kategorii.

### Bezpieczeństwo bazy

- Hasła hashowane `scrypt` z losową solą (wbudowany `crypto`), porównanie w czasie stałym.
- Wszystkie zapytania **parametryzowane** (prepared statements) — brak SQL injection.
- Sesje: token kryptograficznie losowy, cookie `HttpOnly` + `SameSite=Strict`.
- Plik `vibe.db` poza `public/` (niedostępny przez WWW), prawa `600`, w `.gitignore`.
- Endpointy admina chronione kontrolą roli po stronie serwera; API nie zwraca hashy haseł.
- Ochrona logowania przed brute-force (limit prób na IP), nagłówki bezpieczeństwa.
- **Zmień domyślne hasło admina** ustawiając `ADMIN_PASSWORD`. Przy HTTPS dodaj `Secure` do cookie.

---

## Uruchomienie lokalne (Windows / dowolny system)

```bash
node server.js
# otwórz http://localhost:8080
```

Zmiana portu: `PORT=3000 node server.js` (na Windows PowerShell: `$env:PORT=3000; node server.js`).

---

## Wdrożenie na serwer (przez PuTTY)

Serwer: **Ubuntu 22.04**, łączysz się jako `root`. Sklep stanie na **porcie 8080**.

### 1. Sklonuj repozytorium

```bash
cd /opt
git clone https://github.com/Mateuszl28/Vibe.git vibe-sklep
cd vibe-sklep
```

### 2. Uruchom instalator (jeden skrypt robi całość)

```bash
sudo bash deploy/setup.sh
```

Skrypt automatycznie:
- zainstaluje Node.js 20 (jeśli go nie ma),
- ustawi właściciela katalogu na `www-data`,
- utworzy i uruchomi usługę `systemd` (`vibe-sklep`) na porcie 8080,
- otworzy port 8080 w `ufw` (jeśli firewall jest aktywny),
- pokaże status i adres.

### 3. Gotowe

Sklep działa pod: **http://85.215.197.199:8080**

---

## Zarządzanie usługą

```bash
systemctl status vibe-sklep      # status
systemctl restart vibe-sklep     # restart
systemctl stop vibe-sklep        # zatrzymanie
journalctl -u vibe-sklep -f      # logi na żywo
```

## Aktualizacja sklepu (po zmianach w repo)

```bash
cd /opt/vibe-sklep
git pull
systemctl restart vibe-sklep
```

> **Uwaga:** jeśli aktualizacja zmienia wersję Node lub konfigurację usługi
> (np. wprowadzenie bazy SQLite — Node 22 + flaga), uruchom ponownie instalator
> zamiast samego restartu: `ADMIN_PASSWORD='twoje-haslo' bash deploy/setup.sh`

---

## Edycja produktów

Otwórz `data/products.json`, dodaj/zmień wpisy, zapisz, a następnie:

```bash
systemctl restart vibe-sklep
```

Pola produktu: `id`, `name`, `category` (`bluza`/`koszulka`), `price`, `colors[]`,
`sizes[]`, `color` (tło kafelka), `accent` (kolor grafiki), `description`, `featured`.

## Podgląd zamówień

```bash
cat /opt/vibe-sklep/data/orders.json
```

Plik `orders.json` jest w `.gitignore` — zamówienia nie trafiają do repo.

---

## API

| Metoda | Endpoint              | Opis                          |
|--------|-----------------------|-------------------------------|
| GET    | `/api/health`         | status serwera                |
| GET    | `/api/products`       | lista produktów               |
| GET    | `/api/products/:id`   | jeden produkt                 |
| POST   | `/api/orders`         | złożenie zamówienia (JSON)    |

Ceny zamówienia liczone są **po stronie serwera** na podstawie `products.json`
(klient nie może podać własnej ceny).

---

## Domena zamiast portu (opcjonalnie, na przyszłość)

Jeśli kiedyś zechcesz `sklep.twojadomena.pl` zamiast `:8080` — zobacz
`deploy/nginx-vibe.conf.example` (reverse proxy + certbot dla HTTPS).

## Uwaga o płatnościach

To wersja sklepu bez bramki płatniczej (zamówienie jest zapisywane, płatność nie jest
pobierana). Integrację np. ze **Stripe** lub **Przelewy24** można dodać w endpoint
`POST /api/orders`.
