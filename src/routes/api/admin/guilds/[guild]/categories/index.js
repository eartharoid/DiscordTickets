const { logAdminEvent } = require('../../../../../../lib/logging');
const { updateStaffRoles } = require('../../../../../../lib/users');
const emoji = require('node-emoji');
const {
	ApplicationCommandPermissionType,
	ChannelType: { GuildCategory },
} = require('discord.js');
const ms = require('ms');
const {
	getAvgResolutionTime,
	getAvgResponseTime,
} = require('../../../../../../lib/stats');

module.exports.get = fastify => ({
	handler: async req => {
		/** @type {import('client')} */
		const client = req.routeOptions.config.client;

		let { categories } = await client.prisma.guild.findUnique({
			select: {
				categories: {
					select: {
						blockedRoles: true,
						createdAt: true,
						description: true,
						discordCategory: true,
						emoji: true,
						id: true,
						image: true,
						name: true,
						requiredRoles: true,
						staffRoles: true,
						tickets: { where: { open: false } },
					},
				},
			},
			where: { id: req.params.guild },
		});
		categories = categories.map(c => {
			const closedTickets = c.tickets.filter(t => t.firstResponseAt && t.closedAt);
			c = {
				...c,
				stats: {
					avgResolutionTime: ms(getAvgResolutionTime(closedTickets)),
					avgResponseTime: ms(getAvgResponseTime(closedTickets)),
				},
			};
			delete c.tickets;
			return c;
		});

		return categories;
	},
	onRequest: [fastify.authenticate, fastify.isAdmin],
});

module.exports.post = fastify => ({
	handler: async req => {
		/** @type {import('client')} */
		const client = req.routeOptions.config.client;

		const user = await client.users.fetch(req.user.id);
		const guild = client.guilds.cache.get(req.params.guild);
		const data = req.body;
		const allow = ['ViewChannel', 'ReadMessageHistory', 'SendMessages', 'EmbedLinks', 'AttachFiles'];

		if (!data.discordCategory) {
			let name = data.name;
			if (emoji.hasEmoji(data.emoji)) name = `${emoji.get(data.emoji)} ${name}`;
			const channel = await guild.channels.create({
				name,
				permissionOverwrites: [
					...[
						{
							deny: ['ViewChannel'],
							id: guild.roles.everyone,
						},
						{
							allow: allow,
							id: client.user.id,
						},
					],
					...data.staffRoles.map(id => ({
						allow: allow,
						id,
					})),
				],
				position: 1,
				reason: `Tickets category created by ${user.tag}`,
				type: GuildCategory,
			});
			data.discordCategory = channel.id;
		}

		data.channelName ||= 'ticket-{num}'; // not ??=, expect empty string

		const category = await client.prisma.category.create({
			data: {
				guild: { connect: { id: guild.id } },
				...data,
				questions: { createMany: { data: data.questions ?? [] } },
			},
		});

		// update caches
		await client.tickets.getCategory(category.id, true);
		await updateStaffRoles(guild);

		if (req.user.accessToken) {
			Promise.all([
				'Create ticket for user',
				'claim',
				'force-close',
				'move',
				'priority',
				'release',
			].map(name =>
				client.application.commands.permissions.set({
					command: client.application.commands.cache.find(cmd => cmd.name === name),
					guild,
					permissions: [
						{
							id: guild.id, // @everyone
							permission: false,
							type: ApplicationCommandPermissionType.Role,
						},
						...category.staffRoles.map(id => ({
							id,
							permission: true,
							type: ApplicationCommandPermissionType.Role,
						})),
					],
					token: req.user.accessToken,
				}),
			))
				.then(() => client.log.success('Updated application command permissions in "%s"', guild.name))
				.catch(error => client.log.error(error));
		}

		logAdminEvent(client, {
			action: 'create',
			guildId: guild.id,
			target: {
				id: category.id,
				name: category.name,
				type: 'category',
			},
			userId: req.user.id,
		});

		return category;
	},
	onRequest: [fastify.authenticate, fastify.isAdmin],
});
