'use strict';
// usato in newsletter
//Controlla che l’email inserita sia scritta correttamente

//Seleziona il form e aggiunge un listener per l'evento submit
document.querySelector('form').addEventListener('submit', function (event) {
    // Controlla se il campo email è vuoto o non contiene un '@'
    const email = document.querySelector('input[name="email"]').value;
    if (!email || !email.includes('@')) {
        event.preventDefault();
        alert("Inserisci un’email valida.");
    }
    // altrimenti il form si invia normalmente
});
