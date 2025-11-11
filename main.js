const PAUSE_KEY = 'p';

const TIME_RATES = [
	{ key: 'z', multi: 2 },
	{ key: 'x', multi: 3 },
	{ key: 'c', multi: 8 },
	{ key: 'v', multi: 10 },
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

const setupAugmentHeader = content => {
	const header = getById('choice-header');

	if (!content) {
		header.dataset.hidden = true;
		return;
	}
	header.dataset.hidden = false;

	setById('title', content.title, header);
	setById('description', content.description, header);
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

const createQuestUI = (quest, data, onQuestSelect) => {
	const button = createElement('button', {
		children: [
			createElement('h3', { text: quest.title }),
			createElement('div', { text: quest.description }),
		],
	});
	button.addEventListener('click', () => onQuestSelect());

	return button;
};

function main({ resources, globalMulti, quests }) {
	replaceNode(getById('main'));

	let lastFrameTime = performance.now();
	let unusedTime = 0;
	let hasStarted = false;
	let paused = false;
	let pausedForAugmentChoices = false;

	const TIME_KEYS = new Set(TIME_RATES.map(({ key }) => key));
	const timeKeys = new Set();

	const data = {
		framesPassed: 0n,
		producers: {},
		resources: resources.reduce((map, resource) => {
			map[resource.id] = {
				name: resource.name,
				id: resource.id,
				inputUnit: resource.inputUnit,
				quantity: resource.initialQuantity ?? 0,
				earning: 0,
				spent: 0,
				multi: resource.multi ?? 1,
				lifetimeEarnings: 0,
				enabled: false,
				consumers: [],
				paused: false,
			};

			return map;
		}, {}),
		profitMulti: 1,
		selectedAugments: new Set(),
		readyQuests: [],
		readiedQuests: new Set(),
		completedQuests: new Set(),
	};

	resources.forEach(resource => {
		if (resource.inputUnit) {
			data.resources[resource.inputUnit].consumers.push(resource.id);
		}
	});

	const selectRandomAugments = () => {
		const availableAugments = AUGMENTS
			.filter(augment => !data.selectedAugments.has(augment.id))
			.filter(augment => !augment.condition || augment.condition(data));

		const options = selectRandomN(availableAugments, N_CHOICES);

		while (options.length < 3) {
			const randomResource = selectRandomN(Object.values(data.resources).filter(resource => resource.enabled), 1)[0];

			if (!randomResource) {
				throw new Error('Could not find any resources to give for free');
			}

			const quantity = Math.floor(Math.random() * 9) + 2;

			options.push({
				id: `${randomResource.id}-${Math.random()}`,
				title: `Free ${randomResource.name}`,
				description: `Gain a free ${quantity} ${randomResource.name}`,
				action: data => {
					data.resources[randomResource.id].quantity += quantity;
				},
			});
		}

		const result = [];
		result.push(options.splice(Math.floor(Math.random() * 3), 1)[0]);
		result.push(options.splice(Math.floor(Math.random() * 2), 1)[0]);
		result.push(options[0]);

		return result;
	};

	const setupAugmentChoices = ({ augments, headerContent }) => {
		pausedForAugmentChoices = true;

		augments = augments ?? selectRandomAugments();

		setupAugmentHeader(headerContent);

		const onSelect = augment => {
			augment.action(data);
			pausedForAugmentChoices = false;
			data.selectedAugments.add(augment.id);
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

		setupAugment(getById('choice-1'), augments[0], onSelect);
		setupAugment(getById('choice-2'), augments[1], onSelect);
		setupAugment(getById('choice-3'), augments[2], onSelect);
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

		Object.values(data.producers).forEach(targetProducer => {
			const gainRate = Object.values(data.producers).reduce((total, current) => {
				if (current.outputUnit !== targetProducer.id) {
					return total;
				}

				return total + current.earning * current.count * current.profitMulti * targetProducer.gainMulti;
			}, 0);

			targetProducer.gainRate = gainRate * data.profitMulti * globalMulti;
		});
	};

	const visuallyUpdate = () => {
		Object.values(data.resources).forEach(resource => {
			if (resource.quantity > 0) {
				getById(`${resource.id}-resource`).dataset.hidden = false;
				resource.enabled = true;
			}

			setById(`${resource.id}-quantity`, intRound(resource.quantity));
			setById(`${resource.id}-lifetime`, intRound(resource.lifetimeEarnings));

			let earning = 0;
			if (resource.paused) {
				// Earnings are 0
			} else if (resource.inputUnit) {
				const inputResource = data.resources[resource.inputUnit];
				if (resource.earning <= inputResource.earning) {
					earning = resource.earning;
				} else if (resource.earning <= inputResource.quantity) {
					earning = resource.earning;
				} else {
					earning = Math.max(inputResource.earning, inputResource.quantity);
				}
			} else {
				earning = resource.earning;
			}

			setById(`${resource.id}-earning`, intRound(earning));

			const consumedRate = resource.consumers
				.filter(consumer => !data.resources[consumer].paused)
				.map(consumer => data.resources[consumer].earning)
				.reduce((a, b) => a + b, 0);

			getById(`${resource.id}-consumed`).dataset.hidden = consumedRate <= 0;
			setById(`${resource.id}-consumed-rate`, intRound(consumedRate));
		});

		Object.values(data.producers).forEach(entry => {
			const { id } = entry;
			const costResource = data.resources[entry.costUnit];

			if (costResource.quantity >= entry.price) {
				getById(`${id}-producer-row`).dataset.hidden = false;
				entry.enabled = true;
			}

			setById(`${id}-count`, intRound(entry.count));
			setById(`${id}-price`, round(entry.price));

			if (entry.outputUnit in data.resources) {
				const resource = data.resources[entry.outputUnit];
				setById(`${id}-earning`, round(entry.earning * entry.profitMulti * resource.multi * data.profitMulti * globalMulti));
			} else {
				const targetProducer = data.producers[entry.outputUnit];
				setById(`${id}-earning`, round(entry.earning * entry.profitMulti * targetProducer.gainMulti * data.profitMulti * globalMulti));
			}

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
		getById('is-paused').dataset.paused = paused;
		getById('blanket').dataset.hidden = !pausedForAugmentChoices;
	};

	const update = () => {
		Object.values(data.resources).forEach(resource => {
			if (resource.paused) {
				return;
			}

			const shouldProduce = resource.earning / FRAMES_PER_SECOND;
			if (resource.inputUnit) {
				const actualProduce = Math.min(shouldProduce, data.resources[resource.inputUnit].quantity);

				data.resources[resource.inputUnit].quantity -= actualProduce;
				resource.quantity += actualProduce;
				resource.lifetimeEarnings += actualProduce;
			} else {
				resource.quantity += shouldProduce;
				resource.lifetimeEarnings += shouldProduce;
			}
		});
		Object.values(data.producers).forEach(producer => {
			producer.count += producer.gainRate / FRAMES_PER_SECOND;
		});
		quests.forEach(quest => {
			if (data.completedQuests.has(quest.id) || data.readiedQuests.has(quest.id)) {
				return;
			}

			if (quest.condition(data)) {
				data.readyQuests.push(quest);
				data.readiedQuests.add(quest.id);

				const questList = getById('quest-list');

				let button = createQuestUI(quest, data, () => {
					setupAugmentChoices({ augments: quest.choices, headerContent: quest.content });

					if (button) {
						questList.removeChild(button);
					}
					data.completedQuests.add(quest.id);
					data.readiedQuests.delete(quest.id);
				});

				questList.appendChild(button);
			}
		});
	};

	const loop = () => {
		const FRAME_TIME = 1000 / FRAMES_PER_SECOND;

		const currentTime = performance.now();

		const isPaused = !hasStarted || paused || pausedForAugmentChoices;

		if (!isPaused) {
			const elapsedTime = (currentTime - lastFrameTime) * calculateTimeRate();
			unusedTime += elapsedTime;
		}

		lastFrameTime = currentTime;

		while (unusedTime >= FRAME_TIME) {
			unusedTime -= FRAME_TIME;
			data.framesPassed += 1n;

			calculateEarnings();
			update();
		}

		visuallyUpdate();

		requestAnimationFrame(loop);
	};

	const pageSetup = () => {
		// Set up resources
		const resourceList = getById('resource-list');
		clearChildren(resourceList);

		resources.forEach(({ id: resourceId, name: resourceName, producers, initialQuantity, inputUnit }) => {
			const producerBlock = createElement('div');
			const resourcePlayPause = createElement('button');
			resourcePlayPause.classList.add('play-pause');

			resourcePlayPause.dataset.paused = false;
			resourcePlayPause.dataset.hidden = !inputUnit;
			resourcePlayPause.addEventListener('click', () => {
				const nowPaused = !data.resources[resourceId].paused;
				data.resources[resourceId].paused = nowPaused;

				resourcePlayPause.dataset.paused = nowPaused;
			});

			const resourceBlock = createElement('div', {
				id: `${resourceId}-resource`,
				children: [
					createElement('inline', {
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
							resourcePlayPause,
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
							createElement('span', {
								id: `${resourceId}-consumed`,
								children: [
									createTextNode(', '),
									createElement('span', {
										id: `${resourceId}-consumed-rate`,
										text: '0'
									}),
									createTextNode('/s consumed by other resources.')
								],
							}),
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

				const output = outputUnit ?? resourceId;

				const outputName = output in data.producers
					? data.producers[output].name
					: data.resources[output].name;

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
							createTextNode(` ${outputName}/s each.`),
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
					gainMulti: 1,
					gainRate: 0,
					count: 0,
					outputUnit: output,
					costUnit: resourceId,
					enabled: false,
				};

				buyButton.addEventListener('click', () => {
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

		getById('is-paused').addEventListener('click', () => {
			paused = !paused;
		});

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
	};

	pageSetup();
	visuallyUpdate();

	requestAnimationFrame(loop);
}

window.addEventListener('load', () => {
	const crossRoundData = {
		lifetimeBest: 1,
		history: [],
		pointsEarned: 0,
		points: 0,
		lastRoundPoints: 0,
		globalMulti: 1,
	};

	const startGame = () => {
		main({
			resources: RESOURCES,
			globalMulti: 1,
			quests: QUESTS,
		});
	};

	startGame();
});
