/* eslint-disable max-lines */
const EventEmitter = require('events');
const TicketArchives = require('./archives');
const { MessageEmbed } = require('discord.js');
const { footer } = require('../../utils/discord');

/** Manages tickets */
module.exports = class TicketManager extends EventEmitter {
	/**
	 * Create a TicketManager instance
	 * @param {import('../..').Bot} client
	 */
	constructor(client) {
		super();

		/** The Discord Client */
		this.client = client;

		this.setMaxListeners(this.client.config.max_listeners);

		this.archives = new TicketArchives(this.client);
	}

	/**
	 * Create a new ticket
	 * @param {string} guild_id - ID of the guild to create the ticket in
	 * @param {string} creator_id - ID of the ticket creator (user)
	 * @param {string} category_id - ID of the ticket category
	 * @param {string} [topic] - The ticket topic
	 */
	async create(guild_id, creator_id, category_id, topic) {
		if (!topic) topic = '';

		const cat_row = await this.client.db.models.Category.findOne({ where: { id: category_id } });

		if (!cat_row) throw new Error('Ticket category does not exist');

		const cat_channel = await this.client.channels.fetch(category_id);

		if (cat_channel.children.size >= 50) throw new Error('Ticket category has reached child channel limit (50)');

		const number = (await this.client.db.models.Ticket.count({ where: { guild: guild_id } })) + 1;

		const guild = this.client.guilds.cache.get(guild_id);
		const creator = await guild.members.fetch(creator_id);
		const name = cat_row.name_format
			.replace(/{+\s?(user)?name\s?}+/gi, creator.displayName)
			.replace(/{+\s?num(ber)?\s?}+/gi, number);

		const t_channel = await guild.channels.create(name, {
			parent: category_id,
			reason: `${creator.user.tag} requested a new ticket channel`,
			topic: `${creator}${topic.length > 0 ? ` | ${topic}` : ''}`,
			type: 'text'
		});

		t_channel.updateOverwrite(creator_id, {
			ATTACH_FILES: true,
			READ_MESSAGE_HISTORY: true,
			SEND_MESSAGES: true,
			VIEW_CHANNEL: true
		}, `Ticket channel created by ${creator.user.tag}`);

		const t_row = await this.client.db.models.Ticket.create({
			category: category_id,
			creator: creator_id,
			guild: guild_id,
			id: t_channel.id,
			number,
			topic: topic.length === 0 ? null : this.client.cryptr.encrypt(topic)
		});

		(async () => {
			const settings = await guild.getSettings();
			const i18n = this.client.i18n.getLocale(settings.locale);

			topic = t_row.topic
				? this.client.cryptr.decrypt(t_row.topic)
				: '';

			if (cat_row.ping instanceof Array && cat_row.ping.length > 0) {
				const mentions = cat_row.ping.map(id => id === 'everyone'
					? '@everyone'
					: id === 'here'
						? '@here'
						: `<@&${id}>`);

				await t_channel.send(mentions.join(', '));
			}

			if (cat_row.image) {
				await t_channel.send(cat_row.image);
			}

			const description = cat_row.opening_message
				.replace(/{+\s?(user)?name\s?}+/gi, creator.displayName)
				.replace(/{+\s?(tag|ping|mention)?\s?}+/gi, creator.user.toString());
			const embed = new MessageEmbed()
				.setColor(settings.colour)
				.setAuthor(creator.user.username, creator.user.displayAvatarURL())
				.setDescription(description)
				.setFooter(settings.footer, guild.iconURL());

			if (topic) embed.addField(i18n('ticket.opening_message.fields.topic'), topic);

			const sent = await t_channel.send(creator.user.toString(), embed);
			await sent.pin({ reason: 'Ticket opening message' });

			await t_row.update({ opening_message: sent.id });

			const pinned = t_channel.messages.cache.last();

			if (pinned.system) {
				pinned
					.delete({ reason: 'Cleaning up system message' })
					.catch(() => this.client.log.warn('Failed to delete system pin message'));
			}

			if (cat_row.claiming) {
				await sent.react('🙌');
			}

			await sent.react('❌');

			let questions;
			if (cat_row.opening_questions) {
				questions = cat_row.opening_questions
					.map((q, index) => `**${index + 1}.** ${q}`)
					.join('\n\n');
			}

			if (cat_row.require_topic && topic.length === 0) {
				const collector_message = await t_channel.send(
					new MessageEmbed()
						.setColor(settings.colour)
						.setTitle('⚠️ ' + i18n('commands.new.request_topic.title'))
						.setDescription(i18n('commands.new.request_topic.description'))
						.setFooter(footer(settings.footer, i18n('collector_expires_in', 120)), guild.iconURL())
				);

				const collector_filter = message => message.author.id === t_row.creator;

				const collector = t_channel.createMessageCollector(collector_filter, { time: 120000 });

				collector.on('collect', async message => {
					topic = message.content;
					await t_row.update({ topic: this.client.cryptr.encrypt(topic) });
					await t_channel.setTopic(`${creator} | ${topic}`, { reason: 'User updated ticket topic' });
					await sent.edit(
						new MessageEmbed()
							.setColor(settings.colour)
							.setAuthor(creator.user.username, creator.user.displayAvatarURL())
							.setDescription(description)
							.addField(i18n('ticket.opening_message.fields.topic'), topic)
							.setFooter(settings.footer, guild.iconURL())
					);
					await message.react('✅');
					collector.stop();
				});

				collector.on('end', async () => {
					collector_message
						.delete()
						.catch(() => this.client.log.warn('Failed to delete topic collector message'));
					if (cat_row.opening_questions) {
						await t_channel.send(
							new MessageEmbed()
								.setColor(settings.colour)
								.setDescription(i18n('ticket.questions', questions))
								.setFooter(settings.footer, guild.iconURL())
						);
					}
				});
			} else {
				if (cat_row.opening_questions) {
					await t_channel.send(
						new MessageEmbed()
							.setColor(settings.colour)
							.setDescription(i18n('ticket.questions', questions))
							.setFooter(settings.footer, guild.iconURL())
					);
				}
			}
		})();

		this.client.log.info(`${creator.user.tag} created a new ticket in "${guild.name}"`);

		this.emit('create', t_row.id, creator_id);

		return t_row;
	}

	/**
	 * Close a ticket
	 * @param {(string|number)} ticket_id - The channel ID, or the ticket number
	 * @param {string?} closer_id - ID of the member who is closing the ticket, or null
	 * @param {string} [guild_id] - The ID of the ticket's guild (used if a ticket number is provided instead of ID)
	 * @param {string} [reason] - The reason for closing the ticket
	 */
	async close(ticket_id, closer_id, guild_id, reason) {
		const t_row = await this.resolve(ticket_id, guild_id);
		if (!t_row) throw new Error(`A ticket with the ID or number "${ticket_id}" could not be resolved`);
		ticket_id = t_row.id;

		this.emit('beforeClose', ticket_id);

		const guild = this.client.guilds.cache.get(t_row.guild);
		const settings = await guild.getSettings();
		const i18n = this.client.i18n.getLocale(settings.locale);
		const channel = await this.client.channels.fetch(t_row.id);

		const close = async () => {
			const pinned = await channel.messages.fetchPinned();
			await t_row.update({
				closed_by: closer_id || null,
				closed_reason: reason ? this.client.cryptr.encrypt(reason) : null,
				open: false,
				pinned_messages: [...pinned.keys()]
			});

			if (closer_id) {
				const closer = await guild.members.fetch(closer_id);

				await this.archives.updateMember(ticket_id, closer);

				const description = reason
					? i18n('ticket.closed_by_member_with_reason.description', closer.user.toString(), reason)
					: i18n('ticket.closed_by_member.description', closer.user.toString());
				await channel.send(
					new MessageEmbed()
						.setColor(settings.success_colour)
						.setAuthor(closer.user.username, closer.user.displayAvatarURL())
						.setTitle(i18n('ticket.closed.title'))
						.setDescription(description)
						.setFooter(settings.footer, guild.iconURL())
				);

				setTimeout(async () => {
					await channel.delete(`Ticket channel closed by ${closer.user.tag}${reason ? `: "${reason}"` : ''}`);
				}, 5000);

				this.client.log.info(`${closer.user.tag} closed a ticket (${ticket_id})${reason ? `: "${reason}"` : ''}`);
			} else {
				const description = reason
					? i18n('ticket.closed_with_reason.description')
					: i18n('ticket.closed.description');
				await channel.send(
					new MessageEmbed()
						.setColor(settings.success_colour)
						.setTitle(i18n('ticket.closed.title'))
						.setDescription(description)
						.setFooter(settings.footer, guild.iconURL())
				);

				setTimeout(async () => {
					await channel.delete(`Ticket channel closed${reason ? `: "${reason}"` : ''}`);
				}, 5000);

				this.client.log.info(`A ticket was closed (${ticket_id})${reason ? `: "${reason}"` : ''}`);
			}
		};

		if (channel) {
			const creator = await guild.members.fetch(t_row.creator);

			const cat_row = await this.client.db.models.Category.findOne({ where: { id: t_row.category } });

			if (creator && cat_row.survey) {
				const survey = await this.client.db.models.Survey.findOne({
					where: {
						guild: t_row.guild,
						name: cat_row.survey
					}
				});

				if (survey) {
					const r_collector_message = await channel.send(
						creator.toString(),
						new MessageEmbed()
							.setColor(settings.colour)
							.setTitle(i18n('ticket.survey.start.title'))
							.setDescription(i18n('ticket.survey.start.description', creator.toString(), survey.questions.length))
							.setFooter(i18n('collector_expires_in', 60))
					);

					await r_collector_message.react('✅');

					const collector_filter = (reaction, user) => user.id === creator.user.id && reaction.emoji.name === '✅';

					const r_collector = r_collector_message.createReactionCollector(collector_filter, { time: 60000 });

					r_collector.on('collect', async () => {
						r_collector.stop();
						const filter = message => message.author.id === creator.id;
						let answers = [];
						let number = 1;
						for (const question of survey.questions) {
							await channel.send(
								new MessageEmbed()
									.setColor(settings.colour)
									.setTitle(`${number++}/${survey.questions.length}`)
									.setDescription(question)
									.setFooter(i18n('collector_expires_in', 60))
							);

							try {
								const collected = await channel.awaitMessages(filter, {
									errors: ['time'],
									max: 1,
									time: 60000
								});
								answers.push(collected.first().content);
							} catch (collected) {
								return await close();
							}
						}

						await channel.send(
							new MessageEmbed()
								.setColor(settings.success_colour)
								.setTitle(i18n('ticket.survey.complete.title'))
								.setDescription(i18n('ticket.survey.complete.description'))
								.setFooter(settings.footer, guild.iconURL())
						);

						answers = answers.map(a => this.client.cryptr.encrypt(a));
						await this.client.db.models.SurveyResponse.create({
							answers,
							survey: survey.id,
							ticket: t_row.id
						});

						await close();

					});

					r_collector.on('end', async collected => {
						if (collected.size === 0) {
							await close();
						}
					});
				}
			} else {
				await close();
			}
		}

		this.emit('close', ticket_id);
		return t_row;
	}

	/**
	 *
	 * @param {(string|number)} ticket_id - ID or number of the ticket
	 * @param {string} [guild_id] - The ID of the ticket's guild (used if a ticket number is provided instead of ID)
	 */
	async resolve(ticket_id, guild_id) {
		let t_row;

		if (this.client.channels.resolve(ticket_id)) {
			t_row = await this.client.db.models.Ticket.findOne({ where: { id: ticket_id } });
		} else {
			t_row = await this.client.db.models.Ticket.findOne({
				where: {
					guild: guild_id,
					number: ticket_id
				}
			});
		}

		return t_row;
	}

};