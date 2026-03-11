'use strict'; // Importa i moduli necessari per il funzionamento del server web

// IMPORTAZIONE MODULI
const express = require('express');                       // Framework principale per creare il server web
const session = require('express-session');               // Middleware per gestire le sessioni utente
const sqlite3 = require('sqlite3').verbose();             // Driver per connettersi al DB SQLite
const passport = require('passport');                     // Middleware per autenticazione
const LocalStrategy = require('passport-local').Strategy; // Strategia locale di login (username + password)
const path = require('path');                             // Modulo per gestire path file e directory
const bcrypt = require('bcrypt');                         // Per hash sicuro delle password
const validator = require('validator');                   //Usato per controllare l'email
const multer = require('multer');                         // Multer per gestire l'upload di copertine dei libri

const port = 3000; // Porta su cui il server ascolterà le richieste
const app = express(); // Inizializza l'app Express, aka crea il server web

// MIDDLEWARE GLOBALI
app.use(express.static('public'));                         // Middleware per servire file statici dalla cartella public (CSS, JS, immagini)
app.use(express.json());                                   // Per leggere il corpo delle richieste in formato JSON 
app.use(express.urlencoded({ extended: true }));           // Per leggere dati da form HTML

// USA SESSION PER CONFIGURARE LE SESSIONI UTENTE (crea e gestisce un cookie che tine traccia dell'utente loggato)
app.use(session({
  secret: "c23ac071b92a1cc39f23abed6ba70736c758b436d79d6b8f6b4250993b2b541f", //stringa segreta per firmare e criptare il cookie di sessione
  resave: false, // Non riscrivere la sessione nel DB se non è stata modificata
  saveUninitialized: false // Non salvare sessioni vuote nel DB
}));

app.use(passport.initialize()); // Inizializza Passport per gestire l'autenticazione
app.use(passport.session()); //Salva lo stato di login dell'utente nella sessione

// SERIALIZZAZIONE SESSIONI
//Definisce cosa salvare nella sessione quando l'utente si autentica
passport.serializeUser(function (user, done) { //Funzione che riceve l'utente autenticato
  done(null, user.id); // Salva l'ID dell'utente nella sessione
});
//Definisce come recuperare l'utente dalla sessione
passport.deserializeUser(function (id, done) { //Funzione che riceve l'ID dell'utente salvato
  getUserById(id).then((user) => done(null, user)).catch(done); // Recupera l'utente dal DB usando l'ID e lo passa a Passport
});

// CONFIGURAZIONE VIEW ENGINE
app.set('view engine', 'ejs');                           // Metodo express per configurare il motore di template EJS, serve per generare HTML dinamico
app.set('views', path.join(__dirname, 'views'));         // Percorso vers le viste EJS, che si trovano nella cartella 'views'

// CONNESSIONE AL DATABASE
const db = new sqlite3.Database('./database/my_readings.sqlite', (err) => { //Nuova connessione al database SQLite
  if (err) console.error('Errore apertura DB:', err.message);
});

// Abilita le foreign keys per garantire l'integrità referenziale
db.run('PRAGMA foreign_keys = ON;');


// MIDDLEWARE DI PROTEZIONE: verifica che l'utente sia autenticato prima di accedere a determinate rotte
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

//MIDDLEWARE PER AUTORI: verifica che l'utente sia autenticato e abbia il ruolo di autore
function isAuthor(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'autore') return next();
  res.status(403).send('Accesso negato');
}

// STRATEGIA DI LOGIN CON PASSPORT
passport.use(new LocalStrategy( // Strategia di autenticazione con username e password
  function (username, password, done) {
    getUser(username).then((user) => { // Se l'utente esiste nel DB
      if (!user) return done(null, false, { message: 'Username errato.' }); // Se l'utente non esiste, ritorna errore
      if (!user.checkPassword(password)) return done(null, false, { message: 'Password errata.' }); //Se la password non corrisponde, ritorna errore
      return done(null, user); // Se tutto va bene, ritorna l'utente autenticato
    }).catch(done); //Se qualcosa va storto, passa l'errore a Passport
  }));

