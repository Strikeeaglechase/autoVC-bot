const REDACTED = require("./redacted.js");
const events = {
	ready: function () {
		this.log(`Logged in as ${this.client.user.tag}!`);
		this.client.user.setPresence({
			activity: { name: "[YOUR AD HERE]. Dm for info" },
			status: "online",
		});
		this.loadState();
		process.send({
			type: "bot",
			msg: "online",
		});
	},
	message: function (msg) {
		this.handleMessage(msg);
		REDACTED(msg, this.client);
	},
	voiceStateUpdate: function (oldState, newState) {
		if (!oldState && !newState) {
			return;
		}
		const gId = (oldState || newState).guild.id;
		if (!gId) {
			return;
		}
		/*Handle logging*/
		//On join
		if (
			newState.channelID != undefined &&
			newState.channelID != oldState.channelID
		) {
			let members;
			const c = this.channels.find(
				(chan) => chan.channel.id == newState.channelID
			);
			if (c) {
				members = newState.guild.channels
					.resolve(newState.channelID)
					.members.array();
				c.memberCount = members.length;
			}
			if (newState.channelID != this.settings.get(gId).VC_CREATOR_ID) {
				const vc = newState.guild.channels.resolve(newState.channelID);
				if (!members) {
					members = vc.members.array();
				}
				this.serverLog({
					name: "Joined voice channel " + vc.name,
					gId: gId,
					color: this.settings.get(gId).vcJoin,
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
			} else {
				this.createNewVC(newState.member);
			}
		}
		//On leave
		if (
			oldState.channelID != undefined &&
			newState.channelID != oldState.channelID
		) {
			let members;
			const c = this.channels.find(
				(chan) => chan.channel.id == oldState.channelID
			);
			if (c) {
				members = oldState.guild.channels
					.resolve(oldState.channelID)
					.members.array();
				c.memberCount = members.length;
			}
			if (oldState.channelID != this.settings.get(gId).VC_CREATOR_ID) {
				const vc = oldState.guild.channels.resolve(oldState.channelID);
				if (!vc) {
					return;
				}
				if (!members) {
					members = vc.members.array();
				}
				this.serverLog({
					// member: newState.member,
					name: "Left voice channel: " + vc.name,
					gId: gId,
					color: this.settings.get(gId).vcLeave,
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
	},
	channelUpdate: function (oldChannel, newChannel) {
		if (!newChannel.guild) {
			return;
		}
		if (
			newChannel.type != "voice" ||
			!oldChannel ||
			oldChannel.name == newChannel.name
		) {
			return;
		}
		this.serverLog({
			name: "Channel updated " + newChannel.name,
			gId: newChannel.guild.id,
			color: this.settings.get(newChannel.guild.id).channelUpdate,
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
	},
	channelCreate: function (channel) {
		if (!channel.guild) {
			return;
		}
		this.serverLog({
			name: 'Channel created "' + channel.name + '"',
			gId: channel.guild.id,
			color: this.settings.get(channel.guild.id).channelCreate,
		});
	},
	channelDelete: function (channel) {
		if (!channel.guild) {
			return;
		}
		this.serverLog({
			name: 'Channel deleted "' + channel.name + '"',
			gId: channel.guild.id,
			color: this.settings.get(channel.guild.id).channelDelete,
		});
	},
};
module.exports = events;
