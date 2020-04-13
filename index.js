require("dotenv").config();
const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();
const settingsFile = "./settings.json";
var SETTINGS = {
	VC_CREATOR_NAME: "+ New VC",
	CHANNEL_PREFIX: ">",
	MIN_NAME_LEN: 3,
	DEFAULT_NAME: "General",
	ALLOW_CUSTOM_NAME: true,
};

const SETTING_VALIDATE = {
	VC_CREATOR_NAME: (val) => typeof val == "string" && val.length > 1,
	CHANNEL_PREFIX: (val) => typeof val == "string" && val.length == 1,
	MIN_NAME_LEN: (val) => typeof val == "number",
	DEFAULT_NAME: (val) => typeof val == "string" && val.length > 1,
	ALLOW_CUSTOM_NAME: (val) => typeof val == "boolean",
};

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
	SETTINGS = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
});

client.on("message", async (message) => {
	handleMessage(message);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
	handleVCUpdate(oldState, newState);
});

client.login(process.env.TOKEN);

async function editVCName(vc, commandText) {
	if (!vc) {
		return "```diff\n-ERROR: You must be in a voice call to use that command```";
	}
	if (!SETTINGS.ALLOW_CUSTOM_NAME) {
		return "```diff\n-ERROR: Admin has disabled this command```";
	}
	const newName = commandText.substring(commandText.indexOf(" "));
	if (!newName || newName.length < SETTINGS.MIN_NAME_LEN) {
		return "```diff\n-ERROR: Invalid name length```";
	}
	if (vc.name[0] != SETTINGS.CHANNEL_PREFIX) {
		return "```diff\n-ERROR: You cannot edit the channel name of a non-bot created vc```";
	} else {
		try {
			await vc.edit({ name: SETTINGS.CHANNEL_PREFIX + newName });
		} catch (e) {
			return "```diff\n-ERROR: Invalid name```";
		}
	}
}

async function handleInit(message) {
	if (!message.member.hasPermission("MANAGE_CHANNELS")) {
		message.channel.send(
			'```diff\n-ERROR: You do not have the "MANAGE_CHANNELS" permissions```'
		);
	} else {
		const newChannel = await message.guild.channels.create(
			SETTINGS.VC_CREATOR_NAME,
			{
				type: "voice",
			}
		);
		if (!newChannel) {
			message.channel.send(
				"```diff\n-ERROR: Bot could not create channel. Does it have the permissions?```"
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

function handleConfig(command, member) {
	const args = command.split(" ");
	if (args.length == 1) {
		const emb = new Discord.MessageEmbed();
		emb.setColor("#0099ff");
		emb.setTitle("Auto VC Config");
		emb.setAuthor(member.user.username);
		emb.setDescription("Config:");
		for (var loopKey in SETTINGS) {
			emb.addField(loopKey, SETTINGS[loopKey]);
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
	var value = args[2];
	if (key == undefined || value == undefined) {
		return "```diff\n-ERROR: Invalid arguments```";
	}
	if (SETTINGS[key] == undefined) {
		return "```diff\n-ERROR: Invalid setting```";
	}
	if (value == "true") {
		value = true;
	} else if (value == "false") {
		value = false;
	} else if (!isNaN(parseInt(value))) {
		value = parseInt(value);
	}
	const isValid = SETTING_VALIDATE[key](value);
	if (!isValid) {
		return "```diff\n-ERROR: Invalid value```";
	}
	SETTINGS[key] = value;
	fs.writeFileSync(settingsFile, JSON.stringify(SETTINGS));
	return "```diff\n+DONE: Set " + key + " to " + value + "```";
}

async function handleMessage(message) {
	var retMessage;
	if (message.content == "-init") {
		retMessage = await handleInit(message);
	} else if (message.content.startsWith("-name")) {
		const vc = message.member.voice.channel;
		retMessage = await editVCName(vc, message.content);
	} else if (message.content.startsWith("-help")) {
		helpMessage(message);
	} else if (message.content.startsWith("-config")) {
		retMessage = handleConfig(message.content, message.member);
	}
	if (retMessage) {
		message.channel.send(retMessage);
	}
}

async function handleVCUpdate(oldState, newState) {
	if (newState.channelID != undefined) {
		const joinedChannel = newState.guild.channels.resolve(newState.channelID);
		if (joinedChannel.name == SETTINGS.VC_CREATOR_NAME) {
			const member = newState.member;
			var activity = member.presence.activities.find(
				(act) => act.type == "PLAYING"
			);
			var name;
			if (activity) {
				name = activity.name;
			} else {
				name = member.user.username + " - " + SETTINGS.DEFAULT_NAME;
			}
			const newChannel = await newState.guild.channels.create(
				SETTINGS.CHANNEL_PREFIX + name,
				{
					type: "voice",
					parent: joinedChannel.parentID,
				}
			);
			member.edit({
				channel: newChannel,
			});
		}
	}
	if (oldState.channelID != undefined) {
		const leftChannel = oldState.guild.channels.resolve(oldState.channelID);
		if (
			leftChannel.name[0] == SETTINGS.CHANNEL_PREFIX &&
			leftChannel.members.array().length == 0
		) {
			try {
				leftChannel.delete();
			} catch (e) {}
		}
	}
}
