//Invite link:
// const git = require("simple-git")();
// const App = require("./app.js");
const childpro = require("child_process");
const SHUTDOWN_DELAY = 1000;
class Manager {
	constructor() {
		this.prefix = "-manager";
		this.app;
		this.channel;
		this.guild;
	}
	start() {
		this.app = childpro.fork("app.js", [], {
			stdio: ["pipe", "pipe", "pipe", "ipc"],
		});
		this.app.on("message", (msg) => {
			this.handleMessage(msg);
		});
		this.app.stdout.on("data", (data) => {
			process.stdout.write(data.toString());
		});
		this.app.stderr.on("data", (data) => {
			process.stdout.write(data.toString());
		});
	}
	async handleMessage(message) {
		// console.log(message);
		if (message.type == "bot") {
			if (message.msg == "online") {
				this.onBotOnline();
			}
		} else {
			if (!message.msg.startsWith(this.prefix)) {
				return;
			}
			this.guild = message.guildID;
			this.channel = message.channelID;
			const cmd = message.msg.split(" ")[1];
			switch (cmd) {
				case "pull":
					this.gitPull();
					break;
				case "restart":
					await this.kill();
					this.start();
					break;
				case "shutdown":
					await this.kill();
					break;
				default:
					this.send("Invalid manager call");
			}
		}
	}
	onBotOnline() {
		this.send("Bot is online!");
	}
	async kill() {
		this.send("Shutting down");
		await d(SHUTDOWN_DELAY);
		this.app.send({
			type: "bot",
			msg: "shutdown",
		});
	}
	send(msg) {
		this.app.send({
			channelID: this.channel,
			guildID: this.guild,
			msg: msg,
			type: "user",
		});
	}
	gitPull() {
		const gitProc = childpro.spawn("git", ["pull"]);
		gitProc.stdout.on("data", (data) => {
			this.send(data.toString());
		});
	}
}
const manager = new Manager();
manager.start();

function d(ms) {
	return new Promise((res) => setTimeout(res, ms));
}
