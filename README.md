# Vibe — sklep z bluzami i koszulkami

Lekki sklep internetowy w **czystym Node.js** (zero zależności — nie trzeba `npm install`).
Katalog produktów, modal produktu z wyborem rozmiaru/koloru, koszyk (localStorage)
i składanie zamówień z walidacją po stronie serwera.

> **Adres produkcyjny:** `https://vibeleszno.com` (HTTPS). Aplikacja Node działa wewnętrznie
> na porcie **8080**; domena i HTTPS obsługiwane przed nią. Wersje językowe: `?lang=en`, `?lang=de`.

---

## Stos

- **Backend:** Node.js (wbudowany moduł `http`, bez frameworków)
- **Frontend:** statyczny HTML/CSS/JS (vanilla), obrazki produktów generowane jako SVG
- **Dane:** SQLite (`node:sqlite`, plik `data/vibe.db`) — produkty, konta, zamówienia, opinie, kody.
  `data/products.json` służy tylko jako zasiew przy pierwszym uruchomieniu.
- **Wielojęzyczność:** PL/EN/DE (`public/js/i18n.js` + SEO per język w `server.js`)
- **Wdrożenie:** `git` + `systemd` na porcie 8080, domena `vibeleszno.com` (HTTPS) z przodu

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

Konfiguracja oparta o zmienną **`SITE_URL`** (musi być domeną produkcyjną `https://vibeleszno.com`,
nie IP:port) — z niej budowane są wszystkie adresy w canonical, hreflang, Open Graph, sitemap i JSON-LD.

**Indeksowanie i adresy**
- HTTPS + przekierowanie `http → https` (301).
- `/robots.txt` (z odnośnikiem do sitemap) oraz `/sitemap.xml` z `lastmod`, `changefreq`, `priority`
  i alternatywami `hreflang` dla każdej strony (strona główna + wszystkie produkty + podstrony).
- `canonical` na każdej stronie (self-referential, świadomy języka).
- Osobne strony produktów z czystym URL: `/produkt/<id>`. Katalog renderowany po stronie serwera
  (linki do produktów widoczne dla robotów bez JS).

**Meta i Open Graph**
- Unikalny `<title>` i `meta description` na każdej stronie; `meta robots` (`index, follow`;
  panele klienta/admina = `noindex`).
- Open Graph + Twitter Card (obrazek rastrowy `/img/logo.jpg`), `og:locale` zależne od języka.

**Wielojęzyczność (PL / EN / DE)** — patrz `public/js/i18n.js`
- Osobne, indeksowalne adresy: PL bez parametru, `?lang=en`, `?lang=de`.
- Serwer wstrzykuje per-język: `<html lang>`, przetłumaczony `<title>`/`<meta description>`/`og:*`,
  `canonical` na wersję językową oraz `hreflang` (`pl`/`en`/`de`/`x-default`).
