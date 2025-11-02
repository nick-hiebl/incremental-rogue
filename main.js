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
        id: 'worker-cost-scaling',
        title: 'Worker cost scaling',
        description: 'The price of each successive worker only increases 90% slower than normal',
        action: data => {
            const growthRate = data.producers['workers'].priceGrowthRate;
            data.producers['workers'].priceGrowthRate = 0.9 * 1 + 0.1 * growthRate;
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

function main({ augmentsAfter, producers }) {
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
        profitMulti: 1,
        producers: {},
        selectedAugments: [],
        lifetimeEarnings: 0,
    };

    const setupAugmentChoices = () => {
        const availableAugments = AUGMENTS.filter(augment => !data.selectedAugments.includes(augment.id));

        const options = availableAugments.reduce((running, current, index) => {
            const stillNeeded = N_CHOICES - running.length;
            const remainingOptions = availableAugments.length - index;
            if (Math.random() < stillNeeded / remainingOptions) {
                return running.concat(current);
            } else {
                return running;
            }
        }, []);

        const onSelect = augment => {
            augment.action(data);
            pausedForAugmentChoices = false;
            data.selectedAugments.push(augment.id);
            calculateEarnings();
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
        setById('money', Math.floor(data.money).toLocaleString());
        setById('lifetime-earnings', Math.floor(data.lifetimeEarnings).toLocaleString());
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
        getById('blanket').dataset.displayed = pausedForAugmentChoices;
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

        while (unusedTime >= FRAME_TIME) {
            const framesPassed = framesTotal - framesLeft;

            if (augmentTimes.includes(framesPassed)) {
                pausedForAugmentChoices = true;
                setupAugmentChoices();
                augmentTimes.splice(augmentTimes.findIndex(t => t === framesPassed), 1);
            }

            unusedTime -= FRAME_TIME;
            framesLeft -= 1;

            update();
        }

        visuallyUpdate();

        requestAnimationFrame(loop);
    };

    const pageSetup = () => {
        // Set up producers
        const producerList = getById('producer-list');
        clearChildren(producerList);

        producers.forEach(({ id, name, ...others }) => {
            const row = document.createElement('div');
            row.appendChild(document.createTextNode(`${name}: `));

            const countNode = document.createElement('span');
            countNode.id = `${id}-count`;
            countNode.textContent = '0';
            row.appendChild(countNode);

            row.appendChild(document.createTextNode(', earning: $'));

            const earningNode = document.createElement('span');
            earningNode.id = `${id}-earning`;
            earningNode.textContent = round(others.earning);
            row.appendChild(earningNode);

            row.appendChild(document.createTextNode('/s each.'));

            const buyButton = document.createElement('button');
            buyButton.id = `${id}-buy`;

            buyButton.appendChild(document.createTextNode('Buy'));

            const descRow = document.createElement('div');
            descRow.appendChild(document.createTextNode('Cost: $'));

            buyButton.appendChild(descRow);

            const priceSpan = document.createElement('span');
            priceSpan.id = `${id}-price`;
            priceSpan.textContent = round(others.price);
            descRow.appendChild(priceSpan);

            row.appendChild(buyButton);

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

window.addEventListener('load', () => {
    const augmentsAfter = [120, 240, 360, 480];
    main({ augmentsAfter, producers: PRODUCERS });
});