// REGISTRAZIONE UTENTE
const createUser = (name, surname, email, password, role = 'user') => {
  return new Promise((resolve, reject) => {
    if (!validator.isEmail(email)) {
      reject('Email non valida');
    }
    const hash = bcrypt.hashSync(password, 10); // Hash della password
    const sql = 'INSERT INTO Users (name, surname, email, password, role) VALUES (?, ?, ?, ?, ?)';
    db.run(sql, [name, surname, email, hash, role], function (err) { //Esegue la query per inserire l'utente nel DB
      if (err) return reject(err); //Se c'è un errore la promise viene rifiutata
      resolve(this.lastID); // Se tutto ok restituisce ID dell'utente appena creato
    });
  });
};

// LOGIN UTENTE
const getUser = (email) => { //Cerca un utente nel DB per email
  return new Promise((resolve, reject) => { //Se lo trova, ritorna un oggetto utente con le sue informazioni
    const sql = 'SELECT * FROM Users WHERE email = ?'; //Select tutti i campi dell'user che ha la mail specificata
    db.get(sql, [email], (err, row) => { //Query per ottenere l'utente
      if (err) return reject(err);
      if (!row) return resolve(null); //Se l'utente non esiste, ritorna null
      const user = { //Crea un oggetto utente con le informazioni necessarie
        id: row.id,
        username: row.email, //Uso l'email come username
        name: row.name,
        surname: row.surname,
        role: row.role,
        checkPassword: (password) => bcrypt.compareSync(password, row.password) //Metodo per confrontare l'hash inserita nel DB
      };
      resolve(user);
    });
  });
};

// RECUPERA UTENTE DA ID PER SESSIONE
const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM Users WHERE id = ?'; //Select tutti i campi dell'user che ha l'id specificato
    db.get(sql, [id], (err, row) => { //Query per ottenere l'utente, usando l'ID come filtro
      if (err) return reject(err);
      if (!row) return resolve(null);
      // Crea un oggetto utente con le informazioni necessarie
      const user = {
        id: row.id,
        username: row.email,
        name: row.name,
        surname: row.surname,
        role: row.role
      };
      resolve(user);
    });
  });
};

// LOGIN
app.post('/api/login', function (req, res, next) { //Crea una rotta post per il login, per gestire l'invio dei dati di login
  passport.authenticate('local', function (err, user) { //Funzione che gestisce l'autenticazione dell'utente
    if (err) return next(err);
    if (!user) return res.redirect('/login?error=1'); // Se c'è un errore o l'utente non esiste, reindirizza alla pagina di login con un messaggio di errore
    req.logIn(user, function (err) { //Se utente è valido crea sessione di login e salva l'utente nella sessione
      if (err) return next(err);
      return res.redirect('/mybooks'); //Reindirizza alla pagina MyBooks dopo il login
    });
  })(req, res, next); // Passa la richiesta, risposta e next alla funzione di autenticazione
});

// REGISTRAZIONE + LOGIN AUTOMATICO
app.post('/api/register', async (req, res) => { //Crea una rotta post per la registrazione, async per usare await
  const { name, surname, email, password, role } = req.body; //estrae i dati dal body della richiesta (inviati dal form di registrazione)
  try { //Prova a creare un nuovo utente con i dati ricevuti
    await createUser(name, surname, email, password, role || 'lettore'); // Usa la funzione createUser per inserire l'utente nel DB, aspettando che la promessa venga risolta
    const user = await getUser(email); // Recupera l'utente appena creato dal DB usando l'email
    req.login(user, (err) => { // Usa la funzione login di Passport per creare una sessione per l'utente
      if (err) {
        console.error('Errore login automatico:', err);
        return res.status(500).json({ error: 'Errore nel login automatico' });
      }
      res.redirect('/mybooks');
    });
  } catch (err) { //Gestisce gli errori durante la creazione dell'utente
    let errorMsg = 'Errore durante la registrazione.';
    if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('Users.email')) {
      errorMsg = 'Questa email è già registrata. Prova ad accedere o usa un’altra email.';
    }
    res.render('register', { error: errorMsg });
  }
});

