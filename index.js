#!/usr/bin/env node

// Lazy Load Modules
var _require = require;
var require = function (moduleName){
    var module;
    return new Proxy(function (){
        if(!module){
            module = _require(moduleName)
        }
        return module.apply(this, arguments)
    }, {
        get: function (target, name){
            if(!module){
                module = _require(moduleName)
            }
            return module[name];
        }
    })
};

// Importer quelques librairies
const inquirer = require('inquirer');
const updateNotifier = require('update-notifier');
const fs = require('fs');
const path = require('path');
const os = require('os');
const notifier = require('node-notifier');
const fetch = require('node-fetch');
const boxen = require('boxen');
const find = require('local-devices');
const ora = require('ora'); var spinner = ora('');
const pkg = require('./package.json')

// Fonction pour obtenir les fichiers/dossiers dans un dossier
var walkI = 0
var shouldAskIgnoreFolder = false
async function walk(dir){
	if(walkI > 10000 && walkI != "stop"){
		console.log("Note : le dossier contient beaucoup de fichiers, la préparation prendra plus de temps que prévu !")
		walkI = "stop"
	}
	else walkI++
	var results = []
	var list = fs.readdirSync(dir)
	for(var i = 0; i < list.length; i++){
		file = path.join(dir, list[i])
		var stat = fs.statSync(file)
		var isDirectory = stat && stat.isDirectory()
		if(isDirectory && !shouldAskIgnoreFolder && (path.basename(file) == 'node_modules' || path.basename(file) == '.git')){
			if(!process.env.SON_DISABLE_SPINNERS) spinner.stop()
			var action = await askIgnoreFolder(file)
			if(action == 'ignore'){
				if(!process.env.SON_DISABLE_SPINNERS) spinner.start()
				continue
			}
			if(action == 'send-all') shouldAskIgnoreFolder = true
		}
		if(isDirectory){
			results.push({ type: 'dir', path: file })
			results = results.concat(await walk(file))
		} else {
			results.push(file)
		}
	}

	return results
}

// Fonction pour empêcher d'aller en arrière dans le chemin
function preventBackwardPath(filePath){
	var pathArray = path.parse(filePath).dir.split(path.sep)
	pathArray = pathArray.filter(path => path != '..')
	return path.join(...pathArray, path.parse(filePath).base)
}

// Fonction pour demander si on souhaite remplacer un fichier, le renommer, ou l'ignorer
async function askReplaceFile(filePath){
	// Si on a défini une variable d'environnement pour l'action à faire, on retourne directement cette action
	if(process.env.SON_ON_CONFLICT == 'replace') return 'replace-all'
	if(process.env.SON_ON_CONFLICT == 'rename') return 'rename-all'
	if(process.env.SON_ON_CONFLICT == 'ignore') return 'ignore-all'
	if(process.env.SON_DISABLE_PROMPT) return 'replace-all' // si on refuse d'afficher les prompt, on écrasera les fichiers

	var { action } = await inquirer.prompt([{
		type: 'list',
		name: 'action',
		message: `Le fichier "${chalk.blue(filePath)}" existe déjà, que souhaitez-vous faire ?`,
		choices: [
			{ name: 'Écraser le fichier existant', value: 'replace' },
			{ name: 'Enregistrer sous un autre nom', value: 'rename' },
			{ name: 'Ne pas télécharger', value: 'ignore' },
			new inquirer.Separator(),
			{ name: 'Tout écraser', value: 'replace-all' },
			{ name: 'Tout enregistrer sous un autre nom', value: 'rename-all' },
			{ name: 'Ne pas télécharger les fichiers déjà existants', value: 'ignore-all' },
		]
	}])

	return action
}

// Fonction pour demander si on souhaite ignorer l'envoi d'un dossier
async function askIgnoreFolder(filePath){
	if(process.env.SON_ALWAYS_IGNORE_SOME_FOLDERS) return 'ignore' // si on envoie jamais certains dossiers, on retourne directement 'ignore'
	if(process.env.SON_DISABLE_PROMPT) return 'send' // si on refuse d'afficher les prompt, on retourne directement 'send'

	var { action } = await inquirer.prompt([{
		type: 'list',
		name: 'action',
		message: `Êtes-vous sûr d'envoyer "${chalk.blue(filePath)}" ?`,
		choices: [
			{ name: 'Envoyer quand même', value: 'send' },
			{ name: 'Tout envoyer', value: 'send-all' },
			{ name: 'Ignorer ce dossier', value: 'ignore' },
		]
	}])

	return action
}

