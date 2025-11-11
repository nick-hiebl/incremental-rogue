const RESOURCES = [
	{
		id: 'word-of-mouth',
		name: 'Word of mouth',
		initialQuantity: 10,
		multi: 1,
		producers: [
			{ id: 'family-member', earning: 1, price: 10, priceGrowthRate: 1.3, name: 'Family members' },
			{ id: 'coworker', earning: 3, price: 50, priceGrowthRate: 1.2, name: 'Coworkers' },
			{ id: 'friend', earning: 1, price: 200, priceGrowthRate: 1.2, name: 'Friends', outputUnit: 'coworker' },
			{ id: 'follower', earning: 0.5, price: 1200, priceGrowthRate: 1.25, name: 'Followers', outputUnit: 'friend' },
			{ id: 'faithful', earning: 1, price: 3000, priceGrowthRate: 1.25, name: 'Followers', outputUnit: 'faith' },
		],
	},
	{
		id: 'faith',
		name: 'Faith',
		multi: 1,
		producers: [
			{ id: 'acolyte', earning: 5, price: 20, priceGrowthRate: 1.28, name: 'Acolytes' },
			{ id: 'priest', earning: 25, price: 300, priceGrowthRate: 1.29, name: 'Priests' },
			{ id: 'monk', earning: 1, price: 900, priceGrowthRate: 1.2, name: 'Monks', outputUnit: 'gospels' },
		],
	},
	{
		id: 'gospels',
		name: 'Gospels',
		multi: 1,
		producers: [
			{ id: 'scribe', earning: 2, price: 12, priceGrowthRate: 1.2, name: 'Scribes' },
			{ id: 'theologian', earning: 5, price: 75, priceGrowthRate: 1.25, name: 'Theologians' },
			{ id: 'bible-assembler', earning: 12, price: 200, priceGrowthRate: 1.24, name: 'Bible assemblers' },
		],
	},
];

const resourceEnabled = resourceId => data => data.resources[resourceId].enabled;
const producerEnabled = producerId => data => data.producers[producerId].enabled;
const hasResource = (resourceId, amount) => data => resourceEnabled(resourceId)(data) && data.resources[resourceId].quantity >= amount;
const hasAugment = augmentId => data => data.selectedAugments.has(augmentId);
const completedQuest = questId => data => data.completedQuests.has(questId);
const and = list => data => list.every(condition => condition(data));
const or = list => data => list.some(condition => condition(data));

const AUGMENTS = [
	{
		id: 'hot-gossip',
		title: 'Hot gossip',
		description: 'Word of mouth generation from all sources increased by 30%.',
		action: data => {
			data.resources['word-of-mouth'].multi += 0.3;
		},
	},
	{
		id: 'bigger-family',
		title: 'Big family',
		description: 'Immediate +10 family members.',
		action: data => {
			data.producers['family-member'].count += 10;
		},
        condition: producerEnabled('family-member'),
	},
	{
		id: 'fast-family',
		title: 'Fast family',
		description: 'Family producers 20% more word of mouth.',
		action: data => {
			data.producers['family-member'].profitMulti += 0.2;
		},
        condition: producerEnabled('family-member'),
	},
	{
		id: 'outspoken-coworkers',
		title: 'Outspoken coworkers',
		description: 'Coworkers produce twice as much word of mouth!',
		action: data => {
			data.producers['coworker'].profitMulti *= 2;
		},
        condition: producerEnabled('coworker'),
	},
	{
		id: 'noisy-friends',
		title: 'Noisy friends',
		description: 'Friends recruit coworkers 50% faster.',
		action: data => {
			data.producers['friend'].profitMulti += 0.5;
		},
        condition: producerEnabled('friend'),
	},
	{
		id: 'gullible-followers',
		title: 'Gullible followers',
		description: 'Followers only require half as much word of mouth to recruit.',
		action: data => {
			data.producers['follower'].price *= 0.5;
		},
        condition: producerEnabled('follower'),
	},
	{
		id: 'busy-followers',
		title: 'Busy followers',
		description: 'Followers recruit 50% more friends.',
		action: data => {
			data.producers['follower'].profitMulti += 0.5;
		},
        condition: producerEnabled('follower'),
	},
	{
		id: 'prayer-i',
		title: 'Prayer I',
		description: 'Faithful produce 60% more faith.',
		action: data => {
			data.producers['faithful'].profitMulti += 0.6;
		},
        condition: producerEnabled('faithful'),
	},
	{
		id: 'prayer-ii',
		title: 'Prayer II',
		description: 'Faithful produce 75% more faith.',
		action: data => {
			data.producers['faithful'].profitMulti += 0.75;
		},
        condition: hasAugment('prayer-i'),
	},
	{
		id: 'prayer-iii',
		title: 'Prayer III',
		description: 'Faithful produce 100% more faith.',
		action: data => {
			data.producers['faithful'].profitMulti += 1.0;
		},
        condition: hasAugment('prayer-ii'),
	},
	{
		id: 'acolyte-power',
		title: 'Acolyte Power',
		description: 'Acolytes produce twice as much faith.',
		action: data => {
			data.producers['acolyte'].profitMulti *= 2;
		},
        condition: producerEnabled('acolyte'),
	},
];

const QUESTS = [
    {
        id: 'quest-1',
        title: 'A mysterious visitor appears',
        description: 'Better see what they have to say',
        content: {
            title: 'Someone knocks on the door in the night',
            description: 'What will you offer them?',
        },
        condition: hasResource('word-of-mouth', 30),
    },
    {
        id: 'quest-2',
        title: 'The visitor returns',
        description: 'They might have something else in store',
        condition: completedQuest('quest-1'),
        choices: [
            {
                id: 'test-augment-1',
                title: 'Test augment 1',
                description: 'Testing...',
                action: data => {
                    data.resources['word-of-mouth'].quantity += 1;
                },
            },
            {
                id: 'test-augment-2',
                title: 'Test augment 2',
                description: 'Testing...',
                action: data => {
                    data.resources['word-of-mouth'].quantity += 2;
                },
            },
            {
                id: 'test-augment-3',
                title: 'Test augment 3',
                description: 'Testing...',
                action: data => {
                    data.resources['word-of-mouth'].quantity += 3;
                },
            },
        ],
    },
    {
        id: 'quest-3',
        title: 'Quest 3',
        description: 'You have chosen wisely',
        action: () => null,
        condition: hasAugment('test-augment-2'),
    },
];
