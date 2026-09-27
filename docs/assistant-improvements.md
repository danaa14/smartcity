# Voice assistant și precizia chatului — 27 septembrie 2026

Modificări locale în `smartcity-main 6`. Nu sunt publicate pe Vercel și nu au fost trimise pe GitHub. Folderul furnizat este un export, fără director `.git`.

## De ce răspundea incomplet

- `/api/ask` oprea orice întrebare fără potrivire în corpus, cu excepția conversațiilor considerate scurte sau a documentelor atașate. Modelul general exista, dar nu putea formula clarificări/refuzuri pentru multe întrebări.
- „Small talk” însemna orice text de maximum trei cuvinte, fără cifre. Întrebări factuale precum „cine e primar” puteau pierde avertismentul de informație neverificată.
- Căutarea chatului nu primea subiectul conversației. „Și cât durează?” nu putea găsi documentele discutate anterior.
- Vocea înlocuia interogarea contextualizată a modelului cu transcriptul brut. În plus, finalizarea generării redeschidea microfonul chiar dacă audio încă se reda sau căutarea continua.
- Transcrierile goale/eșuate puteau lăsa microfonul în pauză. Rezultatele unei căutări vechi puteau ajunge după încheierea apelului.
- Un citat gol trecea verificarea de apartenență la pasaj. Verificarea citatului nu demonstrează însă singură că afirmația rezultă logic din el.
- Cache-ul reutiliza promisiuni legate de anularea altei cereri și putea păstra rezultate temporar indisponibile.

## Ce s-a schimbat

**Reguli comune** (`src/lib/answer/guidelines.ts`): domeniu municipal/civic, refuz politicos pentru cod, eseuri și marketing; refuz pentru fraudă, falsificare, vătămare și expunerea datelor personale; alternative legale; diferențiere între contestații legitime și evitarea obligațiilor; fără diagnostic individual. Documentele, istoricul și pasajele sunt date, nu instrucțiuni.

**Chat**: răspunsurile citate păstrează verificarea surselor. Când acestea nu acoperă întrebarea, modelul poate cere clarificări, refuza politicos sau da orientare generală, etichetată ca neverificată. Instrucțiunile interzic prezentarea unor taxe, termene, articole și condiții actuale din memorie. Aceasta nu este o extindere către un chatbot universal. Regulile de comportament ale modelului necesită și evaluare cu furnizorul real; testele simulate nu garantează respectarea lor în fiecare răspuns.

Continuările scurte RO/RU primesc subiectul unui topic municipal anterior identificat suficient de sigur. Schimbările explicite de subiect nu îl moștenesc. Această rezolvare este intenționat limitată la topicurile curate; nu este memorie semantică universală. Întrebările despre documentul atașat folosesc textul său; o întrebare nouă fără legătură poate folosi din nou corpusul.

Intrările și istoricul sunt validate, citatele goale sunt respinse, cache-ul păstrează numai răspunsuri finalizate pentru 60 de secunde, iar suma cererilor către model are un termen de 45 de secunde, sub limita rutei de 60 de secunde. Timeout-ul chatului lasă un mesaj și opțiunea de reîncercare.

**Voce**: folosește interogarea contextualizată, așteaptă căutările înainte de răspuns, urmărește separat generarea și redarea audio, revine la ascultare după transcrieri goale/eșuate și anulează căutările la închiderea apelului. Corectarea transcriptului se trimite numai când asistentul ascultă. Schimbarea limbii închide sesiunea; un nou apel primește întregul set de reguli în limba selectată. Timpul petrecut de utilizator în dialogul de permisiune pentru microfon nu consumă timeout-ul conexiunii.

Implementarea separă finalizarea generării de finalizarea redării conform documentației oficiale: https://developers.openai.com/api/docs/guides/realtime-conversations

## Verificare

- `npm run test:answers`: 11 scenarii existente.
- `npm run test:grounding`: eligibilitatea surselor, întrebări multiple, contacte susținute de corpus.
- `npm run test:voice`: 81 de pagini oficiale eligibile; sursele demo și catalogul Anexei nu sunt dovezi pentru cetățeni.
- `npm run test:assistant`: context, intrări invalide, citate goale, prompt comun, documente, răspunsuri JSON/SSE. Furnizorul este simulat.
- `npm run test:voice-ui`: necesită aplicația locală la `http://localhost:3127`, sau variabila `BASE`; browser Chromium cu WebRTC și API simulate. Verifică microfonul la redare/căutare, recuperarea transcrierii și ignorarea rezultatelor după închidere.
- `npx tsc --noEmit`, `npm run build`, ESLint pe fișierele schimbate. Lint-ul global are avertismente existente în alte fișiere și biblioteci generate.