// PAGINE FRONTEND
app.get('/', (req, res) => res.render('index', { user: req.user })); // Pagina principale
app.get('/contacts', (req, res) => res.render('contacts', { user: req.user })); // Pagina dei contatti
app.get('/addbook', isAuthor, (req, res) => res.render('addbook', { user: req.user })); // Pagina per aggiungere un libro
app.get('/newsletter', (req, res) => res.render('newsletter', { user: req.user, error: null })); // Pagina per la newsletter
app.get('/newsletter-thankyou', (req, res) => res.render('newsletter-thankyou', { user: req.user })); // Paginanewsletter
app.get('/register', (req, res) => res.render('register', { error: null })); // Pagina di registrazione

//LOGIN
app.get('/login', (req, res) => {
  const error = req.query.error ? 'Email o password errati.' : null; // Recupera errore da query string, se presente, per mostrare un messaggio di errore
  res.render('login', { error });
});

// LOGOUT
app.get('/logout', (req, res, next) => { // Rotta per il logout, 
  req.logout(function (err) { // Usa la funzione logout di Passport per terminare la sessione dell'utente
    if (err) {
      console.error('Logout error:', err);
      return next(err);
    }
    req.session.destroy(() => { // Distrugge la sessione dell'utente
      res.redirect('/');
    });
  });
});

// GESTIONE LIBRI
const dbPath = path.join(__dirname, 'database', 'my_readings.sqlite'); //dbPath percorso al database SQLite
new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => { // Crea una nuova connessione al database in lettura e scrittura
//NB: Questa connessione viene usata solo per verificare che il database sia accessibile. Le query effettive usano la variabile `db`
  if (err) console.error("Errore durante l'apertura del database:", err.message);
  else console.log("Connessione al database riuscita.");
});

// Rotta per visualizzare tutti i libri
app.get('/books', (req, res) => { 
  const { genre, fromYear, toYear } = req.query; //Estrae i parametri di query genre, fromYear e toYear dalla richiesta
  let query = 'SELECT * FROM Books WHERE 1=1'; // Inizializza la query SQL per selezionare tutti i libri, 1=1 è una condizione sempre vera per facilitare l'aggiunta di ulteriori condizioni
  const params = []; // Array per i parametri della query, inizialmente vuoto

  //Se il genere è specificato, aggiunge una condizione alla query e il parametro corrispondente
  if (genre) {
    query += ' AND genre = ?';
    params.push(genre);
  }

  // Se fromYear è specificato, aggiunge una condizione alla query e il parametro corrispondente
  if (fromYear) {
    query += ' AND publication_date >= ?';
    params.push(fromYear);
  }
  if (toYear) {
    query += ' AND publication_date <= ?';
    params.push(toYear);
  }

  // Mostra i libri in ordine alfabetico per titolo
  query += ' ORDER BY title ASC'; // Aggiunge un ordinamento per titolo in ordine alfabetico
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Errore nel recupero dei dati:', err.message);
      return res.status(500).send('Errore nel recupero dei dati');
    }
    // Recupera errore da query string, se presente, per mostrare un messaggio di errore se l'utente ha già aggiunto il libro
    const error = req.query.error === 'alreadyAdded'
      ? 'Hai già aggiunto questo libro ai tuoi letti.'
      : null;
    res.render('books', { books: rows, user: req.user, error });
  });
});


// Configura multer per gestire il salvataggio nella cartella "public/images"
const storage = multer.diskStorage({ 
  destination: function (req, file, cb) { // Funzione per specificare la cartella di destinazione dei file caricati (riceve richiesta, file e callback)
    cb(null, 'public/images'); // Salva i file nella cartella public/images
  },
  filename: function (req, file, cb) { // Funzione per generare un nome unico per il file dell'immagine del libro
    cb(null, Date.now() + path.extname(file.originalname)); // Chiama la callback senza errori e specifica il nome del file come timestamp + estensione originale
  }
});

//Middleware per gestire l'upload delle copertine dei libri
const upload = multer({ storage: storage }); // Inizializza multer con la configurazione di storage appena creata

