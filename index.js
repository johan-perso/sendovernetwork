#!/usr/bin/env node

// Lazy Load Modules
var _require = require;
var require = function (moduleName) {
    var module;
    return new Proxy(function () {
        if (!module) {
            module = _require(moduleName)
        }
        return module.apply(this, arguments)
    }, {
        get: function (target, name) {
            if (!module) {
                module = _require(moduleName)
            }
            return module[name];
        }
    })
};

// Importer quelques librairies
const chalk = require('chalk');
const inquirer = require('inquirer');
const updateNotifier = require('update-notifier');
const fs = require('fs');
const path = require('path');
const os = require('os');
const notifier = require('node-notifier');
const fetch = require('node-fetch');
const boxen = require('boxen');
const args = require('args-parser')(process.argv); process.argv = process.argv.filter(a => !a.startsWith('--port=') && !a.startsWith('--dest='))
const ora = require('ora'); var spinner = ora('');
const pkg = require('./package.json')

// Vérifier les mises à jour
const notifierUpdate = updateNotifier({ pkg, updateCheckInterval: 10 });
if(!process.env.SON_SILENT_OUTPUT && notifierUpdate.update && pkg.version !== notifierUpdate.update.latest){
	// Afficher un message
	console.log(boxen("Mise à jour disponible " + chalk.dim(pkg.version) + chalk.reset(" → ") + chalk.green(notifierUpdate.update.latest) + "\n" + chalk.cyan("npm i -g " + pkg.name) + " pour mettre à jour", {
		padding: 1,
		margin: 1,
		align: 'center',
		borderColor: 'yellow',
		borderStyle: 'round'
	}))

	// Mettre une "notification" (bell)
	console.log('\u0007');
}

// Fonction pour afficher une notification
async function showNotification(title, message){
	// Si l'os n'est pas Windows ou macOS, annuler
	if(os.platform() !== "win32" && os.platform() !== "darwin") return;

	// Si les notifications sont désactivées
	if(process.env.SON_DISABLE_NOTIFICATIONS) return false;

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
	if(!process.env.SON_SILENT_OUTPUT) console.log('\u0007');
}

// Si aucun flags, passer en mode GUI
if(!process.argv.slice(2)[0]){
	// Demander si on veut télécharger ou uploader
	async function main(){
		var answers = await inquirer.prompt([
			{
				type: 'list',
				name: 'mode',
				message: 'Que voulez-vous faire ?',
				choices: ['Télécharger', 'Uploader'],
				default: 'Télécharger'
			}
		])
		if(answers.mode == 'Télécharger') ask_download()
		if(answers.mode == 'Uploader') ask_upload()
	}; main()

	// Si on veut télécharger
	async function ask_download(){
		var answers = await inquirer.prompt([
			{
				type: 'text',
				name: 'link',
				message: 'Lien de téléchargement :',
				validate: function(value){
					if(!value) return 'Veuillez entrer un lien valide'
					return true
				}
			}
		])
		console.log('\n')
		downloadFile(answers.link)
	}

	// Si on veut upload
	async function ask_upload(){
		var answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'file',
				message: 'Chemin du fichier :',
				validate: function(value){
					if(!value) return 'Veuillez entrer un chemin valide'
					return true
				}
			}
		])
		upload(answers.file)
	}
}

// Afficher la page d'aide avec l'argument associé
if(['--help','-h','help','h'].includes(process.argv.slice(2)[0])){
	return console.log(`
 Utilisation
   $ sendovernetwork
   ${chalk.dim('(ou alors "son")')}

 Options
   --version -v          Indique la version actuellement utilisé
   --download -d         Télécharge un fichier/dossier sur votre appareil
   --upload -u           Permet d'upload un fichier / un dossier

 Télécharger un fichier
   $ sendovernetwork --download http://192.168.1.52:3410

 Envoyer un fichier
   $ sendovernetwork --upload stickman.png

 Afficher l'interface
   $ sendovernetwork
`)
}

// Donner la version avec l'argument associé
if(['--version','-v','version','v'].includes(process.argv.slice(2)[0])){
	console.log("SendOverNetwork utilise actuellement la version " + chalk.cyan(require('./package.json').version))
	console.log("────────────────────────────────────────────")
	console.log("Développé par Johan le stickman")
	console.log(chalk.cyan("https://johanstick.me"))
	process.exit()
}

