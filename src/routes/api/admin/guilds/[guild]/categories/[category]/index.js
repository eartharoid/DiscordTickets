const { logAdminEvent } = require('../../../../../../../lib/logging');
const { updateStaffRoles } = require('../../../../../../../lib/users');
const { ApplicationCommandPermissionType } = require('discord.js');

module.exports.delete = fastify => ({
	handler: async (req, res) => {
		/** @type {import('client')} */
		const client = req.routeOptions.config.client;
		const guild = client.guilds.cache.get(req.params.guild);
		const categoryId = Number(req.params.category);
		const original = categoryId && await client.prisma.category.findUnique({ where: { id: categoryId } });
		if (!original || original.guildId !== guild.id) return res.status(400).send(new Error('Bad Request'));
		const category = await client.prisma.category.delete({ where: { id: categoryId } });

		await updateStaffRoles(guild);

		logAdminEvent(client, {
			action: 'delete',
			guildId: req.params.guild,
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

module.exports.get = fastify => ({
	handler: async (req, res) => {
		/** @type {import('client')} */
		const client = req.routeOptions.config.client;
		const guildId = req.params.guild;
		const categoryId = Number(req.params.category);
		const category = await client.prisma.category.findUnique({
			include: {
				questions: {
					select: {
						// createdAt: true,
						id: true,
						label: true,
						maxLength: true,
						minLength: true,
						options: true,
						order: true,
						placeholder: true,
						required: true,
						style: true,
						type: true,
						value: true,
					},
				},
			},
			where: { id: categoryId },
		});

		if (!category || category.guildId !== guildId) return res.status(400).send(new Error('Bad Request'));

		return category;
	},
	onRequest: [fastify.authenticate, fastify.isAdmin],
});

module.exports.patch = fastify => ({
	handler: async (req, res) => {
		/** @type {import('client')} */
		const client = req.routeOptions.config.client;
		const guildId = req.params.guild;
		const categoryId = Number(req.params.category);
		/** @type {import('discord.js').Guild} */
		const guild = client.guilds.cache.get(req.params.guild);
		const data = req.body;

		const select = {
			blockedRoles: true,
			channelName: true,
			claiming: true,
			// createdAt: true,
			description: true,
			discordCategory: true,
			emoji: true,
			enableFeedback: true,
			guildId: true,
			id: true,
			image: true,
			memberLimit: true,
			name: true,
			openingMessage: true,
			pingRoles: true,
			questions: {
				select: {
					// createdAt: true,
					id: true,
					label: true,
					maxLength: true,
					minLength: true,
					options: true,
					order: true,
					placeholder: true,
					required: true,
					style: true,
					type: true,
					value: true,
				},
			},
			ratelimit: true,
			requireTopic: true,
			requiredRoles: true,
			staffRoles: true,
			totalLimit: true,
		};

		const original = req.params.category && await client.prisma.category.findUnique({
			select,
			where: { id: categoryId },
		});

		if (!original || original.guildId !== guildId) return res.status(400).send(new Error('Bad Request'));

		if (Object.prototype.hasOwnProperty.call(data, 'id')) delete data.id;
		if (Object.prototype.hasOwnProperty.call(data, 'createdAt')) delete data.createdAt;

		const category = await client.prisma.category.update({
			data: {
				...data,
				questions: {
					upsert: data.questions?.map(q => ({
						create: q,
						update: q,
						where: { id: q.id },
					})),
				},
			},
			select,
			where: { id: categoryId },
		});

		// update caches
		await client.tickets.getCategory(categoryId, true);
		await updateStaffRoles(guild);

		if (req.user.accessToken && JSON.stringify(category.staffRoles) !== JSON.stringify(original.staffRoles)) {
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
			action: 'update',
			diff: {
				original,
				updated: category,
			},
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