// Parser les arguments (HAHAHA j'me rends compte le code est horrible eh c'est la faute à copilot)
	// Variable qui contient les arguments par défaut, et ceux parsés
	var defaultArgs = process.argv.slice(2)
	var args = {}

	// Vérifier si l'argument --silent est présent
	if(defaultArgs.includes('--silent') || defaultArgs.includes('-s')) process.env.SON_SILENT_OUTPUT = true

	// Vérifier si l'argument --disable-notifications est présent
	if(defaultArgs.includes('--disable-notifications') || defaultArgs.includes('-dn')) process.env.SON_DISABLE_NOTIFICATIONS = true

	// Vérifier si l'argument --disable-spinners est présent
	if(defaultArgs.includes('--disable-spinners') || defaultArgs.includes('-ds')) process.env.SON_DISABLE_SPINNERS = true
	// Gérer les couleurs en fonction de si les spinners sont activés ou non
	if(process.env.SON_DISABLE_SPINNERS) chalk = {
		red: (text) => text,
		green: (text) => text,
		blue: (text) => text,
		cyan: (text) => text,
		gray: (text) => text,
		dim: (text) => text,
		reset: (text) => text
	}
	else var chalk = require('chalk')

	// Vérifier si l'argument --version est présent
	if(defaultArgs.includes('version') || defaultArgs.includes('v') || defaultArgs.includes('--version') || defaultArgs.includes('-v')) return showVersion()

	// Vérifier si l'argument --help est présent
	if(defaultArgs.includes('help') || defaultArgs.includes('h') || defaultArgs.includes('--help') || defaultArgs.includes('-h')) return showHelp()

	// Vérifier si l'argument --port est présent
	if(defaultArgs.includes('--port') || defaultArgs.includes('-p')){
		var value = defaultArgs[defaultArgs.indexOf('--port') == -1 ? defaultArgs.indexOf('-p') + 1 : defaultArgs.indexOf('--port') + 1]
		if(value && isNaN(value)) return console.error(chalk.red("Le port doit être un nombre !"))
		args['port'] = value
	}

	// Vérifier si l'argument --dest est présent
	if(defaultArgs.includes('--dest') || defaultArgs.includes('-f')){
		var value = defaultArgs[defaultArgs.indexOf('--dest') == -1 ? defaultArgs.indexOf('-f') + 1 : defaultArgs.indexOf('--dest') + 1]
		args['dest'] = value
	}

	// Vérifier si la sous commande upload est présente
	if(defaultArgs.includes('u') || defaultArgs.includes('upload') || defaultArgs.includes('--upload') || defaultArgs.includes('-u')){
		var index = defaultArgs.findIndex(arg => arg === '-u' || arg === '--upload' || arg === 'u' || arg === 'upload');
		var output = []
		if(index != -1) for (let i = index + 1; i < defaultArgs.length; i++){
			if(!defaultArgs[i].startsWith('-')) output.push(defaultArgs[i].endsWith('"') ? defaultArgs[i].substring(0, defaultArgs[i].length - 1) : defaultArgs[i]); else break
		}
		upload(output, args?.port)
	}

	// Vérifier si la sous commande download est présente
	if(defaultArgs.includes('fetchips') || defaultArgs.includes('--fetchips')){
		scanNetwork().then(ips => { console.log(JSON.stringify(ips)) }) // le résultat est moche mais.. c'est fait pour être parsé par un autre programme (dans le but d'automatiser des transferts par exemple)
	}

	// Vérifier si la sous commande download est présente
	if(defaultArgs.includes('d') || defaultArgs.includes('download') || defaultArgs.includes('--download') || defaultArgs.includes('-d')){
		var value = defaultArgs[defaultArgs.findIndex(arg => arg === '-d' || arg === '--download' || arg === 'd' || arg === 'download') + 1]
		downloadFile(value, args?.dest)
	}

	// S'il y a aucune sous commande, afficher l'interface
	if(!defaultArgs.includes('u') && !defaultArgs.includes('upload') && !defaultArgs.includes('--upload') && !defaultArgs.includes('-u') && !defaultArgs.includes('d') && !defaultArgs.includes('download') && !defaultArgs.includes('--download') && !defaultArgs.includes('-d') && !defaultArgs.includes('--fetchips') && !defaultArgs.includes('fetchips')) showTUI()

// Afficher la page d'aide
function showHelp(){
	return console.log(`
 Utilisation
   $ sendovernetwork
   ${chalk.dim('(ou alors "son")')}

 Sous commandes (obligatoires)
   help       h              Affiche cette page d'aide
   version    v              Indique la version actuellement utilisée
   download   d              Télécharge un ou des fichiers/dossiers sur votre appareil
   upload     u              Permet d'upload un ou des fichiers/dossiers
   fetchips                  Affiche la liste des IPs locales qui ont un transfert actif 

 Options (facultatives)
   --silent  -s              Masque certains messages peu utiles dans le terminal
   --port    -p              Change le port sur lequel le serveur est lancé (upload)
   --dest    -f              Modifier le dossier de destination (download)
   --disable-notifications   Désactive les notifications sur Windows et macOS
   --disable-spinners        Empêche l'affichage d'animation de chargement dans le terminal

 Télécharger un fichier
   $ sendovernetwork download http://192.168.1.52:3410

 Envoyer un fichier
   $ sendovernetwork upload stickman.png

 Envoyer des fichiers
   $ sendovernetwork upload homeworks.png jesuis.pdf

 Afficher l'assistant (interface via le terminal)
   $ sendovernetwork
`)
}

// Afficher la version
function showVersion(){
	if(!process.env.SON_SILENT_OUTPUT){
		console.log("SendOverNetwork utilise actuellement la version " + chalk.cyan(require('./package.json').version))
		console.log("────────────────────────────────────────────")
		console.log("Développé par Johan le stickman")
		console.log(chalk.cyan("https://johanstick.me"))
	} else console.log(require('./package.json').version)
	process.exit()
}

// Vérifier les mises à jour
const notifierUpdate = updateNotifier({ pkg, updateCheckInterval: 10 })
if(!process.env.SON_SILENT_OUTPUT && notifierUpdate.update && pkg.version != notifierUpdate.update.latest){
	// Afficher un message
	console.log(boxen("Mise à jour disponible " + chalk.dim(pkg.version) + chalk.reset(" → ") + chalk.green(notifierUpdate.update.latest) + "\n" + chalk.cyan("npm i -g " + pkg.name) + " pour mettre à jour", {
		padding: 1,
		margin: 1,
		align: 'center',
		borderColor: 'yellow',
		borderStyle: 'round'
	}))

	// Mettre une "notification" (bell)
	console.log('\u0007')
}

