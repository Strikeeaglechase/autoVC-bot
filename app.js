require("dotenv").config();
const fs = require("fs");
const Discord = require("discord.js");
const botEvents = require("./bot-events");
const SettingsController = require("./settings.js");
const DELETE_THRESHOLD = 250;
const PRECENSE_UPDATE_RATE = 2000;
const mlogServer = "647138462444552213";
const mlogChannel = "703268292932141127";
const CREATOR = "272143648114606083";

class App {
	constructor() {
		this.client;
		this.settings = new SettingsController(this.log);
		this.channels = [];
		this.botCommands = require("./bot-commands");
		this.toldUsersAboutAd = [];
		this.lastPresenceVal = 0;
	}
	init(apiToken) {
		this.client = new Discord.Client();
		this.log("Starting...");
		const self = this;
		for (let event in botEvents) {
			this.client.on(event, function () {
				try {
					botEvents[event].apply(self, arguments);
				} catch (e) {
					console.log(e);
				}
			});
		}
		this.client.login(apiToken);
		this.handleIPC();
		setInterval(this.updateChannels.bind(this), 250);
		setInterval(this.clearADSentList.bind(this), 1000 * 60 * 5);
	}
	handleIPC() {
		process.on("message", (message) => {
			if (message.type == "user") {
				const guild = this.client.guilds.resolve(message.guildID);
				if (!guild) return;
				const channel = guild.channels.resolve(message.channelID);
				if (!channel) return;
				channel.send(message.msg);
			} else {
				if (message.msg == "shutdown") {
					this.shutdown();
				}
			}
		});
	}
	updateChannels() {
		let usingMembers = this.channels.reduce(
			(acc, cur) => acc + cur.memberCount,
			0
		);
		if (usingMembers != this.lastPresenceVal) {
			this.lastPresenceVal = usingMembers;
			this.client.user.setPresence({
				activity: {
					type: "LISTENING",
					name: "your private conversations | " + this.lastPresenceVal,
				},
				status: "online",
			});
		}
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
	async handleDM(message) {
		if (!message.author.bot) {
			this.client.users
				.resolve(CREATOR)
				.send(
					"`" +
						message.author.username +
						":" +
						message.author.discriminator +
						"` " +
						message.content
				);
			if (this.toldUsersAboutAd.includes(message.author.id)) {
				return;
			}
			try {
				message.channel.send(
					"If you are interested in setting the status of the bot please DM Strikeeaglechase#0001"
				);
				this.toldUsersAboutAd.push(message.author.id);
			} catch (e) {}
		}
	}
	async handleMessage(message) {
		if (message.channel.type == "dm") {
			this.handleDM(message);
		}
		if (!message.guild) {
			return;
		}
		if (message.member && message.member.id == CREATOR) {
			process.send({
				msg: message.content,
				guildID: message.guild.id,
				channelID: message.channel.id,
				type: "user",
			});
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
			if (!hasPerms && message.author.id != CREATOR) {
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
		return "```diff\n-ERROR: " + str + "```";
	}
	success(str) {
		return "```diff\n+DONE: " + str + " ```";
	}
	log() {
		console.log(...arguments);
	}
	async serverLog(opts) {
		if (opts.color && opts.color == "#000000") {
			return;
		}
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
		} catch (e) {}
	}
	saveState() {
		const data = this.channels.map((c) => {
			return {
				channel: c.channel.id,
				owner: c.owner.id,
				isCustomName: c.isCustomName,
				attemptingDelete: c.attemptingDelete,
				memberCount: c.memberCount,
				createdAt: c.createdAt,
				lastPresenceCheck: c.lastPresenceCheck,
				gId: c.channel.guild.id,
			};
		});
		fs.writeFileSync("state.json", JSON.stringify(data));
	}
	loadState() {
		const data = JSON.parse(fs.readFileSync("state.json", "utf8"));
		this.channels = data.map((c) => {
			const guild = this.client.guilds.resolve(c.gId);
			if (!guild) return;
			return {
				channel: guild.channels.resolve(c.channel),
				owner: guild.members.resolve(c.owner),
				isCustomName: c.isCustomName,
				attemptingDelete: c.attemptingDelete,
				memberCount: c.memberCount,
				createdAt: c.createdAt,
				lastPresenceCheck: c.lastPresenceCheck,
			};
		});
	}
	shutdown() {
		this.saveState();
		this.client.destroy();
	}
	clearADSentList() {
		this.toldUsersAboutAd = [];
	}
}

const app = new App();
app.init(process.env.TOKEN);