- Przełącznik języka w nagłówku nawiguje do adresu z `?lang=` (adres do udostępnienia/indeksacji).
- Treść tłumaczona po polskim tekście źródłowym (słownik w `i18n.js`); UI + treść (produkty, FAQ,
  „o marce", podstrony, regulamin, polityka) mają komplet EN i DE. Dynamiczne fragmenty
  (koszyk, checkout, siatka) tłumaczone po renderze.

**Dane strukturalne (JSON-LD)**
- Strona główna: `Store` (z adresem, godzinami otwarcia, `areaServed` = Leszno — lokalne SEO),
  `ItemList` produktów (każdy z `Brand`, `Offer`, `availability`, `sku`) oraz `FAQPage`.
- Strona produktu: `Product` + `Offer` + `BreadcrumbList`; `AggregateRating` dodawane **tylko**
  gdy są prawdziwe opinie (zgodnie z wytycznymi Google).

**Treść i UX dla SEO**
- Jeden `H1` na stronę, semantyczne nagłówki; sekcja treści „o marce" + FAQ na stronie głównej.
- `viewport` mobilny, `loading="lazy"` na zdjęciach, `preconnect` do Google Fonts.
- Opinie klientów (1–5 + komentarz) — tylko dla zalogowanego klienta, który kupił produkt.

**Audyt — znane luki / TODO**
- Tytuł/opis w `<head>` **stron produktów** w EN/DE pozostaje po polsku (nazwa jest dynamiczna
  z bazy; widoczny H1 i tak tłumaczy klient). Pełne tłumaczenie tytułów = przeniesienie słownika
  na serwer.
- Treść `body` wersji EN/DE jest renderowana po stronie klienta (Googlebot renderuje JS) — to nie
  pełny SSR. Wystarczające dla większości przypadków; pełny SSR = większy refactor.
- `og:image` to logo, nie dedykowany baner 1200×630 do social media.
- `sameAs` w JSON-LD (Instagram/TikTok/Facebook) to **placeholdery** — podmień na prawdziwe profile
  lub usuń.
- **Nowe/edytowane produkty** dodane w panelu nie są automatycznie tłumaczone (słownik EN/DE jest
  na sztywno w `i18n.js`) — docelowo: wielojęzyczne pola produktu w bazie + panel.
- Warto podpiąć **Google Search Console** (zgłosić `sitemap.xml`) i analitykę.

## Konta, panele i baza danych

- **Baza:** SQLite (wbudowany `node:sqlite`) — plik `data/vibe.db`. Wymaga **Node ≥ 22**
  uruchomionego z flagą `--experimental-sqlite` (skrypt instalacyjny ustawia to sam).
- **Rejestracja/logowanie:** klienci rejestrują się e-mailem (`/rejestracja`, `/logowanie`).
- **Panel klienta** (`/konto`): edycja danych (imię, e-mail), **zmiana hasła**, historia zamówień
  (zamówienia wiążą się z kontem). Admin może **zresetować hasło** klienta z panelu.
- **Strony prawne (RODO):** `/regulamin` i `/polityka-prywatnosci` (wzorce do uzupełnienia danymi firmy)
  oraz **baner zgody na cookies** wyświetlany na każdej stronie do akceptacji.
- **Panel admina** (`/admin`) z bocznym menu jak w prawdziwym sklepie:
  - **Pulpit** — KPI (obrót, zamówienia, nowe, klienci), wykres sprzedaży 7 dni, ostatnie
    zamówienia, alerty niskich stanów, **bestsellery** (najczęściej kupowane).
  - **Zamówienia** — filtr po statusie + wyszukiwarka, zmiana statusu, dane klienta,
    **eksport do CSV** oraz **eksport kurierski** (CSV z ustrukturyzowanym adresem:
    ulica, kod pocztowy, miasto, kwota pobrania, uwagi — do importu w InPost/DPD/DHL;
    respektuje aktywny filtr statusu). Adres zamówienia jest zbierany w kasie w polach
    ulica/kod/miasto, więc nadaje się do importu kurierskiego.
  - **Produkty** — dodawanie / edycja / usuwanie, stany magazynowe.
  - **Klienci** — lista z liczbą zamówień i wydaną kwotą, wyszukiwarka, **zmiana roli
    (klient↔admin) i usuwanie konta** (z zabezpieczeniami: nie można usunąć siebie ani
    ostatniego admina).
  - **Wiadomości** — zgłoszenia z formularza kontaktowego, z możliwością usuwania.
  - **Opinie** — moderacja: podgląd i usuwanie opinii klientów.
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
- **Warianty z osobnym stanem:** opcjonalnie magazyn liczony per kombinacja rozmiar/kolor
  (edytor siatki w panelu admina). Dostępność i blokada zakupu działają per wariant.
- **Lista życzeń** (♥, localStorage) + strona `/ulubione`; dedykowana strona koszyka `/koszyk`.
- **Backup bazy:** przycisk w panelu (pobranie `vibe.db`) oraz skrypt `deploy/backup.sh` do crona.
- **Wyszukiwarka + sortowanie** na stronie głównej (po nazwie; sort: polecane / cena / nazwa),
  obok filtrów kategorii.

### Bezpieczeństwo

- Hasła hashowane `scrypt` z losową solą (wbudowany `crypto`), porównanie w czasie stałym.
- Wszystkie zapytania **parametryzowane** (prepared statements) — brak SQL injection.
- Sesje: token kryptograficznie losowy, cookie `HttpOnly` + `SameSite=Strict` + **`Secure` na HTTPS**
  (rozpoznawane po `X-Forwarded-Proto` od nginx; na bezpośrednim `http://IP:8080` bez `Secure`).
- **Nagłówki bezpieczeństwa:** `Content-Security-Policy` (`default-src 'self'`, `script-src` bez
  `'unsafe-inline'` — realna ochrona przed XSS; dozwolone tylko Google Fonts + InPost Geowidget),
  `Strict-Transport-Security` (HSTS), `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy` (kamera/mikrofon off, geolokalizacja tylko dla mapy paczkomatów).
- **CSRF:** żądania zmieniające stan (`POST`/`PUT`/`DELETE` pod `/api/`) wymagają zgodnego `Origin`
  (uzupełnienie `SameSite=Strict`).
- **Path traversal:** statyka serwowana wyłącznie z `public/`; pliki API z nagłówkiem `Cache-Control: no-store`.
- **Brute-force / spam:** limit prób logowania na IP oraz limity rejestracji (10/h) i formularza
  kontaktowego (6/10 min). Open redirect przy `?next=` zablokowany (tylko ścieżki względne).
- Plik `vibe.db` poza `public/` (niedostępny przez WWW), prawa `600`, w `.gitignore`.
- Endpointy admina chronione kontrolą roli po stronie serwera; API nie zwraca hashy haseł.
- **Zamówienie może złożyć tylko zalogowany użytkownik** (`POST /api/orders` → 401 bez sesji).
- **Zmień domyślne hasło admina** ustawiając `ADMIN_PASSWORD` (i osobne, mocne hasło SMTP).

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

| Metoda | Endpoint              | Opis                                       |
|--------|-----------------------|--------------------------------------------|
| GET    | `/api/health`         | status serwera                             |
| GET    | `/api/products`       | lista produktów                            |
| GET    | `/api/products/:id`   | jeden produkt                              |
| POST   | `/api/orders`         | złożenie zamówienia (JSON) — **wymaga logowania** |

Ceny zamówienia liczone są **po stronie serwera** na podstawie bazy
(klient nie może podać własnej ceny).

**Walidacja adresu (kurier):** dane muszą być realne, nie losowe — kod pocztowy jest
weryfikowany w **prawdziwej bazie pocztowej** (Zippopotam PL, darmowe API bez klucza):
odrzucane są nieistniejące kody oraz niezgodność kod ↔ miasto. Dodatkowo: ulica musi mieć
nazwę i numer, miasto same litery, telefon 9 cyfr. Gdy baza pocztowa jest chwilowo niedostępna,
walidacja działa **fail-open** (sprawdza sam format), żeby awaria API nie blokowała sprzedaży.

---

## Domena zamiast portu (opcjonalnie, na przyszłość)

Jeśli kiedyś zechcesz `sklep.twojadomena.pl` zamiast `:8080` — zobacz
`deploy/nginx-vibe.conf.example` (reverse proxy + certbot dla HTTPS).

## Płatności

**Płatność online przez Przelewy24** (gdy ustawione zmienne `P24_*`, p. niżej). Po złożeniu
zamówienia serwer rejestruje transakcję w P24 (`POST /transaction/register`), klient jest
przekierowywany na bramkę (BLIK / karta / szybki przelew), a po wpłacie P24 woła webhook
`POST /api/p24/notify` — serwer weryfikuje podpis CRC, potwierdza transakcję (`PUT /transaction/verify`),
ustawia status zamówienia na **`opłacone`** i dopiero wtedy wysyła maile (klient + sklep).
Klient wraca na `/?zamowienie=<ID>&t=<token>`, gdzie front odpytuje `GET /api/p24/status`.

Konfiguracja (sekrety — **nie trafiają do repo**, ustaw przez systemd, p. niżej):

| Zmienna | Znaczenie |
|---|---|
| `P24_MERCHANT_ID` | ID sprzedawcy (liczba) |
| `P24_POS_ID` | ID sklepu/POS (domyślnie = merchant ID) |
| `P24_CRC` | klucz CRC z panelu P24 |
| `P24_API_KEY` | klucz do API (hasło Basic Auth REST) |
| `P24_SANDBOX` | `true` = sandbox, `false` = produkcja (domyślnie `true`) |

Logika integracji jest w `lib/p24.js` (czysty Node, zero zależności). **Gdy brak kompletu zmiennych
`P24_*`, moduł leży bezczynnie i sklep wraca do modelu przelewu tradycyjnego**: klient widzi
**instrukcję przelewu do skopiowania** (odbiorca, nr konta, tytuł = numer zamówienia, kwota) i dostaje
ją mailem. Dane przelewu: env `PAY_ACCOUNT` / `PAY_RECIPIENT` / `PAY_BANK` lub stała `PAYMENT` w `server.js`.

Powiadomienie o nowym zamówieniu trafia na stały zestaw adresów biznesowych:
`kontakt@vibeleszno.com` + `vip@vipnieruchomosci.eu` (rozszerzalne przez `ORDER_NOTIFY_TO`),
a klient dostaje osobne potwierdzenie na swój e-mail.

### Klucze P24 na serwerze (drop-in systemd)

Sekrety wgrywamy poza repo, jako nakładkę na usługę:

```bash
mkdir -p /etc/systemd/system/vibe-sklep.service.d
cat > /etc/systemd/system/vibe-sklep.service.d/p24.conf <<'EOF'
[Service]
Environment=P24_MERCHANT_ID=402226
Environment=P24_POS_ID=402226
Environment=P24_CRC=...
Environment=P24_API_KEY=...
Environment=P24_SANDBOX=false
EOF
systemctl daemon-reload && systemctl restart vibe-sklep
```

> **Dostawa:** wybór **Kurier / Paczkomat** w kasie (przy paczkomacie wymagany kod), koszt 25 zł
> (ustawienie `Koszt dostawy` w panelu / `shipping_cost` w bazie).
