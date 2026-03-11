'use strict';
//usato in book-reviews, reviews

//Serve a evitare che l’utente prema più volte “Invia” su un modulo

//seleziona tutti i form della pagina, per ognuno:
document.querySelectorAll('form').forEach(form => { 
  //aggiunge un listener, quando il form viene inviato esegue la funzione:
  form.addEventListener('submit', function () {
    //cerca il bottone di submit all'interno del form
    const submitButton = this.querySelector('button[type="submit"]');
    if (submitButton) {
      //se la trova, lo disabilita dopo il primo click
      //per evitare che l'utente prema più volte e invii lo spam
      submitButton.disabled = true;
    }
  });
});