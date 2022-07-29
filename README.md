# SendOverNetwork

SendOverNetwork est un CLI permettant l'envoi et le téléchargement de fichiers sur votre réseau local (même sans connexion internet).


## Prérequis

* [nodejs v15+ et npm](https://nodejs.org/en/) installé sur votre système.
* Un appareil sous Windows, macOS, Linux ou ChromeOS (et un autre pour recevoir le fichier ptdr)


## Installation

```bash
$ (sudo) npm install --global sendovernetwork
```


## Comment utiliser le CLI

SendOverNetwork peut s'utiliser de deux façons :

* avec des arguments, exemple :
```bash
# Envoyer "mon_dessin.png" sur le réseau local avec le port par défaut
$ sendovernetwork --upload mon_dessin.png

# Envoyer "mon_dessin.png" sur le réseau local avec le port 12345
$ sendovernetwork --upload mon_dessin.png --port=12345

# Télécharger un fichier à partir de l'IP locale 192.168.1.52 avec le port par défaut
$ sendovernetwork --download 192.168.1.52:3410

# Télécharger un fichier à partir de l'IP locale 192.168.1.52 avec le port 12345
$ sendovernetwork --download 192.168.1.52:12345
```

* avec l'interface graphique, exemple :
```bash
$ sendovernetwork
```


## Variables d'environnements

Vous pouvez modifier certains paramètres de SendOverNetwork grâce aux variables d'environnements suivantes :

| Nom                                     | Utilité                                                                           | Valeur accepté            |
|-----------------------------------------|-----------------------------------------------------------------------------------|---------------------------|
| `SON_SILENT_OUTPUT`                     | Désactive l'affichage de certains textes                                          | N'importe                 |
| `SON_DISABLE_NOTIFICATIONS`             | Désactive les notifications Windows/macOS lors du téléchargement d'un fichier     | N'importe                 |
| `SON_DEFAULT_DOWNLOAD_PATH` | Modifie le chemin par défaut utilisé pour télécharger un fichier                  | Chemin d'un dossier       |
| `SON_REPLACE_WITHOUT_ASKING`            | Remplace les fichiers sans demandé lorsqu'un conflit est détecté                  | N'importe                 |
| `SON_AUTO_EXTRACT_ZIP`                  | Extrait automatiquement les fichiers ZIP téléchargé                               | N'importe                 |
| `SON_AUTO_USE_TWITTERMINAL_SAVE`        | Importe les sauvegardes Twitterminal sans demander lorsqu'elles sont téléchargé   | N'importe                 |
| `SON_DEFAULT_PORT`          | Modifie le port par défaut du serveur web utilisé lors de l'upload d'un fichier   | Port                      |
| `SON_STOP_UPLOAD_AFTER_DOWNLOAD`        | Arrête le serveur web après le téléchargement d'un fichier uploadé                | N'importe                 |
| `SON_DISABLE_AUTO_WRITE_CLIPBOARD`      | Désactive le fait de copier du texte dans le presse-papier lors d'un upload       | N'importe                 |
| `SON_SHOW_PUBLIC_IP`                    | Affiche l'IP publique au lieu de l'IP locale                                      | N'importe                 |

> Les variables contenant "N'importe" comme valeur accepté peuvent être activé en définissant une valeur (n'importe laquelle), ou désactivé (ne pas définir de valeur).


## Et en plus

### Alias

La commande `son` peut également être utilisé en tant qu'alias plus court.

### Gestion des dossiers

* Il est possible d'envoyer des dossiers, ceux ci seront automatiquement converti en fichiers zip
* Il est possible de recevoir des dossiers, ceux ci pourront être décompressé automatiquement

### Via une interface web

Il est possible de voir et télécharger des dossiers en allant sur le lien depuis son navigateur

### Sans internet

SendOverNetwork fonctionne tant que les appareils sont connectés au même réseau local, même si aucune connexion internet n'est disponible.

Cela fonctionne également dans d'autres cas, exemple : entre Windows et le Windows Subsystem for Linux.

### Possibilité de changer le port

Il est possible de changer le port lors d'un envoi de fichier avec l'argument `--port=<le port>`.

Ou en définissant le port dans les variables d'environnement (`SON_DEFAULT_PORT`).

### Possibilité de changer la destination des fichiers de téléchargement

Il est possible de changer le chemin de destination des fichiers lors d'un téléchargement avec l'argument `--dest=<chemin de destination>`.

Ou en le définissant dans les variables d'environnement (`SON_DEFAULT_DOWNLOAD_PATH`).

### Autre possibilité

Il est possible d'ajouter certaines variables d'environnement pour modifier les paramètres de SendOverNetwork.

La liste complète se situe [ici](#variables-denvironnements).


## Licence

MIT © [Johan](https://johanstickman.com)