// Fonction pour télécharger un fichier
async function downloadFile(link, wherePath){
	// Définir le chemin du fichier
	wherePath = wherePath || process.env.SON_DEFAULT_DOWNLOAD_PATH || path.join(process.cwd()) || path.join(require('os').homedir())

	// Importer des librairies
	const hr = require('@tsmx/human-readable');
	const Downloader = _require('nodejs-file-downloader');
	const os = require('os')

	// Si le lien n'est pas fourni, afficher une erreur
	if(!link){
		console.log(`Aucun lien n'est donné. Exemple : "${chalk.blue('sendovernetwork --download http://192.168.1.52:3410')}"`)
		process.exit(1)
	}

	// Si le lien ne commence pas par http:// ou https://
	if(!link.startsWith('http://') && !link.startsWith('https://')) link = 'http://' + link

	// Si le lien se termine par un slash, l'enlever
	if(link?.toString()?.endsWith('/')) link = link?.slice(0, -1)

	// Si le lien est mal formé, afficher une erreur
	if(!link?.toString()?.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()!@:%_\+.~#?&\/\/=]*)/)){
		console.log(`Le lien n'est pas valide. Exemple : "${chalk.blue('sendovernetwork --download http://192.168.1.52:3410')}"`)
		process.exit(1)
	}

	// Obtenir des infos sur le fichier
		// Faire une requête pour les obtenir
		var file = await fetch(`${link}/info`).then(res => res.json()).catch(err => { return `err_${err}` })

		// En cas d'erreur
		if(file?.toString()?.startsWith('err_')){
			console.log(`Erreur lors de la récupération des informations du fichier : ${file.substring(4)}`)
			process.exit(1)
		}

	// Vérifier si un fichier avec ce nom n'existe pas déjà
	if(fs.existsSync(path.join(wherePath, file.name))){
		if(process.env.SON_REPLACE_WITHOUT_ASKING) fs.unlinkSync(path.join(wherePath, file.name))
		else {
			// Si oui, demander si l'utilisateur veut le remplacer
			var answer = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'replace',
					message: `Un fichier portant le nom "${file.name}" existe déjà. Voulez-vous le remplacer ?`,
					default: false
				}
			])

			// Si l'utilisateur ne veut pas le remplacer, obtenir un nom différent qui n'existe pas déjà
			if(!answer.replace){
				var newName = file.name
				while(fs.existsSync(path.join(wherePath, newName))){
					newName = `${Math.floor(Math.random() * 100)}_${file.name}`
				}
				file.name = newName
			}

			// Si l'utilisateur veut le remplacer, supprimer le fichier
			else fs.unlinkSync(path.join(wherePath, file.name))
		}
	}

	// Préparer un spinner
	console.log(`Téléchargement du fichier "${chalk.blue(file?.name)}" auprès de ${chalk.gray(file?.whoami?.user || 'anonyme')}${chalk.gray(`@${file?.whoami?.desktopName || 'anonyme'}`)} - ${chalk.blue(`${file?.whoami?.os || 'Système inconnu'}`)}\n`)
	spinner.text = `Téléchargement...`
	spinner.start()

	// Préparer le téléchargement
	var downloader = new Downloader({
		url: link,
		directory: wherePath,
		fileName: file.name || 'SendOverNetwork',
		customFileSize: file.size,
		headers: {
			'User-Agent': 'SendOverNetwork-client',
			'whoami': JSON.stringify({
				'desktopName': os.hostname(),
				'user': os.userInfo().username,
				'os': (os.platform() == 'win32' ? os.version() : os.platform().replace('darwin','macOS').replace('linux','Linux').replace('android','Android').replace('win32','Windows')),
				'nodeVersion': process.version,
				'clientVersion': require('./package.json').version,
			})
		},
		onProgress: function (percentage, chunk, remainingSize){
			// Modifier le spinner
			if(percentage && remainingSize) spinner.text = `Téléchargement du fichier : ${percentage}%, ${hr.fromBytes(remainingSize, 'BYTE', 'MBYTE')} restant.`
			else spinner.text = `Téléchargement du fichier...`

			// Si on est à 100%
			if(percentage === "100.00") spinner.text = `Téléchargement effectué.`
		}
	})

	// Télécharger le fichier
	try {
		await downloader.download();
	} catch (error) {
		console.log(error)
	}

	// Arrêter le spinner
	spinner.text = `Téléchargement terminé.`
	spinner.succeed()

	// Afficher une notification
	showNotification('SendOverNetwork','Fichier téléchargé avec succès.')

	// Si c'est une archive, demander si on veut l'extraire
	if(file?.name?.endsWith('.zip')){
		// Demander si on veut extraire
		if(!process.env.SON_AUTO_EXTRACT_ZIP) var answer = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'extract',
				message: `Voulez-vous extraire l'archive ?`,
				default: true
			}
		]); else var answer = { extract: true }

		// Si on veut extraire
		if(answer.extract){
			// Extraire l'archive
			var extractor = require('extract-zip');
			await extractor(path.join(wherePath, file.name), { dir: wherePath }, function (err) {
				// En cas d'erreur
				if(err) return console.log(err)
			})

			// Supprimer l'archive
			fs.unlinkSync(path.join(wherePath, file.name))
		}
	}

	// Si le fichier est un fichier .json
	if(file?.name?.endsWith('.json')){
		// Tenter de lire le fichier
		var fetchContent;
		try {
			fetchContent = fs.readFileSync(path.join(process.cwd(), file?.name))
			if(fetchContent) fetchContent = JSON.parse(fetchContent)
		} catch (error) {
			fetchContent = null
		}

		// Si la propriété "configVersion", "clipboardy" et "account" existe : on suppose que c'est une configuration Twitterminal
		if(fetchContent && fetchContent.configVersion && fetchContent.clipboardy && fetchContent.account){
			// Obtenir la liste des comptes
			var listTwitterminalAccount = Object?.keys(fetchContent?.accountList || [])

			// Si il n'y a pas de compte, on laisse tomber
			if(!listTwitterminalAccount || (listTwitterminalAccount && !listTwitterminalAccount?.length)) return;

			// Vérifier si Twitterminal est installé sur l'appareil
				// Faire une commande pour obtenir le chemin de la configuration
				var configPath;
				try {
					configPath = require('child_process')?.execSync('twitterminal -cp', { stdio: 'pipe' })?.toString()?.replace(/\n/g, "")
				} catch (error) {}

				// Si la commande n'a pas marché
				if(!configPath || configPath == "") return;

			// Demander si on veut remplacer la configuration actuelle par celle-ci
			console.log(`Le fichier téléchargé est considéré comme une configuration Twitterminal.`)
			if(!process.env.SON_AUTO_USE_TWITTERMINAL_SAVE) var wantToReplaceTwitterminalConfig = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'replace',
					message: "Voulez-vous l'utiliser ?",
					default: false
				}
			]); else var answer = { replace: true }

			// Si on ne veut pas remplacer, laissons tomber :(
			if(!wantToReplaceTwitterminalConfig.replace) return;

			// Sinon, c'est parti pour la remplacer :)
			spinner.text = "Remplacement de la configuration Twitterminal..."
			spinner.start()

			// Faire une copie de la précédente configuration
			var oldConfig = require('fs').readFileSync(configPath, 'utf8')
			fs.writeFileSync(path.join(path.dirname(configPath), 'twitterminalConfig.old.json'), oldConfig)

			// Remplacer la configuration
			fs.writeFileSync(configPath, JSON.stringify(fetchContent, null, 2))

			// C'est bon, c'est fini
			spinner.text = 'Configuration Twitterminal remplacée.'
			spinner.succeed()

			// Dire également qu'une copie a été faite
			if(!process.env.SON_SILENT_OUTPUT) console.log(chalk.dim("Une copie de la configuration Twitterminal a été créée dans ") + chalk.cyan(path.join(path.dirname(configPath), 'twitterminalConfig.old.json')))
		}
	}
}

