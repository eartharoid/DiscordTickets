const EventListener = require('../modules/listeners/listener');

const { MessageEmbed } = require('discord.js');

module.exports = class MessageReactionAddEventListener extends EventListener {
	constructor(client) {
		super(client, { event: 'messageReactionAdd' });
	}

	async execute(reaction, user) {

		if (reaction.partial) {
			try {
				await reaction.fetch();
			} catch (err) {
				return this.client.log.error(err);
			}
		}

		if (user.partial) {
			try {
				await user.fetch();
			} catch (err) {
				return this.client.log.error(err);
			}
		}

		if (user.id === this.client.user.id) return;

		const guild = reaction.message.guild;
		if (!guild) return;

		const settings = await this.client.utils.getSettings(guild);
		const i18n = this.client.i18n.getLocale(settings.locale);

		const channel = reaction.message.channel;
		const member = await guild.members.fetch(user.id);

		if (settings.blacklist.includes(user.id)) {
			return this.client.log.info(`Ignoring blacklisted member ${user.tag}`);
		} else {
			settings.blacklist.forEach(element => {
				if (guild.roles.cache.has(element) && member.roles.cache.has(element)) {
					return this.client.log.info(`Ignoring member ${user.tag} with blacklisted role`);
				}
			});
		}

		const t_row = await this.client.db.models.Ticket.findOne({ where: { id: channel.id } });

		if (t_row && t_row.opening_message === reaction.message.id) {
			if (reaction.emoji.name === '🙌' && await this.client.utils.isStaff(member)) {
				// ticket claiming

				await t_row.update({ claimed_by: member.user.id });

				await channel.permissionOverwrites.edit(member.user.id, { VIEW_CHANNEL: true }, `Ticket claimed by ${member.user.tag}`);

				const cat_row = await this.client.db.models.Category.findOne({ where: { id: t_row.category } });

				for (const role of cat_row.roles) {
					await channel.permissionOverwrites.edit(role, { VIEW_CHANNEL: false }, `Ticket claimed by ${member.user.tag}`);
				}

				this.client.log.info(`${member.user.tag} has claimed "${channel.name}" in "${guild.name}"`);

				await channel.send({
					embeds: [
						new MessageEmbed()
							.setColor(settings.colour)
							.setAuthor(member.user.username, member.user.displayAvatarURL())
							.setTitle(i18n('ticket.claimed.title'))
							.setDescription(i18n('ticket.claimed.description', member.toString()))
							.setFooter(settings.footer, guild.iconURL())
					]
				});
			} else {
				await reaction.users.remove(user.id);
			}
		} else {
				if (response) {
					setTimeout(async () => {
						await response.delete();
					}, 15000);
				}
			}
		}

	}
};