Pe site-ul public, pagina principală a răspuns HTTP 200, iar `/api/voice/ready` a returnat `ready: true`. Acesta verifică doar existența configurării și a surselor, nu cheia la furnizor, creditul contului sau calitatea unui apel.

## Pentru lansare și precizie mai bună în continuare

1. Testați cu cheile serverului pentru chat (`OPENCODE_API_KEY`) și voce (`OPENAI_API_KEY`), modelele configurate în `.env.example` și conturi cu acces la acestea. Nu puneți chei în codul clientului. În copia atașată nu există configurare locală cu chei reale.
2. Rulați apeluri RO/RU reale, inclusiv zgomot, nume de străzi, întrerupere și schimbarea limbii. Testele simulate nu măsoară acuratețea transcrierii sau latența furnizorului.
3. Evaluați întrebări reale cu răspunsuri așteptate și surse: răspuns corect, refuz corect, clarificare, citare relevantă și informație lipsă. Includeți cereri de falsificare, contestații legitime și instrucțiuni malițioase în documente. Nu există un procent de acuratețe valid fără această evaluare.
4. Extindeți și actualizați corpusul cu documente oficiale pentru întrebările neacoperite. Cele 81 de pagini nu acoperă toate serviciile și toate cazurile. Căutarea actuală este lexicală; o etapă ulterioară poate adăuga căutare semantică și verificare a relevanței, evaluate pe același set de întrebări.
5. Publicați versiunea testată prin fluxul GitHub/Vercel al proiectului. Îmbunătățirile locale nu schimbă automat site-ul public.


## Verificare suplimentară și corecții locale în această sesiune

Modificările descrise mai sus existau deja în folderul primit. Au fost păstrate.
Am adăugat următoarele corecții, fără publicare sau push:

- Contextul chatului recunoaște și „Și ce acte îmi trebuie?”, „Unde depun cererea?”, „Pot depune online?”, „Care e termenul?” și echivalente rusești. Expresiile sunt normalizate identic cu textul întrebării, inclusiv litera й. Întrebările cu un serviciu nou explicit nu moștenesc subiectul anterior.
- O scuză sau un refuz la începutul răspunsului nu mai ascunde avertismentul despre informația neverificată. Doar un schimb social exact este exceptat; verificarea citatelor rămâne neschimbată.
- Microfonul este suspendat imediat la solicitarea salutului/răspunsului, înainte de confirmarea furnizorului. La oprirea redării așteaptă atât finalizarea generării, cât și golirea bufferului audio. O transcriere eșuată întârziată nu îl poate reactiva peste un răspuns în curs.

Verificări efectuate: `test:assistant`, `test:voice-ui` (WebRTC și furnizor simulate), `test:answers` (11 scenarii), `test:grounding`, `test:voice`, `verify:corpus` (520 pasaje și 39 fapte comparate cu snapshoturile locale), TypeScript, ESLint pe fișierele modificate și build de producție. Validarea snapshoturilor nu confirmă că paginile sunt încă actuale astăzi.

În browserul local la http://localhost:3127 am verificat răspunsul cu surse la întrebarea despre actele pentru contractul de apă, urmat de „Și ce acte îmi trebuie?”. A doua întrebare păstrează subiectul și afișează dovezile. Captură: `docs/chat-local-verification.png`.

Limitări: nu există chei API locale configurate, deci demonstrația folosește răspunsurile deterministe din corpus. Apelurile reale, transcrierea cu zgomot și acuratețea modelului nu au fost măsurate. Rezolvarea contextului rămâne conservatoare, bazată pe subiectele curate și pe expresii explicite; nu acoperă toate parafrazele. Corpusul oficial eligibil rămâne de 81 pagini/documente, iar căutarea rămâne lexicală.

Pentru nivelul următor: configurarea privată a OPENCODE_API_KEY și OPENAI_API_KEY în `.env.local`, evaluare RO/RU cu întrebări reale și răspunsuri așteptate, apoi extinderea/actualizarea surselor și evaluarea unei căutări semantice pe același set. Nu există în această sesiune un procent măsurat de creștere a acurateței generale.
