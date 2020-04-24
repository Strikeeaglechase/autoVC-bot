const Discord = require("discord.js");
const CREATOR = "272143648114606083";
const commands = {
	"[command name]": {
		perms: [],
		help: {
			msg: "What it does",
			usage: "How you use it",
			example: "Example of how to use it",
		},
		run: function (message) {
			return "";
		},
	},
	ping: {
		perms: [],
		help: {
			msg: "Ping the bot",
			usage: "ping - usage",
			example: "ping - example",
		},
		run: function (message) {
			return "Pong!";
		},
	},
	config: {
		perms: ["ADMINISTRATOR"],
		help: {
			msg: "Change the server config for the bot",
			usage: "config | config [SETTING] [VALUE]",
			example: "config VC_CREATOR_ID 583604543082987541",
		},
		run: function (message) {
			const args = message.content.substring(1).split(" ");
			if (args.length == 1) {
				const emb = new Discord.MessageEmbed();
				emb.setColor("#0099ff");
				emb.setTitle("Auto VC Config");
				emb.setDescription("Config:");
				const settings = this.settings.get(message.guild.id);
				for (var loopKey in settings) {
					emb.addField(loopKey, settings[loopKey]);
				}
				emb.setTimestamp();
				emb.setFooter("Bot created by Strikeeaglechase#0001");
				return emb;
			}
			const key = args[1];
			if (!key) {
				return this.error("Invalid setting");
			}
			const res = this.settings.set(message.guild.id, key, args[2]);
			if (res.failed) {
				return this.error(res.msg);
			} else {
				return this.success(res.msg);
			}
		},
	},
	help: {
		perms: [],
		help: {
			msg: "Show this help message",
			usage: "help",
			example: "help",
		},
		run: function (message) {
			const emb = new Discord.MessageEmbed();
			emb.setColor("#0099ff");
			emb.setTitle("Auto VC Help");
			emb.setDescription("Help:");
			for (var cmd in this.botCommands) {
				if (this.botCommands[cmd].help) {
					emb.addField(
						"**" + cmd + ":** " + this.botCommands[cmd].help.msg,
						this.botCommands[cmd].help.usage +
							"\n" +
							this.botCommands[cmd].help.example,
						false
					);
				}
			}
			emb.setTimestamp();
			emb.setFooter("Bot created by Strikeeaglechase#0001");
			return emb;
		},
	},
	dump: {
		perms: [],
		help: undefined,
		run: function (message) {
			const gId = message.guild.id;
			const channels = this.channels.filter(
				(c) => c.channel.guild.id == gId
			);
			const asStrings = channels.map((c) => {
				var obj = {};
				for (var i in c) {
					obj[i] = c[i].toString();
				}
				return obj;
			});
			return "```json\n" + JSON.stringify(asStrings) + "\n```";
		},
	},
	dumpAll: {
		perms: [],
		help: undefined,
		run: function (message) {
			if (message.member.id != CREATOR) {
				return this.error("no");
			}
			const asStrings = this.channels.map((c) => {
				var obj = {};
				for (var i in c) {
					obj[i] = c[i].toString();
				}
				return obj;
			});
			return "```json\n" + JSON.stringify(asStrings) + "\n```";
		},
	},
	name: {
		perms: [],
		help: {
			msg: "Change vc name",
			usage: "name [new name]",
			example: "name Cool vc bros",
		},
		run: async function (message) {
			const vc = message.member.voice.channel;
			if (!vc) {
				return this.error(
					"You must be in a voice call to use that command"
				);
			}
			const settings = this.settings.get(message.guild.id);
			if (!settings.ALLOW_CUSTOM_NAME) {
				return this.error("Admin has disabled this command");
			}
			const newName = message.content
				.substring(message.content.indexOf(" "))
				.substring(1);
			if (!newName || newName.length < settings.MIN_NAME_LEN) {
				return this.error("Invalid name length");
			}
			const channel = this.channels.find((c) => c.channel.id == vc.id);
			if (!channel) {
				return this.error("Invalid voice channel");
			}
			if (channel.owner.id != message.member.id) {
				return this.error(
					"You cannot edit the channel name of a channel you do not own"
				);
			}
			channel.attemptingRename = true;
			try {
				console.log("awaiting edit");
				vc.edit({ name: newName });
				console.log("Await over");
				channel.isCustomName = true;
				return this.success("Set name to " + newName);
			} catch (e) {
				console.log(e);
				return this.error("Invaild name");
			} finally {
				channel.attemptingRename = false;
			}
		},
	},
	removeName: {
		perms: [],
		help: {
			msg: "Remove a custom name",
			usage: "removeName",
			example: "removeName",
		},
		run: function (message) {
			const vc = message.member.voice.channel;
			if (!vc) {
				return error("You must be in a voice call to use that command");
			}
			const channel = this.channels.find((c) => c.channel.id == vc.id);
			if (!channel) {
				return error("Invalid voice channel");
			}
			if (channel.owner.id != message.member.id) {
				return error(
					"You cannot edit the channel name of a channel you do not own"
				);
			}
			c.isCustomName = false;
			return this.success("Removed custom name");
		},
	},
	changeOwner: {
		perms: [],
		help: {
			msg: "Sets owner of a channel to a different user",
			usage: "changeOwner [user mention]",
			example: "changeOwner @strikeeaglechase#0001",
		},
		run: function (message) {
			if (!message.member.voice) {
				return this.error(
					"You must be in a voice channel to use this command"
				);
			}
			const channel = this.channels.find(
				(c) => c.channel.id == message.member.voice.channelID
			);
			if (!channel) {
				return this.error(
					"Could not resolve channel owner... This may be due to bot crash/restart. Please have an admin delete this channel and create a new one"
				);
			}
			if (channel.owner.id != message.member.id) {
				return this.error(
					"You must be the owner of the vc to use this command"
				);
			}
			const transferTo = message.mentions.users.array()[0];
			if (!transferTo) {
				return this.error("You must mention a member to transfer to");
			}
			channel.owner = message.guild.members.resolve(transferTo);
			return this.success("Ownership transferd");
		},
	},
};
module.exports = commands;
