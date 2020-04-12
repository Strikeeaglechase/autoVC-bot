require("dotenv").config();
const Discord = require("discord.js");
const client = new Discord.Client();
const VC_CREATOR_NAME = "+ New VC";
const CHANNEL_PREFIX = ">";
const MIN_NAME_LEN = 3;
client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
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
	const newName = commandText.substring(commandText.indexOf(" "));
	if (!newName || newName.length < MIN_NAME_LEN) {
		return "```diff\n-ERROR: Invalid name length```";
	}
	if (vc.name[0] != CHANNEL_PREFIX) {
		return "```diff\n-ERROR: You cannot edit the channel name of a non-bot created vc```";
	} else {
		try {
			await vc.edit({ name: ">" + newName });
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
		const newChannel = await message.guild.channels.create(VC_CREATOR_NAME, {
			type: "voice",
		});
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
	emb.setTimestamp();
	emb.setFooter("Bot created by Strikeeaglechase#0001");
	message.channel.send(emb);
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
	}
	if (retMessage) {
		message.channel.send(retMessage);
	}
}

async function handleVCUpdate(oldState, newState) {
	if (newState.channelID != undefined) {
		const joinedChannel = newState.guild.channels.resolve(newState.channelID);
		if (joinedChannel.name == VC_CREATOR_NAME) {
			const newChannel = await newState.guild.channels.create(
				">New VC Channel",
				{
					type: "voice",
					parent: joinedChannel.parentID,
				}
			);
			const member = newState.guild.members.resolve(newState.id);
			member.edit({
				channel: newChannel,
			});
		}
	}
	if (oldState.channelID != undefined) {
		const leftChannel = oldState.guild.channels.resolve(oldState.channelID);
		if (
			leftChannel.name[0] == CHANNEL_PREFIX &&
			leftChannel.members.array().length == 0
		) {
			try {
				leftChannel.delete();
			} catch (e) {}
		}
	}
}