// Fonction pour uploader un fichier
async function upload(file, port){
	// Obtenir le fichier/dossier à upload
		// Si aucun fichier n'a été donné
		if(!file){
			console.log(`Aucun fichier n'est donné. Exemple : "${chalk.blue('sendovernetwork --upload stickman.png')}"`)
			process.exit(1)
		}

		// Préparer la variable
		var filePath;

		// Vérifier
		try { filePath = fs.realpathSync(file) }
		catch(err){ console.log(`Le fichier "${chalk.blue(file)}" est introuvable. Exemple : "${chalk.blue('sendovernetwork --upload stickman.png')}"`); process.exit(1) };

	// Afficher un spinner
	spinner.text = 'Préparation..'
	spinner.start();

	// Déterminer si c'est un fichier ou un dossier
	var fileType = (fs.lstatSync(filePath).isFile() ? 'file' : 'folder')
	
	// Crée un serveur web avec ExpressJS
		// Importer ExpressJS et OS
		const express = require('express');
		const os = require('os');
		const app = express();
		app.disable('x-powered-by');

		// Définir le port
		port = port || process.env.SON_DEFAULT_PORT || 3410;

		// Route : obtenir des informations sur un fichier/dossier
		app.get('/info', (req, res) => {
			res.send({
				name: `${path.basename(filePath)}${fileType == 'folder' ? '.zip' : ''}`,
				type: fileType,
				size: fs.statSync(filePath).size,
				whoami: {
					'desktopName': os.hostname(),
					'user': os.userInfo().username,
					'os': (os.platform() == 'win32' ? os.version() : os.platform().replace('darwin','macOS').replace('linux','Linux').replace('android','Android').replace('win32','Windows')),
					'nodeVersion': process.version,
					'clientVersion': require('./package.json').version,
				}
			})
		})

		// Route principale
		app.get('*', async(req, res) => {
			// Si l'agent utilisateur n'est pas "SendOverNetwork-client"
			if(req.headers['user-agent'] != 'SendOverNetwork-client'){
				// Si c'est un fichier
				if(fileType == 'file'){
					res.set('fileName', path.basename(filePath)).set('fileType', fileType).sendFile(filePath);
					if(process.env.SON_STOP_UPLOAD_AFTER_DOWNLOAD) process.exit(0)
					return process.exit()
				}

				// Si c'est un dossier
				if(fileType == 'folder') await require('serve-handler')(req, res, { public: filePath, cleanUrls: true })
			}

			// Sinon, retourner un array des fichiers
			else {
				// Si c'est un dossier
				if(fileType == 'folder'){
					// Ajouter quelques headers
					res.set('fileName', `${path.basename(filePath)}.zip`).set('fileType', fileType)

					// Obtenir le header whomai
					var whoami = req?.headers?.whoami
					try { whoami = JSON.parse(whoami) }
					catch(err){ whoami = {} }

					// Créer l'archive
					zip = require('archiver')('zip', { zlib: { level: 9 } });
					spinner.text = `Création de ${chalk.green(`${file}.zip`)} | ${chalk.gray(whoami.user || 'anonyme')}${chalk.gray(`@${whoami.desktopName || 'anonyme'}`)} - ${chalk.blue(`${whoami.os || 'Système inconnu'}`)}`
					spinner.start()

					// En cas d'erreur
					zip.on('error', function(err) {
						spinner.text = chalk.red(err.message || err)
						spinner.fail()
						process.exit()
					})

					// Pipe l'archive
					zip.pipe(res);

					// Ajouter les fichiers et dossiers
					fs.readdirSync(filePath).forEach(file => {
						// Si c'est un dossier, l'ajouter
						if(fs.lstatSync(path.join(filePath, file)).isDirectory()){
							spinner.text = `Création d'une archive : ${chalk.blue(file)}`
							zip.directory(path.join(filePath, file), file);
						}

						// Sinon, ajouter le fichier
						else {
							spinner.text = `Création d'une archive : ${chalk.blue(file)}`
							zip.file(path.join(filePath, file), { name: file });
						}
					});

					// Modifier le spinner quand c'est terminé
					zip.on('end', () => {
						spinner.succeed()
						if(process.env.SON_STOP_UPLOAD_AFTER_DOWNLOAD) process.exit()
					})

					// Finaliser la création de l'archive
					spinner.text = `Création de ${chalk.green(`${file}.zip`)} | ${chalk.gray(whoami.user || 'anonyme')}${chalk.gray(`@${whoami.desktopName || 'anonyme'}`)} - ${chalk.blue(`${whoami.os || 'anonyme'}`)}`
					await zip.finalize();
				}

				// Sinon, retourner le fichier
				else {
					// Obtenir le header whomai
					var whoami = req?.headers?.whoami
					try { whoami = JSON.parse(whoami) }
					catch(err){ whoami = {} }

					// Afficher dans le terminal que le fichier va être accéder
					console.log(`${chalk.green(file)} | ${chalk.gray(whoami.user || 'anonyme')}${chalk.gray(`@${whoami.desktopName || 'anonyme'}`)} - ${chalk.blue(`${whoami.os || 'anonyme'}`)}`)

					// Retourner le fichier
					res.set('fileName', path.basename(filePath)).set('fileType', fileType).sendFile(filePath)

					// Si on doit arrêter après que quelqu'un ai téléchargé
					if(process.env.SON_STOP_UPLOAD_AFTER_DOWNLOAD) server.close()
				}
			}
		})

		// Faire que le serveur écoute sur le port défini
		var server = app.listen(port, async () => {
			// Modifier le spinner
			if(fileType == 'folder') spinner.text = `Dossier accessible depuis ${chalk.blue(`http://${await getLocalIP()}:${port}`)}`
			if(fileType == 'file') spinner.text = `Fichier prêt à être téléchargé depuis ${chalk.blue(`http://${await getLocalIP()}:${port}`)}`
			spinner.succeed();

			// Mettre dans le presse papier
			if(!process.env.SON_DISABLE_AUTO_WRITE_CLIPBOARD) require('clipboardy').write(`${process.env.SON_ONLY_COPY_IP ? '' : 'sendovernetwork --download '}http://${await getLocalIP()}:${port}`).catch(err => {})

			// Afficher un message
			if(!process.env.SON_SILENT_OUTPUT) console.log(chalk.dim("\nSi vous n'arrivez pas à accéder au lien depuis un autre appareil, tenter de régler votre pare feu pour autoriser le port"))

			// Dire comment faire pour autoriser le port dans son pare feu
			if(!process.env.SON_SILENT_OUTPUT && os.platform() == 'linux') console.log(chalk.dim(`Pour autoriser le port ${chalk.blue(port)}, faite "${chalk.blue('sudo ufw allow ' + port)}"`))
			if(!process.env.SON_SILENT_OUTPUT && os.platform() == 'darwin') console.log(chalk.dim(`Pour autoriser le port ${chalk.blue(port)}, faite "${chalk.blue('sudo firewall-cmd --permanent --add-port=' + port + '/tcp')}"`))
			if(!process.env.SON_SILENT_OUTPUT && os.platform() == 'win32') console.log(chalk.dim(`Pour autoriser le port ${chalk.blue(port)}, faite "${chalk.blue('netsh advfirewall firewall add rule name="SendOverNetwork" protocol=TCP dir=in localport=' + port + ' action=allow')}"`))

			// Sauter une ligne
			if(!process.env.SON_SILENT_OUTPUT) console.log('')
		});

		// En cas d'erreur du serveur
		server.on('error', (err) => {
			// Si c'est car le port est déjà utilisé
			if(err.code == 'EADDRINUSE' || err.code == 'EACCES'){
				// Modifier le spinner
				spinner.text = `Le port ${port} est déjà utilisé. Nouvelle tentative..`
				
				// Réessayer
				upload(file, port + 5)
			} else {
				// Afficher l'erreur
				spinner.text = err?.message || err?.toString() || err
				spinner.stop()
			}
		})
}

// Flag pour télécharger un fichier
if(['--download','-d','download','d'].includes(process.argv.slice(2)[0])){
	if(args?.dest && typeof args?.dest == 'string') downloadFile(process.argv.slice(2)[1], args?.dest);
	else downloadFile(process.argv.slice(2)[1]);
}

// Flag pour upload un fichier
if(['--upload','-u','upload','u'].includes(process.argv.slice(2)[0])){
	if(!isNaN(args?.port)) upload(process.argv.slice(2)[1], args?.port);
	else upload(process.argv.slice(2)[1])
}

// Fonction pour obtenir son IP local
async function getLocalIP(){
	// Si on veut l'IP publique et non local
	if(process.env.SON_SHOW_PUBLIC_IP) var ip = await fetch('http://api.ipify.org/?format=text').then(res => res.text());

	// Obtenir l'IP
	else var ip = require("os")?.networkInterfaces()['Wi-Fi']?.filter(i => i?.family == 'IPv4')[0] || Object.values(require("os").networkInterfaces()).flat().filter(({ family, internal }) => family === "IPv4" && !internal).map(({ address }) => address)[0] || await require('dns').promises.lookup(require('os').hostname());

	// La retourner
	return ip.address || ip || '<votre ip local>';
}
