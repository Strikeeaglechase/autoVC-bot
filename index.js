require("dotenv").config();
const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();
const settingsFile = "./settings.json";
const MAX_EMPTY = 2;
var SETTINGS = {};
var ownerships = [];
const BASE_SETTINGS = {
	VC_CREATOR_ID: "-",
	CHANNEL_PREFIX: ">",
	MIN_NAME_LEN: 3,
	DEFAULT_NAME: "General",
	ALLOW_CUSTOM_NAME: true,
	LOG_CHANNEL: "-",
	channelUpdate: "#0000ff",
	channelCreate: "#00ff00",
	channelDelete: "#ff0000",
	vcJoin: "#ccff33",
	vcLeave: "#ff6600",
	DEFAULT_BITRATE: 64000,
	USER_LIMIT: 0,
	AUTO_UPDATE_NAME: true,
	USERNAME_IN_VC: true,
};

const hexValidate = (val) =>
	typeof val == "string" && val[0] == "#" && val.length == 7;

const SETTING_VALIDATE = {
	VC_CREATOR_ID: (val) => typeof val == "string" && val.length == 18,
	CHANNEL_PREFIX: (val) => typeof val == "string" && val.length == 1,
	MIN_NAME_LEN: (val) => typeof val == "number",
	DEFAULT_NAME: (val) => typeof val == "string" && val.length > 1,
	ALLOW_CUSTOM_NAME: (val) => typeof val == "boolean",
	LOG_CHANNEL: (val) => typeof val == "string" && val.length == 18,
	channelUpdate: hexValidate,
	channelCreate: hexValidate,
	channelDelete: hexValidate,
	vcJoin: hexValidate,
	vcLeave: hexValidate,
	DEFAULT_BITRATE: (val) =>
		typeof val == "number" && val > 8000 && val < 260000,
	USER_LIMIT: (val) => typeof val == "number" && val < 99 && val >= 0,
	AUTO_UPDATE_NAME: (val) => typeof val == "boolean",
	USERNAME_IN_VC: (val) => typeof val == "boolean",
};

client.on("ready", () => {
	cLog(`Logged in as ${client.user.tag}!`);
	SETTINGS = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
	for (var gId in SETTINGS) {
		for (var key in BASE_SETTINGS) {
			if (SETTINGS[gId][key] == undefined) {
				SETTINGS[gId][key] = BASE_SETTINGS[key];
			}
		}
	}
	fs.writeFileSync(settingsFile, JSON.stringify(SETTINGS));
});

client.on("message", async (message) => {
	if (!message.guild) {
		cLog("%s dm'ed the bot: %s", message.author, message.content);
		return;
	}
	if (!SETTINGS[message.guild.id]) {
		initSettings(message.guild.id);
	}
	handleMessage(message);
	if (message.content == "-whoami") {
		message.reply(process.env.whoami);
	}
});

client.on("voiceStateUpdate", async (oldState, newState) => {
	if (!oldState && !newState) {
		return;
	}
	if (!(oldState || newState).guild) {
		return;
	}
	if (!SETTINGS[newState.guild.id]) {
		initSettings(channel.guild.id);
	}
	handleVCUpdate(oldState, newState, (oldState || newState).guild.id);
});

client.on("channelUpdate", (oldChannel, newChannel) => {
	if (!newChannel.guild) {
		return;
	}
	if (newChannel.type != "voice" || oldChannel.name == newChannel.name) {
		return;
	}
	if (!SETTINGS[newChannel.guild.id]) {
		initSettings(channel.guild.id);
	}
	log({
		name: "Channel updated " + newChannel.toString(),
		gId: newChannel.guild.id,
		color: SETTINGS[newChannel.guild.id].channelUpdate,
		details: [
			{
				tag: "Was: ",
				data: oldChannel.name,
			},
			{
				tag: "Is now: ",
				data: newChannel.name,
			},
		],
	});
});

client.on("channelCreate", (channel) => {
	if (!channel.guild) {
		return;
	}
	if (!SETTINGS[channel.guild.id]) {
		initSettings(channel.guild.id);
	}
	log({
		name: "Channel created " + channel.toString(),
		gId: channel.guild.id,
		color: SETTINGS[channel.guild.id].channelCreate,
	});
});

