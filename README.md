# radon220
## Résumé
Interface web de mesure de la décroissance radioactive du radon 220 en se connectant via le port série sur: 
- le dispositif Jeulin (fiole de Lucas, modèle CALEN de la société Algade)
- une Arduino Uno simulant la mesure de l'appareil Jeulin

## Utilisation avec l'appareil de mesure Jeulin
- L'appareil est connecté via un adaptateur RS232/USB sur le PC.

- On lance la page [page](https://pages.github.com/) en utilisant comme navigateur **Chrome** ou **Opera** (les autres ne sont pas encore compatibles avec Web Serial API)

- On connecte le navigateur sur le port série, puis on lance la mesure
  
## Utilisation avec un simulateur sous Arduino Uno
- On télécharge le script `serie_echo_001.ino` sur l'Arduino Uno.

- La simulation démarre dès que la connextion se fait sur le port série.

- L'Arduino Uno envoie les commandes avec la même syntaxe que le vrai appareil de mesure Jeulin

## Exemple
  
  