// Fonction pour afficher une notification
async function showNotification(title, message){
	// Si les notifications sont désactivées, ou qu'on est ni sur Windows ni sur macOS
	if(process.env.SON_DISABLE_NOTIFICATIONS) return false
	if(os.platform() != "win32" && os.platform() != "darwin") return false

	// Afficher une notification
	notifier.notify({
		title: title,
		message: message,
		sound: false,
		icon: "Terminal",
		contentImage: "Terminal",
		wait: false,
		install: false
	})

	// Mettre une "notification" (bell)
	if(!process.env.SON_SILENT_OUTPUT) console.log('\u0007')

	// Retourner true
	return true
}

// Si aucun arguments ou sous commande, passer en mode TUI
function showTUI(){
	// Demander si on veut télécharger ou uploader
	async function main(){
		var { mode } = await inquirer.prompt([
			{
				type: 'list',
				name: 'mode',
				message: 'Que voulez-vous faire ?',
				choices: ['Télécharger', 'Uploader'],
				default: 'Télécharger'
			}
		])
		if(mode == 'Télécharger') ask_download()
		if(mode == 'Uploader') ask_upload()
	}; main()

	// Si on veut télécharger
	async function ask_download(){
		// Demander le lien de téléchargement
		var { link } = await inquirer.prompt([
			{
				type: 'text',
				name: 'link',
				message: 'Lien de téléchargement (laisser vide pour la détection automatique) :'
			}
		])

		// Si on veut la détection automatique
		if(!link){
			var ips = await scanNetwork()
			if(!ips?.length) return console.error(chalk.red("Impossible de trouver un appareil exécutant SendOverNetwork sur votre réseau local."))
			if(ips.length == 1) link = ips[0]?.ip
			else {
				var { ip } = await inquirer.prompt([
					{
						type: 'list',
						name: 'ip',
						message: 'Sur quel appareil voulez-vous télécharger ?',
						choices: ips.map(ip => { return { name: `${ip.name} (${ip.ip})`, value: ip.ip } })
					}
				])
				link = ip
			}
		}

		// Télécharger le fichier
		downloadFile(link)
	}

	// Si on veut upload
	async function ask_upload(){
		var { files } = await inquirer.prompt([
			{
				type: 'input',
				name: 'files',
				message: 'Chemin du fichier (séparés par une virgule pour plusieurs fichiers) :',
				validate: function(value){
					if(!value) return 'Veuillez entrer un chemin valide'
					return true
				}
			}
		])
		upload(files.split(',').map(f => path.resolve(f.trim())))
	}
}