client.on("channelDelete", (channel) => {
	if (!channel.guild) {
		return;
	}
	log({
		name: "Channel deleted " + channel.name,
		gId: channel.guild.id,
		color: SETTINGS[channel.guild.id].channelDelete,
	});
});

client.login(process.env.TOKEN);

function initSettings(id) {
	SETTINGS[id] = BASE_SETTINGS;
	cLog("Init settings done for %s", id);
	fs.writeFileSync(settingsFile, JSON.stringify(SETTINGS));
}

function error(msg) {
	return "```diff\n-ERROR: " + msg + " ```";
}

function success(msg) {
	return "```diff\n+DONE: " + msg + " ```";
}

async function editVCName(vc, commandText, member, gId) {
	if (!vc) {
		return error("You must be in a voice call to use that command");
	}
	if (!SETTINGS[gId].ALLOW_CUSTOM_NAME) {
		return error("Admin has disabled this command");
	}
	const newName = commandText.substring(commandText.indexOf(" "));
	if (!newName || newName.length < SETTINGS[gId].MIN_NAME_LEN) {
		return error("Invalid name length");
	}
	if (vc.name[0] != SETTINGS[gId].CHANNEL_PREFIX) {
		return error("You cannot edit the channel name of a non-bot created vc");
	}
	const owner = ownerships.find((ownership) => ownership.id == vc.id);
	if (!owner || owner.ownerId == member.id) {
		if (owner) {
			owner.isCustomName = true;
		}
		try {
			await vc.edit({ name: SETTINGS[gId].CHANNEL_PREFIX + newName });
		} catch (e) {
			return error("Invalid name");
		}
	} else if (owner.ownerId != member.id) {
		return error("You are not the owner of this vc");
	}
}

function removeCustomName(member) {
	if (!member.voice) {
		return error("You must be in a voice call to use that command");
	}
	const owner = ownerships.find(
		(ownership) => ownership.id == member.voice.channelID
	);
	if (!owner) {
		return error(
			"Could not resolve channel owner... if ownership is required please create a new vc"
		);
	}
	if (owner.ownerId != member.id) {
		return error("You must be the owner of the vc to use this command");
	}
	owner.isCustomName = false;
	updateVCName();
}

async function helpMessage(message) {
	const emb = new Discord.MessageEmbed();
	emb.setColor("#0099ff");
	emb.setTitle("Auto VC Help");
	emb.setAuthor(message.author.username);
	emb.setDescription("Help:");
	emb.addField(
		"**Setup:**",
		"To setup the bot all you must do is run `-config VC_CREATOR_ID [VoiceChannelId]\nVoiceChannelId should be a ",
		false
	);
	emb.addField(
		"**-name** [name]",
		"Changes the name of the current voice channel",
		false
	);
	emb.addField("**-config**", "Show the current configuration", false);
	emb.addField(
		"**-config [setting] [newValue]**",
		"Change a config setting",
		false
	);
	emb.addField(
		"**-changeOwner [userMention]**",
		"Set a VC to a different owner",
		false
	);
	emb.addField("**-resetName**", "Remove a VC's custom name", false);
	emb.setTimestamp();
	emb.setFooter("Bot created by Strikeeaglechase#0001");
	message.channel.send(emb);
}

function handleConfig(command, member, gId) {
	const args = command.split(" ");
	if (args.length == 1) {
		const emb = new Discord.MessageEmbed();
		emb.setColor("#0099ff");
		emb.setTitle("Auto VC Config");
		emb.setAuthor(member.user.username);
		emb.setDescription("Config:");
		for (var loopKey in SETTINGS[gId]) {
			emb.addField(loopKey, SETTINGS[gId][loopKey]);
		}
		emb.setTimestamp();
		emb.setFooter("Bot created by Strikeeaglechase#0001");
		return emb;
	}
	if (!member.hasPermission("ADMINISTRATOR")) {
		return error("You are not an admin");
	}
	SETTINGS = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
	const key = args[1];
	var value = "";
	for (var i = 2; i < args.length; i++) {
		value += args[i] + " ";
	}
	value = value.substring(0, value.length - 1);
	if (key == undefined || value == undefined) {
		return error("Invalid arguments");
	}
	if (SETTINGS[gId][key] == undefined) {
		return error("Invalid setting");
	}
	if (value == "true") {
		value = true;
	} else if (value == "false") {
		value = false;
	} else if (!isNaN(parseInt(value)) && value.length != 18) {
		//God this solotion is bad but it works ^
		value = parseInt(value);
	}
	const isValid = SETTING_VALIDATE[key](value);
	if (!isValid) {
		return error("Invalid value");
	}
	SETTINGS[gId][key] = value;
	fs.writeFileSync(settingsFile, JSON.stringify(SETTINGS));
	return success("Set " + key + " to " + value);
}

