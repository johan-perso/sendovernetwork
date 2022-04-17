#!/usr/bin/env node

// Importer quelques librairies
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const args = require('args-parser')(process.argv);
const ora = require('ora'); var spinner = ora({ spinner: 'line' });

// Si aucun flags, passer en mode GUI
if(!Object?.keys(args)?.length){
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
if(args?.help || args?.h){
	console.log(`
 Utilisation
   $ sendovernetwork
   ${chalk.dim('(ou alors "son")')}

 Options
   --version -v          Indique la version actuellement utilisé
   --download -d         Télécharge un fichier/dossier sur votre appareil
   --upload -u           Permet d'upload un fichier / un dossier

 Télécharger un fichier
   $ sendovernetwork --download --link=http://192.168.1.52:3410

 Envoyer un fichier
   $ sendovernetwork --upload --file=stickman.png
`)
}

// Donner la version avec l'argument associé
if(args?.version || args?.v){
	console.log("SendOverNetwork utilise actuellement la version " + chalk.cyan(require('./package.json').version))
	console.log("────────────────────────────────────────────")
	console.log("Développé par Johan le stickman")
	console.log(chalk.cyan("https://johanstickman.com"))
	process.exit()
}

// Fonction pour télécharger un fichier
async function downloadFile(link, wherePath){
	// Importer une librairie
	const fetch = require('node-fetch');

	// Définir le chemin du fichier
	wherePath = wherePath || process.env.SEND_ON_NETWORK_DEFAULT_DOWNLOAD_PATH || path.join(process.cwd()) || path.join(require('os').homedir())

	// Vérifier que nodejs-file-downloader soit bien patché
		// Obtenir le fichier Download.js
		var contentFile = fs.readFileSync(path.join(__dirname, 'node_modules', 'nodejs-file-downloader', 'Download.js'), 'utf8');

		// Si le fichier ne commence pas par un certain texte
		if(!contentFile?.toString()?.startsWith('/*FORK-JOHAN_STICKMAN')){
			// Obtenir le fork
			contentFile = await fetch('https://firebasestorage.googleapis.com/v0/b/storage-bf183.appspot.com/o/SendOverNetwork%2FDownload.js?alt=media').then(res => res.text()).catch(err => {})

			// Si il ne commence toujours pas par le bon texte
			if(!contentFile?.toString()?.startsWith('/*FORK-JOHAN_STICKMAN')){
				// Afficher un message d'erreur
				console.log(chalk.bgYellow('WARN') + '  Impossible de patcher nodejs-file-downloader, certains élements peuvent manquer pendant le téléchargement.')
			} else {
				// Modifier le fichier
				if(contentFile) fs.writeFileSync(path.join(__dirname, 'node_modules', 'nodejs-file-downloader', 'Download.js'), contentFile)
			}
		}

	// Importer des librairies
	const hr = require('@tsmx/human-readable');
	const Downloader = require('nodejs-file-downloader');
	const os = require('os')

	// Si le lien n'est pas fourni, afficher une erreur
	if(!link){
		console.log(`Aucun lien n'est donné. Exemple : "${chalk.blue('sendovernetwork --download --link=http://192.168.1.52:3410')}"`)
		process.exit(1)
	}

	// Si le lien se termine par un slash, l'enlever
	if(link?.toString()?.endsWith('/')) link = link?.slice(0, -1)

	// Si le lien est mal formé, afficher une erreur
	if(!link?.toString()?.match(/^http:\/\/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:[0-9]{1,5}$/)){
		console.log(`Le lien n'est pas valide. Exemple : "${chalk.blue('sendovernetwork --download --link=http://192.168.1.52:3410')}"`)
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
		onProgress: function (percentage, chunk, remainingSize, currentDataSize){
			// Modifier le spinner
			if(percentage && remainingSize) spinner.text = `Téléchargement du fichier : ${percentage}%, ${hr.fromBytes(remainingSize, 'BYTE', 'MBYTE')} restant.`
			else spinner.text = `Téléchargement du fichier : ${hr.fromBytes(currentDataSize, 'BYTE', 'MBYTE')} téléchargé.`

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

	// Si c'est une archive, demander si on veut l'extraire
	if(file?.name?.endsWith('.zip')){
		// Demander si on veut extraire
		var answer = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'extract',
				message: `Voulez-vous extraire l'archive ?`,
				default: true
			}
		])

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
}

// Fonction pour uploader un fichier
async function upload(file, port){
	// Obtenir le fichier/dossier à upload
		// Si aucun fichier n'a été donné
		if(!file){
			console.log(`Aucun fichier n'est donné. Exemple : "${chalk.blue('sendovernetwork --upload --file=stickman.png')}"`)
			process.exit(1)
		}

		// Préparer la variable
		var filePath;

		// Vérifier
		try { filePath = fs.realpathSync(file) }
		catch(err){ console.log(`Le fichier "${chalk.blue(file)}" est introuvable. Exemple : "${chalk.blue('sendovernetwork --upload --file=stickman.png')}"`); process.exit(1) };

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
		port = port || process.env.SEND_ON_NETWORK_DEFAULT_PORT || 3410;

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
				if(fileType == 'file') return res.set('fileName', path.basename(filePath)).set('fileType', fileType).sendFile(filePath);

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
						process.exit(1)
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
					res.set('fileName', path.basename(filePath)).set('fileType', fileType).sendFile(filePath);
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
			require('clipboardy').write(`http://${await getLocalIP()}:${port}`).catch(err => {})

			// Afficher un message
			console.log(chalk.dim("\nSi vous n'arrivez pas à accéder au lien depuis un autre appareil, tenter de régler votre pare feu pour autoriser le port"))

			// Dire comment faire pour autoriser le port dans son pare feu
			if(os.platform() == 'linux') console.log(chalk.dim(`Pour autoriser le port ${chalk.blue(port)}, faite "${chalk.blue('sudo ufw allow ' + port)}"`))
			if(os.platform() == 'darwin') console.log(chalk.dim(`Pour autoriser le port ${chalk.blue(port)}, faite "${chalk.blue('sudo firewall-cmd --permanent --add-port=' + port + '/tcp')}"`))
			if(os.platform() == 'win32') console.log(chalk.dim(`Pour autoriser le port ${chalk.blue(port)}, faite "${chalk.blue('netsh advfirewall firewall add rule name="SendOverNetwork" protocol=TCP dir=in localport=' + port + ' action=allow')}"`))

			// Sauter une ligne
			console.log('')
		});

		// En cas d'erreur du serveur
		server.on('error', (err) => {
			// Si c'est car le port est déjà utilisé
			if(err.code == 'EADDRINUSE'){
				// Modifier le spinner
				spinner.text = `Le port ${port} est déjà utilisé. Nouvelle tentative..`
				
				// Réessayer
				upload(file, port + 5)
			}

			// Afficher l'erreur
			spinner.text = err?.message || err?.toString() || err
			spinner.stop()
		})
}

// Flag pour télécharger un fichier
if(args?.download || args?.d){
	if(args?.dest && typeof args?.dest == 'string') downloadFile(args?.link, args?.dest);
	else downloadFile(args?.link);
}

// Flag pour upload un fichier
if(args?.upload || args?.u){
	if(!isNaN(args?.port)) upload(args?.file, args?.port);
	else upload(args?.file)
}

// Fonction pour obtenir son IP local
async function getLocalIP(){
	// Obtenir l'ip
	var ip = require("os")?.networkInterfaces()['Wi-Fi']?.filter(i => i?.family == 'IPv4')[0] || Object.values(require("os").networkInterfaces()).flat().filter(({ family, internal }) => family === "IPv4" && !internal).map(({ address }) => address)[0] || await require('dns').promises.lookup(require('os').hostname());

	// La retourner
	return ip.address || ip;
}
