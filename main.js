const RESOURCES = [
	{
		id: 'word-of-mouth',
		name: 'Word of mouth',
		initialQuantity: 10,
		multi: 1,
		producers: [
			{ id: 'family-member', earning: 1, price: 10, priceGrowthRate: 1.3, name: 'Family members' },
			{ id: 'coworker', earning: 3, price: 50, priceGrowthRate: 1.2, name: 'Coworkers' },
			{ id: 'friend', earning: 10, price: 200, priceGrowthRate: 1.2, name: 'Friends' },
			{ id: 'follower', earning: 1, price: 1200, priceGrowthRate: 1.25, name: 'Followers', outputUnit: 'faith' },
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

const PAUSE_KEY = 'p';

const TIME_RATES = [
	{ key: 'z', multi: 2 },
	{ key: 'x', multi: 3 },
	{ key: 'c', multi: 5 },
	{ key: 'v', multi: 10 },
];

const AUGMENTS = [
	{
		id: 'bigger-family',
		title: 'Big family',
		description: 'Immediate +10 family members',
		action: data => {
			data.producers['family-member'].count += 10;
		},
	},
	{
		id: 'outspoken-coworkers',
		title: 'Outspoken coworkers',
		description: 'Coworkers produce twice as much word of mouth!',
		action: data => {
			data.producers['coworker'].profitMulti *= 2;
		},
	},
	{
		id: 'noisy-friends',
		title: 'Noisy friends',
		description: 'Friends produce 50% more word of mouth.',
		action: data => {
			data.producers['friend'].profitMulti += 0.5;
		},
	},
	{
		id: 'gullible-followers',
		title: 'Gullible followers',
		description: 'Followers only require half as much word of mouth to recruit',
		action: data => {
			data.producers['follower'].price *= 0.5;
		},
	},
	{
		id: 'busy-followers',
		title: 'Busy followers',
		description: 'Followers produce 50% more faith',
		action: data => {
			data.producers['follower'].profitMulti += 0.5;
		},
	},
	{
		id: 'prayer-i',
		title: 'Prayer I',
		description: 'Followers produce 60% more faith',
		action: data => {
			data.producers['follower'].profitMulti += 0.6;
		},
	},
	{
		id: 'prayer-ii',
		title: 'Prayer II',
		description: 'Followers produce 70% more faith',
		action: data => {
			data.producers['follower'].profitMulti += 0.7;
		},
	},
	{
		id: 'prayer-iii',
		title: 'Prayer III',
		description: 'Followers produce 80% more faith',
		action: data => {
			data.producers['follower'].profitMulti += 0.8;
		},
	},
	{
		id: 'acolyte-power',
		title: 'Acolyte Power',
		description: 'Acolytes produce twice as much faith',
		action: data => {
			data.producers['acolyte'].profitMulti *= 2;
		},
	},
];

const FRAMES_PER_SECOND = 20;

function getById(id, base = document) {
	if (base.getElementById) {
		return base.getElementById(id);
	}

	return base.querySelector(`#${id}`);
}

function setById(id, value, base = document) {
	return getById(id, base).textContent = value;
}

function round(value) {
	return parseFloat((Math.round(value * 10) / 10).toFixed(1), 10).toLocaleString();
}

function intRound(value) {
	return Math.floor(value).toLocaleString();
}

const N_CHOICES = 3;

const replaceNode = original => {
	const newCopy = original.cloneNode(true);
	original.parentNode.replaceChild(newCopy, original);

	return newCopy;
};

const clearChildren = node => {
	while (node.firstChild) {
		node.removeChild(node.firstChild);
	}
};

const setupAugment = (element, augment, onSelect) => {
	setById('title', augment.title, element);
	setById('description', augment.description, element);

	const oldButton = getById('choose', element);
	const newButton = replaceNode(oldButton);

	newButton.addEventListener('click', () => {
		onSelect(augment);
	});
};

function selectRandomN(items, count) {
	return items.reduce((chosen, current, index) => {
		const stillNeeded = count - chosen.length;
		const remainingOptions = items.length - index;
		if (Math.random() < stillNeeded / remainingOptions) {
			return chosen.concat(current);
		} else {
			return chosen;
		}
	}, []);
}

function last(list) {
	return list[list.length - 1];
}

function createTextNode(text) {
	return document.createTextNode(text);
}

function createElement(elementName, { children, text, id } = {}) {
	const element = document.createElement(elementName);
	if (id) {
		element.id = id;
	}
	if (text) {
		element.textContent = text;
	} else if (children) {
		for (const child of children) {
			element.appendChild(child);
		}
	}

	return element;
}

const GAME_DURATION = 10 * 60 * FRAMES_PER_SECOND;

function main({ augmentsAfter, resources, onComplete, globalMulti }) {
	replaceNode(getById('main'));

	let lastFrameTime = performance.now();
	let unusedTime = 0;
	const framesTotal = GAME_DURATION;
	let framesLeft = framesTotal;
	let hasStarted = false;
	let paused = false;
	let pausedForAugmentChoices = false;

	const augmentTimes = augmentsAfter.map(time => time * FRAMES_PER_SECOND);

	const TIME_KEYS = new Set(TIME_RATES.map(({ key }) => key));
	const timeKeys = new Set();

	const data = {
		producers: {},
		resources: resources.reduce((map, resource) => {
			map[resource.id] = {
				name: resource.name,
				id: resource.id,
				quantity: resource.initialQuantity ?? 0,
				earning: 0,
				spent: 0,
				multi: resource.multi ?? 1,
				lifetimeEarnings: 0,
			};

			return map;
		}, {}),
		profitMulti: 1,
		selectedAugments: [],
	};

	const setupAugmentChoices = () => {
		const availableAugments = AUGMENTS.filter(augment => !data.selectedAugments.includes(augment.id));

		const options = selectRandomN(availableAugments, N_CHOICES);

		const onSelect = augment => {
			augment.action(data);
			pausedForAugmentChoices = false;
			data.selectedAugments.push(augment.id);
			calculateEarnings();
			getById('augment-list').appendChild(
				createElement(
					'div',
					{
						children: [
							createElement('strong', { text: augment.title }),
							createElement('span', { text: ' ' + augment.description }),
						],
					},
				),
			);
			getById('augments').dataset.hidden = false;
		};

		setupAugment(getById('choice-1'), options.splice(Math.floor(Math.random() * 3), 1)[0], onSelect);
		setupAugment(getById('choice-2'), options.splice(Math.floor(Math.random() * 2), 1)[0], onSelect);
		setupAugment(getById('choice-3'), options[0], onSelect);
	};

	const calculateTimeRate = () => {
		return TIME_RATES.reduce((rate, current) => {
			if (timeKeys.has(current.key)) {
				return rate * current.multi;
			}

			return rate;
		}, 1);
	};

	const calculateEarnings = () => {
		Object.values(data.resources).forEach(resource => {
			const earning = Object.values(data.producers).reduce((total, current) => {
				if (current.outputUnit !== resource.id) {
					return total;
				}

				return total + current.earning * current.count * current.profitMulti * resource.multi;
			}, 0);

			resource.earning = earning * data.profitMulti * globalMulti;
		});
	};

	const visuallyUpdate = () => {
		Object.values(data.resources).forEach(resource => {
			if (resource.quantity > 0) {
				getById(`${resource.id}-resource`).dataset.hidden = false;
			}
			setById(`${resource.id}-quantity`, intRound(resource.quantity));
			setById(`${resource.id}-earning`, intRound(resource.earning));
			setById(`${resource.id}-lifetime`, intRound(resource.lifetimeEarnings));
		});

		Object.values(data.producers).forEach(entry => {
			const { id } = entry;
			const costResource = data.resources[entry.costUnit];

			if (costResource.quantity >= entry.price) {
				getById(`${id}-producer-row`).dataset.hidden = false;
			}

			const resource = data.resources[entry.outputUnit];

			setById(`${id}-count`, entry.count);
			setById(`${id}-earning`, round(entry.earning * entry.profitMulti * resource.multi * data.profitMulti * globalMulti));
			setById(`${id}-price`, round(entry.price));

			getById(`${id}-buy`).disabled = data.money < entry.price;
		});

		const timeRate = calculateTimeRate();

		TIME_RATES.forEach(({ key }) => {
			const el = getById(`time-key-${key}`);
			if (timeKeys.has(key)) {
				el.dataset.pressed = true;
				el.style.setProperty('--color', 'yellow');
			} else {
				el.dataset.pressed = false;
				el.style.setProperty('--color', 'white');
			}
		});

		setById('time-rate', timeRate);
		const timeLeft = Math.ceil(framesLeft / FRAMES_PER_SECOND);
		const minutesLeft = Math.floor(timeLeft / 60);
		const secondsLeft = timeLeft % 60;
		setById('frames-left', `${minutesLeft}:${secondsLeft.toString().padStart(2, '0')}`);
		setById('is-paused', paused);
		getById('blanket').dataset.hidden = !pausedForAugmentChoices;
		getById('game-over').dataset.hidden = framesLeft > 0;
	};

	const update = () => {
		Object.values(data.resources).forEach(resource => {
			resource.quantity += resource.earning / FRAMES_PER_SECOND;
			resource.lifetimeEarnings += resource.earning / FRAMES_PER_SECOND;
		});
	};

	const loop = () => {
		const FRAME_TIME = 1000 / FRAMES_PER_SECOND;

		const currentTime = performance.now();

		const isPaused = !hasStarted || paused || pausedForAugmentChoices || framesLeft <= 0;

		if (!isPaused) {
			const elapsedTime = (currentTime - lastFrameTime) * calculateTimeRate();
			unusedTime += elapsedTime;
		}

		lastFrameTime = currentTime;

		while (unusedTime >= FRAME_TIME && framesLeft > 0) {
			const framesPassed = framesTotal - framesLeft;

			if (augmentTimes.includes(framesPassed)) {
				pausedForAugmentChoices = true;
				setupAugmentChoices();
				augmentTimes.splice(augmentTimes.findIndex(t => t === framesPassed), 1);
				break;
			}

			unusedTime -= FRAME_TIME;
			framesLeft -= 1;

			update();
		}

		visuallyUpdate();

		if (framesLeft > 0) {
			requestAnimationFrame(loop);
		}
	};

	const pageSetup = () => {
		// Set up main
		getById('main').dataset.hidden = false;

		// Set up resources
		const resourceList = getById('resource-list');
		clearChildren(resourceList);

		resources.forEach(({ id: resourceId, name: resourceName, producers, initialQuantity }) => {
			const producerBlock = createElement('div');
			const resourceBlock = createElement('div', {
				id: `${resourceId}-resource`,
				children: [
					createElement('h2', {
						children: [
							createTextNode(resourceName + ': '),
							createElement('span', {
								id: `${resourceId}-quantity`,
								text: intRound(initialQuantity ?? 0),
							}),
						],
					}),
					createElement('h3', {
						children: [
							createTextNode('Earning: '),
							createElement('span', {
								id: `${resourceId}-earning`,
								text: '0',
							}),
							createTextNode('/s'),
						],
					}),
					createElement('div', {
						children: [
							createTextNode('Lifetime earnings: '),
							createElement('span', {
								id: `${resourceId}-lifetime`,
								text: '0',
							}),
						],
					}),
					producerBlock,
				],
			});
			resourceBlock.dataset.hidden = true;

			producers.forEach(({ id, name, outputUnit, ...others }) => {
				const buyButton = createElement('button', {
					id: `${id}-buy`,
					children: [
						createTextNode('Buy'),
						createElement('div', {
							children: [
								createTextNode('Cost: '),
								createElement('span', {
									id: `${id}-price`,
									text: round(others.price),
								}),
								createTextNode(' ' + resourceName),
							],
						}),
					],
				});

				const outputResource = data.resources[outputUnit ?? resourceId];

				const row = createElement(
					'div',
					{
						id: `${id}-producer-row`,
						children: [
							createTextNode(`${name}: `),
							createElement('span', {
								id: `${id}-count`,
								text: '0',
							}),
							createTextNode(', earning: '),
							createElement('span', {
								id: `${id}-earning`,
								text: round(others.earning),
							}),
							createTextNode(` ${outputResource.name}/s each.`),
							buyButton,
						],
					},
				);
				row.dataset.hidden = true;

				producerBlock.appendChild(row);

				data.producers[id] = {
					id,
					name,
					...others,
					profitMulti: 1,
					count: 0,
					outputUnit: outputUnit ?? resourceId,
					costUnit: resourceId,
				};

				buyButton.addEventListener('click', () => {
					if (framesLeft <= 0) {
						return;
					}

					const entry = data.producers[id];

					const resource = data.resources[resourceId];

					if (resource.quantity >= entry.price) {
						hasStarted = true;

						resource.quantity -= entry.price;
						resource.spent += entry.price;
						entry.price *= entry.priceGrowthRate;
						entry.count += 1;
						calculateEarnings();
					}
				});
			});

			resourceList.appendChild(resourceBlock);
		});

		// Set up time box
		const timeKeyBox = getById('time-key-box');
		clearChildren(timeKeyBox);

		TIME_RATES.forEach(({ key }) => {
			const el = document.createElement('key');
			el.textContent = key;

			el.id = `time-key-${key}`;
			timeKeyBox.appendChild(el);
		});

		// Set up augment list
		clearChildren(getById('augment-list'));
		getById('augments').dataset.hidden = true;

		// Set up game over section
		getById('game-over').dataset.hidden = true;

		const onKeyDown = event => {
			if (event.repeat) {
				return;
			}

			if (TIME_KEYS.has(event.key)) {
				timeKeys.add(event.key);
			} else if (event.key === PAUSE_KEY) {
				paused = !paused;
				unusedTime = 0;
			}
		};
		const onKeyUp = event => {
			if (TIME_KEYS.has(event.key)) {
				timeKeys.delete(event.key);
			}
		};
		document.body.addEventListener('keydown', onKeyDown);
		document.body.addEventListener('keyup', onKeyUp);

		replaceNode(getById('game-over-button')).addEventListener('click', () => {
			document.body.removeEventListener('keydown', onKeyDown);
			document.body.removeEventListener('keyup', onKeyUp);
			onComplete(data);
		});
	};

	pageSetup();
	visuallyUpdate();

	requestAnimationFrame(loop);
}

const updatePostGame = crossRoundData => {
	setById('last-round-earnings', intRound(last(crossRoundData.history)));
	setById('lifetime-best', intRound(crossRoundData.lifetimeBest));
	setById('points', intRound(crossRoundData.points));

	if (last(crossRoundData.history) === crossRoundData.lifetimeBest) {
		getById('new-record').dataset.hidden = false;
		setById('new-points-record', intRound(crossRoundData.lastRoundPoints));
		getById('no-record').dataset.hidden = true;
	} else {
		getById('no-record').dataset.hidden = false;
		setById('new-points-normal', intRound(crossRoundData.lastRoundPoints));
		getById('new-record').dataset.hidden = true;
	}

	META_UPGRADES.forEach(upgrade => {
		const button = getById(`${upgrade.id}-button`);
		button.disabled = upgrade.cost > crossRoundData.points;
	});
};

const STATIC_POINTS_MULTI = 1;
const AWARD_POINTS_MULTI = 5;

const META_UPGRADES = [
	{
		id: 'global-multi',
		text: 'Buy 10% more global earnings',
		cost: 10,
		repeatable: true,
		action: (crossRoundData, thisUpgrade) => {
			crossRoundData.globalMulti += 0.1;
			thisUpgrade.cost = Math.floor(thisUpgrade.cost * 1.1);
		},
		currentValueText: (crossRoundData, _thisUpgrade) => {
			return `(Current value: ${intRound(crossRoundData.globalMulti * 100)}%)`
		},
		purchasedTimes: 0,
	},
]

window.addEventListener('load', () => {
	const crossRoundData = {
		lifetimeBest: 1,
		history: [],
		pointsEarned: 0,
		points: 0,
		lastRoundPoints: 0,
		globalMulti: 1,
	};

	let isCurrentSceneActive = false;

	const onComplete = (data) => {
		getById('main').dataset.hidden = true;
		getById('post-game').dataset.hidden = false;

		let newPoints = data.lifetimeEarnings > 1 ? Math.log(data.lifetimeEarnings) * STATIC_POINTS_MULTI : 0;

		if (data.lifetimeEarnings > crossRoundData.lifetimeBest) {
			newPoints += AWARD_POINTS_MULTI * (Math.pow(data.lifetimeEarnings, 1 / 3) - Math.pow(crossRoundData.lifetimeBest, 1 / 3));

			crossRoundData.lifetimeBest = Math.max(data.lifetimeEarnings);
		}

		crossRoundData.pointsEarned += newPoints;
		crossRoundData.points += newPoints;
		crossRoundData.lastRoundPoints = newPoints;

		crossRoundData.history.push(data.lifetimeEarnings);

		updatePostGame(crossRoundData);
		isCurrentSceneActive = true;
	};

	const metaUpgradesList = getById('meta-upgrades');

	META_UPGRADES.forEach(metaUpgrade => {
		const priceTag = createElement('span', { text: intRound(metaUpgrade.cost), id: `${metaUpgrade.id}-price` });
		const currentText = createElement('div', { text: metaUpgrade.currentValueText(crossRoundData, metaUpgrade) });
		const button = createElement('button', {
			id: `${metaUpgrade.id}-button`,
			children: [
				createTextNode(metaUpgrade.text),
				createElement('div', {
					children: [
						createTextNode('Cost: '),
						priceTag,
						createTextNode(' points'),
					],
				}),
				currentText,
			],
		});

		button.addEventListener('click', () => {
			if (!isCurrentSceneActive) {
				return;
			} else if (crossRoundData.points < metaUpgrade.cost) {
				return;
			}

			metaUpgrade.action(crossRoundData, metaUpgrade);
			metaUpgrade.purchasedTimes += 1;

			crossRoundData.points -= metaUpgrade.cost;

			currentText.textContent = metaUpgrade.currentValueText(crossRoundData, metaUpgrade);

			if (!metaUpgrade.repeatable) {
				button.disabled = true;
			} else {
				priceTag.textContent = intRound(metaUpgrade.cost);
			}

			updatePostGame(crossRoundData);
		});

		metaUpgradesList.appendChild(button);
	});

	const startGame = () => {
		main({
			augmentsAfter: [120, 240, 360, 480],
			resources: RESOURCES,
			onComplete,
			globalMulti: crossRoundData.globalMulti,
		});
	};

	getById('new-game').addEventListener('click', () => {
		getById('post-game').dataset.hidden = true;
		isCurrentSceneActive = false;
		startGame();
	});

	startGame();
});
