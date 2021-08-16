const EventListener = require('../modules/listeners/listener');

const { MessageEmbed } = require('discord.js');
const { footer } = require('../utils/discord');

module.exports = class MessageReactionAddEventListener extends EventListener {
	constructor(client) {
		super(client, { event: 'messageReactionAdd' });
	}

	async execute(r, u) {

		if (r.partial) {
			try {
				await r.fetch();
			} catch (err) {
				return this.client.log.error(err);
			}
		}

		if (u.partial) {
			try {
				await u.fetch();
			} catch (err) {
				return this.client.log.error(err);
			}
		}

		if (u.id === this.client.user.id) return;

		const guild = r.message.guild;
		if (!guild) return;

		const settings = await guild.getSettings();
		const i18n = this.client.i18n.getLocale(settings.locale);

		const channel = r.message.channel;
		const member = await guild.members.fetch(u.id);

		if (settings.blacklist.includes(u.id)) {
			return this.client.log.info(`Ignoring blacklisted member ${u.tag}`);
		} else {
			settings.blacklist.forEach(element => {
				if (guild.roles.cache.has(element) && member.roles.cache.has(element)) {
					return this.client.log.info(`Ignoring member ${u.tag} with blacklisted role`);
				}
			});
		}

		const t_row = await this.client.db.models.Ticket.findOne({ where: { id: channel.id } });

		if (t_row && t_row.opening_message === r.message.id) {
			if (r.emoji.name === '🙌' && await member.isStaff()) {
				// ticket claiming

				await t_row.update({ claimed_by: member.user.id });

				await channel.updateOverwrite(member.user.id, { VIEW_CHANNEL: true }, `Ticket claimed by ${member.user.tag}`);

				const cat_row = await this.client.db.models.Category.findOne({ where: { id: t_row.category } });

				for (const role of cat_row.roles) {
					await channel.updateOverwrite(role, { VIEW_CHANNEL: false }, `Ticket claimed by ${member.user.tag}`);
				}

				this.client.log.info(`${member.user.tag} has claimed "${channel.name}" in "${guild.name}"`);

				await channel.send(
					new MessageEmbed()
						.setColor(settings.colour)
						.setAuthor(member.user.username, member.user.displayAvatarURL())
						.setTitle(i18n('ticket.claimed.title'))
						.setDescription(i18n('ticket.claimed.description', member.toString()))
						.setFooter(settings.footer, guild.iconURL())
				);
			} else if(r.emoji.name === '❌') {
				await this.client.tickets.close(channel.id, member.user.id, guild.id);
			} else {
				await r.users.remove(u.id);
			}
		} else {
			const p_row = await this.client.db.models.Panel.findOne({ where: { message: r.message.id } });

			if (p_row && typeof p_row.categories !== 'string') {
				// panels
				await r.users.remove(u.id);

				const category_id = p_row.categories[r.emoji.name];
				if (!category_id) return;

				const cat_row = await this.client.db.models.Category.findOne({ where: { id: category_id } });

				const tickets = await this.client.db.models.Ticket.findAndCountAll({
					where: {
						category: cat_row.id,
						creator: u.id,
						open: true
					}
				});

				let response;

				if (tickets.count >= cat_row.max_per_member) {
					if (cat_row.max_per_member === 1) {
						const embed = new MessageEmbed()
							.setColor(settings.error_colour)
							.setAuthor(u.username, u.displayAvatarURL())
							.setTitle(i18n('commands.new.response.has_a_ticket.title'))
							.setDescription(i18n('commands.new.response.has_a_ticket.description', tickets.rows[0].id))
							.setFooter(footer(settings.footer, i18n('message_will_be_deleted_in', 15)), guild.iconURL());
						try {
							response = await u.send(embed);
						} catch {
							response = await channel.send(embed);
						}
					} else {
						const list = tickets.rows.map(row => {
							if (row.topic) {
								const description = row.topic.substring(0, 30);
								const ellipses = row.topic.length > 30 ? '...' : '';
								return `<#${row.id}>: \`${description}${ellipses}\``;
							} else {
								return `<#${row.id}>`;
							}
						});
						const embed = new MessageEmbed()
							.setColor(settings.error_colour)
							.setAuthor(u.username, u.displayAvatarURL())
							.setTitle(i18n('commands.new.response.max_tickets.title', tickets.count))
							.setDescription(i18n('commands.new.response.max_tickets.description', settings.command_prefix, list.join('\n')))
							.setFooter(footer(settings.footer, i18n('message_will_be_deleted_in', 15)), u.iconURL());
						try {
							response = await u.send(embed);
						} catch {
							response = await channel.send(embed);
						}
					}
				} else {
					try {
						await this.client.tickets.create(guild.id, u.id, cat_row.id);
					} catch (error) {
						const embed = new MessageEmbed()
							.setColor(settings.error_colour)
							.setAuthor(u.username, u.displayAvatarURL())
							.setTitle(i18n('commands.new.response.error.title'))
							.setDescription(error.message)
							.setFooter(footer(settings.footer, i18n('message_will_be_deleted_in', 15)), guild.iconURL());
						try {
							response = await u.send(embed);
						} catch {
							response = await channel.send(embed);
						}
					}
				}

				if (response) {
					setTimeout(async () => {
						await response.delete();
					}, 15000);
				}
			}
		}

	}
};
