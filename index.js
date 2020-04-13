require("dotenv").config();
const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();
const settingsFile = "./settings.json";
var SETTINGS = {};

const BASE_SETTINGS = {
	VC_CREATOR_NAME: "+ New VC",
	CHANNEL_PREFIX: ">",
	MIN_NAME_LEN: 3,
	DEFAULT_NAME: "General",
	ALLOW_CUSTOM_NAME: true,
	LOG_CHANNEL: "-",
};

const SETTING_VALIDATE = {
	VC_CREATOR_NAME: (val) => typeof val == "string" && val.length > 1,
	CHANNEL_PREFIX: (val) => typeof val == "string" && val.length == 1,
	MIN_NAME_LEN: (val) => typeof val == "number",
	DEFAULT_NAME: (val) => typeof val == "string" && val.length > 1,
	ALLOW_CUSTOM_NAME: (val) => typeof val == "boolean",
	LOG_CHANNEL: (val) => typeof val == "string" && val.length == 18,
};

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
	SETTINGS = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
});

client.on("message", async (message) => {
	if (!SETTINGS[message.guild.id]) {
		SETTINGS[message.guild.id] = BASE_SETTINGS;
		console.log("Init settings done for %s", message.guild.id);
		fs.writeFileSync(settingsFile, JSON.stringify(SETTINGS));
	}
	handleMessage(message);
	if (message.content == "-whoami") {
		message.reply(process.env.whoami);
	}
});

client.on("voiceStateUpdate", async (oldState, newState) => {
	handleVCUpdate(oldState, newState, (oldState || newState).guild.id);
});

client.login(process.env.TOKEN);

async function editVCName(vc, commandText, member, gId) {
	if (!vc) {
		return "```diff\n-ERROR: You must be in a voice call to use that command```";
	}
	if (!SETTINGS[gId].ALLOW_CUSTOM_NAME) {
		return "```diff\n-ERROR: Admin has disabled this command```";
	}
	const newName = commandText.substring(commandText.indexOf(" "));
	if (!newName || newName.length < SETTINGS[gId].MIN_NAME_LEN) {
		return "```diff\n-ERROR: Invalid name length```";
	}
	if (vc.name[0] != SETTINGS[gId].CHANNEL_PREFIX) {
		return "```diff\n-ERROR: You cannot edit the channel name of a non-bot created vc```";
	} else {
		try {
			const oldName = vc.name;
			await vc.edit({ name: SETTINGS[gId].CHANNEL_PREFIX + newName });
			log(
				"Channel Name Update",
				member.user,
				gId,
				oldName + " -> " + vc.name
			);
		} catch (e) {
			return "```diff\n-ERROR: Invalid name```";
		}
	}
}

async function handleInit(message, gId) {
	if (!message.member.hasPermission("MANAGE_CHANNELS")) {
		message.channel.send(
			'```diff\n-ERROR: You do not have the "MANAGE_CHANNELS" permissions```'
		);
	} else {
		try {
			const newChannel = await message.guild.channels.create(
				SETTINGS[gId].VC_CREATOR_NAME,
				{
					type: "voice",
				}
			);
		} catch (e) {
			return "```diff\n-ERROR: Bot could not create channel. Does it have the permissions?```";
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
		return "```diff\n-ERROR: You are not an admin```";
	}
	SETTINGS = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
	const key = args[1];
	var value = "";
	for (var i = 2; i < args.length; i++) {
		value += args[i] + " ";
	}
	value = value.substring(0, value.length - 1);
	if (key == undefined || value == undefined) {
		return "```diff\n-ERROR: Invalid arguments```";
	}
	if (SETTINGS[gId][key] == undefined) {
		return "```diff\n-ERROR: Invalid setting```";
	}
	if (value == "true") {
		value = true;
	} else if (value == "false") {
		value = false;
	} else if (!isNaN(parseInt(value)) && value.length != 18) {
		//God this solotion is bad but it works
		value = parseInt(value);
	}
	const isValid = SETTING_VALIDATE[key](value);
	if (!isValid) {
		return "```diff\n-ERROR: Invalid value```";
	}
	SETTINGS[gId][key] = value;
	fs.writeFileSync(settingsFile, JSON.stringify(SETTINGS));
	return "```diff\n+DONE: Set " + key + " to " + value + "```";
}

async function handleMessage(message) {
	var retMessage;
	const gId = message.guild.id;
	if (message.content == "-init") {
		retMessage = await handleInit(message, gId);
	} else if (message.content.startsWith("-name")) {
		const vc = message.member.voice.channel;
		retMessage = await editVCName(vc, message.content, message.member, gId);
	} else if (message.content.startsWith("-help")) {
		helpMessage(message);
	} else if (message.content.startsWith("-config")) {
		retMessage = handleConfig(message.content, message.member, gId);
	}
	if (retMessage) {
		message.channel.send(retMessage);
	}
}

async function handleVCUpdate(oldState, newState, gId) {
	const member = (newState || oldState).member;
	if (newState.channelID != undefined) {
		const joinedChannel = newState.guild.channels.resolve(newState.channelID);
		if (joinedChannel.name == SETTINGS[gId].VC_CREATOR_NAME) {
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
				log("New channel", member.user, gId, name);
			} catch (e) {
				log(
					"Error!,",
					undefined,
					gId,
					"bot does not have correct permissions"
				);
			}
		}
	}
	if (oldState.channelID != undefined) {
		const leftChannel = oldState.guild.channels.resolve(oldState.channelID);
		if (!leftChannel) {
			console.log("Error could not resolve what channel the user left from");
			return;
		}
		if (
			leftChannel.name[0] == SETTINGS[gId].CHANNEL_PREFIX &&
			leftChannel.members.array().length == 0
		) {
			try {
				log(
					"Channel deleted,",
					member.user,
					gId,
					"all members left the channel"
				);
				leftChannel.delete();
			} catch (e) {
				log("Error!,", undefined, gId, "bot failed to delete channel");
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
						const prevName = leftChannel.name;
						const newName = SETTINGS[gId].CHANNEL_PREFIX + activity.name;
						leftChannel.edit({
							name: SETTINGS[gId].CHANNEL_PREFIX + activity.name,
						});
						log(
							"Channel Name Update",
							member.user,
							gId,
							prevName + " -> " + newName
						);
					} catch (e) {
						log(
							"Error!,",
							undefined,
							gId,
							"bot failed to rename channel"
						);
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
					log(
						"Channel Name Update",
						member.user,
						gId,
						prevName + " -> " + newName
					);
				} catch (e) {
					log(
						"Error!,",
						undefined,
						gId,
						"bot failed to edit channel name"
					);
					console.log("Failed to edit channel name");
				}
			}
		}
	}
}

function log(event, causedBy, gId, details) {
	const guild = client.guilds.resolve(gId);
	const channel = guild.channels.resolve(SETTINGS[gId].LOG_CHANNEL);
	if (!channel) {
		return;
	}
	const emb = new Discord.MessageEmbed();
	emb.setColor("#00ff00");
	emb.setTitle("Log");
	if (causedBy) {
		emb.addField("Triggerd by:", causedBy, false);
	}
	emb.setDescription(event);
	if (details) {
		emb.addField("Info: ", details, false);
	}
	emb.setTimestamp();
	channel.send(emb);
}
