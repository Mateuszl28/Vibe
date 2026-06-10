'use strict';
/* Lekki i18n dla Vibe — tlumaczy UI po polskim tekscie zrodlowym (bez tagowania).
   Produkty, regulamin, polityka i FAQ pozostaja po polsku. */
(function () {
  const LANGS = ['pl', 'en', 'de'];

  // Mapy: polski tekst zrodlowy -> tlumaczenie. PL = oryginal (przywracany z cache).
  const EN = {
    // Naglowek / nawigacja
    'Wszystko': 'All', 'Bluzy': 'Hoodies', 'Koszulki': 'T-shirts', 'Eventy': 'Events',
    '🎟️ Kup bilet': '🎟️ Buy ticket', 'Konto': 'Account', 'Sklep': 'Shop',
    '← Wróć do sklepu': '← Back to shop', '← Sklep': '← Shop', 'Kolekcja': 'Collection', 'Wyloguj': 'Log out',
    // Hero
    'Nowa kolekcja — 2026': 'New collection — 2026',
    'Noś swój': 'Wear your',
    'Bluzy i koszulki szyte z myślą o detalu. Naturalne tkaniny, spokojne kroje, trwałość na lata.':
      'Hoodies and t-shirts crafted with attention to detail. Natural fabrics, calm cuts, built to last.',
    'Zobacz kolekcję': 'Shop the collection',
    'wysyłka': 'shipping', 'bawełna': 'cotton', 'na zwrot': 'returns', '14 dni': '14 days',
    // Marquee
    'Premium bawełna 100%': 'Premium 100% cotton', '14 dni na zwrot': '14-day returns',
    'Wysyłka 24h': '24h shipping', 'Noś swój vibe': 'Wear your vibe',
    // Pasek zaufania
    'szybka realizacja zamówień': 'fast order processing',
    'bez podawania przyczyny': 'no reason needed',
    'Premium jakość': 'Premium quality', 'naturalna bawełna 100%': '100% natural cotton',
    'Bezpieczne płatności': 'Secure payments', 'szyfrowane transakcje': 'encrypted transactions',
    // Sklep
    'Cała kolekcja': 'Full collection', 'Wszystkie bluzy i koszulki Vibe': 'All Vibe hoodies and t-shirts',
    'Szukaj produktów…': 'Search products…',
    'Polecane': 'Featured', 'Cena: od najniższej': 'Price: low to high',
    'Cena: od najwyższej': 'Price: high to low', 'Nazwa: A–Z': 'Name: A–Z',
    // Newsletter
    'Dołącz do klubu Vibe': 'Join the Vibe club',
    '-10% na pierwsze zamówienie i wczesny dostęp do dropów.': '-10% on your first order and early access to drops.',
    'Twój e-mail': 'Your e-mail', 'Zapisz mnie': 'Sign me up',
    // Stopka
    'Pomoc': 'Help', 'Informacje': 'Information',
    'Dostawa i zwroty': 'Shipping & returns', 'Tabela rozmiarów': 'Size guide', 'Kontakt': 'Contact',
    'Regulamin': 'Terms', 'Polityka prywatności': 'Privacy policy',
    'pn–pt 9:00–17:00': 'Mon–Fri 9:00–17:00',
    // Koszyk
    'Twój koszyk': 'Your cart', 'Razem': 'Total', 'Przejdź do zamówienia': 'Checkout',
    'Usuń': 'Remove', 'Produkty': 'Products', 'Dostawa': 'Shipping', 'gratis 🎉': 'free 🎉',
    'Twój koszyk jest pusty. Przejdź do sklepu →': 'Your cart is empty. Go to the shop →',
    'Koszyk jest pusty.': 'Your cart is empty.', 'Dodaj coś z kolekcji 👕': 'Add something from the collection 👕',
    'Podsumowanie': 'Summary', 'Kod rabatowy podasz w następnym kroku.': 'You can enter a discount code in the next step.',
    // Checkout
    'Dane do zamówienia': 'Order details', 'Imię i nazwisko': 'Full name', 'Telefon': 'Phone',
    'Ulica i numer': 'Street and number', 'Kod pocztowy': 'Postal code', 'Miasto': 'City',
    'Kod paczkomatu': 'Parcel locker code',
    'Podaj kod paczkomatu InPost, do którego mamy wysłać przesyłkę.': 'Enter the InPost parcel locker code we should ship to.',
    'Kod rabatowy': 'Discount code', 'Zastosuj': 'Apply', 'Zamawiam': 'Place order',
    'Płatność: przelew tradycyjny. Dane do przelewu (z numerem zamówienia w tytule) pokażemy zaraz po złożeniu zamówienia i wyślemy na e-mail.':
      'Payment: bank transfer. We will show the transfer details (with the order number in the title) right after you place the order and send them by e-mail.',
    'Dostawa (Kurier)': 'Shipping (Courier)', 'Dostawa (Paczkomat)': 'Shipping (Parcel locker)',
    'Przetwarzanie…': 'Processing…',
    // Sukces + przelew
    'Dziękujemy za zamówienie!': 'Thank you for your order!', 'Numer zamówienia:': 'Order number:',
    'Dokończ zakup — opłać przelewem': 'Complete your purchase — pay by bank transfer',
    'Wykonaj zwykły przelew na poniższe dane. W tytule koniecznie podaj numer zamówienia. Zamówienie realizujemy po zaksięgowaniu wpłaty.':
      'Make a standard bank transfer using the details below. Be sure to include the order number in the title. We process the order once the payment is received.',
    'Odbiorca': 'Recipient', 'Tytuł przelewu': 'Transfer title', 'Kwota': 'Amount',
    'Kopiuj': 'Copy', 'Kopiuj wszystkie dane': 'Copy all details', 'Skopiowano ✓': 'Copied ✓',
    'Potwierdzenie wraz z danymi do przelewu wyślemy też na podany e-mail.': 'We will also send the confirmation and transfer details to your e-mail.',
    'Wróć do sklepu': 'Back to shop',
    // Toasty
    'Dodano do koszyka': 'Added to cart', 'Koszyk jest pusty': 'Your cart is empty',
    'Usunięto z koszyka': 'Removed from cart', 'Wybierz rozmiar i kolor': 'Choose size and colour',
    'Zapisano! Sprawdź skrzynkę.': 'Done! Check your inbox.'
  };

  const DE = {
    'Wszystko': 'Alle', 'Bluzy': 'Hoodies', 'Koszulki': 'T-Shirts', 'Eventy': 'Events',
    '🎟️ Kup bilet': '🎟️ Ticket kaufen', 'Konto': 'Konto', 'Sklep': 'Shop',
    '← Wróć do sklepu': '← Zurück zum Shop', '← Sklep': '← Shop', 'Kolekcja': 'Kollektion', 'Wyloguj': 'Abmelden',
    'Nowa kolekcja — 2026': 'Neue Kollektion — 2026',
    'Noś swój': 'Trag deinen',
    'Bluzy i koszulki szyte z myślą o detalu. Naturalne tkaniny, spokojne kroje, trwałość na lata.':
      'Hoodies und T-Shirts mit Liebe zum Detail. Natürliche Stoffe, ruhige Schnitte, langlebig.',
    'Zobacz kolekcję': 'Zur Kollektion',
    'wysyłka': 'Versand', 'bawełna': 'Baumwolle', 'na zwrot': 'Rückgabe', '14 dni': '14 Tage',
    'Premium bawełna 100%': 'Premium 100% Baumwolle', '14 dni na zwrot': '14 Tage Rückgabe',
    'Wysyłka 24h': 'Versand 24h', 'Noś swój vibe': 'Trag deinen Vibe',
    'szybka realizacja zamówień': 'schnelle Auftragsabwicklung',
    'bez podawania przyczyny': 'ohne Angabe von Gründen',
    'Premium jakość': 'Premium-Qualität', 'naturalna bawełna 100%': '100% Naturbaumwolle',
    'Bezpieczne płatności': 'Sichere Zahlungen', 'szyfrowane transakcje': 'verschlüsselte Transaktionen',
    'Cała kolekcja': 'Ganze Kollektion', 'Wszystkie bluzy i koszulki Vibe': 'Alle Vibe Hoodies und T-Shirts',
    'Szukaj produktów…': 'Produkte suchen…',
    'Polecane': 'Empfohlen', 'Cena: od najniższej': 'Preis: aufsteigend',
    'Cena: od najwyższej': 'Preis: absteigend', 'Nazwa: A–Z': 'Name: A–Z',
    'Dołącz do klubu Vibe': 'Tritt dem Vibe-Club bei',
    '-10% na pierwsze zamówienie i wczesny dostęp do dropów.': '-10% auf die erste Bestellung und früher Zugang zu Drops.',
    'Twój e-mail': 'Deine E-Mail', 'Zapisz mnie': 'Anmelden',
    'Pomoc': 'Hilfe', 'Informacje': 'Informationen',
    'Dostawa i zwroty': 'Versand & Rückgabe', 'Tabela rozmiarów': 'Größentabelle', 'Kontakt': 'Kontakt',
    'Regulamin': 'AGB', 'Polityka prywatności': 'Datenschutz',
    'pn–pt 9:00–17:00': 'Mo–Fr 9:00–17:00',
    'Twój koszyk': 'Dein Warenkorb', 'Razem': 'Gesamt', 'Przejdź do zamówienia': 'Zur Kasse',
    'Usuń': 'Entfernen', 'Produkty': 'Produkte', 'Dostawa': 'Versand', 'gratis 🎉': 'gratis 🎉',
    'Twój koszyk jest pusty. Przejdź do sklepu →': 'Dein Warenkorb ist leer. Zum Shop →',
    'Koszyk jest pusty.': 'Dein Warenkorb ist leer.', 'Dodaj coś z kolekcji 👕': 'Füge etwas aus der Kollektion hinzu 👕',
    'Podsumowanie': 'Zusammenfassung', 'Kod rabatowy podasz w następnym kroku.': 'Einen Rabattcode kannst du im nächsten Schritt eingeben.',
    'Dane do zamówienia': 'Bestelldaten', 'Imię i nazwisko': 'Vor- und Nachname', 'Telefon': 'Telefon',
    'Ulica i numer': 'Straße und Hausnummer', 'Kod pocztowy': 'Postleitzahl', 'Miasto': 'Stadt',
    'Kod paczkomatu': 'Paketstation-Code',
    'Podaj kod paczkomatu InPost, do którego mamy wysłać przesyłkę.': 'Gib den InPost-Paketstation-Code an, an den wir versenden sollen.',
    'Kod rabatowy': 'Rabattcode', 'Zastosuj': 'Anwenden', 'Zamawiam': 'Bestellen',
    'Płatność: przelew tradycyjny. Dane do przelewu (z numerem zamówienia w tytule) pokażemy zaraz po złożeniu zamówienia i wyślemy na e-mail.':
      'Zahlung: Banküberweisung. Die Überweisungsdaten (mit der Bestellnummer im Betreff) zeigen wir direkt nach der Bestellung und senden sie per E-Mail.',
    'Dostawa (Kurier)': 'Versand (Kurier)', 'Dostawa (Paczkomat)': 'Versand (Paketstation)',
    'Przetwarzanie…': 'Wird verarbeitet…',
    'Dziękujemy za zamówienie!': 'Danke für deine Bestellung!', 'Numer zamówienia:': 'Bestellnummer:',
    'Dokończ zakup — opłać przelewem': 'Schließe den Kauf ab — per Überweisung zahlen',
    'Wykonaj zwykły przelew na poniższe dane. W tytule koniecznie podaj numer zamówienia. Zamówienie realizujemy po zaksięgowaniu wpłaty.':
      'Überweise auf die folgenden Daten. Gib unbedingt die Bestellnummer im Betreff an. Wir bearbeiten die Bestellung nach Zahlungseingang.',
    'Odbiorca': 'Empfänger', 'Tytuł przelewu': 'Verwendungszweck', 'Kwota': 'Betrag',
    'Kopiuj': 'Kopieren', 'Kopiuj wszystkie dane': 'Alle Daten kopieren', 'Skopiowano ✓': 'Kopiert ✓',
    'Potwierdzenie wraz z danymi do przelewu wyślemy też na podany e-mail.': 'Die Bestätigung und die Überweisungsdaten senden wir auch an deine E-Mail.',
    'Wróć do sklepu': 'Zurück zum Shop',
    'Dodano do koszyka': 'Zum Warenkorb hinzugefügt', 'Koszyk jest pusty': 'Dein Warenkorb ist leer',
    'Usunięto z koszyka': 'Aus dem Warenkorb entfernt', 'Wybierz rozmiar i kolor': 'Größe und Farbe wählen',
    'Zapisano! Sprawdź skrzynkę.': 'Erledigt! Prüfe dein Postfach.'
  };

  // ===== Tlumaczenia TRESCI na angielski (produkty, podstrony, FAQ, prawne) =====
  const CONTENT_EN = {
    // Produkty — nazwy
    'Bluza Vibe Classic': 'Vibe Classic Hoodie', 'Bluza Vibe Oversize': 'Vibe Oversize Hoodie',
    'Bluza z kapturem Night': 'Night Hoodie', 'Bluza Sport': 'Sport Hoodie',
    'Koszulka Vibe Logo': 'Vibe Logo T-shirt', 'Koszulka Minimal': 'Minimal T-shirt',
    'Koszulka Street': 'Street T-shirt', 'Koszulka Oversize Tee': 'Oversize Tee',
    // Produkty — opisy
    'Klasyczna bluza z kapturem, gruby bawelniany dres 320g/m2. Wygodny krój regular, podwojny kaptur i kieszen kangurka.':
      'A classic hoodie in heavy 320 g/m² cotton fleece. Comfortable regular fit, double-layer hood and a kangaroo pocket.',
    'Luzny krój oversize, opuszczona linia ramion. Miekki, drapany w srodku material. Modny streetwearowy look.':
      'Relaxed oversize fit with dropped shoulders. Soft, brushed inside. A trendy streetwear look.',
    'Premium bluza z neonowym haftem. Ciezki material premium, sciagacze z domieszka elastanu.':
      'Premium hoodie with neon embroidery. Heavy premium fabric, ribbing with a touch of elastane.',
    'Lekka bluza treningowa, oddychajacy material odprowadzajacy wilgoc. Idealna na trening i na co dzien.':
      'A lightweight training sweatshirt in breathable, moisture-wicking fabric. Perfect for workouts and everyday wear.',
    'Bawelniana koszulka 100% z nadrukiem logo Vibe. Gramatura 180g/m2, krój regular.':
      '100% cotton t-shirt with a Vibe logo print. 180 g/m² weight, regular fit.',
    'Minimalistyczna koszulka basic bez nadruku. Najwyzszej jakosci bawelna czesana.':
      'A minimalist basic t-shirt with no print. Top-quality combed cotton.',
    'Streetwearowa koszulka z grafika na plecach. Lekko oversizowy krój, gruba bawelna.':
      'A streetwear t-shirt with a back graphic. Slightly oversize fit, thick cotton.',
    'Koszulka oversize z grubej bawelny 220g/m2. Opadajace ramie, dluzszy tyl.':
      'An oversize t-shirt in thick 220 g/m² cotton. Dropped shoulders, longer back.',
    // Sekcja "o marce" (strona glowna)
    'Streetwear, który nosisz na co dzień': 'Streetwear you wear every day',
    'Vibe to polska marka odzieżowa z Leszna, która tworzy bluzy z kapturem i koszulki z myślą o trwałości oraz wygodzie. Stawiamy na naturalną, gęstą bawełnę, spokojne kroje i staranne wykończenie — bo dobrze uszyta rzecz służy latami, a nie jeden sezon. Szukasz ubrań, które łączą minimalistyczny styl z jakością premium? Trafiłeś idealnie!':
      'Vibe is a Polish clothing brand from Leszno that makes hoodies and t-shirts built for durability and comfort. We rely on natural, dense cotton, calm cuts and careful finishing — because a well-made piece lasts for years, not one season. Looking for clothes that combine minimalist style with premium quality? You\'ve come to the right place!',
    'Dlaczego warto wybrać Vibe?': 'Why choose Vibe?',
    'Każdy model projektujemy i kompletujemy sami, dbając o detal: mocne szwy, miękki materiał i kolory, które nie blakną po praniu. Nasze bluzy mają regularny krój i podwójny kaptur, a koszulki — przyjemną, oddychającą bawełnę 100%. Chcesz mieć pewność co do rozmiaru? Zajrzyj do tabeli rozmiarów, a jeśli coś nie zagra, masz 14 dni na zwrot bez podawania przyczyny!':
      'We design and assemble every model ourselves, caring about the details: strong seams, soft fabric and colours that don\'t fade in the wash. Our hoodies have a regular fit and a double hood, and the t-shirts use pleasant, breathable 100% cotton. Want to be sure about the size? Check the size guide, and if something doesn\'t fit, you have 14 days to return it with no reason needed!',
    'Szybka wysyłka i pomoc, gdy jej potrzebujesz': 'Fast shipping and help when you need it',
    'Zamówienia złożone do 13:00 w dni robocze pakujemy i wysyłamy tego samego dnia — kurierem lub do paczkomatu. Masz pytanie o produkt, dostawę albo zwrot? Napisz do nas przez formularz kontaktowy lub zadzwoń, a pomożemy szybko i konkretnie. Noś swój vibe — wygodnie, stylowo i na lata!':
      'Orders placed before 1:00 p.m. on business days are packed and shipped the same day — by courier or to a parcel locker. Got a question about a product, delivery or a return? Write to us via the contact form or call — we\'ll help quickly and clearly. Wear your vibe — comfortably, stylishly and for years!',
    // FAQ
    'Najczęściej zadawane pytania': 'Frequently asked questions',
    'Jak dobrać rozmiar bluzy lub koszulki Vibe?': 'How do I choose the size of a Vibe hoodie or t-shirt?',
    'W każdej karcie produktu znajdziesz dostępne rozmiary od S do XXL. Dokładne wymiary w centymetrach (obwód klatki, długość) zebraliśmy w':
      'On every product page you\'ll find the available sizes from S to XXL. We\'ve gathered the exact measurements in centimetres (chest, length) in the',
    'tabeli rozmiarów': 'size guide',
    '. Jeśli wahasz się między dwoma rozmiarami, przy oversize wybierz mniejszy, a przy klasycznym kroju — większy.':
      '. If you\'re hesitating between two sizes, go smaller for oversize and larger for a classic fit.',
    'Ile kosztuje i jak długo trwa dostawa?': 'How much does delivery cost and how long does it take?',
    'Zamówienia złożone do 13:00 w dni robocze wysyłamy tego samego dnia — kurierem lub do paczkomatu. Czas doręczenia to zwykle 1–2 dni robocze. Szczegóły i koszty znajdziesz na stronie':
      'Orders placed before 1:00 p.m. on business days ship the same day — by courier or to a parcel locker. Delivery usually takes 1–2 business days. Details and costs are on the',
    'Czy mogę zwrócić lub wymienić zamówiony produkt?': 'Can I return or exchange an ordered product?',
    'Tak. Masz 14 dni na zwrot bez podawania przyczyny. Wystarczy, że produkt jest nieużywany i z metką. Zasady zwrotów i wymiany opisaliśmy w sekcji':
      'Yes. You have 14 days to return it with no reason needed. The product just needs to be unused and with its tag. We describe the return and exchange rules in the',
    'Z jakiego materiału uszyte są ubrania Vibe?': 'What material are Vibe clothes made of?',
    'Stawiamy na naturalną, gęstą bawełnę. Koszulki to 100% oddychającej bawełny, a bluzy mają mocny, miękki materiał z podwójnym kapturem. Kolory nie blakną po praniu, a szwy są wzmocnione.':
      'We rely on natural, dense cotton. The t-shirts are 100% breathable cotton, and the hoodies use a strong, soft fabric with a double hood. The colours don\'t fade in the wash and the seams are reinforced.',
    'Czy Vibe to sklep z Leszna?': 'Is Vibe a shop from Leszno?',
    'Tak, Vibe to polska marka odzieżowa z okolic Leszna (Wilkowice, ul. Pszenna 30). Wysyłamy zamówienia w całej Polsce, a klientów z Leszna i okolic obsługujemy szczególnie szybko.':
      'Yes, Vibe is a Polish clothing brand from near Leszno (Wilkowice, ul. Pszenna 30). We ship across Poland, and we serve customers from Leszno and the surrounding area especially fast.',
    'Jak skontaktować się ze sklepem?': 'How can I contact the shop?',
    'Napisz na kontakt@vibeleszno.com, zadzwoń pod +48 665 799 919 (pn–pt 9:00–17:00) lub skorzystaj z formularza na stronie':
      'Write to kontakt@vibeleszno.com, call +48 665 799 919 (Mon–Fri 9:00–17:00) or use the form on the',
    // Okruszki / naglowki podstron
    'Strona główna': 'Home', '/ Pomoc / Kontakt': '/ Help / Contact',
    '/ Pomoc / Dostawa i zwroty': '/ Help / Shipping & returns', '/ Pomoc / Tabela rozmiarów': '/ Help / Size guide',
    '/ Eventy': '/ Events', '/ Regulamin': '/ Terms', '/ Polityka prywatności': '/ Privacy policy',
    // Kontakt
    'Masz pytanie o zamówienie, rozmiar lub zwrot? Napisz — odpowiadamy zwykle w ciągu 24h.':
      'Got a question about an order, size or return? Write to us — we usually reply within 24h.',
    'Telefon': 'Phone', 'Godziny': 'Opening hours', 'Adres': 'Address', 'Zwroty': 'Returns',
    'poniedziałek–piątek, 9:00–17:00': 'Monday–Friday, 9:00–17:00', 'Zobacz': 'See', 'dostawę i zwroty': 'shipping & returns',
    'Imię': 'First name', 'Wiadomość': 'Message', 'Wyślij wiadomość': 'Send message',
    // Tabela rozmiarow
    'Wymiary podane w centymetrach. W razie wątpliwości wybierz większy rozmiar lub napisz do nas.':
      'Measurements in centimetres. If in doubt, choose the larger size or write to us.',
    'Rozmiar': 'Size', 'Klatka (cm)': 'Chest (cm)', 'Długość (cm)': 'Length (cm)', 'Rękaw (cm)': 'Sleeve (cm)',
    'Szer. ramion (cm)': 'Shoulder width (cm)', 'Jak się zmierzyć?': 'How to measure?',
    'Klatka piersiowa': 'Chest', 'zmierz obwód w najszerszym miejscu, pod pachami.': 'measure the circumference at the widest point, under the arms.',
    'Długość': 'Length', 'od najwyższego punktu ramienia w dół do dołu produktu.': 'from the highest point of the shoulder down to the bottom of the garment.',
    'Rękaw': 'Sleeve', 'od szwu ramienia do końca mankietu.': 'from the shoulder seam to the end of the cuff.',
    'Wymiary mogą się różnić o ±2 cm w zależności od modelu. Modele': 'Measurements may vary by ±2 cm depending on the model. The',
    'mają luźniejszy krój — jeśli wolisz dopasowany look, wybierz rozmiar mniejszy.': 'models have a looser fit — if you prefer a fitted look, choose a smaller size.',
    'Potrzebujesz pomocy z doborem?': 'Need help choosing?', 'Napisz do nas': 'Write to us', '— doradzimy.': '— we\'ll advise you.',
    // Dostawa i zwroty
    'Wszystko, co musisz wiedzieć o wysyłce zamówienia i zwrocie produktów.':
      'Everything you need to know about shipping your order and returning products.',
    'Kurier (DPD/InPost)': 'Courier (DPD/InPost)', 'Paczkomat InPost': 'InPost parcel locker',
    '25 zł · dostawa 1–2 dni robocze': '25 zł · delivery 1–2 business days', 'bez podania przyczyny': 'no reason needed',
    'Realizacja zamówienia': 'Order fulfilment',
    'Zamówienia złożone do godziny 13:00 w dni robocze wysyłamy tego samego dnia. Pozostałe — następnego dnia roboczego. O nadaniu paczki poinformujemy Cię e-mailem wraz z numerem do śledzenia.':
      'Orders placed before 1:00 p.m. on business days ship the same day. The rest — the next business day. We\'ll notify you of the shipment by e-mail with a tracking number.',
    'Koszty i czas dostawy': 'Costs and delivery time',
    'Kurier:': 'Courier:', 'Paczkomat InPost:': 'InPost parcel locker:',
    ', czas 1–2 dni robocze': ', time 1–2 business days',
    'Zwroty — 14 dni bez podania przyczyny': 'Returns — 14 days, no reason needed',
    'na odstąpienie od umowy zawartej na odległość, licząc od dnia otrzymania przesyłki. Nie musisz podawać przyczyny.':
      'to withdraw from the distance contract, counting from the day you receive the parcel. You don\'t need to give a reason.',
    'Masz': 'You have',
    'Możesz sprawdzić produkt tak, jak zrobiłbyś to w sklepie stacjonarnym (przymierzyć). Jeśli jednak korzystałeś z niego ponad to (noszenie, pranie, usunięcie metek), możemy obniżyć kwotę zwrotu o zmniejszenie wartości produktu.':
      'You may inspect the product as you would in a physical shop (try it on). However, if you used it beyond that (wearing, washing, removing tags), we may reduce the refund by the decrease in the product\'s value.',
    'Jak zwrócić produkt:': 'How to return a product:',
    'W ciągu 14 dni od odbioru wyślij oświadczenie o odstąpieniu — e-mailem przez': 'Within 14 days of receipt, send a withdrawal statement — by e-mail via the',
    'formularz kontaktowy': 'contact form', 'lub korzystając ze': 'or using the',
    'wzoru formularza w regulaminie (§7)': 'model form in the Terms (§7)', '. Potwierdzimy jego otrzymanie.': '. We\'ll confirm receipt.',
    'Odeślij produkt w ciągu': 'Send the product back within',
    'od złożenia oświadczenia na adres podany w potwierdzeniu. Bezpośredni koszt odesłania ponosi kupujący.':
      'of submitting the statement, to the address given in the confirmation. The direct cost of return is borne by the buyer.',
    'Zwrócimy wszystkie płatności — łącznie z kosztem dostawy do Ciebie (do wysokości najtańszej oferowanej przez nas opcji) — w ciągu':
      'We\'ll refund all payments — including the cost of delivery to you (up to the cheapest option we offer) — within',
    'od otrzymania oświadczenia, tą samą metodą płatności. Możemy wstrzymać się ze zwrotem do czasu otrzymania produktu lub dowodu jego nadania.':
      'of receiving the statement, using the same payment method. We may withhold the refund until we receive the product or proof of its dispatch.',
    'Prawo odstąpienia nie dotyczy produktów personalizowanych (wykonanych na indywidualne zamówienie) — art. 38 ustawy o prawach konsumenta.':
      'The right of withdrawal does not apply to personalised products (made to individual order) — Article 38 of the Consumer Rights Act.',
    'Reklamacje (niezgodność towaru z umową)': 'Complaints (non-conformity of goods)',
    'Niezależnie od prawa zwrotu, odpowiadamy za zgodność towaru z umową przez': 'Regardless of the right of return, we are liable for the conformity of goods with the contract for',
    'od dostarczenia. Jeśli produkt ma wadę (np. uszkodzenie, błąd wykonania):': 'from delivery. If a product has a defect (e.g. damage, manufacturing error):',
    'Napisz do nas przez': 'Write to us via the',
    ': podaj numer zamówienia, opis problemu i swoje żądanie (naprawa lub wymiana; w dalszej kolejności obniżenie ceny lub odstąpienie od umowy).':
      ': provide the order number, a description of the problem and your request (repair or replacement; subsequently a price reduction or withdrawal from the contract).',
    'Koszt odesłania reklamowanego produktu pokrywamy my.': 'We cover the cost of returning the product under complaint.',
    'Odpowiemy w ciągu': 'We\'ll respond within', '— brak odpowiedzi w tym terminie oznacza uznanie reklamacji.': '— failure to respond within this period means the complaint is accepted.',
    'Wymiana rozmiaru': 'Size exchange',
    'Nie pasuje rozmiar? Zobacz': 'Wrong size? See the', 'tabelę rozmiarów': 'size guide',
    'i napisz do nas — pomożemy dobrać właściwy i wymienić produkt. Wymiana traktowana jest jak zwrot + nowe zamówienie, więc obowiązują te same terminy.':
      'and write to us — we\'ll help pick the right one and exchange the product. An exchange is treated as a return + a new order, so the same deadlines apply.',
    'Pełne zasady, w tym wzór formularza odstąpienia od umowy, znajdziesz w': 'Full rules, including the model withdrawal form, can be found in the',
    'regulaminie sklepu': 'shop Terms',
    // Strona produktu
    'Kolor': 'Colour', 'zobacz zasady': 'see the rules', 'Nie wiesz jaki rozmiar?': 'Not sure about the size?',
    'Opinie klientów': 'Customer reviews', 'Ładowanie opinii…': 'Loading reviews…', 'Może Ci się spodobać': 'You may also like',
    'Dodaj do koszyka': 'Add to cart', 'Wyprzedane': 'Sold out', '✔ Dostępny, wysyłka 24h': '✔ In stock, 24h shipping',
    'Wybrany wariant niedostępny': 'Selected variant unavailable',
    // Eventy
    'Wydarzenia, na których spotkasz markę Vibe. Najbliższy event poniżej — wpadnij i poczuj swój vibe na żywo.':
      'Events where you\'ll meet the Vibe brand. The next event is below — come and feel your vibe live.',
    'Vibe City Festiwal — łączymy pokolenia': 'Vibe City Festival — connecting generations',
    'Muzyka, ludzie i dobra energia w jednym miejscu. Vibe City Festiwal to wydarzenie, które łączy pokolenia — od starszych po najmłodszych fanów dobrej zabawy. Bądź tam z nami!':
      'Music, people and good energy in one place. Vibe City Festival is an event that connects generations — from older to the youngest fans of a good time. Be there with us!',
    'Liczba biletów jest ograniczona — kup swój online, zanim się skończą.': 'Tickets are limited — buy yours online before they sell out.',
    '🎟️ Kup bilet na tobilet.pl': '🎟️ Buy a ticket on tobilet.pl'
  };
  Object.assign(EN, CONTENT_EN);

  // Strony prawne (z tlumaczen blokowych) — dopasowanie po dokladnym tekscie wezla
  const LEGAL_EN = [{"pl":"/ Regulamin","en":"/ Terms & Conditions"},{"pl":"Regulamin sklepu","en":"Shop Terms & Conditions"},{"pl":"Regulamin sklepu internetowego Vibe — obowiązuje od 7 czerwca 2026 r.","en":"Terms and Conditions of the Vibe online shop — in force as of 7 June 2026."},{"pl":"Ostatnia aktualizacja: 7 czerwca 2026 r.","en":"Last updated: 7 June 2026."},{"pl":"§1. Postanowienia ogólne","en":"§1. General provisions"},{"pl":"Sklep internetowy","en":"The online shop"},{"pl":"(dalej: „Sklep”) prowadzony jest przez Pawła Domagałę, prowadzącego działalność gospodarczą pod firmą","en":"(hereinafter: the \"Shop\") is operated by Paweł Domagała, conducting business under the name"},{"pl":", ul. Pszenna 30, 64-115 Wilkowice, NIP: 6972057976 (dalej: „Sprzedawca”).","en":", ul. Pszenna 30, 64-115 Wilkowice, Tax ID (NIP): 6972057976 (hereinafter: the \"Seller\")."},{"pl":"Kontakt ze Sprzedawcą: e-mail: kontakt@vibeleszno.com, formularz na stronie","en":"Contact with the Seller: e-mail: kontakt@vibeleszno.com, the form on the"},{"pl":", adres korespondencyjny jak wyżej.","en":", correspondence address as above."},{"pl":"Regulamin określa zasady zawierania umów sprzedaży na odległość za pośrednictwem Sklepu, zasady świadczenia usług drogą elektroniczną oraz prawa i obowiązki Sprzedawcy i Klientów.","en":"These Terms and Conditions set out the rules for concluding distance sales contracts via the Shop, the rules for providing services by electronic means, and the rights and obligations of the Seller and Customers."},{"pl":"Regulamin jest nieodpłatnie udostępniany na stronie Sklepu w sposób umożliwiający jego pozyskanie, odtwarzanie i utrwalanie (zapis, wydruk).","en":"These Terms and Conditions are made available free of charge on the Shop's website in a manner allowing them to be obtained, reproduced and stored (saving, printing)."},{"pl":"§2. Definicje","en":"§2. Definitions"},{"pl":"— osoba fizyczna dokonująca ze Sprzedawcą czynności prawnej niezwiązanej bezpośrednio z jej działalnością gospodarczą lub zawodową.","en":"— a natural person performing a legal act with the Seller that is not directly related to their business or professional activity."},{"pl":"Przedsiębiorca na prawach konsumenta","en":"Entrepreneur with consumer rights"},{"pl":"— osoba fizyczna zawierająca umowę bezpośrednio związaną z jej działalnością gospodarczą, gdy z treści umowy wynika, że nie posiada ona dla niej charakteru zawodowego. Postanowienia Regulaminu dotyczące Konsumenta stosuje się do niej odpowiednio (w zakresie odstąpienia od umowy oraz niezgodności towaru z umową).","en":"— a natural person concluding a contract directly related to their business activity, where it follows from the content of the contract that it does not have a professional character for them. The provisions of these Terms and Conditions concerning the Consumer apply to them accordingly (with respect to withdrawal from the contract and the non-conformity of goods with the contract)."},{"pl":"Klient","en":"Customer"},{"pl":"— każdy podmiot dokonujący zakupów w Sklepie.","en":"— any entity making purchases in the Shop."},{"pl":"Towar","en":"Goods"},{"pl":"— rzecz ruchoma oferowana w Sklepie (odzież: bluzy, koszulki i in.).","en":"— a movable item offered in the Shop (clothing: hoodies, t-shirts, etc.)."},{"pl":"Umowa zawarta na odległość","en":"Distance contract"},{"pl":"— umowa zawarta bez jednoczesnej fizycznej obecności stron, z wykorzystaniem środków porozumiewania się na odległość.","en":"— a contract concluded without the simultaneous physical presence of the parties, using means of distance communication."},{"pl":"§3. Usługi świadczone drogą elektroniczną","en":"§3. Services provided by electronic means"},{"pl":"Sprzedawca świadczy nieodpłatnie usługi: prowadzenie konta Klienta, formularz zamówienia, lista życzeń, możliwość dodawania opinii o Towarach oraz formularz kontaktowy.","en":"The Seller provides the following services free of charge: maintaining a Customer account, the order form, the wishlist, the ability to add reviews of Goods, and the contact form."},{"pl":"Do korzystania ze Sklepu wymagane są: urządzenie z dostępem do Internetu, aktualna przeglądarka internetowa z obsługą JavaScript i plików cookies oraz aktywny adres e-mail (do złożenia zamówienia i założenia konta).","en":"To use the Shop, the following are required: a device with internet access, an up-to-date web browser with JavaScript and cookies enabled, and an active e-mail address (to place an order and create an account)."},{"pl":"Umowa o prowadzenie konta zawierana jest z chwilą rejestracji, na czas nieoznaczony. Klient może w każdej chwili, bez podania przyczyny i bez opłat, zażądać usunięcia konta — przez panel konta lub wiadomość na adres kontaktowy.","en":"The contract for maintaining an account is concluded at the moment of registration, for an indefinite period. The Customer may at any time, without giving a reason and free of charge, request deletion of the account — via the account panel or a message to the contact address."},{"pl":"Zakazane jest dostarczanie przez Klienta treści o charakterze bezprawnym, w szczególności w opiniach i formularzach.","en":"The Customer is prohibited from providing content of an unlawful nature, in particular in reviews and forms."},{"pl":"Reklamacje dotyczące działania Sklepu (usług elektronicznych) można składać na adres kontaktowy; Sprzedawca odpowiada w terminie 14 dni.","en":"Complaints regarding the operation of the Shop (electronic services) may be submitted to the contact address; the Seller will respond within 14 days."},{"pl":"§4. Składanie zamówień i zawarcie umowy","en":"§4. Placing orders and concluding the contract"},{"pl":"Zamówienia można składać przez stronę Sklepu 24 godziny na dobę, 7 dni w tygodniu. Założenie konta nie jest wymagane do złożenia zamówienia.","en":"Orders may be placed via the Shop's website 24 hours a day, 7 days a week. Creating an account is not required to place an order."},{"pl":"W celu złożenia zamówienia Klient: dodaje Towary do koszyka, wybiera rozmiar i wariant, podaje dane niezbędne do realizacji (imię i nazwisko, adres dostawy, e-mail, telefon) i zatwierdza zamówienie przyciskiem oznaczającym obowiązek zapłaty.","en":"To place an order, the Customer: adds Goods to the cart, selects the size and variant, provides the data necessary for fulfilment (full name, delivery address, e-mail, telephone) and confirms the order using a button indicating the obligation to pay."},{"pl":"Bezpośrednio przed złożeniem zamówienia Klient widzi łączną cenę Towarów wraz z kosztami dostawy.","en":"Immediately before placing the order, the Customer sees the total price of the Goods together with the delivery costs."},{"pl":"Po złożeniu zamówienia Klient otrzymuje potwierdzenie jego przyjęcia.","en":"After placing the order, the Customer receives confirmation of its acceptance."},{"pl":"Umowa sprzedaży zostaje zawarta z chwilą potwierdzenia przyjęcia zamówienia do realizacji przez Sprzedawcę.","en":"The sales contract is concluded at the moment the Seller confirms acceptance of the order for fulfilment."},{"pl":"Utrwalenie i zabezpieczenie treści umowy następuje przez zapis zamówienia w systemie Sklepu oraz przesłanie Klientowi potwierdzenia.","en":"The content of the contract is recorded and secured by saving the order in the Shop's system and by sending the Customer a confirmation."},{"pl":"§5. Ceny i płatności","en":"§5. Prices and payments"},{"pl":"Ceny podane w Sklepie są cenami brutto w złotych polskich (zawierają podatek VAT). Cena wiążąca jest cena z chwili złożenia zamówienia.","en":"The prices given in the Shop are gross prices in Polish zlotys (including VAT). The binding price is the price at the moment of placing the order."},{"pl":"Dostępne metody płatności: [PRZELEW TRADYCYJNY na rachunek Sprzedawcy podany w potwierdzeniu zamówienia / PŁATNOŚĆ ZA POBRANIEM / operator płatności — uzupełnić po wdrożeniu bramki]. Metody płatności prezentowane są przy składaniu zamówienia.","en":"Available payment methods: [STANDARD BANK TRANSFER to the Seller's account given in the order confirmation / CASH ON DELIVERY / payment operator — to be completed after implementation of the gateway]. Payment methods are presented when placing the order."},{"pl":"najniższą cenę tego Towaru z okresu 30 dni przed wprowadzeniem obniżki","en":"the lowest price of those Goods from the period of 30 days before the reduction was introduced"},{"pl":"(zgodnie z art. 4 ust. 2 ustawy o informowaniu o cenach towarów i usług).","en":"(in accordance with Article 4(2) of the Act on Informing About the Prices of Goods and Services)."},{"pl":"§6. Dostawa","en":"§6. Delivery"},{"pl":"oraz prezentowane przy składaniu zamówienia.","en":"and are presented when placing the order."},{"pl":"Sprzedawca zobowiązuje się dostarczyć Towar niezwłocznie, nie później niż w terminie 30 dni od dnia zawarcia umowy, chyba że umowa stanowi inaczej.","en":"The Seller undertakes to deliver the Goods without undue delay, no later than within 30 days from the date of concluding the contract, unless the contract provides otherwise."},{"pl":"Jeżeli Towar został doręczony z widocznym uszkodzeniem przesyłki, zalecane (lecz niewymagane) jest spisanie protokołu szkody z przewoźnikiem — ułatwi to rozpatrzenie reklamacji.","en":"If the Goods were delivered with visible damage to the parcel, it is recommended (but not required) to draw up a damage report with the carrier — this will facilitate the handling of the complaint."},{"pl":"§7. Prawo odstąpienia od umowy (zwroty)","en":"§7. Right of withdrawal from the contract (returns)"},{"pl":"Konsument oraz Przedsiębiorca na prawach konsumenta może odstąpić od umowy zawartej na odległość","en":"A Consumer and an Entrepreneur with consumer rights may withdraw from a distance contract"},{"pl":"bez podania przyczyny w terminie 14 dni","en":"without giving a reason within 14 days"},{"pl":"od dnia objęcia Towaru w posiadanie przez niego lub wskazaną przez niego osobę trzecią inną niż przewoźnik (art. 27 ustawy z dnia 30 maja 2014 r. o prawach konsumenta).","en":"from the day on which the Goods came into the possession of the Consumer or a third party indicated by them, other than the carrier (Article 27 of the Act of 30 May 2014 on Consumer Rights)."},{"pl":"Do zachowania terminu wystarczy wysłanie oświadczenia przed jego upływem — e-mailem na adres kontaktowy lub pisemnie. Można skorzystać ze wzoru formularza zamieszczonego poniżej (nie jest to obowiązkowe).","en":"To meet the deadline, it is sufficient to send the statement before it expires — by e-mail to the contact address or in writing. You may use the model form provided below (this is not obligatory)."},{"pl":"Sprzedawca niezwłocznie potwierdzi otrzymanie oświadczenia o odstąpieniu (e-mailem).","en":"The Seller will promptly confirm receipt of the statement of withdrawal (by e-mail)."},{"pl":"Konsument ma obowiązek zwrócić Towar niezwłocznie, nie później niż w terminie","en":"The Consumer is obliged to return the Goods without undue delay, no later than within"},{"pl":"od dnia, w którym odstąpił od umowy.","en":"from the day on which they withdrew from the contract."},{"pl":"Bezpośrednie koszty zwrotu Towaru ponosi Konsument.","en":"The direct costs of returning the Goods are borne by the Consumer."},{"pl":"Sprzedawca zwraca wszystkie otrzymane płatności, w tym koszty dostarczenia Towaru (z wyjątkiem dodatkowych kosztów wynikających z wybrania sposobu dostawy innego niż najtańszy zwykły oferowany przez Sklep), niezwłocznie,","en":"The Seller refunds all payments received, including the costs of delivering the Goods (except for additional costs resulting from the choice of a delivery method other than the cheapest standard one offered by the Shop), without undue delay,"},{"pl":"nie później niż w terminie 14 dni","en":"no later than within 14 days"},{"pl":"od dnia otrzymania oświadczenia o odstąpieniu — tym samym sposobem zapłaty, jakiego użył Konsument, chyba że Konsument wyraźnie zgodzi się na inny sposób niewiążący się z kosztami.","en":"from the day of receiving the statement of withdrawal — using the same payment method that the Consumer used, unless the Consumer expressly agrees to a different method that does not entail any costs."},{"pl":"Sprzedawca może wstrzymać się ze zwrotem płatności do chwili otrzymania Towaru z powrotem lub dostarczenia dowodu jego odesłania, w zależności od tego, które zdarzenie nastąpi wcześniej.","en":"The Seller may withhold the refund of payments until the Goods are received back or until proof of their return is provided, whichever occurs first."},{"pl":"Wzór formularza odstąpienia od umowy","en":"Model withdrawal form"},{"pl":"(formularz należy wypełnić i odesłać tylko w przypadku chęci odstąpienia od umowy)","en":"(this form should be completed and returned only if you wish to withdraw from the contract)"},{"pl":"§8. Reklamacje — niezgodność Towaru z umową","en":"§8. Complaints — non-conformity of the Goods with the contract"},{"pl":"§9. Opinie o Towarach","en":"§9. Reviews of Goods"},{"pl":"§10. Pozasądowe rozwiązywanie sporów","en":"§10. Out-of-court dispute resolution"},{"pl":"§11. Dane osobowe","en":"§11. Personal data"},{"pl":"§12. Postanowienia końcowe","en":"§12. Final provisions"},{"pl":"Jak przetwarzamy Twoje dane osobowe i jak używamy plików cookie.","en":"How we process your personal data and how we use cookies."},{"pl":"1. Administrator danych","en":"1. Data Controller"},{"pl":"Administratorem danych jest VIP Domagała Nieruchomości Paweł Domagała, ul. Pszenna 30, 64-115 Wilkowice, NIP 6972057976. Kontakt w sprawie danych: kontakt@vibeleszno.com.","en":"The data controller is VIP Domagała Nieruchomości Paweł Domagała, ul. Pszenna 30, 64-115 Wilkowice, VAT ID 6972057976. Contact regarding data: kontakt@vibeleszno.com."},{"pl":"2. Jakie dane zbieramy","en":"2. What Data We Collect"},{"pl":"dane konta: imię i nazwisko, adres e-mail, zaszyfrowane hasło,","en":"account data: first and last name, email address, encrypted password,"},{"pl":"dane zamówienia: dane do wysyłki (ulica, kod pocztowy, miasto), telefon, historia zamówień,","en":"order data: shipping details (street, postal code, city), phone number, order history,"},{"pl":"dane techniczne: pliki cookie / pamięć przeglądarki (np. zawartość koszyka, sesja logowania).","en":"technical data: cookies / browser storage (e.g. cart contents, login session)."},{"pl":"3. Cele i podstawy przetwarzania","en":"3. Purposes and Legal Bases for Processing"},{"pl":"realizacja zamówień i obsługa konta (art. 6 ust. 1 lit. b RODO),","en":"fulfilling orders and managing the account (Art. 6(1)(b) GDPR),"},{"pl":"obowiązki prawne, np. księgowe (lit. c),","en":"legal obligations, e.g. accounting (point c),"},{"pl":"uzasadniony interes — obsługa, bezpieczeństwo, statystyka (lit. f).","en":"legitimate interest — service, security, statistics (point f)."},{"pl":"4. Pliki cookie i pamięć przeglądarki","en":"4. Cookies and Browser Storage"},{"pl":"Używamy niezbędnych plików/danych przeglądarki do działania koszyka i logowania oraz (opcjonalnie) do statystyk. Zgodę na cookie możesz zaakceptować w banerze; niezbędne dane są wymagane do działania sklepu.","en":"We use essential browser files/data to operate the cart and login, and (optionally) for statistics. You can accept cookie consent in the banner; essential data is required for the shop to function."},{"pl":"5. Odbiorcy danych","en":"5. Data Recipients"},{"pl":"Dane mogą być przekazywane firmom kurierskim (realizacja dostawy) oraz operatorom płatności — wyłącznie w zakresie niezbędnym do realizacji zamówienia.","en":"Data may be transferred to courier companies (delivery fulfilment) and payment operators — only to the extent necessary to fulfil the order."},{"pl":"6. Czas przechowywania","en":"6. Retention Period"},{"pl":"Dane przechowujemy przez okres niezbędny do realizacji zamówień oraz wynikający z przepisów (np. podatkowych).","en":"We store data for the period necessary to fulfil orders and as required by law (e.g. tax regulations)."},{"pl":"7. Twoje prawa","en":"7. Your Rights"},{"pl":"Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia, przenoszenia oraz wniesienia sprzeciwu i skargi do Prezesa UODO. W sprawach danych pisz na kontakt@vibeleszno.com.","en":"You have the right to access your data, rectify, erase, restrict, and port it, as well as to object and to lodge a complaint with the President of the Personal Data Protection Office (UODO). For data matters, write to kontakt@vibeleszno.com."}];
  LEGAL_EN.forEach((p) => { if (!(p.pl in EN)) EN[p.pl] = p.en; });

  // Produkty (realne, z produkcji) — nazwy + opisy
  const PRODUCTS_EN = [
    { pl: 'Bluza Vibe Turkusowy', en: 'Vibe Hoodie Turquoise' },
    { pl: 'Bluza VIbe neonowy róż', en: 'Vibe Hoodie Neon Pink' },
    { pl: 'Bluza Vibe jasny szary melanż', en: 'Vibe Hoodie Light Grey Melange' },
    { pl: 'Bluza Vibe pastelowy', en: 'Vibe Hoodie Pastel' },
    { pl: 'Bluza Vibe miętowy', en: 'Vibe Hoodie Mint' },
    { pl: 'Bluza Vibe neonowa limonka', en: 'Vibe Hoodie Neon Lime' },
    { pl: 'Bluza Vibe neonowy pomarańcz', en: 'Vibe Hoodie Neon Orange' },
    { pl: 'Bluza Vibe słoneczny żółty', en: 'Vibe Hoodie Sunny Yellow' },
    { pl: 'Bluza Vibe błękitny jeans', en: 'Vibe Hoodie Denim Blue' },
    { pl: 'Bluza Vibe czerwony', en: 'Vibe Hoodie Red' },
    {
      pl: 'Stylowa i wygodna bluza z kapturem w modnym turkusowym kolorze. Wykonana z miękkiej i przyjemnej w dotyku dzianiny, zapewnia komfort noszenia na co dzień. Oryginalny biały nadruk „VIBE” z motywem luksusowego jachtu nadaje jej wyjątkowego, nowoczesnego charakteru.\n\nCechy produktu:\n\nklasyczny krój z kapturem,\npraktyczna kieszeń typu kangurka,\ndługie rękawy ze ściągaczami,\nefektowny biały nadruk „VIBE”,\nmiękki i wygodny materiał,\nidealna do codziennych stylizacji, podróży i aktywnego wypoczynku.\n\nKolor: turkusowy\nWzór: biały nadruk „VIBE” z motywem jachtu\nStyl: casual / sportowy / premium\n\n\nPoczuj wakacyjny klimat i pozytywną energię z bluzą VIBE. Połączenie wygody i modnego designu sprawia, że świetnie sprawdzi się zarówno podczas spacerów, wyjazdów, jak i w codziennych stylizacjach. Wyrazisty nadruk inspirowany luksusowym stylem życia podkreśla wyjątkowy charakter i dodaje każdej stylizacji niepowtarzalnego „vibe’u”.',
      en: 'A stylish and comfortable hooded sweatshirt in a trendy turquoise colour. Made of soft, pleasant-to-touch knit, it ensures everyday wearing comfort. The original white "VIBE" print with a luxury yacht motif gives it a unique, modern character.\n\nProduct features:\n\nclassic hooded cut,\npractical kangaroo pocket,\nlong sleeves with ribbed cuffs,\neye-catching white "VIBE" print,\nsoft and comfortable fabric,\nperfect for everyday outfits, travel and active leisure.\n\nColour: turquoise\nPattern: white "VIBE" print with a yacht motif\nStyle: casual / sporty / premium\n\n\nFeel the holiday mood and positive energy with the VIBE hoodie. The combination of comfort and fashionable design makes it great for walks, trips and everyday outfits alike. The bold print inspired by a luxury lifestyle underlines its unique character and adds an unmistakable "vibe" to any outfit.'
    },
    {
      pl: 'Dodaj energii swoim stylizacjom z wyjątkową bluzą VIBE w intensywnym, neonowym odcieniu różu. To połączenie wygody i modnego designu, które przyciąga spojrzenia i podkreśla indywidualny charakter. Oryginalny biały nadruk z motywem luksusowego jachtu nadaje całości nowoczesnego, wakacyjnego klimatu.\n\nCechy produktu:\nmodny, wyrazisty kolor neonowego różu,\nklasyczny fason z kapturem,\npraktyczna kieszeń typu kangurka,\nelastyczne ściągacze przy rękawach i dole bluzy,\nefektowny biały nadruk „VIBE”,\nmiękki i przyjemny w dotyku materiał,\nidealna na co dzień, na wyjazdy i aktywny wypoczynek.',
      en: 'Add energy to your outfits with the exceptional VIBE hoodie in an intense neon pink shade. It combines comfort and fashionable design that turns heads and emphasises your individual character. The original white print with a luxury yacht motif gives the whole a modern, holiday vibe.\n\nProduct features:\na trendy, bold neon pink colour,\nclassic hooded style,\npractical kangaroo pocket,\nelastic ribbing at the cuffs and hem,\neye-catching white "VIBE" print,\nsoft and pleasant-to-touch fabric,\nperfect for everyday wear, trips and active leisure.'
    },
    {
      pl: 'Ponadczasowa, wygodna i stylowa – bluza VIBE w kolorze jasnoszarego melanżu to idealny wybór dla kobiet ceniących komfort i modny wygląd. Kontrastowy czarny nadruk z motywem luksusowego jachtu nadaje jej nowoczesnego charakteru i sprawia, że doskonale wpisuje się w casualowe stylizacje.',
      en: 'Timeless, comfortable and stylish – the VIBE hoodie in light grey melange is the ideal choice for women who value comfort and a fashionable look. The contrasting black print with a luxury yacht motif gives it a modern character and makes it fit perfectly into casual outfits.'
    },
    {
      pl: 'Stylowa damska bluza z kapturem w kolorze pudrowego różu z nowoczesnym nadrukiem VIBE. Miękka i wygodna, idealna na co dzień, podróże i casualowe stylizacje. Modny pastelowy odcień podkreśla kobiecy charakter i zapewnia ponadczasowy wygląd.',
      en: 'A stylish women\'s hooded sweatshirt in powder pink with a modern VIBE print. Soft and comfortable, perfect for everyday wear, travel and casual outfits. The fashionable pastel shade emphasises a feminine character and ensures a timeless look.'
    },
    {
      pl: 'Damska bluza z kapturem VIBE w modnym miętowym kolorze to połączenie wygody i nowoczesnego stylu. Wykonana z miękkiej, przyjemnej w dotyku dzianiny, doskonale sprawdzi się na co dzień, podczas podróży i w casualowych stylizacjach. Oryginalny nadruk nadaje jej wyjątkowego charakteru.',
      en: 'The women\'s VIBE hoodie in a trendy mint colour combines comfort and modern style. Made of soft, pleasant-to-touch knit, it works great for everyday wear, travel and casual outfits. The original print gives it a unique character.'
    },
    {
      pl: 'Damska bluza z kapturem VIBE w intensywnym neonowo-zielonym kolorze przyciąga uwagę i nadaje stylizacjom wyjątkowego charakteru. Wykonana z miękkiej i komfortowej dzianiny, zapewnia wygodę na co dzień, podczas podróży oraz aktywnego wypoczynku. Modny nadruk VIBE podkreśla nowoczesny design.',
      en: 'The women\'s VIBE hoodie in an intense neon green colour attracts attention and gives outfits a unique character. Made of soft and comfortable knit, it ensures comfort for everyday wear, travel and active leisure. The fashionable VIBE print underlines its modern design.'
    },
    {
      pl: 'Damska bluza z kapturem VIBE w energetycznym neonowym pomarańczowym kolorze to propozycja dla kobiet ceniących wygodę i wyrazisty styl. Miękka dzianina, praktyczna kieszeń kangurka oraz nowoczesny nadruk VIBE sprawiają, że bluza doskonale sprawdzi się na co dzień, podczas podróży i aktywnego wypoczynku.',
      en: 'The women\'s VIBE hoodie in an energetic neon orange colour is a proposal for women who value comfort and a bold style. Soft knit, a practical kangaroo pocket and a modern VIBE print make the hoodie perfect for everyday wear, travel and active leisure.'
    },
    {
      pl: 'Damska bluza z kapturem VIBE w energetycznym żółtym kolorze to doskonały wybór dla kobiet ceniących wygodę i modny wygląd. Wykonana z miękkiej, przyjemnej w dotyku dzianiny, zapewnia komfort noszenia każdego dnia. Praktyczna kieszeń kangurka oraz efektowny nadruk VIBE nadają jej nowoczesnego charakteru.',
      en: 'The women\'s VIBE hoodie in an energetic yellow colour is an excellent choice for women who value comfort and a fashionable look. Made of soft, pleasant-to-touch knit, it ensures wearing comfort every day. A practical kangaroo pocket and an eye-catching VIBE print give it a modern character.'
    },
    {
      pl: 'Damska bluza z kapturem VIBE w modnym błękitnym odcieniu to połączenie wygody i ponadczasowego stylu. Wykonana z miękkiej, wysokiej jakości dzianiny, zapewnia komfort noszenia na co dzień i podczas podróży. Charakterystyczny nadruk VIBE oraz praktyczna kieszeń kangurka nadają jej nowoczesnego wyglądu.',
      en: 'The women\'s VIBE hoodie in a fashionable light blue shade combines comfort and timeless style. Made of soft, high-quality knit, it ensures wearing comfort for everyday use and travel. The distinctive VIBE print and a practical kangaroo pocket give it a modern look.'
    },
    {
      pl: 'Klasyka, która nigdy nie wychodzi z mody. Bluza VIBE w odcieniu jasnego melanżu to połączenie wygody i nowoczesnego designu. Wyrazisty czarny nadruk inspirowany luksusowym stylem życia dodaje jej wyjątkowego charakteru, a uniwersalny kolor sprawia, że z łatwością dopasujesz ją do ulubionych jeansów, legginsów czy szortów.',
      en: 'A classic that never goes out of fashion. The VIBE hoodie in a light melange shade combines comfort and modern design. The bold black print inspired by a luxury lifestyle adds a unique character, and the versatile colour means you can easily match it with your favourite jeans, leggings or shorts.'
    }
  ];
  PRODUCTS_EN.forEach((p) => { EN[p.pl] = p.en; });

  // Drobne fragmenty: strona produktu + opinie
  Object.assign(EN, {
    '14 dni na zwrot —': '14-day returns —',
    'tabela rozmiarów': 'size guide',
    'Brak opinii — bądź pierwszy': 'No reviews yet — be the first',
    'Brak opinii. Bądź pierwszy, który oceni ten produkt.': 'No reviews yet. Be the first to rate this product.',
    'Opinię możesz dodać dopiero po zakupie tego produktu.': 'You can add a review only after purchasing this product.',
    'Zaloguj się': 'Log in', ', aby dodać opinię (po zakupie).': ' to add a review (after purchase).',
    'Twoja opinia': 'Your review', 'Dodaj opinię': 'Add a review',
    'Twoja opinia (opcjonalnie)': 'Your review (optional)',
    'Zaktualizuj opinię': 'Update review', 'Wyślij opinię': 'Submit review',
    'Nie udało się wczytać opinii.': 'Failed to load reviews.',
    'Wybierz ocenę (gwiazdki)': 'Choose a rating (stars)', 'Dziękujemy za opinię!': 'Thank you for your review!',
    'Nie udało się dodać opinii': 'Failed to add the review',
    // pozostale toasty / drobne
    'Dziękujemy za zamówienie': 'Thank you for your order', 'Wybierz rozmiar': 'Choose a size', 'Wybierz kolor': 'Choose a colour',
    'Dodano do ulubionych': 'Added to favourites', 'Usunięto z ulubionych': 'Removed from favourites',
    'Nie udało się pobrać produktów. Odśwież stronę.': 'Failed to load products. Please refresh the page.',
    'Ładowanie…': 'Loading…', 'Koszyk': 'Cart', 'Do koszyka': 'Add to cart',
    // Kolory produktow (wybor na stronie produktu, koszyk)
    'Turkusowy': 'Turquoise', 'neonowy róż': 'Neon pink', 'jasny szary melanż': 'Light grey melange',
    'pastelowy': 'Pastel', 'miętowy': 'Mint', 'neonowa limonka': 'Neon lime',
    'neonowy pomarańcz': 'Neon orange', 'słoneczny żółty': 'Sunny yellow',
    'błękitny jeans': 'Denim blue', 'czerwony': 'Red'
  });

  const MAPS = { en: EN, de: DE };
  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };

  function getLang() { try { const l = localStorage.getItem('vibe_lang'); return LANGS.includes(l) ? l : 'pl'; } catch { return 'pl'; } }
  function tr(lang, key) { if (lang === 'pl') return key; const m = MAPS[lang]; return (m && m[key] != null) ? m[key] : key; }

  // t() dla kodu (np. app.js): zwraca tlumaczenie biezacego jezyka
  function t(plText) { return tr(getLang(), plText); }

  function translateTextNodes(root, lang) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentNode && SKIP_TAGS[node.parentNode.nodeName]) return NodeFilter.FILTER_REJECT;
        if (node.parentNode && node.parentNode.closest && node.parentNode.closest('#toast,[data-no-i18n]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n; while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach((node) => {
      let info = node.__i18n;
      if (!info) {
        const raw = node.nodeValue;
        const key = raw.trim();
        info = node.__i18n = { key, lead: raw.match(/^\s*/)[0], trail: raw.match(/\s*$/)[0] };
      }
      const val = tr(lang, info.key);
      node.nodeValue = info.lead + val + info.trail;
    });
  }

  function translateAttrs(root, lang) {
    root.querySelectorAll('[placeholder],[aria-label],[title]').forEach((el) => {
      ['placeholder', 'aria-label', 'title'].forEach((attr) => {
        if (!el.hasAttribute(attr)) return;
        const cacheKey = '__i18n_' + attr;
        let key = el[cacheKey];
        if (key == null) { key = el[cacheKey] = el.getAttribute(attr); }
        el.setAttribute(attr, tr(lang, key));
      });
    });
  }

  function apply(root) {
    const lang = getLang();
    const scope = root || document.body;
    if (!scope) return;
    document.documentElement.lang = lang;
    translateTextNodes(scope, lang);
    translateAttrs(scope, lang);
    markButtons(lang);
  }

  function markButtons(lang) {
    document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
  }

  function setLang(lang) {
    if (!LANGS.includes(lang)) return;
    try { localStorage.setItem('vibe_lang', lang); } catch {}
    apply();
  }

  // Klik w przyciski jezyka (delegacja — dziala tez dla dodanych dynamicznie)
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-lang]');
    if (b) { e.preventDefault(); setLang(b.dataset.lang); }
  });

  window.VibeI18n = { apply, setLang, getLang, t };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply());
  else apply();
})();
