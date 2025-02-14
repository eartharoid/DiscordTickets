const jsonFields = [
	'pingRoles',
	'requiredRoles',
	'blockedRoles',
	'staffRoles',
	'autoTag',
	'blocklist',
	'workingHours',
	'options',
	'pinnedMessageIds',
];

const traverse = (obj, action) => {
	for (let prop in obj) {
		if (prop === 'createMany') {
			obj.create = obj[prop].data;
			delete obj[prop];
			prop = 'create';
			traverse(obj[prop], action);
		} else if (jsonFields.includes(prop) && obj[prop] !== null && obj[prop] !== undefined) {
			if (action === 'SERIALISE') {
				if (typeof obj[prop] === 'string') {
					try {
						JSON.parse(obj[prop]);
					} catch {
						obj[prop] = JSON.stringify(obj[prop]);
					}
				} else {
					obj[prop] = JSON.stringify(obj[prop]);
				}
			} else if (action === 'PARSE' && typeof obj[prop] === 'string') {
				obj[prop] = JSON.parse(obj[prop]);
			}
		} else if (typeof obj[prop] === 'object' && obj[prop] !== null && obj[prop] !== undefined) {
			traverse(obj[prop], action);
		}
	}
	return obj;
};

module.exports = async (params, next) => {
	if (params.args?.create) params.args.create = traverse(params.args.create, 'SERIALISE');
	if (params.args?.data) params.args.data = traverse(params.args.data, 'SERIALISE');
	if (params.args?.update) params.args.update = traverse(params.args.update, 'SERIALISE');
	let result = await next(params);
	if (result) result = traverse(result, 'PARSE');
	return result;
};