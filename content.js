const resourceEnabled = resourceId => data => data.resources[resourceId].enabled;
const producerEnabled = producerId => data => data.producers[producerId].enabled;
const hasResource = (resourceId, amount) => data => resourceEnabled(resourceId)(data) && data.resources[resourceId].quantity >= amount;
const hasAugment = augmentId => data => data.selectedAugments.has(augmentId);
const completedQuest = questId => data => data.completedQuests.has(questId);
const and = list => data => list.every(condition => condition(data));
const or = list => data => list.some(condition => condition(data));

const EIGHT_BILLION = 8_000_000_000;

const RESOURCES = [
	{
		id: '__unconverted',
		name: '[TECHNICAL] Unconverted citizens',
		initialQuantity: EIGHT_BILLION,
		producers: [],
		hidden: true,
	},
	{
		id: 'word-of-mouth',
		name: 'Word of mouth',
		initialQuantity: 20,
		multi: 1,
		producers: [
			{ id: 'facebook-post', earning: 1, price: 10, priceGrowthRate: 1.2, name: 'Facebook posts' },
			{ id: 'facebook-group', earning: 1, price: 1_000, priceGrowthRate: 2, name: 'Facebook groups', outputUnit: 'facebook-post' },
			{ id: 'reddit-comment', earning: 5, price: 200, priceGrowthRate: 1.2, name: 'Reddit comments' },
			{ id: 'subreddit', earning: 0.5, price: 20_000, priceGrowthRate: 3, name: 'Subreddits', outputUnit: 'reddit-comment' },
		],
	},
	{
		id: 'followers',
		name: 'Followers',
		initialQuantity: 0,
		multi: 1,
		inputUnit: '__unconverted',
		producers: [
			{ id: 'fans', earning: 1, price: 100, costUnit: 'word-of-mouth', outputUnit: 'word-of-mouth', priceGrowthRate: 1.3, name: 'Fans', outputUnit: 'followers' },
		],
	}
];

const AUGMENTS = [];

const QUESTS = [
	{
		id: 'intro-word-of-mouth',
		title: 'An unexpected email appears',
		description: 'It seems you\'ve attracted some attention',
		content: {
			title: 'From: supporter@unknown.inc',
			description:
				`I see you're trying to spread the word a little. Perhaps I could help you out somewhat.
				I specialise in digital outreach. I have a few plans that might help.`,
		},
		condition: hasResource('word-of-mouth', 500),
		choices: [
			{
				id: 'facebook-posting-rewards',
				title: 'Posting rewards',
				description: 'Your Facebook posts on their own will generate 50% less word of mouth, but your Facebook groups will generate 50% more posts.',
				action: data => {
					data.producers['facebook-post'].profitMulti -= 0.5;
					data.producers['facebook-group'].profitMulti += 0.5;
				},
			},
			{
				id: 'engagement-baiting',
				title: 'Engagement baiting',
				description: 'Your Facebook posts will generate 100% more engagement, but your Facebook groups will produce posts at a 20% slower rate.',
				action: data => {
					data.producers['facebook-post'].profitMulti += 1.0;
					data.producers['facebook-group'].profitMulti -= 0.2;
				},
			},
			{
				id: 'ignore-supporter-unknown',
				title: 'Ignore',
				description: `Don't send any reply.`,
			},
		],
	},
];
