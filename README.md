# SendOverNetwork

![demo](https://firebasestorage.googleapis.com/v0/b/storage-bf183.appspot.com/o/otherImages%2Fsendovernetwork-v3-demo.gif?alt=media)

SendOverNetwork est un CLI permettant l'envoi et le téléchargement de fichiers sur votre réseau local (même sans connexion internet).

## Prérequis

* [nodejs v15+ et npm](https://nodejs.org/en/) installé sur votre système.
* Deux appareils sous Windows, macOS, Linux ou ChromeOS


## Installation

```bash
$ (sudo) npm install --global sendovernetwork
```


## Comment utiliser le CLI

SendOverNetwork peut s'utiliser de deux façons :

* avec des arguments, exemple :
```bash
# Envoyer "mon_dessin.png" sur le réseau local avec le port par défaut
$ sendovernetwork upload mon_dessin.png

# Envoyer "mon_dessin.png" et "projet.psd" sur le réseau local avec le port par défaut
$ sendovernetwork upload mon_dessin.png projet.psd

# Envoyer plusieurs fichiers/dossier avec un espace dans le nom
$ sendovernetwork upload "mon dessin.png" "projet.psd"

# Envoyer "mon_dessin.png" sur le réseau local avec le port 12345
$ sendovernetwork upload mon_dessin.png --port 12345

# Télécharger un fichier/dossier à partir de l'IP locale 192.168.1.52 avec le port par défaut (3410)
$ sendovernetwork download 192.168.1.52:3410

# Télécharger un fichier/dossier à partir de l'IP locale 192.168.1.52 avec le port 12345
$ sendovernetwork download 192.168.1.52:12345
```

* avec l'interface graphique via terminal (TUI), exemple :
```bash
$ sendovernetwork
```

> Vous pouvez également utiliser l'alias `son`


## Variables d'environnements

Vous pouvez modifier certains paramètres de SendOverNetwork grâce aux variables d'environnements suivants :

| Nom                                  | Utilité                                                                           | Valeur acceptée               |
|--------------------------------------|-----------------------------------------------------------------------------------|-------------------------------|
| `SON_SILENT_OUTPUT`                  | Désactive l'affichage de certains textes dans le terminal                         | N'importe                     |
| `SON_DISABLE_NOTIFICATIONS`          | Désactive les notifications système lors du téléchargement d'un fichier           | N'importe                     |
| `SON_DEFAULT_DOWNLOAD_PATH`          | Modifie le chemin par défaut utilisé pour télécharger un fichier                  | Chemin d'un dossier           |
| `SON_DEFAULT_PORT`                   | Modifie le port par défaut du serveur web utilisé lors de l'upload d'un fichier   | Port                          |
| `SON_ON_CONFLICT`                    | Action à effectuer automatiquement lorsqu'on télécharge un fichier déjà existant  | `replace`, `rename`, `ignore` |
| `SON_STOP_UPLOAD_AFTER_DOWNLOAD`     | Arrête l'envoi après qu'il soit téléchargé au moins une fois                      | N'importe                     |
| `SON_IGNORE_SSH_CONFIG`              | Ignore les appareils présents dans la config SSH lors de la détection automatique | N'importe                     |
| `SON_DISABLE_AUTO_WRITE_CLIPBOARD`   | Désactive le fait de copier du texte dans le presse-papier lors d'un envoi        | N'importe                     |
| `SON_SHOW_PUBLIC_IP`                 | Affiche l'IP publique au lieu de l'IP locale                                      | N'importe                     |
| `SON_ONLY_COPY_IP`                   | Ne copie que l'IP au lieu de la commande entière lors de l'envoi d'un fichier     | N'importe                     |
| `SON_ALWAYS_IGNORE_SOME_FOLDERS`     | Ignorer les dossiers `.git` et `node_modules` lors d'un envoi de fichiers         | N'importe                     |
| `SON_DISABLE_PROMPT`                 | Empêche l'affichage de prompt (le CLI propose un choix à remplir avec le clavier) | N'importe                     |
| `SON_DISABLE_SPINNERS`               | Empêche l'affichage d'icône/animations de chargement dans le terminal             | N'importe                     |

> Les variables contenant "N'importe" comme valeur acceptée peuvent être activé en définissant une valeur (n'importe laquelle), ou désactivé (ne pas définir de valeur).


## Similaire

* [Snapdrop](https://snapdrop.net/) - permet de s'échanger des fichiers depuis un navigateur web
* [HiberCLI](https://github.com/johan-perso/hibercli) - télécharge et envoi des fichiers sur HiberFile, en passant par un serveur

## Licence

MIT © [Johan](https://johanstick.me)
