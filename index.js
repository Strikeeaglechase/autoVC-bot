//Invite link: https://discordapp.com/api/oauth2/authorize?client_id=650800972708446239&permissions=16777232&scope=bot
require("dotenv").config();
const Discord = require("discord.js");
const botEvents = require("./bot-events");
const SettingsController = require("./settings.js");
const DELETE_THRESHOLD = 250;
const PRECENSE_UPDATE_RATE = 2000;
class App {
	constructor() {
		this.client = new Discord.Client();
		this.settings = new SettingsController(this.log);
		this.MAX_EMPTY = 2;
		this.channels = [];
		this.botCommands = require("./bot-commands");
	}
	init(apiToken) {
		this.log("Starting...");
		const self = this;
		for (let event in botEvents) {
			this.client.on(event, function () {
				try {
					botEvents[event].apply(self, arguments);
				} catch (e) {
					this.log(e);
				}
			});
		}
		this.client.login(apiToken);
		// setInterval(this.updateChannels.bind(this), 250);
	}
	updateChannels() {
		const d = Date.now();
		this.channels.forEach(async (c) => {
			if (c.channel.deleted || c.attemptingDelete || c.attemptingRename) {
				return;
			}
			if (d - c.createdAt > DELETE_THRESHOLD && c.memberCount == 0) {
				c.attemptingDelete = true;
				try {
					await c.channel.delete();
				} catch (e) {
					console.log(e);
					this.log(
						"Could not delete channel %s in %s",
						c.channel.id,
						c.channel.guild.id
					);
					c.attemptingDelete = false;
				}
			}
			if (
				this.settings.get(c.owner.guild.id).AUTO_UPDATE_NAME &&
				!c.isCustomName &&
				c.memberCount > 0 &&
				Date.now() - c.lastPresenceCheck > PRECENSE_UPDATE_RATE
			) {
				const name = this.resolveName(c.owner);
				c.lastPresenceCheck = Date.now();
				if (name != c.channel.name) {
					try {
						await c.channel.edit({ name: name });
					} catch (e) {
						this.log("Could not edit channel name %s", c.channel.id);
					}
				}
			}
		});
		this.channels = this.channels.filter((c) => !c.channel.deleted);
	}
	resolveName(member) {
		var activity = member.presence.activities.find(
			(act) => act.type == "PLAYING"
		);
		const settings = this.settings.get(member.guild.id);
		var name;
		if (activity) {
			name = activity.name;
		} else {
			name = settings.DEFAULT_NAME;
			if (settings.USERNAME_IN_VC) {
				name = name + " - " + member.user.username;
			}
		}
		return name;
	}
	async handleMessage(message) {
		if (!message.guild) {
			return;
		}
		const guildPrefix = this.settings.get(message.guild.id).PREFIX;
		if (!message.content.startsWith(guildPrefix)) {
			return;
		}
		const commandStr = message.content.substring(1).split(" ")[0];
		const command = this.botCommands[commandStr];
		if (command) {
			let hasPerms = true;
			command.perms.forEach((perm) => {
				if (hasPerms && !message.member.hasPermission(perm)) {
					hasPerms = false;
				}
			});
			if (!hasPerms) {
				return message.channel.send(
					this.error("You do not have the required permissions")
				);
			}
			try {
				const ret = await command.run.call(this, message);
				if (ret) {
					await message.channel.send(ret);
				}
			} catch (e) {
				this.log(e);
			}
		}
	}
	async createNewVC(member) {
		const name = this.resolveName(member);
		const settings = this.settings.get(member.guild.id);
		try {
			const newChannel = await member.guild.channels.create(name, {
				type: "voice",
				parent: member.guild.channels.resolve(member.voice.channelID)
					.parentID, //Gets parent ID of VC the member is in
				bitrate: settings.DEFAULT_BITRATE,
				userLimit: settings.USER_LIMIT || undefined,
			});
			member.edit({
				channel: newChannel,
			});
			this.channels.push({
				channel: newChannel,
				owner: member,
				isCustomName: false,
				attemptingDelete: false,
				memberCount: 0,
				createdAt: Date.now(),
				lastPresenceCheck: Date.now(),
			});
		} catch (e) {
			this.log("Could not create vc");
			this.log(e);
		}
	}
	error(str) {
		return "```diff\n-ERROR " + str + "```";
	}
	success(str) {
		return "```diff\n+DONE: " + str + " ```";
	}
	log() {
		console.log(...arguments);
	}
	async serverLog(opts) {
		const guild = this.client.guilds.resolve(opts.gId);
		var channel;
		try {
			channel = guild.channels.resolve(
				this.settings.get(guild.id).LOG_CHANNEL
			);
		} catch (e) {
			return;
		}
		if (!channel) {
			return;
		}
		const emb = new Discord.MessageEmbed();
		emb.setColor(opts.color || "#00ff00");
		if (opts.member) {
			emb.setAuthor(
				opts.member.user.username + "#" + opts.member.user.discriminator,
				opts.member.user.avatarURL()
			);
		}
		if (opts.name) {
			emb.setDescription(opts.name);
		}
		if (opts.details) {
			opts.details.forEach((dt) => {
				emb.addField(dt.tag, dt.data);
			});
		}
		emb.setTimestamp();
		try {
			await channel.send(emb);
		} catch (e) {
			if (e) {
				cLog("Problem logging to log channel");
				cLog(e);
			}
		}
	}
}

const app = new App();
setInterval(() => app.updateChannels(), 250);
app.init(process.env.TOKEN);
// const testClient = new Discord.Client();
// testClient.login(process.env.TOKEN);
// testClient.on("ready", () => {
// 	console.log("-Begining test-");
// 	startTest();
// });
// async function startTest() {
// 	const guild = app.client.guilds.resolve("647138462444552213");
// 	let t;
// 	console.log("Creating channel...");
// 	t = Date.now();
// 	const channel = await guild.channels.create("TEST CHANNEL", {
// 		type: "voice",
// 	});
// 	console.log("Channel created in %sms", Date.now() - t);

// 	console.log("Renaming channel...");
// 	t = Date.now();
// 	await channel.edit({ name: "EDIT NAME" });
// 	console.log("Channel edited in %sms", Date.now() - t);

// 	console.log("Deleting channel...");
// 	t = Date.now();
// 	await channel.delete();
// 	console.log("Channel deleted in %sms", Date.now() - t);
// }
