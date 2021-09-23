const Command = require('../modules/commands/command');
const {
	Message, // eslint-disable-line no-unused-vars
	MessageEmbed
} = require('discord.js');

module.exports = class TagCommand extends Command {
	constructor(client) {
		const i18n = client.i18n.getLocale(client.config.locale);
		super(client, {
			// options: [
			// 	{
			// 		description: i18n('commands.tag.options.command.description'),
			// 		example: i18n('commands.tag.options.tag.example'),
			// 		name: i18n('commands.tag.options.tag.name'),
			// 		required: false
			// 	}
			// ],
			description: i18n('commands.tag.description'),
			internal: true,
			name: i18n('commands.tag.name'),
			staff_only: true
		});
	}

	/**
	 * @param {Message} message
	 * @param {string} options
	 * @returns {Promise<void|any>}
	 */
	async execute(message, options) {
		const settings = await this.client.utils.getSettings(message.guild);
		const i18n = this.client.i18n.getLocale(settings.locale);

		const t_row = await this.client.db.models.Ticket.findOne({ where: { id: message.channel.id } });

		options = options.split(/\s/g); // convert to an array
		const tag_name = options.shift(); // shift the first element
		options = options.join(' '); // convert back to a string with the first word removed

		if (tag_name && settings.tags[tag_name]) {
			const tag = settings.tags[tag_name];
			const placeholders = [...tag.matchAll(/(?<!\\){{1,2}\s?([A-Za-z0-9._:]+)\s?(?<!\\)}{1,2}/gi)].map(p => p[1]);
			const requires_ticket = placeholders.some(p => p.startsWith('ticket.'));

			if (requires_ticket && !t_row) {
				return await message.channel.send({
					embeds: [
						new MessageEmbed()
							.setColor(settings.error_colour)
							.setTitle(i18n('commands.tag.response.not_a_ticket.title'))
							.setDescription(i18n('commands.tag.response.not_a_ticket.description'))
							.setFooter(settings.footer, message.guild.iconURL())
					]
				});
			}

			const expected = placeholders
				.filter(p => p.startsWith(':'))
				.map(p => ({
					name: p.substr(1, p.length),
					type: String
				}));

			if (expected.length >= 1) {
				try {
					options = parseoptions(expected, { argv: argv(options) });
				} catch (error) {
					return await message.channel.send({
						embeds: [
							new MessageEmbed()
								.setColor(settings.error_colour)
								.setTitle(i18n('commands.tag.response.error'))
								.setDescription(`\`\`\`${error.message}\`\`\``)
								.setFooter(settings.footer, message.guild.iconURL())
						]
					});
				}
			} else {
				options = {};
			}

			for (const p of expected) {
				if (!options[p.name]) {
					const list = expected.map(p => `\`${p.name}\``);
					return await message.channel.send({
						embeds: [
							new MessageEmbed()
								.setColor(settings.error_colour)
								.setTitle(i18n('commands.tag.response.error'))
								.setDescription(i18n('commands.tag.response.missing', list.join(', ')))
								.setFooter(settings.footer, message.guild.iconURL())
						]
					});
				}
			}

			if (requires_ticket) {
				options.ticket = t_row.toJSON();
				options.ticket.topic = t_row.topic ? this.client.cryptr.decrypt(t_row.topic) : null;
			}

			// note that this regex is slightly different to the other
			const text = tag.replace(/(?<!\\){{1,2}\s?:?([A-Za-z0-9._]+)\s?(?<!\\)}{1,2}/gi, (_$, $1) => this.client.i18n.resolve(options, $1));
			return await message.channel.send({
				embeds: [
					new MessageEmbed()
						.setColor(settings.colour)
						.setDescription(text)
				]
			});
		} else {
			const list = Object.keys(settings.tags).map(t => `❯ **\`${t}\`**`);
			return await message.channel.send({
				embeds: [
					new MessageEmbed()
						.setColor(settings.colour)
						.setTitle(i18n('commands.tag.response.list.title'))
						.setDescription(list.join('\n'))
						.setFooter(settings.footer, message.guild.iconURL())
				]
			});
		}



		this.client.commands.publish(message.guild);

	}
};
