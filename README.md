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

* avec des flags, exemple :
```bash
# Envoyer "mon_dessin.png" sur le réseau local avec le port par défaut
$ sendovernetwork --upload --file=mon_dessin.png

# Envoyer "mon_dessin.png" sur le réseau local avec le port 12345
$ sendovernetwork --upload --file=mon_dessin.png --port=12345

# Télécharger un fichier à partir de l'IP locale 192.168.1.52 avec le port par défaut
$ sendovernetwork --download --link=192.168.1.52:3410

# Télécharger un fichier à partir de l'IP locale 192.168.1.52 avec le port 12345
$ sendovernetwork --download --link=192.168.1.52:12345
```

* avec l'interface graphique, exemple :
```bash
$ sendovernetwork
```


## Et en plus

### Alias

La commande `son` peut également être utilisé en tant qu'alias plus court.

### Gestion des dossiers

* Il est possible d'envoyer des dossiers, ceux ci seront automatiqueement converti en fichiers zip
* Il est possible de recevoir des dossiers, ceux ci pourront être décompressé automatiquement

### Via une interface web

Il est possible de voir et télécharger des dossiers en allant sur le lien depuis son navigateur

### Sans internet

SendOverNetwork fonctionne tant que les appareils sont connectés au même réseau local, même si aucune connexion internet n'est disponible.

Cela fonctionne également sans même être connecté à un réseau pour des envois sur le même appareil (exemple : entre Windows et le Windows Subsytem for Linux).

### Possibilité de changer le port

Il est possible de changer le port lors d'un envoi de fichier avec l'argument `--port=<le port>`.

Ou en définissant le port dans les variables d'environnement (`SEND_ON_NETWORK_DEFAULT_PORT`).

### Possibilité de changer la destination des fichiers de téléchargement

Il est possible de changer le chemin de destination des fichiers lors d'un téléchargement avec l'argument `--dest=<chemin de destination>`.

Ou en le définissant dans les variables d'environnement (`SEND_ON_NETWORK_DEFAULT_DOWNLOAD_PATH`).



## Licence

MIT © [Johan](https://johanstickman.com)