// Fonction pour télécharger un fichier
async function downloadFile(link, wherePath){
	// Définir le chemin du fichier
	wherePath = wherePath || process.env.SON_DEFAULT_DOWNLOAD_PATH || path.join(process.cwd()) || path.join(require('os').homedir()) || '.'

	// Importer des librairies
	const hr = require('@tsmx/human-readable');
	const os = require('os')

	// Si le lien n'est pas fourni, afficher une erreur
	if(!link){
		console.error(`Aucun lien n'est donné. Exemple : "${chalk.blue('sendovernetwork download http://192.168.1.52:3410')}"`)
		process.exit()
	}

	// Si le lien ne commence pas par http:// ou https://
	if(!link.startsWith('http://') && !link.startsWith('https://')) link = 'http://' + link

	// Si le lien se termine par un slash, l'enlever
	if(link?.toString()?.endsWith('/')) link = link?.slice(0, -1)

	// Si le lien est mal formé, afficher une erreur
	if(!link?.toString()?.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()!@:%_\+.~#?&\/\/=]*)/)){
		console.error(`Le lien n'est pas valide. Exemple : "${chalk.blue('sendovernetwork download http://192.168.1.52:3410')}"`)
		process.exit()
	}

	// Afficher un spinner
	if(process.env.SON_DISABLE_SPINNERS) console.log("CONNECT-STATUS_Connexion à l'appareil..")
	else {
		spinner.text = "Connexion à l'appareil.."
		spinner.start()
	}

	// Importer et se connecter au socket
	const io = require("socket.io-client")
	var socket = io(`${link}/socket`, { parser: require("socket.io-msgpack-parser"), reconnection: false, extraHeaders: {
		'whoami': JSON.stringify({
			'user': os.userInfo().username,
			'os': os.platform().replace('darwin','macOS').replace('linux','Linux').replace('android','Android').replace('win32','Windows'),
			'clientVersion': require('./package.json').version,
		})
	} })
	// Si on a pas pu se connecter, on retente 
	socket.on('connect_error', async () => {
		// On tente de se reconnecter
		await new Promise(resolve => setTimeout(resolve, 5000))
		socket.connect()
	})

	// Vérifier au bout de 5 secondes si on est connecté
	var autoRetryConnection = setTimeout(() => {
		if(!socket.connected){
			var seconds = 5
			var interval = setInterval(() => {
				if(socket.connected) return clearInterval(interval)
				seconds++
				if(!process.env.SON_DISABLE_SPINNERS) spinner.text = `Connexion à l'appareil (${seconds} secondes)..`
			}, 1000)
		}
	}, 5000)

	// Vérifier au bout de 60 secondes si on est connecté
	var checkConnectionTimeout = setTimeout(() => {
		if(!socket.connected){
			if(process.env.SON_DISABLE_SPINNERS) console.error("Connexion à l'appareil échouée !")
			else {
				spinner.text = "Connexion à l'appareil échouée !"
				spinner.fail()
			}
			if(!process.env.SON_SILENT_OUTPUT) console.error(`Vous pouvez tenter de vérifier si le port ${chalk.cyan(link.split(':')[2])} est ouvert sur l'appareil, et est ouvert sur votre routeur s'il ne s'agit pas d'une IP locale.`)
			process.exit()
		}
	}, 60000)

	// Une fois connecté au socket, on informe
	socket.on('connect', () => {
		if(process.env.SON_DISABLE_SPINNERS) console.log("CONNECT-STATUS_Connexion à l'appareil établie")
		else {
			spinner.text = "Connexion à l'appareil établie"
			spinner.succeed()
		}
		clearTimeout(autoRetryConnection)
		clearTimeout(checkConnectionTimeout)
	})

	// Si on perd la connexion on l'indique et on arrête le CLI
	socket.on('disconnect', async (reason) => {
		if(reason == "io client disconnect" || reason == "io server disconnect") return; // Si on a déconnecté le socket manuellement (ou le serveur l'a fait manuellement), on ne l'affiche pas
		console.error(chalk.red(`\n\nConnexion à l'appareil perdue${reason ? ` (${reason})` : ''} :\nSi des fichiers étaient en cours de transfert lors de la déconnexion, il est conseillé de les retélécharger puisqu'ils sont sûrement corrompus.`))
		process.exit()
	})

	// Lorsqu'on reçoit un tronçon de fichier, ou qu'on reçoit la liste des fichiers
	var filesList
	socket.on('file', async (content, callback) => {
		// Mettre dans le cache la liste des fichiers
		if(!filesList && content?.state == 'before'){
			filesList = content.filesList
			filesList = filesList.map(file => {
				file.relativePath = preventBackwardPath(file.relativePath)
				return file
			})
		}

		// Au moment où on obtient la liste des fichiers, on crée les dossiers et fichiers vides, puis on dit que l'on est prêt au téléchargement
		if(content?.state == 'before'){
			// Si on a des fichiers déjà existants, on demande à l'utilisateur ce qu'il veut faire
			var globalAction
			for(var i = 0; i < filesList.length; i++){
				if(filesList[i].type != "dir" && fs.existsSync(path.join(wherePath, filesList[i].relativePath))){
					// On demande ce qu'il veut faire
					if(!globalAction && !process.env.SON_REPLACE_WITHOUT_ASKING) var action = await askReplaceFile(path.relative(process.cwd(), path.join(wherePath, filesList[i].relativePath)))
					else if(!globalAction) var globalAction = 'replace-all'

					// Si l'action qu'on a choisi s'applique à tous les fichiers
					if(action == 'ignore-all' || action == 'replace-all' || action == 'rename-all') globalAction = action

					// Action qui ne s'effectue qu'à ce fichier
					if(globalAction == 'ignore-all' || action == 'ignore') filesList[i] = null
					if(globalAction == 'rename-all' || action == 'rename'){
						// Ajouter un nombre au début du fichier
						var fileName = path.basename(filesList[i].relativePath)
						var randomNumber = Math.floor(Math.random() * 100)
						filesList[i].savePath = path.join(path.dirname(filesList[i].relativePath), `${randomNumber}_${fileName}`)
						filesList[i].name = `${randomNumber}_${fileName}`
					}
				}
			}
			filesList = filesList.filter(file => file != null)

			// Créer les dossiers et fichiers de 0 octets (vide)
			if(process.env.SON_DISABLE_SPINNERS) console.log("FILE-PREPARE_Préparation des fichiers..")
			else {
				spinner.text = 'Préparation des fichiers..'
				spinner.start()
			}
			for(var i = 0; i < filesList.length; i++){
				if(!filesList[i].savePath) filesList[i].savePath = filesList[i].relativePath

				if(filesList[i].type == 'dir' && !fs.existsSync(path.join(wherePath, filesList[i].savePath))){
					fs.mkdirSync(path.join(wherePath, filesList[i].savePath), { recursive: true })
				}
				if(!fs.existsSync(path.join(wherePath, path.dirname(filesList[i].savePath)))){
					fs.mkdirSync(path.join(wherePath, path.dirname(filesList[i].savePath)), { recursive: true })
				}

				if(filesList[i].type != 'dir' && filesList[i].size == 0 && !fs.existsSync(path.join(wherePath, filesList[i].savePath))) fs.writeFileSync(path.join(wherePath, filesList[i].savePath), '')
			}
			if(process.env.SON_DISABLE_SPINNERS) console.log(`FILE-PREPARE_Préparation des ${filesList.length} éléments terminés`)
			else if(filesList.length > 2){
				spinner.text = `Préparation des ${filesList.length} éléments terminés`
				spinner.succeed()
			}

			// Si on a plus rien à télécharger, on arrête
			if(!filesList.filter(a => a.type != 'dir').length){
				if(process.env.SON_DISABLE_SPINNERS) console.error("Aucun fichier n'a été téléchargé ! Ils ont déjà été téléchargés, ou l'envoyeur n'a envoyé aucun fichier.")
				else {
					spinner.text = "Aucun fichier n'a été téléchargé ! Ils ont déjà été téléchargés, ou l'envoyeur n'a envoyé aucun fichier."
					spinner.succeed()
				}
				socket.disconnect()
			}

			// Envoyer au socket qu'on est prêt, et qu'on veut recevoir les fichiers
			else socket.emit('ready')
		}

		// Écrire dans le stream de fichier
		if(typeof content?.data == 'string' && content?.state == 'up'){
			// Obtenir les informations du fichier à partir de ceux dans le cache
			var file = filesList.find(file => file.relativePath == preventBackwardPath(content.relativePath))

			// Si on a pas trouvé le fichier, on ne fait rien
			if(!file) return callback('ignore')

			// Modifier le spinner
			file.downloadedSize = (file.downloadedSize || 0) + content?.data?.length
			if(process.env.SON_DISABLE_SPINNERS){
				console.log(JSON.stringify({
					type: 'downloadProgress',
					path: file?.savePath,
					downloadedSize: file?.downloadedSize,
					size: file?.size,
					downloaded: `${hr.fromBytes(file?.downloadedSize)}/${hr.fromBytes(file?.size)}`,
					percent: (file.downloadedSize/file.size*100).toFixed(2),
					remain: filesList.filter(a => a.type != 'dir').length - filesList.filter(a => a.type != 'dir' && a.downloadedSize == a.size).length
				}))
			} else {
				spinner.text = `Téléchargement de "${chalk.blue(file?.savePath)}" (${hr.fromBytes(file?.downloadedSize)}/${hr.fromBytes(file?.size)}, ${(file?.downloadedSize/file?.size*100).toFixed(2)}%)`
				if(!spinner.isSpinning) spinner.start()
			}

			// Ecrire dans le stream, ou en créer un et écrire dedans
			if(file.writeStream) await file.writeStream.write(content.data)
			else {
				file.writeStream = fs.createWriteStream(path.join(wherePath, file.savePath), { flags: 'w', encoding: 'binary' })
				await file.writeStream.write(content.data)
			}

			// Renvoyer au serveur qu'on a reçu le tronçon
			callback('ok')
		}

		// Si le transfert d'fichier est fini, on ferme son stream associé
		if(content?.state == 'finished' && content?.relativePath){
			// Obtenir le fichier, puis fermer son stream
			var file = filesList.find(file => file.relativePath == preventBackwardPath(content.relativePath))
			if(file?.writeStream) file.writeStream.end()

			// Si on a pas trouvé le fichier, on ne fait rien
			if(!file) return

			// Modifier le spinner
			if(!process.env.SON_DISABLE_SPINNERS){
				spinner.text = `Téléchargement de "${chalk.blue(file?.savePath)}"`
				spinner.succeed()
			}

			// Renvoyer au serveur qu'on a reçu l'info
			callback('ok')
		}

		// Si TOUT les transferts sont fini, on déconnecte le socket
		if(content?.state == 'finished' && !content?.relativePath){
			socket.disconnect()
			showNotification('SendOverNetwork', 'Fichier téléchargé avec succès')
			setTimeout(() => process.exit(0), 2000) // fermer de force au bout de 2 secondes
		}
	})

	// En cas d'erreurs
	socket.on('error', (error) => {
		if(error == 'Un appareil est déjà connecté.'){
			if(process.env.SON_DISABLE_SPINNERS) console.error("Un transfert est déjà en cours sur l'appareil cible. Veuillez attendre qu'il soit terminé, ou l'annuler depuis l'appareil cible.")
			else {
				spinner.text = "Un transfert est déjà en cours sur l'appareil cible. Veuillez attendre qu'il soit terminé, ou l'annuler depuis l'appareil cible."
				spinner.fail()
			}
		} else console.error("Erreur socket : ", error)
	})
}