// Rotta per aggiunta libro
app.post('/addbook', isAuthor, upload.single('cover'), async (req, res) => { // Rotta per aggiungere un libro, richiede autenticazione come autore e gestisce l'upload di una singola copertina
// Estrae i dati dal body della richiesta rimuovendo spazi vuoti all'inizio e alla fine, se non presenti imposta a null
  // per il titolo se inserito minuscolo, lo capitalizza
  let title = req.body.title?.trim() || null;
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
  const genre = req.body.genre?.trim() || null;
  const cover = req.file ? 'images/' + req.file.filename : null; // Se il file di copertina è stato caricato, usa il nome del file, e salva il percorso altrimenti imposta a null
  const publication_date = req.body.publication_date?.trim() || null;
  const publisher = req.body.publisher?.trim() || null;
  const pages = parseInt(req.body.pages) || null; //converte il numero di pagine in un intero, se non presente imposta a null
  const description = req.body.description?.trim() || null;

  const author_id = req.user.id; // prende l'ID dell'autore dalla sessione utente autenticata
  const author = req.user.name + " " + req.user.surname; // Combina nome e cognome dell'autore per creare una stringa completa

  try { // Controlla se tutti i campi obbligatori sono stati compilati
    //Query SQL per inserire un nuovo libro nel database
    const sql = "INSERT INTO Books (title, author_id, genre, cover, publication_date, publisher, pages, author, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"; 
    db.run(sql, [title, author_id, genre, cover, publication_date, publisher, pages, author, description], function (err) { // Esegue la query per inserire il libro nel database
      // Se c'è un errore durante l'inserimento del libro, lo gestisce
      if (err) {
        console.error("Errore nell'aggiunta del libro:", err);
        return res.status(500).json({ error: "Errore nell'aggiunta del libro" });
      }
      res.redirect('/books'); // Se l'inserimento va a buon fine, reindirizza alla pagina dei libri
    });
  } catch (err) { // Gestisce gli errori durante il salvataggio del libro
    console.error("Errore salvataggio libro:", err);
    res.status(500).json({ error: "Errore salvataggio libro" });
  }
});

// Rotta per la ricerca di autori e libri
app.get('/search', (req, res) => {
  const searchTerm = req.query.q?.trim() || ''; // Estrae il termine di ricerca dalla query string, rimuovendo spazi vuoti all'inizio e alla fine, se non presente imposta a stringa vuota
  if (!searchTerm) { // Se non c'è termine di ricerca, reindirizza a /books
    return res.redirect('/books'); 
  }
  //Filtra i libri per titolo o autore che contengono il termine di ricerca
  const query = `
    SELECT * FROM Books
    WHERE title LIKE ? OR author LIKE ? 
    ORDER BY title ASC
  `;
  const searchPattern = `%${searchTerm}%`; // Aggiunge i caratteri % per la ricerca parziale

  db.all(query, [searchPattern, searchPattern], (err, rows) => { //Esegue la query (sia per titolo che autore) che restituisce i libri che corrispondono al termine di ricerca
    if (err) {
      console.error('Errore nella ricerca:', err.message);
      return res.status(500).send('Errore nella ricerca');
    }
    res.render('books', { books: rows, user: req.user, error: null }); // Renderizza la pagina dei libri con i risultati della ricerca
  });
});


//AGGIUNTA LIBRI DA CATALOGO BOOKS A MYBOOKS
app.post('/api/add-to-mybooks', isLoggedIn, (req, res) => { // Rotta per aggiungere un libro alla lista MyBooks dell'utente autenticato
  const userId = req.user.id; // Prende l'ID dell'utente dalla sessione
  const bookId = req.body.bookId; // Prende l'ID del libro dal body della richiesta dal form di aggiunta
  const sql = 'INSERT INTO UserBooks (user_id, book_id) VALUES (?, ?)'; // Query SQL per inserire il libro nella tabella UserBooks, che associa l'utente al libro
  db.run(sql, [userId, bookId], (err) => { // Esegue la query per inserire il libro nella tabella UserBooks
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        // Libro già presente per quell'utente
        return res.redirect('/books?error=alreadyAdded');
      }
      console.error('Errore durante l\'aggiunta del libro a MyBooks:', err.message);
      return res.status(500).send('Errore durante l\'aggiunta del libro.');
    }
    res.redirect('/mybooks');
  });
});

