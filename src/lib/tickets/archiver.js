const { reusable } = require('../threads');


/**
 * Returns highest (roles.highest) hoisted role, or everyone
 * @param {import("discord.js").GuildMember} member
 * @returns {import("discord.js").Role}
 */
const hoistedRole = member => member.roles.hoist || member.guild.roles.everyone;

module.exports = class TicketArchiver {
	constructor(client) {
		/** @type {import("client")} */
		this.client = client;
	}

	/** Add or update a message
	 * @param {string} ticketId
	 * @param {import("discord.js").Message} message
	 * @param {boolean?} external
	 * @returns {import("@prisma/client").ArchivedMessage|boolean}
	 */
	async saveMessage(ticketId, message, external = false) {
		if (process.env.OVERRIDE_ARCHIVE === 'false') return false;

		if (!message.member) {
			try {
				message.member = await message.guild.members.fetch(message.author.id);
			} catch {
				this.client.log.verbose('Failed to fetch member %s of %s', message.author.id, message.guild.id);
			}
		}

		const channels = [...message.mentions.channels.values()];
		const members = [...message.mentions.members.values()];
		const roles = [...message.mentions.roles.values()];

		const worker = await reusable('crypto');

		try {
			const queries = [];

			if (message.member) {
				members.push(message.member);
				roles.push(hoistedRole(message.member));
			} else {
				this.client.log.warn('Message member does not exist');
				queries.push(
					this.client.prisma.archivedUser.upsert({
						create: {
							ticketId,
							userId: 'default',
						},
						select: { ticketId: true }, // ? default is to return all scalar fields
						update: {},
						where: {
							ticketId_userId: {
								ticketId,
								userId: 'default',
							},
						},
					}),
				);
			}

			for (const role of roles) {
				const data = {
					colour: role.hexColor.slice(1),
					name: role.name,
				};
				console.log({
					create: {
						...data,
						roleId: role.id,
						ticketId,
					},
					select: { ticketId: true },
					update: data,
					where: {
						ticketId_roleId: {
							roleId: role.id,
							ticketId,
						},
					},
				});
				queries.push(
					this.client.prisma.archivedRole.upsert({
						create: {
							...data,
							roleId: role.id,
							ticketId,
						},
						select: { ticketId: true },
						update: data,
						where: {
							ticketId_roleId: {
								roleId: role.id,
								ticketId,
							},
						},
					}),
				);
			}

			for (const member of members) {
				const data = {
					avatar: member.avatar || member.user.avatar, // TODO: save avatar in user/avatars/
					bot: member.user.bot,
					discriminator: member.user.discriminator,
					displayName: member.displayName ? await worker.encrypt(member.displayName) : null,
					roleId: !!member && hoistedRole(member).id,
					username: await worker.encrypt(member.user.username),
				};
				queries.push(
					this.client.prisma.archivedUser.upsert({
						create: {
							...data,
							ticketId,
							userId: member.user.id,
						},
						select: { ticketId: true },
						update: data,
						where: {
							ticketId_userId: {
								ticketId,
								userId: member.user.id,
							},
						},
					}),
				);
			}

			for (const channel of channels) {
				const data = {
					channelId: channel.id,
					name: channel.name,
					ticketId,
				};
				queries.push(
					this.client.prisma.archivedChannel.upsert({
						create: data,
						select: { ticketId: true },
						update: data,
						where: {
							ticketId_channelId: {
								channelId: channel.id,
								ticketId,
							},
						},
					}),
				);
			}

			const data = {
				content: await worker.encrypt(
					JSON.stringify({
						attachments: [...message.attachments.values()],
						components: [...message.components.values()],
						content: message.content,
						embeds: message.embeds.map(embed => ({ ...embed })),
						reference: message.reference?.messageId ?? null,
					}),
				),
				createdAt: message.createdAt,
				edited: !!message.editedAt,
				external,
			};

			queries.push(
				this.client.prisma.archivedMessage.upsert({
					create: {
						...data,
						authorId: message.author?.id || 'default',
						id: message.id,
						ticketId,
					},
					select: { ticketId: true },
					update: data,
					where: { id: message.id },
				}),
			);
			console.log(await this.client.prisma.ticket.findUnique({ where: { id: ticketId } }));
			return await this.client.prisma.$transaction(queries);
		} finally {
			await worker.terminate();
		}
	}
};