// Fonction pour uploader un fichier
async function upload(filesList, port){
	// Préparer une copie des fichiers à upload (au cas où, pour plus tard)
	var _filesList = filesList

	// Afficher un spinner
	if(process.env.SON_DISABLE_SPINNERS) console.log('GLOBAL_Préparation..')
	else {
		spinner.text = 'Préparation..'
		spinner.start()
	}

	// Vérifier le port
	if(!port && process.env.SON_DEFAULT_PORT) port = process.env.SON_DEFAULT_PORT
	if(!port) port = 3410
	if(!port || port && (port < 0 || port > 65535)){
		if(!process.env.SON_DISABLE_SPINNERS) spinner.stop()
		console.error(chalk.red("Le port doit être un nombre compris entre 0 et 65535 !"))
		process.exit(1)
	}

	// Obtenir les fichiers/dossiers à upload
		// Si aucun chemin n'a été donné
		if(!filesList?.length){
			if(!process.env.SON_DISABLE_SPINNERS) spinner.stop()
			console.error(`Aucun fichier n'est donné. Exemple : "${chalk.blue('sendovernetwork upload stickman.png')}"`)
			process.exit(1)
		}

		// Vérifier que tout les fichiers existent
		for(var i = 0; i < filesList.length; i++){
			try { fs.realpathSync(filesList[i]) }
			catch(err){
				if(!process.env.SON_DISABLE_SPINNERS) spinner.stop()
				console.error(`Le fichier "${chalk.blue(filesList[i])}" est introuvable. Exemple : "${chalk.blue('sendovernetwork upload stickman.png')}"`)
				process.exit(1)
			}
		}

	// Supprimer les chemins en doubles
	filesList = [...new Set(filesList)]

	// Importer des librairies
	const hr = require('@tsmx/human-readable')
	const os = require('os')

	// Importer quelques autres librairies liés au serveur web
	const http = require('http')
	const server = http.createServer()
	const { Server } = require("socket.io")
	const io = new Server(server, {
		serveClient: false,
		httpCompression: false,
		parser: require("socket.io-msgpack-parser")
	})

	// Modifier l'état du spinner, puis ajouter tout les fichiers qui sont présents dans les dossiers
	if(process.env.SON_DISABLE_SPINNERS) console.log('FILE-PREPARE_Analyse des fichiers..')
	else {
		spinner.text = 'Analyse des fichiers..'
		spinner.start()
	}
	await new Promise(resolve => setTimeout(resolve, 1)) // attendre vite fait pour le spinner puisse se modifier
	for(var i = 0; i < filesList.length; i++){
		if(filesList[i]?.path) continue // si c'est un élément qu'on a rajouté dans la même fonction, on l'ignore (il sera traité plus tard)

		if(fs.lstatSync(filesList[i]).isDirectory()){
			// Remplacer le chemin du dossier par un objet dans l'array
			filesList[filesList.indexOf(filesList[i])] = { path: filesList[i], type: 'dir' }

			// Obtenir les fichiers du dossier
			var files = await walk(filesList[i]?.path)

			// Ajouter les fichiers du dossier à la liste
			files.forEach(file => {
				filesList.push({ path: file?.path || file, type: file?.type || 'file' })
			})
		}
	}

	// Ajouter les informations sur chaque fichiers, au lieu de seulement leur chemins
	var basePath
	for(var i = 0; i < filesList.length; i++){
		// S'il n'y a pas de type (= c'est un fichier, à l'extérieure d'un dossier), le chemin relatif par défaut sera celui de ce fichier
		if(!basePath && !filesList[i]?.type) basePath = path.dirname(filesList[i])

		// Ajouter les informations
		filesList[i] = {
			path: filesList[i]?.path || filesList[i],
			relativePath: path.relative(basePath || '.', filesList[i]?.path || filesList[i]),
			name: path.basename(filesList[i]?.path || filesList[i]),
			size: (fs.statSync(filesList[i]?.path || filesList[i])).size,
			type: filesList[i]?.type || 'file'
		}
	}

	// Afficher le nombre de fichiers trouvés
	if(process.env.SON_DISABLE_SPINNERS) console.log(`FILE-PREPARE_${filesList.length} fichiers ont été trouvés.`)
	else if(filesList.length > 5){
		spinner.text = `${filesList.length} fichiers ont été trouvés.`
		spinner.succeed()
	} else spinner.stop()

	// Fonction pour envoyer un fichier
	async function sendFile(file, socket){
		var sendFilePromise = new Promise(async (resolve, reject) => {
			// Afficher un spinner
			if(!process.env.SON_DISABLE_SPINNERS){
				spinner.text = `Envoi de "${chalk.blue(file?.relativePath)}..`
				spinner.start()
			}

			// Créer un stream de fichier
			socket.packetSending = 0 // on prépare pour plus tard
			socket.packetSended = 0 // on prépare pour plus tard
			fileContentStream = fs.createReadStream(file?.path, { encoding: 'binary', highWaterMark: 6e6 /* gère la taille des tronçons, une valeur trop haute peut tuer le socket du client */ })

			// Si le stream a une erreur
			fileContentStream.on('error', (err) => {
				console.error(`Envoi de "${chalk.blue(file?.relativePath)} : ${err.message || err.toString() || err}`)
			})

			// Pour chaque tronçon de fichier obtenu, l'envoyer via le socket
			fileContentStream.on('data', async (chunk) => {
				// Log
				file.uploadedSize = (file.uploadedSize || 0) + chunk?.length
				if(process.env.SON_DISABLE_SPINNERS){
					console.log(JSON.stringify({
						type: 'uploadProgress',
						path: file?.relativePath,
						uploadedSize: file?.uploadedSize,
						size: file?.size,
						uploaded: `${hr.fromBytes(file.uploadedSize)}${file.uploadedSize > file?.size ? '' : '/'+ hr.fromBytes(file?.size)}`,
						remain: filesList.filter(a => a.type != 'dir').length - filesList.filter(a => a.type != 'dir' && a.uploadedSize == a.size).length
					}))
				} else spinner.text = `"${chalk.blue(file?.relativePath)}"  : ${hr.fromBytes(file.uploadedSize)}${file.uploadedSize > file?.size ? '' : '/'+ hr.fromBytes(file?.size)}`

				// Si on est pas censé continuer l'envoi du fichier
				if(file.stopped) return

				// Ajouter un packet en cours d'envoi
				socket.packetSending++

				// Attendre qu'un certain nombre de packet soit envoyé
				if(socket.packetSending - 2 > socket.packetSended){
					if(!process.env.SON_DISABLE_SPINNERS) spinner.text = `${spinner.text} | En attente de ${socket.packetSending - socket.packetSended} packet${socket.packetSending - socket.packetSended > 1 ? 's' : ''} envoyé${socket.packetSending - socket.packetSended > 1 ? 's' : ''}..`
					fileContentStream.pause()
				}

				// Envoyer le fichier via le socket
				socket.emit('file', { state: 'up', relativePath: file?.relativePath, data: chunk }, async (response) => {
					socket.packetSended++ // le packet a été envoyé
					if(response == 'ignore') sendEnd()
					if(socket.packetSending == socket.packetSended && fileContentStream.isPaused()) fileContentStream.resume()
				})
			})

			// Envoyer l'information de fin de fichier
			function sendEnd(){
				if(!file.stopped){
					socket.emit('file', { state: 'finished', relativePath: file?.relativePath }, async (response) => {
						if(!process.env.SON_DISABLE_SPINNERS){
							spinner.text = `Envoi de "${chalk.blue(file?.relativePath)}"`
							spinner.succeed()
						}

						// Resolve si le fileContentStream est fini
						if(fileContentStream?.readableEnded) resolve()
					})
				}
				file.stopped = true
			}
			fileContentStream.on('end', () => { sendEnd() })
		})
		await sendFilePromise
		return true
	}

	// Quand on reçoit une connexion sur le socket
	var isClientConnected = false
	io.of('/socket').on('connection', socket => {
		// Si un client est déjà connecté
		if(isClientConnected){
			socket.emit('error', 'Un appareil est déjà connecté.' )
			return socket.disconnect()
		} else isClientConnected = true

		// Obtenir les informations sur le client
		var clientInfo = socket.handshake.headers['whoami']
		if(clientInfo) try {
			clientInfo = JSON.parse(clientInfo)
		} catch(err){}

		// Informer de la nouvelle connexion au socket
		if(!process.env.SON_SILENT_OUTPUT) console.log('')
		if(process.env.SON_DISABLE_SPINNERS) console.log(`SERVER-STATUS_Un appareil s'est connecté${clientInfo?.user && clientInfo?.os ? chalk.gray(` (${clientInfo?.user}@${clientInfo?.os})`) : ''}, en attente de l'envoi des fichiers..`)
		else {
			spinner.text = `Un appareil s'est connecté${clientInfo?.user && clientInfo?.os ? chalk.gray(` (${clientInfo?.user}@${clientInfo?.os})`) : ''}, en attente de l'envoi des fichiers..`
			spinner.start()
		}

		// Obtenir et envoyer les informations basique des fichier, sans le "path"
		socket.emit('file', { state: 'before', filesList: filesList.map(file => { return { ...file, path: '', type : file.type == 'file' ? '' : file.type } }) })

		// Quand le client est prêt à recevoir le fichier, envoyer tout les fichiers
		socket.on('ready', async () => {
			// Modifier l'état du spinner
			if(!process.env.SON_DISABLE_SPINNERS) spinner.stop()

			// Envoyer tout les fichiers
			for(var i = 0; i < filesList.length; i++){
				// Si c'est un dossier ou un fichier de 0 octet, on envoie rien
				if(filesList[i]?.type != 'dir' && filesList[i]?.size != 0){
					// Si le socket est déconnecté, on alerte
					if(!socket.connected && process.env.SON_DISABLE_SPINNERS) console.log(`SERVER-STATUS_Un appareil s'est déconnecté${clientInfo?.user && clientInfo?.os ? chalk.gray(` (${clientInfo?.user}@${clientInfo?.os})`) : ''}, le transfert a été interrompu.`)
					else if(!socket.connected){
						spinner.text = `Un appareil s'est déconnecté${clientInfo?.user && clientInfo?.os ? chalk.gray(` (${clientInfo?.user}@${clientInfo?.os})`) : ''}, le transfert a été interrompu.`
						spinner.fail()
					}

					// Si le fichier a été stoppé (a cause de l'envoi précédant)
					if(filesList[i].stopped) filesList[i].stopped = false
					if(filesList[i].uploadedSize) filesList[i].uploadedSize = null

					// Envoyer le fichier
					await sendFile(filesList[i], socket)
				}

				// Si c'était le dernier fichier de la liste
				if(i == filesList.length - 1){
					if(!process.env.SON_DISABLE_SPINNERS){
						spinner.text = `${clientInfo?.user && clientInfo?.os ? chalk.gray(`(${clientInfo?.user}@${clientInfo?.os}) `) : ''}Tous les fichiers ont été envoyés !`
						spinner.succeed()
					}
					socket.emit('file', { state: 'finished' })
					socket.disconnect()
					if(process.env.SON_STOP_UPLOAD_AFTER_DOWNLOAD){
						io.disconnectSockets()
						io.close()
						server.close()
					}
					showNotification('SendOverNetwork', 'Fichier envoyé avec succès')
				}
			}
		})

		// Quand le socket est déconnecté
		socket.on('disconnect', () => {
			isClientConnected = false
		})
	})

	// Quand on reçoit une requête sur le serveur
	server.on('request', (req, res) => {
		// Si on fait une requête vers /check
		if(req.url == '/check'){
			res.writeHead(200, { 'Content-Type': 'text/plain' })
			res.end(`sendovernetwork v${require('./package.json').version} | ${os.hostname()}`)
		}

		// Pour les autres requêtes
		else if(!req.url.startsWith('/socket')){
			res.writeHead(302, { 'Location': 'https://github.com/johan-perso/sendovernetwork' })
			res.end()
		}
	})

	// Démarrer le serveur web
	server.listen(port || 3410, async () => {
		// Modifier le spinner
		if(process.env.SON_DISABLE_SPINNERS) console.log(`SERVER-STATUS_Fichier prêt à être téléchargé depuis ${chalk.blue(`http://${await getLocalIP()}:${server.address().port}`)}`)
		else {
			spinner.text = `Fichier prêt à être téléchargé depuis ${chalk.blue(`http://${await getLocalIP()}:${server.address().port}`)}`
			spinner.succeed()
		}

		// Mettre dans le presse papier
		if(!process.env.SON_DISABLE_AUTO_WRITE_CLIPBOARD) require('clipboardy').write(`${process.env.SON_ONLY_COPY_IP ? '' : 'sendovernetwork download '}http://${await getLocalIP()}:${server.address().port}`).catch(err => {})

		// Afficher un message
		if(!process.env.SON_SILENT_OUTPUT) console.log(chalk.dim("\nSi vous n'arrivez pas à accéder au lien depuis un autre appareil, tenter de régler votre pare-feu pour autoriser le port"))

		// Dire comment faire pour autoriser le port dans son pare-feu
		if(!process.env.SON_SILENT_OUTPUT && os.platform() == 'linux') console.log(chalk.dim(`Pour autoriser le port ${chalk.blue(server.address().port)}, faite "${chalk.blue('sudo ufw allow ' + server.address().port)}"`))
		if(!process.env.SON_SILENT_OUTPUT && os.platform() == 'darwin') console.log(chalk.dim(`Pour autoriser le port ${chalk.blue(server.address().port)}, faite "${chalk.blue('sudo firewall-cmd --permanent --add-port=' + server.address().port + '/tcp')}"`))
		if(!process.env.SON_SILENT_OUTPUT && os.platform() == 'win32') console.log(chalk.dim(`Pour autoriser le port ${chalk.blue(server.address().port)}, faite "${chalk.blue('netsh advfirewall firewall add rule name="SendOverNetwork" protocol=TCP dir=in localport=' + server.address().port + ' action=allow')}"`))
	})

	// En cas d'erreurs
	server.on('error', (err) => {
		// Si c'est car le port est déjà utilisé
		if(err.code == 'EADDRINUSE' || err.code == 'EACCES'){
			// Modifier le spinner
			if(process.env.SON_DISABLE_SPINNERS) console.log(`SERVER-PORT_Le port ${port || 3410} est déjà utilisé. Nouvelle tentative..`)
			else {
				spinner.text = `Le port ${port || 3410} est déjà utilisé. Nouvelle tentative..`
				spinner.start()
			}

			// Réessayer
			upload(_filesList, (port || 3410) + 10)
		} else {
			// Afficher l'erreur
			if(process.env.SON_DISABLE_SPINNERS) console.error(err?.message || err?.toString() || err)
			else {
				spinner.text = err?.message || err?.toString() || err
				spinner.stop()
			}
		}
	})
}

// Fonction pour obtenir toute les IPs présente dans la config SSH
function getSSHConfigIPs(){
	// Si on a désactivé la fonction
	if(process.env.SON_IGNORE_SSH_CONFIG) return []

	// Obtenir le contenu du fichier
	var sshConfig = fs.readFileSync(path.join(require('os').homedir(), '.ssh', 'config')).toString().trim().split('\n')

	// Filtrer pour n'avoir que les IPs
	var sshConfig = sshConfig.filter(el => el.trim().startsWith('Hostname')).map(hostname => hostname.replace('Hostname ','').trim())

	// Retourner les IPs
	return sshConfig
}

// Fonction pour obtenir son IP local
async function getLocalIP(forceLocal=false){
	// Si on veut l'IP publique et non local
	if(process.env.SON_SHOW_PUBLIC_IP && !forceLocal) var ip = await fetch('http://api.ipify.org/?format=text').then(res => res.text());

	// Obtenir l'IP
	else var ip = require("os")?.networkInterfaces()['Wi-Fi']?.filter(i => i?.family == 'IPv4')[0] || Object.values(require("os").networkInterfaces()).flat().filter(({ family, internal }) => family === "IPv4" && !internal).map(({ address }) => address)[0] || await require('dns').promises.lookup(require('os').hostname());

	// La retourner
	return ip.address || ip || '<votre ip local>';
}

// Fonction pour scanner les IPs sur le réseau
async function scanNetwork(){
	// Afficher un spinner
	if(!process.env.SON_DISABLE_SPINNERS){
		spinner.text = `Recherche d'appareils..`
		spinner.start()
	}

	// Préparer la liste des IPs
	var ips = []

	// Obtenir la liste des appareils connectés au réseau
	var waitGetIps = new Promise(async (resolve, reject) => {
		// Obtenir les IPs de la config SSH, et celles présentes sur le réseau
		var potentialIps = [...getSSHConfigIPs()]
		potentialIps.push(...(await find()).map(device => device.ip))
		potentialIps = potentialIps.filter((ip, i) => potentialIps.indexOf(ip) == i) // supprimer les doublons

		// Si on a pas d'appareils dans la liste
		if(!potentialIps?.length) resolve()

		// Pour chaque IPs potentielles
		if(!process.env.SON_DISABLE_SPINNERS) spinner.text = `Vérification pour SendOverNetwork.. (${potentialIps.length} appareils trouvés)`
		for(var i = 0; i < potentialIps.length; i++){
			var fetched = await fetch(`http://${potentialIps[i]}:3410/check`).then(res => res.text()).catch(err => {return''})
			if(fetched.startsWith('sendovernetwork')) ips.push({ ip: `${potentialIps[i]}:3410`, name: fetched.split(' | ')[1] || fetched.replace('sendovernetwork ','') })
			if(ips.length > 6) resolve() // si on a beaucoup d'IPs, on arrête la recherche
			if(potentialIps.length == i + 1) resolve() // si on a fini de parcourir la liste, on arrête la recherche
		}
	})
	await waitGetIps

	// Arrêter le spinner et retourner les IPs
	if(!process.env.SON_DISABLE_SPINNERS) spinner.stop()
	return ips
}