//RECUPERA I LIBRI LETTI/SALVATI IN MYBOOKS
app.get('/mybooks', isLoggedIn, (req, res) => {
  const userId = req.user.id;
  //Seleziona tutti i campi della tabella Books, e fa un join con UserBooks per ottenere solo i libri associati all'utente, filtrando per user_id loggato
  const query = `
    SELECT Books.* FROM Books 
    INNER JOIN UserBooks ON Books.id = UserBooks.book_id
    WHERE UserBooks.user_id = ?
  `;
  db.all(query, [userId], (err, rows) => { //Query che restituisce tutti i libri associati all'utente loggato
    if (err) {
      console.error('Errore nel recupero dei MyBooks:', err.message);
      return res.status(500).send('Errore nel recupero dei MyBooks.');
    }
    // Recupera errore da query string, se presente, per mostrare un messaggio di errore se l'utente non ha selezionato una valutazione nel lasciare di una recensione
    const error = req.query.error === 'missingRating'
      ? 'Devi selezionare almeno una stella per lasciare una recensione.'
      : null;

    res.render('mybooks', { // Renderizza la pagina mybooks.ejs con i libri letti dall'utente
      books: rows || [], // Se non ci sono libri, passa un array vuoto
      user: req.user,
      error
    });
  });
});

// INSERISCI LE RECENSIONI
app.post('/api/review', isLoggedIn, (req, res) => {
  const { book_id, review, rating } = req.body;
  const user_id = req.user.id;
  if (!rating) {
    // Reindirizza alla GET passando l'errore come parametro
    return res.redirect('/mybooks?error=missingRating');
  }
  const sql = 'INSERT INTO Reviews (user_id, book_id, review, rating) VALUES (?, ?, ?, ?)';
  db.run(sql, [user_id, book_id, review, rating], (err) => {
    if (err) {
      console.error("Errore nel salvataggio della recensione:", err.message);
      return res.status(500).send("Errore nel salvataggio della recensione.");
    }
    res.redirect('/mybooks');
  });
});

// ELIMINA RECENSIONI
app.post('/api/review/delete', isLoggedIn, (req, res) => { //definisce una rotta HTTP post per eliminare una recensione
  const reviewId = req.body.review_id; // Prende l'ID della recensione dal body della richiesta dal form di eliminazione
  const userId = req.user.id; // Prende l'ID dell'utente dalla sessione autenticata
  const sql = 'DELETE FROM Reviews WHERE id = ? AND user_id = ?'; // Query SQL per eliminare la recensione specificata dall'ID e dall'ID dell'utente
  db.run(sql, [reviewId, userId], function (err) { // Esegue la query per eliminare la recensione
    if (err) {
      console.error("Errore durante l'eliminazione della recensione:", err.message);
      return res.status(500).send("Errore nell'eliminazione.");
    }
    res.redirect('/reviews');
  });
});

// RECUPERA LE RECENSIONI DELL'UTENTE
app.get('/reviews', isLoggedIn, (req, res) => {
  // Queru che recupera tutte le recensioni dell'utente loggato, unendo le tabelle Reviews e Books per ottenere il titolo e la copertina del libro
  // Join tra Reviews e Books con alias b per ottenere titolo e copertina del libro
  const sql = `
    SELECT b.title, b.cover, r.book_id, r.review, r.rating, r.created_at, r.id
    FROM Reviews r
    JOIN Books b ON r.book_id = b.id 
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `;
  db.all(sql, [req.user.id], (err, rows) => { //esegue la query per ottenere le recensioni dell'utente loggato
    if (err) {
      console.error("Errore nel recupero recensioni:", err.message);
      return res.status(500).send("Errore nel caricamento delle recensioni.");
    }
    res.render('reviews', { user: req.user, reviews: rows });
  });
});

