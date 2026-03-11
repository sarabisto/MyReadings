'use strict';
// usato in mybooks

// Questo script gestisce l'apertura del modal per visualizzare i dettagli di un libro
//seleziona il Bookmodal e aggiunge un gestore per l'evento 'show.bs.modal'
// QUando il modal sta per essere mostrato, esegue la funzione di callback che riceve l'evento del modal
$('#bookModal').on('show.bs.modal', function (event) {

    const button = $(event.relatedTarget); // Bottone cliccato che fa apparire il modal, è l'elemento html cliccato
    // $ è un alias per jQuery, che permette di selezionare elementi del DOM e manipolarli
    const modal = $(this); // converte in oggetto jQuery il modal stesso

    // Cerca nel modal gli elementi con id #modal-book-title, #modal-book-author, etc. e imposta il loro testo o attributi, poi prende il valore dal bottone cliccato
    modal.find('#modal-book-title').text(button.data('title'));
    modal.find('#modal-book-author').text('Autore: ' + button.data('author'));
    modal.find('#modal-book-cover').attr('src', button.data('cover')); // attr('src') cambia il src dell'immagine di copertina
    modal.find('#modal-book-pages').text('Numero di pagine: ' + button.data('pages'));
    modal.find('#modal-book-pubdate').text('Data di pubblicazione: ' + button.data('pubdate'));
    modal.find('#modal-book-genre').text('Genere letterario: ' + button.data('genre'));
    modal.find('#modal-book-publisher').text('Casa editrice: ' + button.data('publisher'));
    modal.find('#modal-book-description').text(button.data('description'));
    modal.find('#modal-book-id').val(button.data('id')); // Imposta il valore del campo nascosto con l'ID del libro
    modal.find('textarea[name="review"]').val(''); // Pulisce la recensione precedente, nel caso in cui si inizi a scrivere una nuova recensione
});

// Quando un rating viene selezionato, aggiorna il campo nascosto nel form
// seleziona tutti gli input radio con il nome "rating" all'interno di #rating-group
document.querySelectorAll('#rating-group input[name="rating"]').forEach(radio => {
    // aggiunge un evento 'change' che si attiva quando il valore del radio button cambia (utente clicca una stella)
    radio.addEventListener('change', function () {
        // imposta il valore del campo nascosto con l'ID 'rating-input' al valore della stella selezionata
        document.getElementById('rating-input').value = this.value;
    });
});

// Disabilita il pulsante di invio del form quando il form viene inviato per evitare invii multipli
//seleziona tutti i form della pagina
document.querySelectorAll('form').forEach(form => {
    //quando un fomr viene inviato, aggiunge un gestore di eventi 'submit'
    form.addEventListener('submit', function () {
        //cerca nel form il pulsante di invio e lo disabilita per evitare che l'utente possa cliccarlo più volte
        const submitButton = this.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
        }
    });
});