function changeOwner(message, member) {
	if (!member.voice) {
		return error("You must be in a voice channel to use this command");
	}
	const owner = ownerships.find(
		(ownership) => ownership.id == member.voice.channelID
	);
	if (!owner) {
		return error(
			"Could not resolve channel owner... if ownership is required please create a new vc"
		);
	}
	if (owner.ownerId != member.id) {
		return error("You must be the owner of the vc to use this command");
	}
	const transferTo = message.mentions.users.array()[0];
	if (!transferTo) {
		return error("You must mention a member to transfer to");
	}
	owner.ownerId = transferTo.id;
	return success("Ownership transferd");
}

async function handleMessage(message) {
	var retMessage;
	const gId = message.guild.id;
	if (message.content.startsWith("-name")) {
		const vc = message.member.voice.channel;
		retMessage = await editVCName(vc, message.content, message.member, gId);
	} else if (message.content.startsWith("-help")) {
		helpMessage(message);
	} else if (message.content.startsWith("-config")) {
		retMessage = handleConfig(message.content, message.member, gId);
	} else if (message.content.startsWith("-changeOwner")) {
		retMessage = changeOwner(message, message.member);
	} else if (message.content.startsWith("-resetName")) {
		removeCustomName(message.member);
	}
	if (retMessage) {
		message.channel.send(retMessage);
	}
}

async function handleVCJoin(newState, gId) {
	const member = newState.member;
	const joinedChannel = newState.guild.channels.resolve(newState.channelID);
	if (joinedChannel.id == SETTINGS[gId].VC_CREATOR_ID) {
		var activity = member.presence.activities.find(
			(act) => act.type == "PLAYING"
		);
		var name;
		if (activity) {
			name = activity.name;
		} else {
			name = SETTINGS[gId].DEFAULT_NAME;
			if (SETTINGS[gId].USERNAME_IN_VC) {
				name = member.user.username + " - " + name;
			}
		}
		try {
			const numExist = newState.guild.channels.cache.filter((channel) => {
				return (
					channel.name[0] == SETTINGS[gId].CHANNEL_PREFIX &&
					channel.type == "voice" &&
					channel.members.array().length == 0
				);
			});
			if (numExist.array().length > MAX_EMPTY) {
				cLog("---TOO MANY EMPTY CHANNELS---");
				return;
			}
			const newChannel = await newState.guild.channels.create(
				SETTINGS[gId].CHANNEL_PREFIX + " " + name,
				{
					type: "voice",
					parent: joinedChannel.parentID,
					bitrate: SETTINGS[gId].DEFAULT_BITRATE,
					userLimit: SETTINGS[gId].USER_LIMIT || undefined,
				}
			);
			member.edit({
				channel: newChannel,
			});
			ownerships.push({
				id: newChannel.id,
				ownerId: member.id,
				guildId: newChannel.guild.id,
				isCustomName: false,
			});
		} catch (e) {
			cLog("Failed to create channel correctly");
			cLog(e);
		}
	}
}