// RECUPERA TUTTE LE RECENSIONI PER UN LIBRO SPECIFICO IN COSA NE PENSANO GLI ALTRI/RECENSIONI DI ALTRI LETTORI
app.get('/book/:id/reviews', isLoggedIn, (req, res) => { // La rotta risponde all’URL `/book/qualcosa/reviews`, dove `:id` è l’id del libro
  const bookId = req.params.id; // Prende l'ID del libro dalla rotta
  const sql = `
    SELECT r.id, r.review, r.rating, r.created_at, u.name, u.surname, b.cover, b.title
    FROM Reviews r
    JOIN Users u ON u.id = r.user_id
    JOIN Books b ON b.id = r.book_id
    WHERE r.book_id = ?
    ORDER BY r.created_at DESC
  `;
  db.all(sql, [bookId], (err, rows) => {
    if (err) return res.status(500).send("Errore nel caricamento recensioni.");
    res.render('book-reviews', { reviews: rows, user: req.user });
  });
});

// LIKE/DISLIKE RECENSIONI E NOTIFICHE
app.post('/api/review/like', isLoggedIn, (req, res) => {
  const { review_id, type } = req.body; //Estrae l'ID della recensione e il tipo di azione (like o dislike) dal body della richiesta
  const user_id = req.user.id; // Prende l'ID dell'utente dalla sessione autenticata
  //Inserisce o aggiorna il like/dislike nella tabella ReviewLikes
  const sql = `
    INSERT OR REPLACE INTO ReviewLikes (user_id, review_id, type)
    VALUES (?, ?, ?)
  `;
// Elimina eventuali notifiche precedenti per lo stesso utente e recensione
  const deleteSql = `DELETE FROM Notifications WHERE review_id = ? AND user_id = ?`;
  db.run(deleteSql, [review_id, req.user.id], (err) => {
    if (err) console.error("Errore cancellazione notifiche:", err);
    // Inserisce o aggiorna il like/dislike nella tabella ReviewLikes
    db.run(sql, [user_id, review_id, type], (err) => {
      if (err) return res.status(500).send("Errore like/dislike");
      // Recupera l'autore della recensione per creare una notifica
      const getReviewAuthorSql = `
        SELECT user_id FROM Reviews WHERE id = ?
      `;
      //Recupera l'Id dell'autore della recensione per poter inviare una notifica
      db.get(getReviewAuthorSql, [review_id], (err, review) => {
        if (err) return res.status(500).send("Errore nel recupero dell'autore della recensione.");
        if (review) {
          // Inserisce una notifica per l'autore della recensione
          const notificationSql = `
            INSERT INTO Notifications (user_id, review_id, type, message)
            VALUES (?, ?, ?, ?)
          `;
          // Crea il messaggio della notifica in base al tipo di azione (like o dislike)
          const action = type === 'like' ? 'messo un like' : 'messo un dislike';
          const message = `${req.user.name} ${req.user.surname} ha ${action} alla tua recensione.`;
          db.run(notificationSql, [review.user_id, review_id, type, message], (err) => {
            if (err) return res.status(500).send("Errore nell'inserimento della notifica.");
          });
        }
      });
      // Reindirizza in modo sicuro alla pagina precedente o a una pagina predefinita
      const referrer = req.get("Referrer") || "/";
      res.redirect(referrer);
    });
  });
});

