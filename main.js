const PRODUCERS = [
    { id: 'workers', earning: 1, price: 20, priceGrowthRate: 1.16, name: 'Workers' },
    { id: 'managers', earning: 4, price: 100, priceGrowthRate: 1.2, name: 'Managers' },
    { id: 'factory', earning: 20, price: 1000, priceGrowthRate: 1.25, name: 'Factories' },
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
        id: 'better-workers',
        title: 'Better workers',
        description: 'Workers produce 100% more money per second.',
        action: data => {
            data.producers['workers'].profitMulti += 1;
        },
    },
    {
        id: 'better-workers-2',
        title: 'Productive workers',
        description: 'Workers produce 80% more money per second.',
        action: data => {
            data.producers['workers'].profitMulti += 0.8;
        },
    },
    {
        id: 'better-factories',
        title: 'Better factories',
        description: 'Factories produce 150% more money per second.',
        action: data => {
            data.producers['factory'].profitMulti += 1.5;
        },
    },
    {
        id: 'profit-bonus',
        title: 'More profit',
        description: 'Earn 20% more profit from all sources.',
        action: data => {
            data.profitMulti += 0.2;
        },
    },
    {
        id: 'factory-price-reset',
        title: 'Factory price reset',
        description: 'Undo all of that inflation! Factory price resets to $1000.',
        action: data => {
            data.producers['factory'].price = 1000;
        },
    },
    {
        id: 'factory-discount',
        title: 'Discount on factories',
        description: 'Halves the price of all factories.',
        action: data => {
            data.producers['factory'].price *= 0.5;
        }
    },
    {
        id: 'worker-cost-scaling',
        title: 'Worker cost scaling',
        description: 'The price of each successive worker only increases at 20% the normal speed.',
        action: data => {
            const growthRate = data.producers['workers'].priceGrowthRate;
            data.producers['workers'].priceGrowthRate = 0.8 * 1 + 0.2 * growthRate;
        },
    },
    {
        id: 'cashback',
        title: 'Cashback program',
        description: 'Get 50% cashback on all money you\'ve spent so far.',
        action: data => {
            const refundAmount = data.moneySpent * 0.5;
            data.money += refundAmount;
            // Intentionally not counting this as money "earned"
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

function main({ augmentsAfter, producers, onComplete }) {
    replaceNode(getById('main'));

    let lastFrameTime = performance.now();
    let unusedTime = 0;
    const framesTotal = 10 * 60 * FRAMES_PER_SECOND;
    let framesLeft = framesTotal;
    let hasStarted = false;
    let paused = false;
    let pausedForAugmentChoices = false;

    const augmentTimes = augmentsAfter.map(time => time * FRAMES_PER_SECOND);

    const TIME_KEYS = new Set(TIME_RATES.map(({ key }) => key));
    const timeKeys = new Set();

    const data = {
        money: 100,
        earning: 0,
        moneySpent: 0,
        profitMulti: 1,
        producers: {},
        selectedAugments: [],
        lifetimeEarnings: 0,
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
        const earning = Object.values(data.producers).reduce((total, current) => {
            return total + current.earning * current.count * current.profitMulti;
        }, 0);

        data.earning = earning * data.profitMulti;
    };

    const visuallyUpdate = () => {
        setById('money', intRound(data.money));
        setById('lifetime-earnings', intRound(data.lifetimeEarnings));
        setById('earning', round(data.earning));

        producers.forEach(({ id }) => {
            const entry = data.producers[id];

            setById(`${id}-count`, entry.count);
            setById(`${id}-earning`, round(entry.earning * entry.profitMulti));
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
        data.money += data.earning / FRAMES_PER_SECOND;
        data.lifetimeEarnings += data.earning / FRAMES_PER_SECOND;
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

        requestAnimationFrame(loop);
    };

    const pageSetup = () => {
        // Set up main
        getById('main').dataset.hidden = false;

        // Set up producers
        const producerList = getById('producer-list');
        clearChildren(producerList);

        producers.forEach(({ id, name, ...others }) => {
            const buyButton = createElement('button', {
                id: `${id}-buy`,
                children: [
                    createTextNode('Buy'),
                    createElement('div', {
                        children: [
                            createTextNode('Cost: $'),
                            createElement('span', {
                                id: `${id}-price`,
                                text: round(others.price),
                            }),
                        ],
                    }),
                ],
            });

            const row = createElement(
                'div',
                {
                    children: [
                        createTextNode(`${name}: `),
                        createElement('span', {
                            id: `${id}-count`,
                            text: '0',
                        }),
                        createTextNode(', earning: $'),
                        createElement('span', {
                            id: `${id}-earning`,
                            text: round(others.earning),
                        }),
                        createTextNode('/s each.'),
                        buyButton,
                    ],
                },
            );

            producerList.appendChild(row);

            data.producers[id] = {
                id,
                name,
                ...others,
                profitMulti: 1,
                count: 0,
            };

            buyButton.addEventListener('click', () => {
                const entry = data.producers[id];

                if (data.money >= entry.price) {
                    hasStarted = true;

                    data.money -= entry.price;
                    data.moneySpent += entry.price;
                    entry.price *= entry.priceGrowthRate;
                    entry.count += 1;
                    calculateEarnings();
                }
            });
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
        replaceNode(getById('game-over-button')).addEventListener('click', () => {
            onComplete(data);
        });
    };

    pageSetup();

    document.body.addEventListener('keydown', event => {
        if (event.repeat) {
            return;
        }

        if (TIME_KEYS.has(event.key)) {
            timeKeys.add(event.key);
        } else if (event.key === PAUSE_KEY) {
            paused = !paused;
            unusedTime = 0;
        }
    });
    document.body.addEventListener('keyup', event => {
        if (TIME_KEYS.has(event.key)) {
            timeKeys.delete(event.key);
        }
    });

    requestAnimationFrame(loop);
}

const updatePostGame = crossRoundData => {
    setById('lifetime-best', intRound(crossRoundData.lifetimeBest));
};

window.addEventListener('load', () => {
    const crossRoundData = {
        lifetimeBest: 0,
        history: [],
    };

    const onComplete = (data) => {
        getById('main').dataset.hidden = true;
        getById('post-game').dataset.hidden = false;

        crossRoundData.lifetimeBest = Math.max(data.lifetimeEarnings);
        crossRoundData.history.push(data.lifetimeEarnings);

        updatePostGame(crossRoundData);
    };

    const startGame = () => {
        main({
            augmentsAfter: [120, 240, 360, 480],
            producers: PRODUCERS,
            onComplete,
        });
    };

    getById('new-game').addEventListener('click', () => {
        getById('post-game').dataset.hidden = true;
        startGame();
    });

    startGame();
});
