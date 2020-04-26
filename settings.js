const fs = require("fs");
class SettingsController {
	constructor(logger) {
		this.BASE_SETTINGS = {
			PREFIX: "-",
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
		this.SETTING_VALIDATE = {
			VC_CREATOR_ID: {
				validate: (val) => typeof val == "string" && val.length == 18,
				parse: (val) => val,
			},
			CHANNEL_PREFIX: {
				validate: (val) => typeof val == "string" && val.length == 1,
				parse: (val) => val,
			},
			MIN_NAME_LEN: {
				validate: (val) => typeof val == "number" && val > 1,
				parse: (val) => parseInt(val),
			},
			DEFAULT_NAME: {
				validate: (val) => typeof val == "string" && val.length > 1,
				parse: (val) => val,
			},
			ALLOW_CUSTOM_NAME: {
				validate: (val) => typeof val == "boolean",
				parse: (val) => val.toLowerCase() == "true",
			},
			LOG_CHANNEL: {
				validate: (val) => typeof val == "string" && val.length == 18,
				parse: (val) => val,
			},
			channelUpdate: { validate: hexValidate, parse: (val) => val },
			channelCreate: { validate: hexValidate, parse: (val) => val },
			channelDelete: { validate: hexValidate, parse: (val) => val },
			vcJoin: { validate: hexValidate, parse: (val) => val },
			vcLeave: { validate: hexValidate, parse: (val) => val },
			DEFAULT_BITRATE: {
				validate: (val) =>
					typeof val == "number" && val > 8000 && val < 260000,
				parse: (val) => parseInt(val),
			},
			USER_LIMIT: {
				validate: (val) => typeof val == "number" && val < 99 && val >= 0,
				parse: (val) => parseInt(val),
			},
			AUTO_UPDATE_NAME: {
				validate: (val) => typeof val == "boolean",
				parse: (val) => val.toLowerCase() == "true",
			},
			USERNAME_IN_VC: {
				validate: (val) => typeof val == "boolean",
				parse: (val) => val.toLowerCase() == "true",
			},
		};
		this.settings;
		this.log = logger;
		this.settingsFile = "./settings.json";
		this.load();
	}
	load() {
		let loadedSettings = JSON.parse(
			fs.readFileSync(this.settingsFile, "utf8")
		);
		let updatedOldSettings = false;
		for (var gId in loadedSettings) {
			for (var key in this.BASE_SETTINGS) {
				if (loadedSettings[gId][key] == undefined) {
					loadedSettings[gId][key] = this.BASE_SETTINGS[key];
				}
			}
		}
		this.settings = loadedSettings;
		if (updatedOldSettings) {
			this.log("Settings manager is updating out of date settings");
			this.save();
		}
	}
	save() {
		fs.writeFileSync(this.settingsFile, JSON.stringify(this.settings));
	}
	get(gId) {
		var sets = this.settings[gId];
		if (!sets) {
			sets = this.BASE_SETTINGS;
			this.settings[gId] = sets;
			this.save();
			this.log("Created new settings file for %s", gId);
		}
		return this.settings[gId];
	}
	set(gId, key, value) {
		this.get(gId); //Ensure that this guild has been initilized but dont care about result
		if (this.settings[gId][key] == undefined) {
			return { failed: true, msg: "Invalid setting" };
		}
		const val = this.SETTING_VALIDATE[key].parse(value);
		if (!this.SETTING_VALIDATE[key].validate(val)) {
			return { failed: true, msg: "Invalid value" };
		}
		this.settings[gId][key] = val;
		this.save();
		return { failed: false, msg: "Updated " + key + " to: " + val };
	}
}

module.exports = SettingsController;
