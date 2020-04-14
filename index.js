require("dotenv").config();
const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();
const settingsFile = "./settings.json";
const MAX_EMPTY = 2;
var SETTINGS = {};

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
};

const hexValidate = (val) =>
	typeof val == "string" && val[0] == "#" && val.length == 7;

const SETTING_VALIDATE = {
	VC_CREATOR_ID: (val) => typeof val == "string" && val.length > 1,
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
};

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
	SETTINGS = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
});

client.on("message", async (message) => {
	if (!SETTINGS[message.guild.id]) {
		initSettings(message.guild.id);
	}
	handleMessage(message);
	if (message.content == "-whoami") {
		message.reply(process.env.whoami);
	}
});

client.on("voiceStateUpdate", async (oldState, newState) => {
	if (!SETTINGS[newState.guild.id]) {
		initSettings(channel.guild.id);
	}
	handleVCUpdate(oldState, newState, (oldState || newState).guild.id);
});

client.on("channelUpdate", (oldChannel, newChannel) => {
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
	log({
		name: "Channel deleted " + channel.name,
		gId: channel.guild.id,
		color: SETTINGS[channel.guild.id].channelDelete,
	});
});

client.login(process.env.TOKEN);

function initSettings(id) {
	SETTINGS[id] = BASE_SETTINGS;
	console.log("Init settings done for %s", id);
	fs.writeFileSync(settingsFile, JSON.stringify(SETTINGS));
}

function error(msg) {
	return "```diff\n-ERROR: " + msg + " ```";
}

async function editVCName(vc, commandText, gId) {
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
	} else {
		try {
			const oldName = vc.name;
			await vc.edit({ name: SETTINGS[gId].CHANNEL_PREFIX + newName });
		} catch (e) {
			return error("Invalid name");
		}
	}
}

async function handleInit(message, gId) {
	if (!message.member.hasPermission("MANAGE_CHANNELS")) {
		return error('You do not have the "MANAGE_CHANNELS" permissions');
	} else {
		try {
			const newChannel = await message.guild.channels.create(
				SETTINGS[gId].VC_CREATOR_ID,
				{
					type: "voice",
				}
			);
		} catch (e) {
			return error(
				"Bot could not create channel. Does it have the permissions?"
			);
		}
	}
}

async function helpMessage(message) {
	const emb = new Discord.MessageEmbed();
	emb.setColor("#0099ff");
	emb.setTitle("Auto VC Help");
	emb.setAuthor(message.author.username);
	emb.setDescription("Help:");
	emb.addField("**-init**", 'Creates the "Create VC" voice channel', false);
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
	return "```diff\n+DONE: Set " + key + " to " + value + "```";
}

async function handleMessage(message) {
	var retMessage;
	const gId = message.guild.id;
	if (message.content == "-init") {
		// retMessage = await handleInit(message, gId);
	} else if (message.content.startsWith("-name")) {
		const vc = message.member.voice.channel;
		retMessage = await editVCName(vc, message.content, gId);
	} else if (message.content.startsWith("-help")) {
		helpMessage(message);
	} else if (message.content.startsWith("-config")) {
		retMessage = handleConfig(message.content, message.member, gId);
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
			name = member.user.username + " - " + SETTINGS[gId].DEFAULT_NAME;
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
				console.log("---TOO MANY EMPTY CHANNELS---");
				return;
			}
			const newChannel = await newState.guild.channels.create(
				SETTINGS[gId].CHANNEL_PREFIX + name,
				{
					type: "voice",
					parent: joinedChannel.parentID,
				}
			);
			member.edit({
				channel: newChannel,
			});
		} catch (e) {
			console.log(e);
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
			leftChannel.delete();
		} catch (e) {
			console.log("CHANNEL DELETE FAILED!!!");
			console.log(e);
		}
	} else if (leftChannel.name[0] == SETTINGS[gId].CHANNEL_PREFIX) {
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
					console.log(e);
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
				console.log(e);
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

function log(opts) {
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
	channel.send(emb);
}
