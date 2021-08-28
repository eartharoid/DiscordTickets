const Command = require('../modules/commands/command');
const {
	Message, // eslint-disable-line no-unused-vars
	MessageEmbed,
        MessageButton
} = require('discord.js');
const {
	some, wait
} = require('../utils');
const { emojify } = require('node-emoji');

module.exports = class PanelCommand extends Command {
	constructor(client) {
		const i18n = client.i18n.getLocale(client.config.locale);
		super(client, {
			aliases: [],
			args: [
				{
					alias: i18n('commands.panel.args.title.alias'),
					description: i18n('commands.panel.args.title.description'),
					example: i18n('commands.panel.args.title.example'),
					name: i18n('commands.panel.args.title.name'),
					required: false,
					type: String
				},
				{
					alias: i18n('commands.panel.args.description.alias'),
					description: i18n('commands.panel.args.description.description'),
					example: i18n('commands.panel.args.description.example'),
					name: i18n('commands.panel.args.description.name'),
					required: true,
					type: String
				},
				{
					alias: i18n('commands.panel.args.emoji.alias'),
					description: i18n('commands.panel.args.emoji.description'),
					example: i18n('commands.panel.args.emoji.example'),
					multiple: true,
					name: i18n('commands.panel.args.emoji.name'),
					required: false,
					type: String
				},
				{
					alias: i18n('commands.panel.args.categories.alias'),
					description: i18n('commands.panel.args.categories.description'),
					example: i18n('commands.panel.args.categories.example'),
					multiple: true,
					name: i18n('commands.panel.args.categories.name'),
					required: true,
					type: String
				}
			],
			description: i18n('commands.panel.description'),
			internal: true,
			name: i18n('commands.panel.name'),
			permissions: ['MANAGE_GUILD'],
			process_args: true
		});
	}

	/**
	 * @param {Message} message
	 * @param {*} args
	 * @returns {Promise<void|any>}
	 */
	async execute(message, args) {
		// localised command and arg names are a pain
		const arg_title = this.args[0].name;
		const arg_description = this.args[1].name;
		const arg_emoji = this.args[2].name;
		const arg_categories = this.args[3].name;

		const settings = await this.client.utils.getSettings(message.guild);
		const i18n = this.client.i18n.getLocale(settings.locale);

		if (!args[arg_emoji]) args[arg_emoji] = [];

		args[arg_emoji] = args[arg_emoji].map(emoji => emojify(emoji.replace(/\\/g, '')));

		const invalid_category = await some(args[arg_categories], async id => {
			const cat_row = await this.client.db.models.Category.findOne({
				where: {
					guild: message.guild.id,
					id
				}
			});
			return !cat_row;
		});

		if (invalid_category) {
			return await message.channel.send({
				embeds: [
					new MessageEmbed()
						.setColor(settings.error_colour)
						.setTitle(i18n('commands.panel.response.invalid_category.title'))
						.setDescription(i18n('commands.panel.response.invalid_category.description'))
						.setFooter(settings.footer, message.guild.iconURL())
				]
			});
		}

		let panel_channel,
			panel_message;

		let categories_map = args[arg_categories][0];

		const embed = new MessageEmbed()
			.setColor(settings.colour)
			.setFooter(settings.footer, message.guild.iconURL());

		if (args[arg_title]) embed.setTitle(args[arg_title]);

		if (args[arg_emoji].length === 0) {
			// reaction-less panel
			panel_channel = await message.guild.channels.create('create-a-ticket', {
				permissionOverwrites: [
					{
						allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY'],
						deny: ['ATTACH_FILES', 'EMBED_LINKS', 'ADD_REACTIONS'],
						id: message.guild.roles.everyone
					},
					{
						allow: ['SEND_MESSAGES', 'EMBED_LINKS', 'ADD_REACTIONS'],
						id: this.client.user.id
					}
				],
				position: 1,
				rateLimitPerUser: 30,
				reason: `${message.author.tag} created a new reaction-less panel`,
				type: 'GUILD_TEXT'
			});

			embed.setDescription(args[arg_description]);
			panel_message = await panel_channel.send({ embeds: [embed] });

			this.client.log.info(`${message.author.tag} has created a new reaction-less panel`);
		} else {
			if (args[arg_categories].length !== args[arg_emoji].length) {
				// send error
				return await message.channel.send({
					embeds: [
						new MessageEmbed()
							.setColor(settings.error_colour)
							.setTitle(i18n('commands.panel.response.mismatch.title'))
							.setDescription(i18n('commands.panel.response.mismatch.description'))
							.setFooter(settings.footer, message.guild.iconURL())
					]
				});
			} else {
				panel_channel = await message.guild.channels.create('create-a-ticket', {
					permissionOverwrites: [
						{
							allow: ['VIEW_CHANNEL', 'READ_MESSAGE_HISTORY'],
							deny: ['SEND_MESSAGES', 'ADD_REACTIONS'],
							id: message.guild.roles.everyone
						},
						{
							allow: ['SEND_MESSAGES', 'EMBED_LINKS', 'ADD_REACTIONS'],
							id: this.client.user.id
						}
					],
					position: 1,
					reason: `${message.author.tag} created a new panel`,
					type: 'GUILD_TEXT'
				});

				if (args[arg_emoji].length === 1) {
					// single category
					categories_map = {};
					categories_map[args[arg_emoji][0]] = args[arg_categories][0];
					embed.setDescription(args[arg_description]);
					panel_message = await panel_channel.send({ embeds: [embed] });
					await panel_message.react(args[arg_emoji][0]);
				} else {
					// multi category
					let description = '';
					categories_map = {};

					for (const i in args[arg_emoji]) {
						categories_map[args[arg_emoji][i]] = args[arg_categories][i];
						const cat_row = await this.client.db.models.Category.findOne({
							where: {
								guild: message.guild.id,
								id: args[arg_categories][i]
							}
						});
						description += `\n> ${args[arg_emoji][i]} | ${cat_row.name}`;
					}

					embed.setDescription(args[arg_description] + '\n' + description);
                    const row = new MessageActionRow();
                    const key = this._generateString(5); //I don't know if this is needed but I still do because I think all custom IDs should be unique
                    const button = new MessageButton();
                    button.setLabel(i18n('commands.panel.button.label'));
                    button.setStyle("PRIMARY");
                    button.setCustomId(`tickets-${key}`);
                    button.setEmoji(args[arg_emoji][0]);
                    row.addComponents(button);
					panel_message = await panel_channel.send({
						embeds: [
							embed
						],
                        components: [row],
					});
                    this.client.on("interactionCreate", async (interaction) => {
                        if (!interaction.isButton() || interaction.customId !== `tickets-${key}` || !interaction.inGuild()) return;
                        const p_row = await this.client.db.models.Panel.findOne({ where: { message: interaction.message.id } });
			            if (p_row && typeof p_row.categories !== 'string') {
				            const { user } = interaction;

				            const category_id = p_row.categories[reaction.emoji.name];
				            if (!category_id) return;

				            const cat_row = await this.client.db.models.Category.findOne({ where: { id: category_id } });

				            const tickets = await this.client.db.models.Ticket.findAndCountAll({
					        	where: {
						    		category: cat_row.id,
						    		creator: user.id,
						    		open: true
					        	}
				            });

				            let response;

				            if (tickets.count >= cat_row.max_per_member) {
					        if (cat_row.max_per_member === 1) {
						    	const embed = new MessageEmbed()
									.setColor(settings.error_colour)
									.setAuthor(user.username, user.displayAvatarURL())
									.setTitle(i18n('commands.new.response.has_a_ticket.title'))
									.setDescription(i18n('commands.new.response.has_a_ticket.description', tickets.rows[0].id))
									.setFooter(this.client.utils.footer(settings.footer, i18n('message_will_be_deleted_in', 15)), guild.iconURL());
						    	try {
							 		response = await user.send({ embeds: [embed] });
						    	} catch {
									response = await channel.send({ embeds: [embed] });
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
									.setAuthor(user.username, user.displayAvatarURL())
									.setTitle(i18n('commands.new.response.max_tickets.title', tickets.count))
									.setDescription(i18n('commands.new.response.max_tickets.description', settings.command_prefix, list.join('\n')))
									.setFooter(this.client.utils.footer(settings.footer, i18n('message_will_be_deleted_in', 15)), user.iconURL());
								try {
									response = await user.send({ embeds: [embed] });
								} catch {
									response = await channel.send({ embeds: [embed] });
								}
					    	}
				        } else {
					    	try {
								await this.client.tickets.create(guild.id, user.id, cat_row.id);
					    	} catch (error) {
							const embed = new MessageEmbed()
								.setColor(settings.error_colour)
								.setAuthor(user.username, user.displayAvatarURL())
								.setTitle(i18n('commands.new.response.error.title'))
								.setDescription(error.message)
								.setFooter(this.client.utils.footer(settings.footer, i18n('message_will_be_deleted_in', 15)), guild.iconURL());
								try {
									response = await user.send({ embeds: [embed] });
								} catch {
									response = await channel.send({ embeds: [embed] });
								}
					     	}
				        }
			        }
				});

				this.client.log.info(`${message.author.tag} has created a new panel`);
			}
		}

		message.channel.send({ content: `✅ ${panel_channel}` });

		await this.client.db.models.Panel.create({
			categories: categories_map,
			channel: panel_channel.id,
			guild: message.guild.id,
			message: panel_message.id
		});
	}
}

    _generateString(length) {
        let result           = "";
        const characters       = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
        }
        return result;
    }
};
