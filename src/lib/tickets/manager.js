/* eslint-disable no-underscore-dangle */
/* eslint-disable max-lines */
const TicketArchiver = require('./archiver');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	inlineCode,
	ModalBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');
const emoji = require('node-emoji');
const ms = require('ms');
const ExtendedEmbedBuilder = require('../embed');
const { logTicketEvent } = require('../logging');
const { isStaff } = require('../users');
const { Collection } = require('discord.js');
const spacetime = require('spacetime');

const { getSUID } = require('../logging');
const { getAverageTimes } = require('../stats');
const {
	quick,
	reusable,
} = require('../threads');

/**
 * @typedef {import('@prisma/client').Category &
 * 	{guild: import('@prisma/client').Guild} &
 * 	{questions: import('@prisma/client').Question[]}} CategoryGuildQuestions
 */

/**
 * @typedef {import('@prisma/client').Ticket &
 * 	{category: import('@prisma/client').Category} &
 * 	{feedback: import('@prisma/client').Feedback} &
 * 	{guild: import('@prisma/client').Guild}} TicketCategoryFeedbackGuild
 */

module.exports = class TicketManager {
	constructor(client) {
		/** @type {import("client")} */
		this.client = client;
		this.archiver = new TicketArchiver(client);
		this.$count = { categories: {} };
		this.$numbers = {};
		this.$stale = new Collection();
	}

	/**
	 * Retrieve cached category data
	 * @param {string} categoryId the category ID
	 * @param {boolean} force bypass & update the cache?
	 * @returns {Promise<CategoryGuildQuestions>}
	 */
	async getCategory(categoryId, force) {
		const cacheKey = `cache/category+guild+questions:${categoryId}`;
		/** @type {CategoryGuildQuestions} */
		let category = await this.client.keyv.get(cacheKey);
		if (!category || force) {
			category = await this.client.prisma.category.findUnique({
				include: {
					guild: true,
					questions: { orderBy: { order: 'asc' } },
				},
				where: { id: categoryId },
			});
			await this.client.keyv.set(cacheKey, category, ms('12h'));
		}
		return category;
	}

	/**
	 * Retrieve cached ticket data for the closing sequence
	 * @param {string} ticketId the ticket ID
	 * @param {boolean} force bypass & update the cache?
	 * @returns {Promise<TicketCategoryFeedbackGuild>}
	 */
	async getTicket(ticketId, force) {
		const cacheKey = `cache/ticket+category+feedback+guild:${ticketId}`;
		/** @type {TicketCategoryFeedbackGuild} */
		let ticket = await this.client.keyv.get(cacheKey);
		if (!ticket || force) {
			ticket = await this.client.prisma.ticket.findUnique({
				include: {
					category: true,
					feedback: true,
					guild: true,
				},
				where: { id: ticketId },
			});
			await this.client.keyv.set(cacheKey, ticket, ms('3m'));
		}
		return ticket;
	}

	async getTotalCount(categoryId) {
		this.$count.categories[categoryId] ||= {};
		let count = this.$count.categories[categoryId].total;
		if (!count) {
			count = await this.client.prisma.ticket.count({
				where: {
					categoryId,
					open: true,
				},
			});
			this.$count.categories[categoryId].total = count;
		}
		return count;
	}

	async getMemberCount(categoryId, memberId) {
		this.$count.categories[categoryId] ||= {};
		let count = this.$count.categories[categoryId][memberId];
		if (!count) {
			count = await this.client.prisma.ticket.count({
				where: {
					categoryId: categoryId,
					createdById: memberId,
					open: true,
				},
			});
			this.$count.categories[categoryId][memberId] = count;
		}
		return count;
	}

	async getCooldown(categoryId, memberId) {
		const cacheKey = `cooldowns/category-member:${categoryId}-${memberId}`;
		return await this.client.keyv.get(cacheKey);
	}

	async getNextNumber(guildId) {
		if (this.$numbers[guildId] === undefined) {
			const { _max: { number: max } } = await this.client.prisma.ticket.aggregate({
				_max: { number: true },
				where: { guildId },
			});
			this.client.tickets.$numbers[guildId] = max ?? 0;
		}
		this.$numbers[guildId] += 1;
		return this.$numbers[guildId];
	}

	/**
	 * @param {object} data
	 * @param {string} data.categoryId
	 * @param {import("discord.js").ChatInputCommandInteraction
	 * | import("discord.js").ButtonInteraction
	 * | import("discord.js").SelectMenuInteraction} data.interaction
	 * @param {string?} [data.topic]
	 */
	async create({
		categoryId, interaction, topic, referencesMessageId, referencesTicketId,
	}) {
		categoryId = Number(categoryId);
		const category = await this.getCategory(categoryId);

		if (!category) {
			let settings;
			if (interaction.guild) {
				settings = await this.client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
			} else {
				settings = {
					errorColour: 'Red',
					locale: 'en-GB',
				};
			}
			const getMessage = this.client.i18n.getLocale(settings.locale);
			return await interaction.reply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild?.iconURL(),
						text: settings.footer,
					})
						.setColor(settings.errorColour)
						.setTitle(getMessage('misc.unknown_category.title'))
						.setDescription(getMessage('misc.unknown_category.description')),
				],
				ephemeral: true,
			});
		}

		/** @type {import("discord.js").Guild} */
		const guild = this.client.guilds.cache.get(category.guild.id);
		const member = interaction.member ?? await guild.members.fetch(interaction.user.id);
		const getMessage = this.client.i18n.getLocale(category.guild.locale);

		const rlKey = `ratelimits/guild-user:${category.guildId}-${interaction.user.id}`;
		const rl = await this.client.keyv.get(rlKey);
		if (rl) {
			return await interaction.reply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: guild.iconURL(),
						text: category.guild.footer,
					})
						.setColor(category.guild.errorColour)
						.setTitle(getMessage('misc.ratelimited.title'))
						.setDescription(getMessage('misc.ratelimited.description')),
				],
				ephemeral: true,
			});
		} else {
			this.client.keyv.set(rlKey, true, ms('5s'));
		}

		const sendError = name => interaction.reply({
			embeds: [
				new ExtendedEmbedBuilder({
					iconURL: guild.iconURL(),
					text: category.guild.footer,
				})
					.setColor(category.guild.errorColour)
					.setTitle(getMessage(`misc.${name}.title`))
					.setDescription(getMessage(`misc.${name}.description`)),
			],
			ephemeral: true,
		});

		if (category.guild.blocklist.length !== 0) {
			const blocked = category.guild.blocklist.some(r => member.roles.cache.has(r));
			if (blocked) return await sendError('blocked');
		}

		if (category.blockedRoles.length !== 0) {
			const blocked = category.blockedRoles.some(r => member.roles.cache.has(r));
			if (blocked) return await sendError('blocked');
		}

		if (category.requiredRoles.length !== 0) {
			const missing = category.requiredRoles.some(r => !member.roles.cache.has(r));
			if (missing) return await sendError('missing_roles');
		}

		const discordCategory = guild.channels.cache.get(category.discordCategory);
		if (discordCategory.children.cache.size === 50) return await sendError('category_full');

		const totalCount = await this.getTotalCount(category.id);
		if (totalCount >= category.totalLimit) return await sendError('category_full');

		const memberCount = await this.getMemberCount(category.id, interaction.user.id);
		if (memberCount >= category.memberLimit) {
			return await interaction.reply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: guild.iconURL(),
						text: category.guild.footer,
					})
						.setColor(category.guild.errorColour)
						.setTitle(getMessage('misc.member_limit.title', memberCount, memberCount))
						.setDescription(getMessage('misc.member_limit.description', memberCount)),
				],
				ephemeral: true,
			});
		}

		const cooldown = await this.getCooldown(category.id, interaction.user.id);
		if (cooldown) {
			return await interaction.reply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: guild.iconURL(),
						text: category.guild.footer,
					})
						.setColor(category.guild.errorColour)
						.setTitle(getMessage('misc.cooldown.title'))
						.setDescription(getMessage('misc.cooldown.description', { time: ms(cooldown - Date.now()) })),
				],
				ephemeral: true,
			});
		}

		if (category.questions.length >= 1) {
			await interaction.showModal(
				new ModalBuilder()
					.setCustomId(JSON.stringify({
						action: 'questions',
						categoryId,
						referencesMessageId,
						referencesTicketId,
					}))
					.setTitle(category.name)
					.setComponents(
						category.questions
							.filter(q => q.type === 'TEXT') // TODO: remove this when modals support select menus
							.map(q => {
								if (q.type === 'TEXT') {
									const field = new TextInputBuilder()
										.setCustomId(q.id)
										.setLabel(q.label)
										.setStyle(q.style)
										.setMaxLength(Math.min(q.maxLength, 1000))
										.setMinLength(q.minLength)
										.setPlaceholder(q.placeholder)
										.setRequired(q.required);
									if (q.value) field.setValue(q.value);
									return new ActionRowBuilder().setComponents(field);
								} else if (q.type === 'MENU') {
									return new ActionRowBuilder()
										.setComponents(
											new StringSelectMenuBuilder()
												.setCustomId(q.id)
												.setPlaceholder(q.placeholder || q.label)
												.setMaxValues(q.maxLength)
												.setMinValues(q.minLength)
												.setOptions(
													q.options.map((o, i) => {
														const builder = new StringSelectMenuOptionBuilder()
															.setValue(String(i))
															.setLabel(o.label);
														if (o.description) builder.setDescription(o.description);
														if (o.emoji) builder.setEmoji(emoji.hasEmoji(o.emoji) ? emoji.get(o.emoji) : { id: o.emoji });
														return builder;
													}),
												),
										);
								}
							}),
					),
			);
		} else if (category.requireTopic && !topic) {
			await interaction.showModal(
				new ModalBuilder()
					.setCustomId(JSON.stringify({
						action: 'topic',
						categoryId,
						referencesMessageId,
						referencesTicketId,
					}))
					.setTitle(category.name)
					.setComponents(
						new ActionRowBuilder()
							.setComponents(
								new TextInputBuilder()
									.setCustomId('topic')
									.setLabel(getMessage('modals.topic.label'))
									.setStyle(TextInputStyle.Paragraph)
									.setMaxLength(1000)
									.setMinLength(5)
									.setPlaceholder(getMessage('modals.topic.placeholder'))
									.setRequired(true),
							),
					),
			);
		} else {
			await this.postQuestions({
				categoryId,
				interaction,
				referencesMessageId,
				referencesTicketId,
				topic,
			});
		}
	}

	/**
	 * @param {object} data
	 * @param {string} data.category
	 * @param {import("discord.js").ButtonInteraction
	 * | import("discord.js").SelectMenuInteraction
	 * | import("discord.js").ModalSubmitInteraction} data.interaction
	 * @param {string?} [data.topic]
	 */
	async postQuestions({
		action, categoryId, interaction, topic, referencesMessageId, referencesTicketId,
	}) {
		const [, category] = await Promise.all([
			interaction.deferReply({ ephemeral: true }),
			this.getCategory(categoryId),
		]);

		let answers;
		if (interaction.isModalSubmit()) {
			if (action === 'questions') {
				const worker = await reusable('crypto');
				try {
					answers = await Promise.all(
						category.questions
							.filter(q => q.type === 'TEXT')
							.map(async q => ({
								questionId: q.id,
								userId: interaction.user.id,
								value: interaction.fields.getTextInputValue(q.id)
									? await worker.encrypt(interaction.fields.getTextInputValue(q.id))
									: '', // TODO: maybe this should be null?
							})),
					);
				} finally {
					await worker.terminate();
				}
				if (category.customTopic) topic = interaction.fields.getTextInputValue(category.customTopic);
			} else if (action === 'topic') {
				topic = interaction.fields.getTextInputValue('topic');
			}
		}

		/** @type {import("discord.js").Guild} */
		const guild = this.client.guilds.cache.get(category.guild.id);
		const getMessage = this.client.i18n.getLocale(category.guild.locale);
		const creator = await guild.members.fetch(interaction.user.id);
		const number = await this.getNextNumber(category.guild.id);
		const channelName = category.channelName
			.replace(/{+\s?(user)?name\s?}+/gi, creator.user.username)
			.replace(/{+\s?(nick|display)(name)?\s?}+/gi, creator.displayName)
			.replace(/{+\s?num(ber)?\s?}+/gi, number === 1488 ? '1487b' : number);
		const allow = ['ViewChannel', 'ReadMessageHistory', 'SendMessages', 'EmbedLinks', 'AttachFiles'];
		/** @type {import("discord.js").TextChannel} */
		const channel = await guild.channels.create({
			name: channelName,
			parent: category.discordCategory,
			permissionOverwrites: [
				{
					deny: ['ViewChannel'],
					id: guild.roles.everyone.id,
				},
				{
					allow,
					id: this.client.user.id,
				},
				{
					allow,
					id: creator.id,
				},
				...category.staffRoles.map(id => ({
					allow,
					id,
				})),
			],
			rateLimitPerUser: category.ratelimit,
			reason: `${creator.user.tag} created a ticket`,
			topic: `${creator}${topic?.length > 0 ? ` | ${topic}` : ''}`,
		});

		const needsStats = /{+\s?(avgResponseTime|avgResolutionTime)\s?}+/i.test(category.openingMessage);
		const statsCacheKey = `cache/category-stats/${categoryId}`;
		let stats = await this.client.keyv.get(statsCacheKey);
		if (needsStats && !stats) {
			const closedTickets = await this.client.prisma.ticket.findMany({
				select: {
					closedAt: true,
					createdAt: true,
					firstResponseAt: true,
				},
				where: {
					categoryId: category.id,
					firstResponseAt: { not: null },
					open: false,
				},
			});
			const {
				avgResolutionTime,
				avgResponseTime,
			} = await getAverageTimes(closedTickets);
			stats = {
				avgResolutionTime: ms(avgResolutionTime, { long: true }),
				avgResponseTime: ms(avgResponseTime, { long: true }),
			};
			this.client.keyv.set(statsCacheKey, stats, ms('1h'));
		}

		const embeds = [
			new ExtendedEmbedBuilder()
				.setColor(category.guild.primaryColour)
				.setAuthor({
					iconURL: creator.displayAvatarURL(),
					name: creator.displayName,
				})
				.setDescription(
					category.openingMessage
						.replace(/{+\s?(user)?name\s?}+/gi, creator.user.toString())
						.replace(/{+\s?num(ber)?\s?}+/gi, number)
						.replace(/{+\s?avgResponseTime\s?}+/gi, stats?.avgResponseTime)
						.replace(/{+\s?avgResolutionTime\s?}+/gi, stats?.avgResolutionTime),
				),
		];

		if (category.image) embeds[0].setImage(category.image);

		if (answers) {
			embeds.push(
				new ExtendedEmbedBuilder()
					.setColor(category.guild.primaryColour)
					.setFields(
						category.questions
							.map(q => ({
								name: q.label,
								value: interaction.fields.getTextInputValue(q.id) || getMessage('ticket.answers.no_value'),
							})),
					),
			);
		} else if (topic) {
			embeds.push(
				new ExtendedEmbedBuilder()
					.setColor(category.guild.primaryColour)
					.setFields({
						name: getMessage('ticket.opening_message.fields.topic'),
						value: topic,
					}),
			);
		}

		if (category.guild.footer) {
			embeds[embeds.length - 1].setFooter({
				iconURL: guild.iconURL(),
				text: category.guild.footer,
			});
		}

		const components = new ActionRowBuilder();

		if (topic || answers) {
			components.addComponents(
				new ButtonBuilder()
					.setCustomId(JSON.stringify({ action: 'edit' }))
					.setStyle(ButtonStyle.Secondary)
					.setEmoji(getMessage('buttons.edit.emoji'))
					.setLabel(getMessage('buttons.edit.text')),
			);
		}

		if (category.guild.claimButton && category.claiming) {
			components.addComponents(
				new ButtonBuilder()
					.setCustomId(JSON.stringify({ action: 'claim' }))
					.setStyle(ButtonStyle.Secondary)
					.setEmoji(getMessage('buttons.claim.emoji'))
					.setLabel(getMessage('buttons.claim.text')),
			);
		}

		if (category.guild.closeButton) {
			components.addComponents(
				new ButtonBuilder()
					.setCustomId(JSON.stringify({ action: 'close' }))
					.setStyle(ButtonStyle.Danger)
					.setEmoji(getMessage('buttons.close.emoji'))
					.setLabel(getMessage('buttons.close.text')),
			);
		}

		const pings = category.pingRoles.map(r => `<@&${r}>`).join(' ');

		const sent = await channel.send({
			components: components.components.length >= 1 ? [components] : [],
			content: getMessage('ticket.opening_message.content', {
				creator: interaction.user.toString(),
				staff: pings ? pings + ',' : '',
			}),
			embeds,
		});

		sent.pin({ reason: 'Ticket opening message' })
			.then(() => {
				const recent = channel.messages.cache.last(3);
				for (const message of recent) {
					if (message.system) {
						message
							.delete({ reason: 'Cleaning up system message' })
							.catch(() => this.client.log.warn('Failed to delete system pin message'));
					}
				}
			})
			.catch(this.client.log.error);

		/** @type {import("discord.js").Message|undefined} */
		let message;
		if (referencesMessageId) {
			/** @type {import("discord.js").Message} */
			message = await interaction.channel.messages.fetch(referencesMessageId);
			if (message) {
				// not worth the effort of making system messages work atm
				if (message.system) {
					referencesMessageId = null;
					message = null;
				} else {
					if (!message.member) {
						try {
							message.member = await message.guild.members.fetch(message.author.id);
						} catch {
							this.client.log.verbose('Failed to fetch member %s of %s', message.author.id, message.guild.id);
						}
					}
					channel.send({
						embeds: [
							new ExtendedEmbedBuilder()
								.setColor(category.guild.primaryColour)
								.setTitle(getMessage('ticket.references_message.title'))
								.setDescription(
									getMessage('ticket.references_message.description', {
										author: message.author.toString(),
										timestamp: `<t:${Math.ceil(message.createdTimestamp / 1000)}:R>`,
										url: message.url,
									})),
							new ExtendedEmbedBuilder({
								iconURL: guild.iconURL(),
								text: category.guild.footer,
							})
								.setColor(category.guild.primaryColour)
								.setAuthor({
									iconURL: message.member?.displayAvatarURL(),
									name: message.member?.displayName || 'Unknown',
								})
								.setDescription(message.content.substring(0, 1000) + (message.content.length > 1000 ? '...' : '')),
						],
					}).catch(this.client.log.error);
				}

			}
		} else if (referencesTicketId) {
			// TODO: add portal url
			const ticket = await this.client.prisma.ticket.findUnique({ where: { id: referencesTicketId } });
			if (ticket) {
				const embed = new ExtendedEmbedBuilder({
					iconURL: guild.iconURL(),
					text: category.guild.footer,
				})
					.setColor(category.guild.primaryColour)
					.setTitle(getMessage('ticket.references_ticket.title'))
					.setDescription(getMessage('ticket.references_ticket.description'))
					.setFields([
						{
							inline: true,
							name: getMessage('ticket.references_ticket.fields.number'),
							value: inlineCode(ticket.number),
						},
						{
							inline: true,
							name: getMessage('ticket.references_ticket.fields.date'),
							value: `<t:${Math.ceil(ticket.createdAt / 1000)}:f>`,
						},
					]);
				if (ticket.topic) {
					embed.addFields({
						inline: false,
						name: getMessage('ticket.references_ticket.fields.topic'),
						value: await quick('crypto', worker => worker.decrypt(ticket.topic)),
					});
				}
				channel.send({
					components: category.guild.archive
						? [
							new ActionRowBuilder()
								.addComponents(
									new ButtonBuilder()
										.setCustomId(JSON.stringify({
											action: 'transcript',
											ticket: referencesTicketId,
										}))
										.setStyle(ButtonStyle.Primary)
										.setEmoji(getMessage('buttons.transcript.emoji'))
										.setLabel(getMessage('buttons.transcript.text')),

								),
						]
						: [],
					embeds: [embed],
				}).catch(this.client.log.error);
			}
		}

		const data = {
			category: { connect: { id: categoryId } },
			createdBy: {
				connectOrCreate: {
					create: { id: interaction.user.id },
					where: { id: interaction.user.id },
				},
			},
			guild: { connect: { id: category.guild.id } },
			id: channel.id,
			number,
			openingMessageId: sent.id,
			topic: topic ? await quick('crypto', worker => worker.encrypt(topic)) : null,
		};
		if (referencesTicketId) data.referencesTicket = { connect: { id: referencesTicketId } };
		if (answers) data.questionAnswers = { createMany: { data: answers } };

		await interaction.editReply({
			components: [],
			embeds: [
				new ExtendedEmbedBuilder({
					iconURL: guild.iconURL(),
					text: category.guild.footer,
				})
					.setColor(category.guild.successColour)
					.setTitle(getMessage('ticket.created.title'))
					.setDescription(getMessage('ticket.created.description', { channel: channel.toString() })),
			],
		});

		try {
			const ticket = await this.client.prisma.ticket.create({ data });
			this.$count.categories[categoryId].total++;
			this.$count.categories[categoryId][creator.id]++;

			if (category.cooldown) {
				const cacheKey = `cooldowns/category-member:${category.id}-${ticket.createdById}`;
				const expiresAt = ticket.createdAt.getTime() + category.cooldown;
				const TTL = category.cooldown;
				await this.client.keyv.set(cacheKey, expiresAt, TTL);
			}

			if (category.guild.archive && message) {
				if (
					await this.client.prisma.archivedMessage.findUnique({ where: { id: message.id } }) ||
					await this.archiver.saveMessage(ticket.id, message, true)
				) {
					await this.client.prisma.ticket.update({
						data: { referencesMessageId: message.id },
						where: { id: ticket.id },
					});
				}
			}

			logTicketEvent(this.client, {
				action: 'create',
				target: {
					id: ticket.id,
					name: channel.toString(),
				},
				userId: interaction.user.id,
			});
		} catch (error) {
			const ref = getSUID();
			this.client.log.warn.tickets('An error occurred whilst creating ticket', channel.id);
			this.client.log.error.tickets(ref);
			this.client.log.error.tickets(error);
			await interaction.editReply({
				components: [],
				embeds: [
					new ExtendedEmbedBuilder()
						.setColor('Orange')
						.setTitle(getMessage('misc.error.title'))
						.setDescription(getMessage('misc.error.description'))
						.addFields({
							name: getMessage('misc.error.fields.identifier'),
							value: inlineCode(ref),
						}),
				],
			});
		}

		try {
			const workingHours = category.guild.workingHours;
			const timezone = workingHours[0];
			workingHours.shift(); // remove timezone
			const now = spacetime.now(timezone);
			const currentHours = workingHours[now.day()];
			const start = now.time(currentHours[0]);
			const end = now.time(currentHours[1]);
			let working = true;

			if (currentHours[0] === currentHours[1] || now.isAfter(end)) { // staff have the day off or have finished for the day
			// first look for the next working day *this* week (after today)
				let nextIndex = workingHours.findIndex((hours, i) => i > now.day() && hours[0] !== hours[1]);
				// if there isn't one, look for the next working day *next* week (before and including today's weekday)
				if (!nextIndex) nextIndex = workingHours.findIndex((hours, i) => i <= now.day() && hours[0] !== hours[1]);
				if (nextIndex) {
					working = false;
					const next = workingHours[nextIndex];
					let then = now.add(nextIndex - now.day(), 'day');
					if (nextIndex <= now.day()) then = then.add(1, 'week');
					const timestamp = Math.ceil(then.time(next[0]).goto('utc').d.getTime() / 1000); // in seconds
					channel.send({
						embeds: [
							new ExtendedEmbedBuilder()
								.setColor(category.guild.primaryColour)
								.setTitle(getMessage('ticket.working_hours.next.title'))
								.setDescription(getMessage('ticket.working_hours.next.description', { timestamp })),
						],
					}).catch(this.client.log.error);
				}
			} else if (now.isBefore(start)) { // staff haven't started working yet
				working = false;
				const timestamp = Math.ceil(start.goto('utc').d.getTime() / 1000); // in seconds
				channel.send({
					embeds: [
						new ExtendedEmbedBuilder()
							.setColor(category.guild.primaryColour)
							.setTitle(getMessage('ticket.working_hours.today.title'))
							.setDescription(getMessage('ticket.working_hours.today.description', { timestamp })),
					],
				}).catch(this.client.log.error);
			}

			if (working && process.env.PUBLIC_BOT !== 'true') {
				let online = 0;
				for (const [, member] of channel.members) {
					if (!await isStaff(channel.guild, member.id)) continue;
					if (member.presence && member.presence !== 'offline') online++;
				}
				if (online === 0) {
					channel.send({
						embeds: [
							new ExtendedEmbedBuilder()
								.setColor(category.guild.primaryColour)
								.setTitle(getMessage('ticket.offline.title'))
								.setDescription(getMessage('ticket.offline.description')),
						],
					}).catch(this.client.log.error);
					this.client.keyv.set(`offline/${channel.id}`, Date.now(), ms('1h'));
				}
			}
		} catch (error) {
			this.client.log.error(error);
		}
	}

	/**
	 * @param {import("discord.js").ChatInputCommandInteraction|import("discord.js").ButtonInteraction} interaction
	 */
	async claim(interaction) {
		const ticket = await this.client.prisma.ticket.findUnique({
			include: {
				_count: { select: { questionAnswers: true } },
				category: true,
				guild: true,
			},
			where: { id: interaction.channel.id },
		});
		const getMessage = this.client.i18n.getLocale(ticket.guild.locale);

		if (!(await isStaff(interaction.guild, interaction.user.id))) { // if user is not staff
			return await interaction.reply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.errorColour)
						.setTitle(getMessage('commands.slash.claim.not_staff.title'))
						.setDescription(getMessage('commands.slash.claim.not_staff.description')),
				],
				ephemeral: true,
			});
		}

		await interaction.deferReply({ ephemeral: false });

		await Promise.all([
			interaction.channel.permissionOverwrites.edit(interaction.user, { 'ViewChannel': true }, `Ticket claimed by ${interaction.user.tag}`),
			...ticket.category.staffRoles.map(role => interaction.channel.permissionOverwrites.edit(role, { 'ViewChannel': false }, `Ticket claimed by ${interaction.user.tag}`)),
			this.client.prisma.ticket.update({
				data: {
					claimedBy: {
						connectOrCreate: {
							create: { id: interaction.user.id },
							where: { id: interaction.user.id },
						},
					},
				},
				where: { id: interaction.channel.id },
			}),
		]);

		const openingMessage = await interaction.channel.messages.fetch(ticket.openingMessageId);

		if (openingMessage && openingMessage.components.length !== 0) {
			const components = new ActionRowBuilder();

			if (ticket.topic || ticket._count.questionAnswers !== 0) {
				components.addComponents(
					new ButtonBuilder()
						.setCustomId(JSON.stringify({ action: 'edit' }))
						.setStyle(ButtonStyle.Secondary)
						.setEmoji(getMessage('buttons.edit.emoji'))
						.setLabel(getMessage('buttons.edit.text')),
				);
			}

			if (ticket.guild.claimButton && ticket.category.claiming) {
				components.addComponents(
					new ButtonBuilder()
						.setCustomId(JSON.stringify({ action: 'unclaim' }))
						.setStyle(ButtonStyle.Secondary)
						.setEmoji(getMessage('buttons.unclaim.emoji'))
						.setLabel(getMessage('buttons.unclaim.text')),
				);
			}

			if (ticket.guild.closeButton) {
				components.addComponents(
					new ButtonBuilder()
						.setCustomId(JSON.stringify({ action: 'close' }))
						.setStyle(ButtonStyle.Danger)
						.setEmoji(getMessage('buttons.close.emoji'))
						.setLabel(getMessage('buttons.close.text')),
				);
			}

			await openingMessage.edit({ components: [components] });
		}

		await interaction.editReply({
			embeds: [
				new ExtendedEmbedBuilder()
					.setColor(ticket.guild.primaryColour)
					.setDescription(getMessage('ticket.claimed', { user: interaction.user.toString() })),
			],
		});

		logTicketEvent(this.client, {
			action: 'claim',
			target: {
				id: ticket.id,
				name: interaction.channel.toString(),
			},
			userId: interaction.user.id,
		});
	}

	/**
	 * @param {import("discord.js").ChatInputCommandInteraction|import("discord.js").ButtonInteraction} interaction
	 */
	async release(interaction) {
		const ticket = await this.client.prisma.ticket.findUnique({
			include: {
				_count: { select: { questionAnswers: true } },
				category: true,
				guild: true,
			},
			where: { id: interaction.channel.id },
		});
		const getMessage = this.client.i18n.getLocale(ticket.guild.locale);

		if (!(await isStaff(interaction.guild, interaction.user.id))) { // if user is not staff
			return await interaction.reply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.errorColour)
						.setTitle(getMessage('commands.slash.claim.not_staff.title'))
						.setDescription(getMessage('commands.slash.claim.not_staff.description')),
				],
				ephemeral: true,
			});
		}

		await interaction.deferReply({ ephemeral: false });

		await Promise.all([
			interaction.channel.permissionOverwrites.delete(interaction.user, `Ticket released by ${interaction.user.tag}`),
			...ticket.category.staffRoles.map(role => interaction.channel.permissionOverwrites.edit(role, { 'ViewChannel': true }, `Ticket released by ${interaction.user.tag}`)),
			this.client.prisma.ticket.update({
				data: { claimedBy: { disconnect: true } },
				where: { id: interaction.channel.id },
			}),
		]);

		const openingMessage = await interaction.channel.messages.fetch(ticket.openingMessageId);

		if (openingMessage && openingMessage.components.length !== 0) {
			const components = new ActionRowBuilder();

			if (ticket.topic || ticket._count.questionAnswers !== 0) {
				components.addComponents(
					new ButtonBuilder()
						.setCustomId(JSON.stringify({ action: 'edit' }))
						.setStyle(ButtonStyle.Secondary)
						.setEmoji(getMessage('buttons.edit.emoji'))
						.setLabel(getMessage('buttons.edit.text')),
				);
			}

			if (ticket.guild.claimButton && ticket.category.claiming) {
				components.addComponents(
					new ButtonBuilder()
						.setCustomId(JSON.stringify({ action: 'claim' }))
						.setStyle(ButtonStyle.Secondary)
						.setEmoji(getMessage('buttons.claim.emoji'))
						.setLabel(getMessage('buttons.claim.text')),
				);
			}

			if (ticket.guild.closeButton) {
				components.addComponents(
					new ButtonBuilder()
						.setCustomId(JSON.stringify({ action: 'close' }))
						.setStyle(ButtonStyle.Danger)
						.setEmoji(getMessage('buttons.close.emoji'))
						.setLabel(getMessage('buttons.close.text')),
				);
			}

			await openingMessage.edit({ components: [components] });
		}

		await interaction.editReply({
			embeds: [
				new ExtendedEmbedBuilder()
					.setColor(ticket.guild.primaryColour)
					.setDescription(getMessage('ticket.released', { user: interaction.user.toString() })),
			],
		});

		logTicketEvent(this.client, {
			action: 'unclaim',
			target: {
				id: ticket.id,
				name: interaction.channel.toString(),
			},
			userId: interaction.user.id,
		});
	}

	buildFeedbackModal(locale, id) {
		const getMessage = this.client.i18n.getLocale(locale);
		return new ModalBuilder()
			.setCustomId(JSON.stringify({
				action: 'feedback',
				...id,
			}))
			.setTitle(getMessage('modals.feedback.title'))
			.setComponents(
				new ActionRowBuilder()
					.setComponents(
						new TextInputBuilder()
							.setCustomId('rating')
							.setLabel(getMessage('modals.feedback.rating.label'))
							.setStyle(TextInputStyle.Short)
							.setMaxLength(3)
							.setMinLength(1)
							.setPlaceholder(getMessage('modals.feedback.rating.placeholder'))
							.setRequired(true),
					),
				new ActionRowBuilder()
					.setComponents(
						new TextInputBuilder()
							.setCustomId('comment')
							.setLabel(getMessage('modals.feedback.comment.label'))
							.setStyle(TextInputStyle.Paragraph)
							.setMaxLength(1000)
							.setMinLength(4)
							.setPlaceholder(getMessage('modals.feedback.comment.placeholder'))
							.setRequired(false),
					),
			);
	}


	/**
	 * @param {import("discord.js").ChatInputCommandInteraction|import("discord.js").ButtonInteraction} interaction
	 */
	async beforeRequestClose(interaction) {
		const ticket = await this.getTicket(interaction.channel.id);
		if (!ticket) {
			await interaction.deferReply({ ephemeral: true });
			const {
				errorColour,
				footer,
				locale,
			} = await this.client.prisma.guild.findUnique({
				select: {
					errorColour: true,
					locale: true,
				},
				where: { id: interaction.guild.id },
			});
			const getMessage = this.client.i18n.getLocale(locale);
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: footer,
					})
						.setColor(errorColour)
						.setTitle(getMessage('misc.not_ticket.title'))
						.setDescription(getMessage('misc.not_ticket.description')),
				],
			});
		}

		const getMessage = this.client.i18n.getLocale(ticket.guild.locale);
		const staff = await isStaff(interaction.guild, interaction.user.id);
		const reason = interaction.options?.getString('reason', false) || null; // ?. because it could be a button interaction

		if (ticket.createdById !== interaction.user.id && !staff) {
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder()
						.setColor(ticket.guild.errorColour)
						.setTitle(getMessage('ticket.close.forbidden.title'))
						.setDescription(getMessage('ticket.close.forbidden.description')),
				],
			});
		}

		if (
			ticket.createdById === interaction.user.id &&
			ticket.category.enableFeedback &&
			!ticket.feedback
		) {
			return await interaction.showModal(this.buildFeedbackModal(ticket.guild.locale, {
				next: 'requestClose',
				reason, // known issue: a reason longer than a few words will cause an error due to 100 character custom_id limit
			}));
		}

		// not showing feedback, so send the close request

		// defer asap
		await interaction.deferReply();

		// if the creator isn't in the guild , close the ticket immediately
		// (although leaving should cause the ticket to be closed anyway)
		try {
			await interaction.guild.members.fetch(ticket.createdById);
		} catch {
			return this.finallyClose(ticket.id, { reason });
		}

		this.requestClose(interaction, reason);
	}

	/**
	 * @param {import("discord.js").ChatInputCommandInteraction
	 * | import("discord.js").ButtonInteraction
	 * | import("discord.js").ModalSubmitInteraction} interaction
	 * @param {string} reason
	 */
	async requestClose(interaction, reason) {
		// interaction could be command, button. or modal
		const ticket = await this.getTicket(interaction.channel.id);
		const getMessage = this.client.i18n.getLocale(ticket.guild.locale);
		const staff = interaction.user.id !== ticket.createdById && await isStaff(interaction.guild, interaction.user.id);
		const closeButtonId = {
			action: 'close',
			expect: staff ? 'user' : 'staff',
		};
		const embed = new ExtendedEmbedBuilder(/* {
			iconURL: interaction.guild.iconURL(),
			text: ticket.guild.footer,
		} */)
			.setColor(ticket.guild.primaryColour)
			.setTitle(getMessage(`ticket.close.${staff ? 'staff' : 'user'}_request.title`, { requestedBy: interaction.member.displayName }));

		if (staff) {
			embed.setDescription(
				getMessage('ticket.close.staff_request.description', { requestedBy: interaction.user.toString() }) +
				(ticket.guild.archive ? getMessage('ticket.close.staff_request.archived') : ''),
			);
		}

		const sent = await interaction.editReply({
			components: [
				new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setCustomId(JSON.stringify({
								accepted: true,
								...closeButtonId,
							}))
							.setStyle(ButtonStyle.Success)
							.setEmoji(getMessage('buttons.accept_close_request.emoji'))
							.setLabel(getMessage('buttons.accept_close_request.text')),
						new ButtonBuilder()
							.setCustomId(JSON.stringify({
								accepted: false,
								...closeButtonId,
							}))
							.setStyle(ButtonStyle.Danger)
							.setEmoji(getMessage('buttons.reject_close_request.emoji'))
							.setLabel(getMessage('buttons.reject_close_request.text')),
					),
			],
			content: staff ? `<@${ticket.createdById}>` : '', // ticket.category.pingRoles.map(r => `<@&${r}>`).join(' ')
			embeds: [embed],
		});

		this.$stale.set(ticket.id, {
			closeAt: ticket.guild.autoClose ? Date.now() + ticket.guild.autoClose : null,
			closedBy: interaction.user.id, // null if set as stale due to inactivity
			message: sent,
			messages: 0,
			reason,
			staleSince: Date.now(),
		});

		if (ticket.priority && ticket.priority !== 'LOW') {
			await this.client.prisma.ticket.update({
				data: { priority: 'LOW' },
				where: { id: ticket.id },
			});
		}
	}

	/**
	 * @param {import("discord.js").ChatInputCommandInteraction
	 * | import("discord.js").ButtonInteraction
	 * | import("discord.js").ModalSubmitInteraction} interaction
	 */
	async acceptClose(interaction) {
		const ticket = await this.getTicket(interaction.channel.id);
		const getMessage = this.client.i18n.getLocale(ticket.guild.locale);
		await interaction.editReply({
			embeds: [
				new ExtendedEmbedBuilder({
					iconURL: interaction.guild.iconURL(),
					text: ticket.guild.footer,
				})
					.setColor(ticket.guild.successColour)
					.setTitle(getMessage('ticket.close.closed.title'))
					.setDescription(getMessage('ticket.close.closed.description')),
			],
		});
		await new Promise(resolve => setTimeout(resolve, 3e3));
		await this.finallyClose(interaction.channel.id, this.$stale.get(interaction.channel.id) || {});
	}

	/**
	 * close a ticket
	 * @param {string} ticketId
	 */
	async finallyClose(ticketId, {
		closedBy = null,
		reason = null,
	}) {
		if (this.$stale.has(ticketId)) this.$stale.delete(ticketId);
		let ticket = await this.getTicket(ticketId);
		const getMessage = this.client.i18n.getLocale(ticket.guild.locale);
		this.$count.categories[ticket.categoryId].total -= 1;
		this.$count.categories[ticket.categoryId][ticket.createdById] -= 1;

		const { _count: { archivedMessages } } = await this.client.prisma.ticket.findUnique({
			select: { _count: { select: { archivedMessages: true } } },
			where: { id: ticket.id },
		});

		/** @type {import("@prisma/client").Ticket} */
		const data = {
			closedAt: new Date(),
			closedBy: closedBy && {
				connectOrCreate: {
					create: { id: closedBy },
					where: { id: closedBy },
				},
			} || undefined, // Prisma wants undefined not null because it is a relation
			closedReason: reason && await quick('crypto', worker => worker.encrypt(reason)),
			messageCount: archivedMessages,
			open: false,
		};

		/** @type {import("discord.js").TextChannel} */
		const channel = this.client.channels.cache.get(ticketId);
		if (channel) {
			const pinned = await channel.messages.fetchPinned();
			data.pinnedMessageIds = [...pinned.keys()];
		}

		ticket = await this.client.prisma.ticket.update({
			data,
			include: {
				category: true,
				feedback: true,
				guild: true,
			},
			where: { id: ticket.id },
		});

		if (channel?.deletable) {
			const member = closedBy ? channel.guild.members.cache.get(closedBy) : null;
			await channel.delete('Ticket closed' + (member ? ` by ${member.displayName}` : '') + reason ? `: ${reason}` : '');
		}

		logTicketEvent(this.client, {
			action: 'close',
			target: {
				archive: ticket.guild.archive,
				id: ticket.id,
				name: `${ticket.category.name} **#${ticket.number}**`,
				reason,
			},
			userId: closedBy || this.client.user.id,
		});

		try {
			const creator = channel?.guild.members.cache.get(ticket.createdById);
			if (creator) {
				const embed = new ExtendedEmbedBuilder({
					iconURL: channel.guild.iconURL(),
					text: ticket.guild.footer,
				})
					.setColor(ticket.guild.primaryColour)
					.setTitle(getMessage('dm.closed.title'))
					.addFields([
						{
							inline: true,
							name: getMessage('dm.closed.fields.ticket'),
							value: `${ticket.category.name} **#${ticket.number}**`,
						},

					]);
				if (ticket.topic) {
					embed.addFields({
						inline: true,
						name: getMessage('dm.closed.fields.topic'),
						value: await quick('crypto', worker => worker.decrypt(ticket.topic)),
					});
				}

				embed.addFields([
					{
						inline: true,
						name: getMessage('dm.closed.fields.created'),
						value: `<t:${Math.floor(ticket.createdAt / 1000)}:f>`,
					},
					{
						inline: true,
						name: getMessage('dm.closed.fields.closed.name'),
						value: getMessage('dm.closed.fields.closed.value', {
							duration: ms(ticket.closedAt - ticket.createdAt, { long: true }),
							timestamp: `<t:${Math.floor(ticket.closedAt / 1000)}:f>`,
						}),
					},
				]);

				if (ticket.firstResponseAt) {
					embed.addFields({
						inline: true,
						name: getMessage('dm.closed.fields.response'),
						value: ms(ticket.firstResponseAt - ticket.createdAt, { long: true }),
					});
				}

				if (ticket.feedback) {
					embed.addFields({
						inline: true,
						name: getMessage('dm.closed.fields.feedback'),
						value: Array(ticket.feedback.rating).fill('⭐').join(' ') + ` (${ticket.feedback.rating}/5)`,
					});
				}

				if (ticket.closedById) {
					embed.addFields({
						inline: true,
						name: getMessage('dm.closed.fields.closed_by'),
						value: `<@${ticket.closedById}>`,
					});
				}


				if (reason) {
					embed.addFields({
						inline: true,
						name: getMessage('dm.closed.fields.reason'),
						value: reason,
					});
				}

				const components = [];

				if (ticket.guild.archive) {
					components.push(
						new ActionRowBuilder()
							.addComponents(
								new ButtonBuilder()
									.setCustomId(JSON.stringify({
										action: 'transcript',
										ticket: ticket.id,
									}))
									.setStyle(ButtonStyle.Primary)
									.setEmoji(getMessage('buttons.transcript.emoji'))
									.setLabel(getMessage('buttons.transcript.text')),

							),
					);
				}


				await creator.send({
					components,
					embeds: [embed],
				});
			}
		} catch (error) {
			this.client.log.error(error);
		}

	}
};
