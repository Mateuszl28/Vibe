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