// COMMENTA RECENSIONI E NOTIFICHE
app.post('/api/review/comment', isLoggedIn, (req, res) => {
  const { review_id, comment } = req.body; // Estrae l'ID della recensione e il commento dal body della richiesta
  const reviewId = review_id
  if (!reviewId || !comment) {
    return res.status(400).send("Campi mancanti.");
  }
  // Recupera l'ID dell'autore della recensione per poter inviare una notifica
  const getAuthorSql = `SELECT user_id FROM Reviews WHERE id = ?`;
  // Esegue la query per ottenere l'ID dell'autore della recensione
  db.get(getAuthorSql, [reviewId], (err, row) => {
    if (err || !row) {
      console.error("Errore nel recupero autore recensione:", err?.message);
      return res.status(500).send("Errore nel recupero dell'autore.");
    }
    // Se l'autore della recensione esiste, inserisce il commento nella tabella ReviewComments
    const reviewAuthorId = row.user_id;
    // Query SQL per inserire il commento nella tabella ReviewComments
    const insertCommentSql = `INSERT INTO ReviewComments (review_id, user_id, comment) VALUES (?, ?, ?)`;
    // Esegue la query per inserire il commento
    db.run(insertCommentSql, [reviewId, req.user.id, comment], function (err2) { //Function() {} è fondamentale per usare this.lastID
      if (err2) {
        console.error("Errore nell'inserimento del commento:", err2.message);
        return res.status(500).send("Errore nell'inserimento del commento.");
      }
      // Se l'inserimento del commento va a buon fine, crea una notifica per l'autore della recensione
      const reviewCommentId = this.lastID; // Fondamentale usare function() {} e NON una arrow function
      // Crea il messaggio della notifica
      const message = `${req.user.name} ${req.user.surname} ha commentato la tua recensione.`;
      // Query SQL per inserire la notifica nella tabella Notifications
      const insertNotificationSql = `
        INSERT INTO Notifications (user_id, review_id, type, message, sender_id, review_comment_id)
        VALUES (?, ?, 'comment', ?, ?, ?)
      `;
      // Esegue la query per inserire la notifica
      db.run(insertNotificationSql, [reviewAuthorId, reviewId, message, req.user.id, reviewCommentId], (err3) => {
        if (err3) {
          console.error("Errore nella creazione della notifica:", err3.message);
          return res.status(500).send("Errore nella notifica.");
        }
        return res.redirect(req.get("Referrer") || "/");
      });
    });
  });
});

// NOTIFICHE
app.get('/notifications', isLoggedIn, (req, res) => {
  // Query SQL per recuperare le notifiche dell'utente loggato, unendo le tabelle Notifications, Reviews e Books
  //Se la notifica è di tipo comment, recupera anche il commento dalla tabella ReviewComments - CASE WHEN
  // END AS comment serve per rinominare il campo comment in modo che sia accessibile nell'oggetto restituito
  const sql = `
    SELECT 
      n.id,
      n.review_id,
      n.user_id,
      n.type,
      n.message,
      n.created_at,
      n.read,
      r.review AS review_text,
      b.title AS book_title,
      CASE 
      WHEN n.type = 'comment' THEN (
        SELECT rc.comment
        FROM ReviewComments rc
        WHERE rc.id = n.review_comment_id
      )
      ELSE NULL
    END AS comment
    FROM Notifications n
    JOIN Reviews r ON n.review_id = r.id
    JOIN Books b ON r.book_id = b.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
  `;
  // Esegue la query per ottenere le notifiche dell'utente loggato
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) {
      console.error("Errore nel caricamento delle notifiche:", err.message);
      return res.status(500).send("Errore nel caricamento delle notifiche.");
    }
    // Aggiorna lo stato delle notifiche come lette (read = 1) se non lo sono già (read = 0)
    const updateSql = `UPDATE Notifications SET read = 1 WHERE user_id = ? AND read = 0`;
    db.run(updateSql, [req.user.id], (updateErr) => {
      if (updateErr) {
        console.error("Errore nell'aggiornamento delle notifiche:", updateErr.message);
      }
      // Controlla se ci sono nuove notifiche (read = 0) per mostrare un badge di notifica
      const hasNewNotifications = rows.some(n => n.read === 0);
      res.render('notifications', { 
        notifications: rows,
        user: req.user,
        hasNewNotifications // Passa l'informazione se ci sono nuove notifiche per mostrare un badge
      });
    });
  });
});

// GESTIONE DELLA NEWSLETTER
app.post('/newsletter', (req, res) => {
  const email = req.body.email;
  if (!email || !email.includes('@')) {
    return res.render('newsletter', {
      user: req.user,
      error: 'Inserisci un’email valida per iscriverti alla newsletter.'
    });
  }
  res.redirect('/newsletter-thankyou');
});

// AVVIO SERVER
app.listen(port, '127.0.0.1', () => { // Avvia il server sulla porta specificata e sull'indirizzo IP locale e lo mette in ascolto alle richieste
  console.log('http://localhost:3000/');
});