async function handleVCLeave(oldState, gId) {
	const leftChannel = oldState.guild.channels.resolve(oldState.channelID);
	if (!leftChannel) {
		return;
	}
	if (
		leftChannel.name[0] == SETTINGS[gId].CHANNEL_PREFIX &&
		leftChannel.members.array().length == 0
	) {
		try {
			ownerships = ownerships.filter(
				(ownership) => ownership.id == leftChannel.id
			);
			leftChannel.delete();
		} catch (e) {
			cLog("CHANNEL DELETE FAILED!!!");
			cLog(e);
		}
	} else if (
		leftChannel.name[0] == SETTINGS[gId].CHANNEL_PREFIX &&
		SETTINGS[gId].AUTO_UPDATE_NAME
	) {
		const membs = leftChannel.members.array();
		var foundNew = false;
		for (var i = 0; i < membs.length; i++) {
			var activity = membs[i].presence.activities.find(
				(act) => act.type == "PLAYING"
			);
			if (activity) {
				try {
					leftChannel.edit({
						name: SETTINGS[gId].CHANNEL_PREFIX + activity.name,
					});
				} catch (e) {
					cLog(e);
				}
				foundNew = true;
				break;
			}
		}
		if (!foundNew && membs.length > 0) {
			try {
				const prevName = leftChannel.name;
				const newName =
					SETTINGS[gId].CHANNEL_PREFIX +
					membs[0].user.username +
					" - " +
					SETTINGS[gId].DEFAULT_NAME;
				leftChannel.edit({
					name: newName,
				});
			} catch (e) {
				cLog(e);
			}
		}
	}
}

async function handleVCUpdate(oldState, newState, gId) {
	if (
		newState.channelID != undefined &&
		newState.channelID != oldState.channelID
	) {
		handleVCJoin(newState, gId);
		if (newState.channelID != SETTINGS[gId].VC_CREATOR_ID) {
			const vc = newState.guild.channels.resolve(newState.channelID);
			const members = newState.channel.members.array();
			log({
				name: "Joined voice channel " + vc.toString(),
				gId: gId,
				color: SETTINGS[gId].vcJoin,
				details: [
					{
						tag: "Who: ",
						data: newState.member.toString(),
					},
					{
						tag: "Current members: ",
						data: members.join("\n") || "none",
					},
				],
			});
		}
	}
	if (
		oldState.channelID != undefined &&
		newState.channelID != oldState.channelID
	) {
		handleVCLeave(oldState, gId);
		if (oldState.channelID != SETTINGS[gId].VC_CREATOR_ID) {
			const vc = oldState.guild.channels.resolve(oldState.channelID);
			const members = oldState.channel.members.array();
			log({
				// member: newState.member,
				name: "Left voice channel: " + vc.name,
				gId: gId,
				color: SETTINGS[gId].vcLeave,
				details: [
					{
						tag: "Who: ",
						data: newState.member.toString(),
					},
					{
						tag: "Current members: ",
						data: members.join("\n") || "none",
					},
				],
			});
		}
	}
}

async function log(opts) {
	const guild = client.guilds.resolve(opts.gId);
	var channel;
	try {
		channel = guild.channels.resolve(SETTINGS[opts.gId].LOG_CHANNEL);
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

function cLog() {
	console.log(Date().split(" ")[4] + ":");
	console.log(...arguments);
}

function updateVCName() {
	ownerships.forEach((ownership) => {
		const guild = client.guilds.resolve(ownership.guildId);
		if (!guild) {
			return;
		}
		const channel = guild.channels.resolve(ownership.id);
		if (!channel) {
			return;
		}
		// if (channel.members.array().length == 0) {
		// 	cLog("Empty VC found... attempting delete");
		// 	try {
		// 		ownerships = ownerships.filter((c) => c.id != channel.id);
		// 		channel.delete();
		// 		return;
		// 	} catch (e) {
		// 		cLog("Failed channel delete");
		// 		cLog(e);
		// 	}
		// }
		const member = guild.members.resolve(ownership.ownerId);
		const gId = guild.id;
		if (SETTINGS[gId].AUTO_UPDATE_NAME) {
			var activity = member.presence.activities.find(
				(act) => act.type == "PLAYING"
			);
			var name;
			if (activity) {
				name = activity.name;
			} else {
				name = SETTINGS[gId].DEFAULT_NAME;
				if (SETTINGS[gId].USERNAME_IN_VC) {
					name = member.user.username + " - " + name;
				}
			}
			name = SETTINGS[gId].CHANNEL_PREFIX + " " + name;
			if (name != channel.name && !ownership.isCustomName) {
				try {
					channel.edit({ name: name });
				} catch (e) {
					cLog("Failed channel re-name");
					cLog(e);
				}
			}
		}
	});
}

setInterval(updateVCName, 1000);
